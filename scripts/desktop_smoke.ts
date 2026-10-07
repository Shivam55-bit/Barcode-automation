import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';
import { PDFDocument } from 'pdf-lib';
import { sourceFingerprint } from './release_verification';
import { listPackage } from '@electron/asar';
import type { TextElement, BarcodeElement, LabelTemplate } from '../src/types';
import { SYMBOLOGY_CATALOG, getBarcodeModuleColumns, calculateBarcodeLayout } from '../src/services/barcodeEngine';

const mode = process.argv[2] || 'built';
const loginOnly = process.argv.includes('--login-only');
const workspace = process.cwd();
const sourceDigest = sourceFingerprint();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const root = mkdtempSync(path.join(os.tmpdir(), 'barcodeflow-desktop-smoke-'));
const profile = path.join(root, 'profile');
const dataDir = path.join(profile, 'data');
const evidence = path.join(workspace, 'release-evidence', 'desktop', loginOnly ? 'auth' : `${mode}-${runId}`);
mkdirSync(dataDir, { recursive: true });
mkdirSync(evidence, { recursive: true });
const user = { id: 'release-test-user', name: 'Release Test Operator', email: 'release-test@example.invalid', password: randomBytes(24).toString('hex'), role: 'Admin', status: 'approved', isApproved: true, department: 'QA', avatar: '' };
const legacyUser = { id: 'legacy-test-user', name: 'Legacy Test Operator', email: 'legacy-test@example.invalid', role: 'Admin', department: 'QA', avatar: '' };
const legacyPassword = randomBytes(24).toString('hex');
const initialUsers = loginOnly ? [user, legacyUser,
  { ...legacyUser, id: 'suspended-test-user', email: 'suspended-test@example.invalid', status: 'suspended' },
  { ...legacyUser, id: 'pending-test-user', email: 'pending-test@example.invalid', status: 'pending_approval', isApproved: false },
] : [user];
writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(initialUsers));
const checks: Array<{ id: string; status: string; evidence?: string }> = [];
let application: ElectronApplication | undefined;
let executablePath = path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe');
let args = [path.join(workspace, 'dist-electron', 'main.js')];
let installerDigest: string | undefined;
let splashScreenshotCaptured = false;

async function assertRenderedTextFitsBox(element: ReturnType<Page['locator']>, context: string) {
  const bounds = await element.evaluate(node => {
    const text = node.querySelector<HTMLElement>('[style*="text-align"]');
    if (!text) throw new Error('Rendered text alignment container is missing.');
    const range = document.createRange();
    range.selectNodeContents(text);
    const textBounds = range.getBoundingClientRect();
    const objectBounds = node.getBoundingClientRect();
    return {
      text: { left: textBounds.left, right: textBounds.right, top: textBounds.top, bottom: textBounds.bottom },
      object: { left: objectBounds.left, right: objectBounds.right, top: objectBounds.top, bottom: objectBounds.bottom },
      fontSize: parseFloat(getComputedStyle(text.parentElement!).fontSize),
    };
  });
  assert.ok(Number.isFinite(bounds.fontSize) && bounds.fontSize > 0, `${context}: rendered font size must be positive`);
  assert.ok(bounds.text.left >= bounds.object.left - 1, `${context}: text exceeds the left box edge`);
  assert.ok(bounds.text.right <= bounds.object.right + 1, `${context}: text exceeds the right box edge`);
  assert.ok(bounds.text.top >= bounds.object.top - 1, `${context}: text exceeds the top box edge`);
  assert.ok(bounds.text.bottom <= bounds.object.bottom + 1, `${context}: text exceeds the bottom box edge`);
}

async function launch(profilePath = profile) {
  application = await electron.launch({ executablePath, args, cwd: root, env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profilePath }, timeout: 40000 });
  const firstWindow = await application.firstWindow();
  firstWindow.on('dialog', dialog => {
    console.log(`Desktop dialog (${dialog.type()}): ${dialog.message()}`);
    void dialog.accept().catch(error => console.log(`Dialog already closed: ${error.message}`));
  });
  await firstWindow.waitForLoadState('domcontentloaded');
  if (!splashScreenshotCaptured && firstWindow.url().startsWith('data:text/html')) {
    await firstWindow.screenshot({ path: path.join(evidence, `${mode}-splash.png`) });
    splashScreenshotCaptured = true;
  }
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  const page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  page.on('dialog', dialog => {
    console.log(`Desktop dialog (${dialog.type()}): ${dialog.message()}`);
    void dialog.accept().catch(error => console.log(`Dialog already closed: ${error.message}`));
  });
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  return page;
}

async function signIn(page: Page, credentials: { email: string; password: string } = user) {
  const passwordInput = page.locator('input[type="password"]').first();
  const openDocument = page.getByTitle('Open Document (Ctrl+O)', { exact: true });
  await passwordInput.or(openDocument).first().waitFor({ state: 'visible', timeout: 15000 });
  if (!await openDocument.isVisible()) {
    await page.locator('input[type="email"]').first().fill(credentials.email);
    await passwordInput.fill(credentials.password);
    const loginResponse = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
    await page.locator('button[type="submit"]').first().click();
    assert.equal((await loginResponse).ok(), true, 'Isolated profile sign-in must be accepted by the actual backend');
    await openDocument.waitFor({ state: 'visible', timeout: 15000 });
  }
  await page.keyboard.press('Escape');
}

async function verifyInitialPasswordSetup(page: Page) {
  const candidates = await page.evaluate(() => window.electronAPI.listInitialPasswordAccounts());
  assert.deepEqual(candidates, [{ email: legacyUser.email, name: legacyUser.name }]);
  const originalStore = readFileSync(path.join(dataDir, 'users.json'), 'utf8');
  await application!.evaluate(({ dialog }) => {
    (globalThis as any).passwordSetupConsentCalls = [];
    (dialog as any).showMessageBox = async (_owner: unknown, options: any) => {
      (globalThis as any).passwordSetupConsentCalls.push(options);
      return { response: 0, checkboxChecked: false };
    };
  });
  for (const payload of [
    { email: legacyUser.email, password: '123456' },
    { email: user.email, password: legacyPassword },
    { email: 'pending-test@example.invalid', password: legacyPassword },
    { email: 'suspended-test@example.invalid', password: legacyPassword },
  ]) {
    const result = await page.evaluate(data => window.electronAPI.initializeLegacyPassword(data), payload);
    assert.equal(result.success, false);
  }
  assert.equal(await application!.evaluate(() => (globalThis as any).passwordSetupConsentCalls.length), 0);
  const publicAttempt = await page.request.post(new URL('/api/auth/initialize-legacy-password', page.url()).href,
    { data: { email: legacyUser.email, password: legacyPassword } });
  assert.equal(publicAttempt.status(), 404);
  assert.equal(readFileSync(path.join(dataDir, 'users.json'), 'utf8'), originalStore);
  await page.getByRole('button', { name: 'Set Initial Password', exact: true }).click();
  await page.getByLabel('New Password', { exact: true }).fill(legacyPassword);
  await page.getByLabel('Confirm New Password', { exact: true }).fill(`${legacyPassword}-mismatch`);
  await page.getByRole('button', { name: 'Save Password', exact: true }).click();
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
  await page.getByLabel('Confirm New Password', { exact: true }).fill(legacyPassword);
  await page.getByRole('button', { name: 'Save Password', exact: true }).click();
  await expect(page.getByText('Password setup canceled. Account unchanged.', { exact: true })).toBeVisible();
  assert.equal(readFileSync(path.join(dataDir, 'users.json'), 'utf8'), originalStore);
  const consent = await application!.evaluate(() => (globalThis as any).passwordSetupConsentCalls[0]);
  assert.equal(consent.defaultId, 0);
  assert.equal(consent.cancelId, 0);
  assert.equal(consent.buttons[1], 'Set Password');
  assert.equal(JSON.stringify(consent).includes(legacyPassword), false);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(evidence, `${mode}-password-setup-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await application!.evaluate(({ dialog }) => {
    (dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  await page.getByRole('button', { name: 'Save Password', exact: true }).click();
  await expect(page.getByText('Password saved. Sign in with your new password.', { exact: true })).toBeVisible();
  const storedUsers = JSON.parse(readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  const savedLegacy = storedUsers.find((account: any) => account.id === legacyUser.id);
  assert.match(savedLegacy.passwordHash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(savedLegacy.password, undefined);
  const { passwordHash, ...profileFields } = savedLegacy;
  assert.deepEqual(profileFields, legacyUser);
  assert.deepEqual(storedUsers.filter((account: any) => account.id !== legacyUser.id), initialUsers.filter(account => account.id !== legacyUser.id));
  const overwrite = await page.evaluate(payload => window.electronAPI.initializeLegacyPassword(payload),
    { email: legacyUser.email, password: `${legacyPassword}-overwrite` });
  assert.equal(overwrite.success, false);
  assert.deepEqual(await page.evaluate(() => window.electronAPI.listInitialPasswordAccounts()), []);
  const wrongPassword = await page.request.post(new URL('/api/auth/login', page.url()).href,
    { data: { email: legacyUser.email, password: '123456' } });
  assert.equal(wrongPassword.status(), 401);
  checks.push({ id: 'LEGACY-PASSWORD-SETUP-UI', status: 'passed', evidence: 'Credentialless legacy account: 12-character minimum, mismatch and native Cancel preserve store; protected/pending/suspended accounts rejected; no public setup route; explicit consent stores only scrypt hash and preserves profiles; no overflow at 1280/375px' });
}

async function verifyParagraphWorkflow(page: Page, base: LabelTemplate) {
  const fixturePath = path.join(root, 'paragraph-input.bfl');
  const outputPath = path.join(evidence, `${mode}-paragraph-editable.bfl`);
  const paragraph: TextElement = { ...(base.elements.find(element => element.type === 'text') as TextElement),
    id: 'qa-paragraph', name: 'QA Paragraph', x: 2, y: 2, width: 95.3, height: 50, rotation: 0,
    text: '', textType: 'paragraph', textFormatType: 'paragraph', fontFamily: 'Arial', fontSize: 10,
    fontWeight: 'normal', textAlign: 'left', sizingMode: 'fixed-width', autoSize: false, autoFit: false,
    indentationMode: 'hanging', indentationMm: 25.4, tabStops: [25.4], defaultTabIntervalMm: 25.4,
    dataSources: [
      { id: 'qa-label', name: 'Description label', type: 'embedded', value: 'Description:', valueEncoding: 'raw', enabled: true },
      { id: 'qa-description', name: 'QA description field', type: 'database-field', field: 'qa_description', value: '', valueEncoding: 'raw', enabled: true },
      { id: 'qa-status-label', name: 'Status label', type: 'embedded', value: 'Status:\t', valueEncoding: 'raw', enabled: true },
      { id: 'qa-status', name: 'QA status field', type: 'database-field', field: 'subinventory_status', value: '', valueEncoding: 'raw', enabled: true },
    ] };
  const template: LabelTemplate = { ...base, id: 'qa-paragraph-template', name: 'Synthetic Paragraph QA', elements: [paragraph],
    databaseConnection: undefined, sampleRecords: [
      { qa_description: 'Short QA', subinventory_status: 'Active' },
      { qa_description: 'Synthetic long description with wrapping and hanging indentation. '.repeat(5), subinventory_status: 'Long QA' },
      { qa_description: '', subinventory_status: '' },
      { qa_description: '日本語 café Ω', subinventory_status: 'Unicode QA' },
      { subinventory_status: 'Missing QA' },
    ] };
  writeFileSync(fixturePath, JSON.stringify(serializeBarcodeFlowDocument(template)));
  await application!.evaluate(({ dialog }, paths) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [paths.fixturePath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: paths.outputPath });
  }, { fixturePath, outputPath });
  await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  const object = page.locator('#canvas-el-qa-paragraph');
  await expect(object).toBeVisible();
  await expect(object).toContainText('Short QA');
  await object.click({ button: 'right', position: { x: 12, y: 5 } });
  await page.getByText('Properties...', { exact: true }).click();
  const properties = page.locator('div.fixed.inset-0').filter({ has: page.getByText(/^Text Object Properties/) });
  const editor = properties.locator('textarea').first();
  await expect(editor).toHaveValue('Description:');
  const openCharacters = async (position: number) => {
    await editor.focus();
    await editor.evaluate((node: HTMLTextAreaElement, offset) => node.setSelectionRange(offset, offset), position);
    await properties.getByRole('button', { name: /Special Characters/ }).click();
    const characters = page.locator('div.fixed.inset-0').filter({ has: page.getByText('Insert Symbols or Special Characters', { exact: true }) }).last();
    await characters.getByRole('button', { name: 'Control Characters', exact: true }).click();
    await expect(characters.getByLabel('Character Size', { exact: true })).toBeDisabled();
    return characters;
  };
  let characters = await openCharacters(12);
  await characters.getByRole('row').filter({ has: page.getByText('«HT»', { exact: true }) }).click();
  await characters.getByRole('button', { name: 'Insert', exact: true }).click();
  await characters.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(editor).toHaveValue('Description:\t\t');
  await characters.getByTitle('Close', { exact: true }).click();
  await properties.getByTitle('Undo Character Insertion (Ctrl+Z)', { exact: true }).click();
  await expect(editor).toHaveValue('Description:\t');
  await properties.getByTitle('Redo Character Insertion (Ctrl+Y)', { exact: true }).click();
  await expect(editor).toHaveValue('Description:\t\t');
  await properties.getByTitle('Undo Character Insertion (Ctrl+Z)', { exact: true }).click();
  await properties.getByText('Status:«HT»', { exact: true }).click();
  characters = await openCharacters(0);
  await characters.getByRole('row').filter({ has: page.getByText('«CR»', { exact: true }) }).click();
  await characters.getByRole('button', { name: 'Insert', exact: true }).click();
  await characters.getByText('Close', { exact: true }).click();
  await expect(editor).toHaveValue('\nStatus:\t');
  await properties.getByText('Font', { exact: true }).first().click();
  await properties.getByRole('button', { name: /Font per Data Source/ }).click();
  const fonts = page.locator('div.fixed.inset-0').filter({ has: page.getByText(/^Data Source Fonts/) }).last();
  await fonts.getByText('Description:«HT»', { exact: true }).click();
  await fonts.getByRole('checkbox', { name: 'Override default font for this data source', exact: true }).check();
  await fonts.getByText('Bold', { exact: true }).click();
  await fonts.getByTitle('Close', { exact: true }).click();
  await properties.getByText('Text Format', { exact: true }).click();
  await expect(properties.getByRole('radio', { name: 'Paragraph', exact: true })).toBeChecked();
  await properties.getByRole('button', { name: 'Spacing', exact: true }).click();
  await expect(properties.getByLabel('Paragraph Line Height', { exact: true })).toBeVisible();
  await properties.getByRole('button', { name: 'General', exact: true }).click();
  await expect(properties.getByLabel('Paragraph Width', { exact: true })).toHaveValue('95.3');
  await expect(properties.getByLabel('Indentation Millimetres', { exact: true })).toHaveValue('25.4');
  await expect(properties.locator('[aria-label="Paragraph Sample Preview"] svg')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, `${mode}-paragraph-properties.png`) });
  await properties.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(outputPath)).toBe(true);
  const savedParagraph = deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!;
  const savedText = savedParagraph.elements[0] as TextElement;
  assert.deepEqual(savedText.dataSources!.map(source => source.id), paragraph.dataSources!.map(source => source.id));
  assert.equal(savedText.dataSources![0].value, 'Description:\t');
  assert.equal(savedText.dataSources![2].value, '\rStatus:\t');
  assert.deepEqual(savedText.dataSources![1], paragraph.dataSources![1]);
  assert.deepEqual(savedText.dataSources![3], paragraph.dataSources![3]);
  assert.equal(savedText.dataSources![0].fontStyleOverride!.fontWeight, 'bold');
  assert.equal(savedText.dataSources![0].fontStyleOverride!.fontFamily, undefined);
  for (const expected of ['Synthetic long description', 'Status:', '日本語 café Ω', '[Missing field: qa_description]']) {
    await page.getByTitle('Next Record (Ctrl+PageDown)', { exact: true }).click();
    await expect(object).toContainText(expected);
    await expect(object.locator('svg text').first()).toHaveAttribute('font-weight', 'bold');
  }
  await page.screenshot({ path: path.join(evidence, `${mode}-paragraph-missing-field.png`) });
  await page.getByTitle('Previous Record (Ctrl+PageUp)', { exact: true }).click();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByText('Print Preview', { exact: true }).click();
  await expect(page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true })).toBeVisible();
  await expect(page.locator('[data-paragraph-layout="native"]').last()).toContainText('Short QA');
  await expect(page.locator('[data-paragraph-layout="native"]').last()).not.toContainText('«HT»');
  await expect(page.locator('[data-paragraph-layout="native"]').last()).not.toContainText('«CR»');
  await page.screenshot({ path: path.join(evidence, `${mode}-paragraph-preview.png`) });
  await page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true }).click();
  const pdf = await page.evaluate(async payload => (window as any).barcodeFlow.printers.generatePdf(payload), {
    htmlContent: generateWindowsDriverHtml(savedParagraph, [template.sampleRecords[0]]),
    widthMm: template.dimensions.width, heightMm: template.dimensions.height,
  });
  assert.equal(pdf.success, true, pdf.error);
  writeFileSync(path.join(evidence, `${mode}-paragraph.pdf`), Buffer.from(pdf.base64Data, 'base64'));
  await application!.close();
  application = undefined;
  page = await launch();
  await signIn(page);
  await application!.evaluate(({ dialog }, filePath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, outputPath);
  await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await expect(page.locator('#canvas-el-qa-paragraph')).toContainText('Short QA');
  assert.deepEqual(deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!.elements, savedParagraph.elements);
  checks.push({ id: 'TEXT-PARAGRAPH-SOURCES-UI', status: 'passed', evidence: 'Actual HT/CR caret insertion, repeated Insert, Close/X, local Undo/Redo, four-source preservation, source font override, five record states, preview/PDF and native save/reopen; synthetic fixture, no exact reference-parity claim' });
  return page;
}

try {
  if (mode === 'installed') {
    const installer = path.join(workspace, 'dist-electron-build', 'BarcodeFlow_Setup_Dev_Unsigned.exe');
    assert.ok(existsSync(installer), 'Installer must be built before installed verification');
    installerDigest = createHash('sha256').update(readFileSync(installer)).digest('hex');
    const installation = path.join(root, 'installed');
    execFileSync(installer, ['/S', '/currentuser', `/D=${installation}`], { timeout: 120000 });
    executablePath = path.join(installation, 'BarcodeFlow Enterprise Suite.exe');
    args = [];
    assert.ok(existsSync(executablePath), 'Installer did not create the application executable');
    checks.push({ id: 'INSTALL-001', status: 'passed', evidence: installerDigest });
  } else if (mode === 'packaged') {
    executablePath = path.join(workspace, 'dist-electron-build', 'win-unpacked', 'BarcodeFlow Enterprise Suite.exe');
    args = [];
  }
  assert.ok(existsSync(executablePath), `Executable missing: ${executablePath}`);
  let page = await launch();
  const manifest = await (await page.request.get(new URL('/release-manifest.json', page.url()).href)).json();
  assert.equal(manifest.sourceDigest, sourceDigest, 'Desktop build is stale or was built from different source');
  if (mode !== 'built') assert.equal(await application!.evaluate(({ app }) => app.getVersion()), manifest.version);
  checks.push({ id: 'ARTIFACT-IDENTITY-001', status: 'passed', evidence: `Bundled version ${manifest.version}; current source SHA-256 ${sourceDigest}` });
  if (mode !== 'built') {
    const archive = await application!.evaluate(({ app }) => app.getAppPath());
    const entries = listPackage(archive, { isPack: false }).map(entry => entry.replaceAll(path.sep, '/'));
    for (const file of ['/dist/index.html', '/dist/server.cjs', '/dist/release-manifest.json', '/dist-electron/main.js', '/dist-electron/preload.js', '/node_modules/@google/genai/package.json']) {
      assert.ok(entries.includes(file), `Required packaged resource missing: ${file}`);
    }
    assert.equal(entries.some(entry => entry.includes('/barcode-automation-backend/data/')), false);
    assert.equal(entries.includes('/.env'), false);
    checks.push({ id: 'ARTIFACT-RESOURCES-001', status: 'passed', evidence: 'Actual running ASAR includes frontend, backend, preload, source manifest and runtime dependencies; no working backend data directory or root .env packaged' });
  }
  assert.match(page.url(), /^http:\/\/127\.0\.0\.1:\d+/);
  assert.notEqual(new URL(page.url()).port, '3001');
  const health = await page.request.get(new URL('/api/health', page.url()).href);
  assert.equal((await health.json()).status, 'online');
  checks.push({ id: 'DESK-002', status: 'passed', evidence: 'Private embedded loopback backend; cwd is a clean temporary directory' });
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await expect(page.getByText('BarcodeFlow', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, `${mode}-welcome.png`) });
  checks.push({ id: 'STARTUP-WELCOME-UI', status: 'passed', evidence: `${mode}-splash.png and ${mode}-welcome.png` });
  const welcomePreference = page.getByRole('checkbox', { name: "Don't show this dialog again" });
  await welcomePreference.check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTitle('Open Document (Ctrl+O)', { exact: true })).toBeVisible();
  await expect(page.locator('[id^="canvas-el-"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (window as any).electronAPI.getAppSettings())).toMatchObject({ showWelcomeOnStartup: false });
  checks.push({ id: 'WELCOME-EMPTY-DESIGNER-UI', status: 'passed', evidence: 'Close leaves a blank editable Document1 in the designer' });
  await application!.close();
  application = undefined;
  page = await launch();
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByText('Welcome Screen...', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: "Don't show this dialog again" })).toBeChecked();
  await page.getByRole('checkbox', { name: "Don't show this dialog again" }).uncheck();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await application!.close();
  application = undefined;
  page = await launch();
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, `${mode}-welcome-reenabled.png`) });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push({ id: 'WELCOME-PREFERENCE-RESTART-UI', status: 'passed', evidence: 'Suppress preference persists, Help menu reopens Welcome, and re-enabled preference survives relaunch' });
  await page.locator('button[title^="Logged in as "]').click();
  await page.getByRole('button', { name: /Log Out/ }).click();
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  if (loginOnly) {
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Sign In', exact: true }).click();
  }
  await page.evaluate(email => localStorage.setItem('barcodeflow_pending_users', JSON.stringify([{ email, role: 'Super Admin', status: 'approved', isApproved: true }])), user.email);
  for (const credentials of [
    { email: user.email, password: 'incorrect-release-test-password' },
    { email: 'shivam@gmail.com', password: 'incorrect-release-test-password' },
    { email: 'superadmin@gmail.com', password: 'superadmin@gmail.com' },
  ]) {
    await page.locator('input[type="email"]').first().fill(credentials.email);
    await page.locator('input[type="password"]').first().fill(credentials.password);
    const response = page.waitForResponse(request => request.url().includes('/auth/login') && request.request().method() === 'POST');
    await page.locator('button[type="submit"]').first().click();
    assert.equal((await response).ok(), false);
    await expect(page.getByText('Invalid email address or password.', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
  }
  await page.evaluate(() => localStorage.removeItem('barcodeflow_pending_users'));
  checks.push({ id: 'SEC-AUTH-001', status: 'passed', evidence: 'Invalid passwords, forged local approvals, preset and hard-coded root identities cannot bypass backend authentication' });
  if (loginOnly) {
    await expect(page.getByText('Quick Role Presets (Click to Fill)', { exact: false })).toHaveCount(0);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Login must not overflow ${viewport.width}px viewport`);
      await page.screenshot({ path: path.join(evidence, `${mode}-login-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    checks.push({ id: 'LOGIN-FEEDBACK-LAYOUT-UI', status: 'passed', evidence: 'Actual backend credential message replaces generic 401; fake preset removed; no horizontal overflow at 1280px and 375px' });
    await verifyInitialPasswordSetup(page);
  }
  await signIn(page);
  if (loginOnly) {
    await expect(page.getByTitle('Open Document (Ctrl+O)', { exact: true })).toBeVisible();
    checks.push({ id: 'LOGIN-SUCCESS-UI', status: 'passed', evidence: 'Real isolated backend accepts the approved synthetic account and opens the editor; no authentication bypass' });
    await application!.close();
    application = undefined;
    page = await launch();
    await expect(page.getByRole('button', { name: 'Set Initial Password', exact: true })).toHaveCount(0);
    await signIn(page, { email: legacyUser.email, password: legacyPassword });
    await expect(page.getByTitle('Open Document (Ctrl+O)', { exact: true })).toBeVisible();
    checks.push({ id: 'LEGACY-PASSWORD-COLD-LOGIN-UI', status: 'passed', evidence: 'After fully closing and relaunching Electron, the initialized legacy account signs in through the real backend and opens the editor; setup disappears after initialization' });
    await application!.close();
    application = undefined;
  } else {
  console.log('Visible buttons:', (await page.locator('button:visible').allTextContents()).map(label => label.trim()).filter(Boolean).slice(0, 45).join(' | '));
  await page.screenshot({ path: path.join(evidence, `${mode}-startup.png`) });
  writeFileSync(path.join(evidence, `${mode}-startup.txt`), await page.locator('body').innerText());
  checks.push({ id: 'DESK-003', status: 'passed', evidence: `${mode}-startup.png` });
  const fixture = path.join(workspace, 'public', 'samples', 'release-product.bfl');
  let savedPath = path.join(root, 'shared', 'roundtrip.bfl');
  const original = deserializeBarcodeFlowDocument(readFileSync(fixture, 'utf8')).template!;
  const fixtureDigest = createHash('sha256').update(readFileSync(fixture)).digest('hex');
  if (process.argv.includes('--designer')) page = await verifyParagraphWorkflow(page, original);
  const bartenderPath = path.join(root, 'original.BTW');
  copyFileSync(path.join(workspace, 'public', 'samples', 'AIAG_B10_6.25x5_BMW.btw'), bartenderPath);
  const bartenderDigest = createHash('sha256').update(readFileSync(bartenderPath)).digest('hex');
  const rejectedSave = await page.evaluate(async filePath => (window as any).electronAPI.saveFile(filePath, { format: 'BarcodeFlowDocument', version: 1 }), bartenderPath);
  assert.equal(rejectedSave.success, false);
  assert.match(rejectedSave.error, /cannot overwrite/i);
  assert.equal(createHash('sha256').update(readFileSync(bartenderPath)).digest('hex'), bartenderDigest);
  checks.push({ id: 'DOC-IPC-001', status: 'passed', evidence: 'Actual Electron save IPC rejects .BTW and original binary hash remains unchanged' });
  await application!.evaluate(({ dialog }, paths) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [paths.fixture] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: paths.savedPath });
  }, { fixture, savedPath });
  await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await page.locator('#canvas-el-product-name').waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await page.locator('[id^="canvas-el-"]').count(), original.elements.length);
  await page.locator('#canvas-el-product-name').click();
  await page.keyboard.press('ArrowRight');
  await page.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(savedPath), { timeout: 10000 }).toBe(true);
  const nudged = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
  assert.ok(nudged.elements[0].x > original.elements[0].x);
  assert.equal(nudged.elements[0].y, original.elements[0].y);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements[0].x).toBe(original.elements[0].x);
  await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements[0].x).toBe(nudged.elements[0].x);
  checks.push({ id: 'UI-EDIT-001', status: 'passed', evidence: 'Actual nudge/undo/redo commands and native disk state agree' });
  await page.locator('button[title^="Insert Text Object ("]').click();
  await expect(page.locator('[id^="canvas-el-"]')).toHaveCount(original.elements.length + 1);
  await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements.length).toBe(original.elements.length + 1);
  let saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
  assert.equal(createHash('sha256').update(readFileSync(fixture)).digest('hex'), fixtureDigest);
  await page.screenshot({ path: path.join(evidence, `${mode}-edited.png`) });
  checks.push({ id: 'UI-EDIT-002', status: 'passed', evidence: 'Toolbar insertion persists without changing the shared source' });
  if (process.argv.includes('--designer')) {
    const insertedText = saved.elements.find(element => element.type === 'text' && !original.elements.some(previous => previous.id === element.id))!;
    const selected = page.locator(`#canvas-el-${insertedText.id}`);
    await selected.click();
    const corner = selected.locator('[class*="cursor-nwse-resize"]').last();
    const cornerBounds = await corner.boundingBox();
    assert.ok(cornerBounds, 'Selected text bottom-right green handle must be visible');
    await page.mouse.move(cornerBounds.x + cornerBounds.width / 2, cornerBounds.y + cornerBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(cornerBounds.x + cornerBounds.width / 2 + 35, cornerBounds.y + cornerBounds.height / 2 + 20, { steps: 10 });
    await page.mouse.up();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements.find((element: any) => element.id === insertedText.id).fontSize).toBeGreaterThan((insertedText as any).fontSize);
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    const resizedText = saved.elements.find(element => element.id === insertedText.id)! as TextElement;
    await expect(page.locator('[title="Font Size"] input').first()).toHaveValue(String(Number((resizedText as any).fontSize.toFixed(1))));
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements.find((element: any) => element.id === insertedText.id)).toEqual(insertedText);
    await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).template.elements.find((element: any) => element.id === insertedText.id)).toEqual(resizedText);
    await expect(page.getByTitle('Unsaved Changes', { exact: true })).toHaveCount(0);
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    checks.push({ id: 'TEXT-SCALE-UI-001', status: 'passed', evidence: 'Real bottom-right green handle increases persisted Single Line font size, not only CSS geometry' });
    const readSelected = () => deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!.elements.find(element => element.id === insertedText.id)!;
    const verifyAutoContent = async (elementId: string) => {
      const readText = () => deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!.elements.find(element => element.id === elementId)! as TextElement;
      const originalMode = readText().sizingMode || 'fixed-width';
      await page.getByTitle('Text Sizing Mode', { exact: true }).selectOption('auto-width');
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      const beforeAuto = readText();
      const largerFont = Number((beforeAuto.fontSize + 4).toFixed(1));
      await page.locator('[title="Font Size"] input').first().fill(String(largerFont));
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      const afterAuto = readText();
      assert.equal(afterAuto.sizingMode, 'auto-width');
      assert.equal(afterAuto.fontSize, largerFont);
      assert.ok(afterAuto.width > beforeAuto.width && afterAuto.height > beforeAuto.height, `${beforeAuto.textType}: automatic bounds grow with font size`);
      assert.equal(afterAuto.text, beforeAuto.text);
      await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.deepEqual(readText(), beforeAuto);
      await page.getByTitle('Width in mm', { exact: true }).fill(String(Number((beforeAuto.width + 5).toFixed(1))));
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.equal(readText().sizingMode, 'fixed-width');
      assert.equal(readText().autoSize, false);
      assert.equal(readText().fontSize, beforeAuto.fontSize);
      await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.deepEqual(readText(), beforeAuto);
      await page.getByTitle('Text Sizing Mode', { exact: true }).selectOption(originalMode);
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    };
    await page.evaluate(() => {
      (window as any).resizeEventTrace = [];
      for (const eventType of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
        document.addEventListener(eventType, event => {
          const pointer = event as PointerEvent;
          (window as any).resizeEventTrace.push({ type: eventType, target: (event.target as HTMLElement)?.title, x: pointer.clientX, y: pointer.clientY });
        }, true);
      }
    });
    const restoreSelected = async () => {
      await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect.poll(readSelected).toEqual(resizedText);
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    };
    for (const zoom of [25, 50, 100, 200, 400]) {
      await page.getByRole('button', { name: /^\d+%$/ }).click();
      await page.getByRole('button', { name: `${zoom}%`, exact: true }).click();
      await selected.evaluate(async node => {
        node.getBoundingClientRect();
        await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined)));
      });
      await page.screenshot({ path: path.join(evidence, `${mode}-text-handles-${zoom}.png`) });
      for (const handleName of ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']) {
        const handle = selected.getByTitle(`Resize ${handleName}`, { exact: true });
        const bounds = await handle.boundingBox();
        assert.ok(bounds);
        const pointer = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const hit = await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.closest('[title^="Resize "]')?.getAttribute('title'), pointer);
        assert.equal(hit, `Resize ${handleName}`, `${zoom}% zoom: ${handleName} hit-test ${hit}`);
        await page.mouse.move(pointer.x, pointer.y);
        await page.mouse.down();
        const distance = Math.max(12, (96 / 25.4) * (zoom / 100) * 10);
        await page.mouse.move(pointer.x + (handleName.includes('left') ? -distance : handleName.includes('right') ? distance : 0), pointer.y + (handleName.includes('top') ? -distance : handleName.includes('bottom') ? distance : 0), { steps: 5 });
        await page.mouse.up();
        const pointerTrace = await page.evaluate(() => (window as any).resizeEventTrace.splice(0));
        const renderedGeometry = await selected.evaluate(node => ({ width: (node as HTMLElement).style.width, height: (node as HTMLElement).style.height, left: (node as HTMLElement).style.left, top: (node as HTMLElement).style.top }));
        await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
        await expect.poll(readSelected, { message: `${zoom}% ${handleName}: rendered ${JSON.stringify(renderedGeometry)}; pointer trace ${JSON.stringify(pointerTrace)}` }).not.toEqual(resizedText);
        const changed = readSelected();
        const horizontalAnchor = handleName.includes('left') ? 1 : handleName.includes('right') ? 0 : 0.5;
        const verticalAnchor = handleName.includes('top') ? 1 : handleName.includes('bottom') ? 0 : 0.5;
        assert.ok(Math.abs(changed.x + changed.width * horizontalAnchor - resizedText.x - resizedText.width * horizontalAnchor) < 0.000001, `${zoom}% ${handleName}: horizontal anchor drift`);
        assert.ok(Math.abs(changed.y + changed.height * verticalAnchor - resizedText.y - resizedText.height * verticalAnchor) < 0.000001, `${zoom}% ${handleName}: vertical anchor drift`);
        const corner = handleName.includes('left') || handleName.includes('right');
        const proportional = corner && (handleName.includes('top') || handleName.includes('bottom'));
        if (proportional) {
          assert.ok(Math.abs(changed.width / changed.height - resizedText.width / resizedText.height) < 0.000001);
          assert.equal((changed as TextElement).fontSize, Number((resizedText.fontSize * changed.width / resizedText.width).toFixed(4)), `${zoom}% ${handleName}: proportional font at stored precision`);
        } else {
          assert.equal((changed as TextElement).fontSize, resizedText.fontSize);
        }
        assert.equal((changed as TextElement).sizingMode, 'scale-text');
        await restoreSelected();
      }
      const cancelHandle = await selected.getByTitle('Resize bottom-right', { exact: true }).boundingBox();
      assert.ok(cancelHandle);
      await page.mouse.move(cancelHandle.x + cancelHandle.width / 2, cancelHandle.y + cancelHandle.height / 2);
      await page.mouse.down();
      await page.mouse.move(cancelHandle.x + 30, cancelHandle.y + 20, { steps: 5 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect.poll(readSelected).toEqual(resizedText);
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    }
    checks.push({ id: 'TEXT-HANDLES-ZOOM-UI', status: 'passed', evidence: 'Actual 40 green-handle drags across 25/50/100/200/400%; persisted anchors, proportional corner fonts, unchanged edge fonts, one-step Undo and Escape cancellation verified; screenshots retained' });
    await page.getByRole('button', { name: /^\d+%$/ }).click();
    await page.getByRole('button', { name: '100%', exact: true }).click();
    for (const sizingMode of ['fit-to-box', 'shrink-to-fit']) {
      await page.getByTitle('Text Sizing Mode', { exact: true }).selectOption(sizingMode);
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      const beforeFit = readSelected() as TextElement;
      const fitHandle = await selected.getByTitle('Resize middle-right', { exact: true }).boundingBox();
      assert.ok(fitHandle);
      await page.mouse.move(fitHandle.x + fitHandle.width / 2, fitHandle.y + fitHandle.height / 2);
      await page.mouse.down();
      await page.mouse.move(fitHandle.x + fitHandle.width / 2 - 30, fitHandle.y + fitHandle.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      const afterFit = readSelected() as TextElement;
      assert.equal(afterFit.sizingMode, sizingMode);
      assert.equal(afterFit.fontSize, beforeFit.fontSize, `${sizingMode}: fitting must not overwrite the configured point size`);
      const displayedFit = await page.locator('[title="Font Size"] input').first().inputValue();
      assert.equal(Number(displayedFit), Number(afterFit.fontSize.toFixed(1)));
      await assertRenderedTextFitsBox(selected, sizingMode);
      await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.deepEqual(readSelected(), beforeFit);
    }
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    checks.push({ id: 'TEXT-FIT-MODES-UI', status: 'passed', evidence: 'Fit and shrink modes survive actual edge drags; persisted font, toolbar, canvas CSS, exact Undo and native Save agree' });
    for (const sizingMode of ['fixed-width', 'scale-text', 'shrink-to-fit', 'fit-to-box']) {
      await page.getByTitle('Text Sizing Mode', { exact: true }).selectOption(sizingMode);
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      for (const dimension of ['width', 'height'] as const) {
        const beforeNumeric = readSelected() as TextElement;
        const target = Number((beforeNumeric[dimension] * 0.6).toFixed(1));
        await page.getByTitle(`${dimension === 'width' ? 'Width' : 'Height'} in mm`, { exact: true }).fill(String(target));
        await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
        await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
        const afterNumeric = readSelected() as TextElement;
        assert.equal(afterNumeric.sizingMode, sizingMode, `${sizingMode}: numeric ${dimension} preserves sizing mode`);
        assert.equal(afterNumeric[dimension], target);
        if (sizingMode === 'fixed-width' || sizingMode === 'scale-text') {
          assert.equal(afterNumeric.fontSize, beforeNumeric.fontSize);
        } else {
          assert.equal(afterNumeric.fontSize, beforeNumeric.fontSize,
            `${sizingMode}: numeric geometry edits preserve the configured point size`);
        }
        assert.equal(Number(await page.locator('[title="Font Size"] input').first().inputValue()), Number(afterNumeric.fontSize.toFixed(1)));
        if (sizingMode === 'fit-to-box' || sizingMode === 'shrink-to-fit') {
          await assertRenderedTextFitsBox(selected, `${sizingMode} numeric ${dimension}`);
        }
        await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
        await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
        await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
        assert.deepEqual(readSelected(), beforeNumeric);
      }
    }
    checks.push({ id: 'TEXT-NUMERIC-SIZING-UI', status: 'passed', evidence: 'Eight actual numeric width/height edits preserve Fixed Width/Scale Text/Shrink/Fit modes, synchronize saved/canvas/toolbar fonts and restore exact state with Undo' });
    const textProperties = page.locator('div.fixed.inset-0').filter({ has: page.getByText(/^Text Object Properties/) });
    const openTextProperties = async () => {
      await selected.click({ button: 'right', position: { x: 12, y: 5 } });
      await page.getByText('Properties...', { exact: true }).click();
      await expect(textProperties).toBeVisible();
    };
    for (const sizingMode of ['scale-text', 'fixed-width', 'shrink-to-fit', 'fit-to-box', 'auto-width']) {
      await page.getByTitle('Text Sizing Mode', { exact: true }).selectOption(sizingMode);
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      const beforeProperties = readSelected();
      await openTextProperties();
      await textProperties.getByText('Text Format', { exact: true }).click();
      await textProperties.getByRole('button', { name: 'Auto Size', exact: true }).click();
      const automaticBounds = textProperties.getByRole('checkbox', { name: 'Size Object to Content', exact: true });
      await expect(automaticBounds).toBeChecked({ checked: sizingMode === 'auto-width' });
      await expect(textProperties.getByRole('checkbox', { name: 'Auto Size', exact: true })).toBeChecked({ checked: sizingMode === 'fit-to-box' || sizingMode === 'shrink-to-fit' });
      await page.screenshot({ path: path.join(evidence, `${mode}-properties-${sizingMode}.png`) });
      await textProperties.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.deepEqual(readSelected(), beforeProperties);
    }
    for (const automatic of [false, true]) {
      await openTextProperties();
      await textProperties.getByText('Text Format', { exact: true }).click();
      await textProperties.getByRole('button', { name: 'Auto Size', exact: true }).click();
      await textProperties.getByRole('checkbox', { name: 'Size Object to Content', exact: true }).setChecked(automatic);
      await textProperties.getByRole('button', { name: 'OK', exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      assert.equal((readSelected() as TextElement).sizingMode, automatic ? 'auto-width' : 'fixed-width');
      await expect(page.getByTitle('Text Sizing Mode', { exact: true })).toHaveValue(automatic ? 'auto-width' : 'fixed-width');
    }
    checks.push({ id: 'TEXT-PROPERTIES-MODE-UI', status: 'passed', evidence: 'Five actual sizing-mode/property-checkbox checks preserve native state on Cancel; property toggles commit authoritative modes and synchronize the toolbar' });
    const beforePropertyFit = readSelected() as TextElement;
    const propertyBox = { width: Number((beforePropertyFit.width * 2).toFixed(2)), height: Number((beforePropertyFit.height * 2).toFixed(2)) };
    await openTextProperties();
    await textProperties.getByText('Text Format', { exact: true }).click();
    await textProperties.getByRole('button', { name: 'Auto Size', exact: true }).click();
    await textProperties.getByRole('checkbox', { name: 'Auto Size', exact: true }).check();
    await textProperties.getByLabel('Minimum Font Point Size', { exact: true }).fill('2');
    await textProperties.getByLabel('Maximum Font Point Size', { exact: true }).fill('48');
    await textProperties.getByLabel('Auto Size Object Width', { exact: true }).fill(String(propertyBox.width));
    await textProperties.getByLabel('Auto Size Object Height', { exact: true }).fill(String(propertyBox.height));
    await page.screenshot({ path: path.join(evidence, `${mode}-properties-font-fit.png`) });
    await textProperties.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    const propertyFit = readSelected() as TextElement;
    assert.equal(propertyFit.sizingMode, 'fit-to-box');
    assert.equal(propertyFit.width, propertyBox.width);
    assert.equal(propertyFit.height, propertyBox.height);
    assert.equal(propertyFit.minFontSize, 2);
    assert.equal(propertyFit.maxFontSize, 48);
    assert.equal(propertyFit.fontSize, beforePropertyFit.fontSize, 'Auto Size controls retain the configured base point size');
    await expect(page.getByTitle('Text Sizing Mode', { exact: true })).toHaveValue('fit-to-box');
    await assertRenderedTextFitsBox(selected, 'Text Properties fit-to-box');
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), beforePropertyFit);
    checks.push({ id: 'TEXT-PROPERTIES-FIT-UI', status: 'passed', evidence: 'Reference-observed Auto Size font fitting is separate from content bounds; actual limits and object-box controls synchronize saved dimensions/font, canvas and toolbar, with exact one-step Undo' });
    const beforeSymbolDraft = readSelected() as TextElement;
    const insertSymbolDraft = async () => {
      await openTextProperties();
      await textProperties.getByRole('button', { name: /Special Characters/ }).click();
      const characters = page.locator('div.fixed.inset-0').filter({ has: page.getByText('Insert Symbols or Special Characters', { exact: true }) }).last();
      await expect(characters).toBeVisible();
      await characters.getByRole('button', { name: 'Insert', exact: true }).click();
      await expect(textProperties.locator('textarea').first()).not.toHaveValue(beforeSymbolDraft.text);
      await characters.getByTitle('Close', { exact: true }).click();
      await expect(characters).toBeHidden();
    };
    await insertSymbolDraft();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, `${mode}-special-character-draft.png`) });
    await textProperties.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), beforeSymbolDraft);
    await insertSymbolDraft();
    await textProperties.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.notEqual((readSelected() as TextElement).text, beforeSymbolDraft.text);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), beforeSymbolDraft);
    checks.push({ id: 'TEXT-PROPERTIES-CANCEL-UI', status: 'passed', evidence: 'Actual special-character Insert stays in the properties draft without dirtying the document; Cancel preserves exact native state, OK commits, and one Undo restores the original' });
    await verifyAutoContent(insertedText.id);
    const beforeRotation = readSelected() as TextElement;
    const objectBounds = await selected.boundingBox();
    const rotationBounds = await selected.getByTitle('Rotate object', { exact: true }).boundingBox();
    assert.ok(objectBounds && rotationBounds);
    const center = { x: objectBounds.x + objectBounds.width / 2, y: objectBounds.y + objectBounds.height / 2 };
    const grab = { x: rotationBounds.x + rotationBounds.width / 2 + 2, y: rotationBounds.y + rotationBounds.height / 2 };
    const radius = Math.hypot(grab.x - center.x, grab.y - center.y);
    const startAngle = Math.atan2(grab.y - center.y, grab.x - center.x);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(center.x + radius * Math.cos(startAngle + Math.PI / 3), center.y + radius * Math.sin(startAngle + Math.PI / 3), { steps: 12 });
    await page.mouse.up();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    const rotated = readSelected() as TextElement;
    assert.ok(Math.abs(rotated.rotation - 60) < 0.1, `Off-center rotation jumped: ${rotated.rotation}`);
    assert.deepEqual({ ...rotated, rotation: beforeRotation.rotation }, beforeRotation, 'Rotation must not change geometry, font or content');
    const fixedAnchor = (element: TextElement) => {
      const radians = element.rotation * Math.PI / 180;
      return { x: element.x + element.width / 2 - element.width / 2 * Math.cos(radians) + element.height / 2 * Math.sin(radians), y: element.y + element.height / 2 - element.width / 2 * Math.sin(radians) - element.height / 2 * Math.cos(radians) };
    };
    const rotatedHandle = await selected.getByTitle('Resize bottom-right', { exact: true }).boundingBox();
    assert.ok(rotatedHandle);
    await page.mouse.move(rotatedHandle.x + rotatedHandle.width / 2, rotatedHandle.y + rotatedHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(rotatedHandle.x + rotatedHandle.width / 2 + 40, rotatedHandle.y + rotatedHandle.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    const afterRotatedResize = readSelected() as TextElement;
    assert.notEqual(afterRotatedResize.width, rotated.width);
    assert.equal(afterRotatedResize.rotation, rotated.rotation);
    assert.ok(Math.hypot(fixedAnchor(rotated).x - fixedAnchor(afterRotatedResize).x, fixedAnchor(rotated).y - fixedAnchor(afterRotatedResize).y) < 0.000001, 'Rotated opposite anchor moved');
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), rotated);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), beforeRotation);
    await page.getByTitle('Editable: Click to Lock', { exact: true }).click();
    await expect(selected.locator('[title^="Resize "]')).toHaveCount(0);
    await expect(selected.getByTitle('Rotate object', { exact: true })).toHaveCount(0);
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    const lockedSnapshot = readSelected();
    await selected.hover();
    await page.mouse.down();
    await page.mouse.move(objectBounds.x + 40, objectBounds.y + 30, { steps: 5 });
    await page.mouse.up();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    assert.deepEqual(readSelected(), lockedSnapshot);
    await page.getByTitle('Locked: Click to Unlock & Make Editable', { exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    checks.push({ id: 'TEXT-ROTATE-LOCK-UI', status: 'passed', evidence: 'Off-center blue-handle rotation preserves text/geometry, rotated green resize keeps opposite anchor, separate Undo restores both gestures, locked objects cannot resize/rotate/move' });
    const beforePickerElements = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!.elements;
    await page.getByTitle('Choose Barcode Symbology...', { exact: true }).click();
    await page.getByText('More Barcodes...', { exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Select Barcode', exact: true });
    const barcodeList = picker.getByRole('listbox', { name: 'Barcode symbologies', exact: true });
    const code39Row = picker.getByText('Code 39', { exact: true }).locator('..');
    await code39Row.click();
    await expect(picker.getByText('Preview: Code 39', { exact: true })).toBeVisible();
    const selectedPreview = await picker.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await picker.getByText('Code 128', { exact: true }).hover();
    await expect(picker.getByText('Preview: Code 39', { exact: true })).toBeVisible();
    assert.equal(await picker.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()), selectedPreview);
    const nextSymbology = await code39Row.locator('xpath=following-sibling::div[1]').locator('span').last().textContent();
    try {
      await page.keyboard.press('ArrowDown');
      await expect(picker.getByText(`Preview: ${nextSymbology}`, { exact: true })).toBeVisible();
      await picker.getByText(`All Symbologies (${SYMBOLOGY_CATALOG.length})`, { exact: true }).click();
      const renderedOptions = await barcodeList.getByRole('option').evaluateAll(options => options.map(option => ({ tag: option.tagName, id: (option as HTMLElement).dataset.symbologyId, text: option.textContent })));
      await expect(barcodeList.getByRole('option'), JSON.stringify(renderedOptions)).toHaveCount(SYMBOLOGY_CATALOG.length);
      for (const metadata of SYMBOLOGY_CATALOG) {
        const row = picker.locator(`[role="option"][data-symbology-id="${metadata.id}"]`);
        if (metadata.unsupportedReason) {
          await row.scrollIntoViewIfNeeded();
          const rowBounds = await row.boundingBox();
          assert.ok(rowBounds);
          await page.mouse.click(rowBounds.x + rowBounds.width / 2, rowBounds.y + rowBounds.height / 2);
        } else {
          await row.click();
        }
        await expect(row).toHaveAttribute('aria-selected', 'true');
        await expect(picker.getByText(`Preview: ${metadata.name}`, { exact: true })).toBeVisible();
        if (metadata.unsupportedReason) {
          await expect(row).toHaveAttribute('aria-disabled', 'true');
          await expect(picker.getByRole('alert')).toContainText(metadata.unsupportedReason);
          await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeDisabled();
          await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', '');
        } else {
          await expect(picker.locator('canvas'), metadata.name).toHaveAttribute('data-preview-symbology-id', metadata.id);
          await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeEnabled();
        }
      }
      for (const symbology of ['code39', 'code128', 'datamatrix', 'posicode-b', 'code39']) {
        await picker.locator(`[role="option"][data-symbology-id="${symbology}"]`).click();
      }
      await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', 'code39');
      await picker.getByPlaceholder('Search', { exact: true }).fill('QR Code');
      await expect(barcodeList.getByRole('option', { selected: true })).toContainText('QR Code');
      await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', 'qr');
      await picker.getByPlaceholder('Search', { exact: true }).fill('no-symbology-matches-this');
      await expect(barcodeList.getByRole('option')).toHaveCount(0);
      await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeDisabled();
      await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', '');
    } finally {
      await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    }
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    assert.deepEqual(saved.elements, beforePickerElements, 'Cancel and modal keyboard navigation must leave document objects unchanged');
    await page.getByTitle('Choose Barcode Symbology...', { exact: true }).click();
    await page.getByText('More Barcodes...', { exact: true }).click();
    await picker.getByText('Code 39', { exact: true }).locator('..').click();
    await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', 'code39');
    await page.screenshot({ path: path.join(evidence, `${mode}-barcode-picker-code39.png`) });
    await picker.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    const insertedBarcode = saved.elements.find(element => !beforePickerElements.some(original => original.id === element.id));
    assert.ok(insertedBarcode && insertedBarcode.type === 'barcode');
    assert.equal(insertedBarcode.symbology, 'code39');
    await page.getByTitle('Choose Barcode Symbology...', { exact: true }).click();
    await page.getByText('More Barcodes...', { exact: true }).click();
    await expect(picker.locator('canvas')).toHaveAttribute('data-preview-symbology-id', 'code39');
    await picker.getByRole('option', { name: 'Code 128', exact: true }).dblclick();
    await expect(picker).toBeHidden();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    const withDoubleClick = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    assert.equal(withDoubleClick.elements.length, saved.elements.length);
    const changedBarcode = withDoubleClick.elements.find(element => element.id === insertedBarcode.id);
    assert.ok(changedBarcode && changedBarcode.type === 'barcode');
    assert.equal(changedBarcode.symbology, 'code128');
    saved = withDoubleClick;
    checks.push({ id: 'BARCODE-PICKER-KEYBOARD-UI', status: 'passed', evidence: 'All 32 registry rows: 30 genuine previews and 2 explicitly unavailable. Click/hover/keyboard/rapid selection/filtering/no-results/Cancel invariance/Select/reopen/double-click verified; actual inserted model matches preview ID' });
    for (const [symbology, menuName] of [['code128', 'Code 128'], ['code39', 'Code 39'], ['qr', 'QR Code'], ['datamatrix', 'Data Matrix']]) {
      const previousIds = saved.elements.map(element => element.id);
      const is2D = symbology === 'qr' || symbology === 'datamatrix';
      await page.getByTitle('Choose Barcode Symbology...', { exact: true }).click();
      await page.getByRole('button', { name: `${menuName} ${is2D ? '2D' : '1D'}`, exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      const originalBarcode = saved.elements.find(element => !previousIds.includes(element.id)) as BarcodeElement;
      assert.equal(originalBarcode.symbology, symbology);
      if (is2D) assert.ok(Math.abs(originalBarcode.width - calculateBarcodeLayout(originalBarcode).symbolHeightMm) < 0.000001);
      const barcodeCanvas = page.locator(`#canvas-el-${originalBarcode.id}`);
      const columns = getBarcodeModuleColumns(originalBarcode);
      const barcodeDpi = saved.dimensions.dpi;
      for (const handleName of ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']) {
        const handleBounds = await barcodeCanvas.getByTitle(`Resize ${handleName}`, { exact: true }).boundingBox();
        assert.ok(handleBounds);
        const pointer = { x: handleBounds.x + handleBounds.width / 2, y: handleBounds.y + handleBounds.height / 2 };
        await page.mouse.move(pointer.x, pointer.y);
        await page.mouse.down();
        await page.mouse.move(pointer.x + (handleName.includes('left') ? -35 : handleName.includes('right') ? 35 : 0), pointer.y + (handleName.includes('top') ? -35 : handleName.includes('bottom') ? 35 : 0), { steps: 8 });
        await page.mouse.up();
        await barcodeCanvas.evaluate(node => node.getBoundingClientRect());
        await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
        await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
        const changedBarcode = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!.elements.find(element => element.id === originalBarcode.id) as BarcodeElement;
        assert.notDeepEqual(changedBarcode, originalBarcode, `${symbology} ${handleName}: actual drag must mutate the saved object before Undo`);
        const layout = calculateBarcodeLayout(changedBarcode);
        assert.equal(changedBarcode.value, originalBarcode.value);
        assert.equal(changedBarcode.humanReadableFontSize, originalBarcode.humanReadableFontSize);
        assert.equal(changedBarcode.fontSize, originalBarcode.fontSize);
        if (is2D) assert.ok(Math.abs(changedBarcode.width / layout.symbolHeightMm - originalBarcode.width / calculateBarcodeLayout(originalBarcode).symbolHeightMm) < 0.000001, `${symbology} ${handleName}: distorted modules`);
        if (is2D || handleName.includes('left') || handleName.includes('right')) {
          const moduleDots = changedBarcode.xDimensionMm! * barcodeDpi / 25.4;
          assert.ok(Math.abs(moduleDots - Math.round(moduleDots)) < 0.000001, `${symbology} ${handleName}: fractional printer dots`);
          assert.ok(Math.abs(changedBarcode.width - columns * changedBarcode.xDimensionMm!) < 0.000001);
        }
        assert.ok(Math.abs(changedBarcode.height - layout.totalHeightMm) < 0.000001, `${symbology} ${handleName}: HRT changed the symbol container`);
        if (originalBarcode.quietZone) {
          await expect.poll(() => barcodeCanvas.locator('canvas').evaluate((node, geometry) => {
            const canvas = node as HTMLCanvasElement;
            const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
            let left = canvas.width;
            let right = -1;
            let top = canvas.height;
            let bottom = -1;
            for (let row = 0; row < canvas.height; row++) {
              for (let column = 0; column < canvas.width; column++) {
                const offset = (row * canvas.width + column) * 4;
                if (pixels[offset + 3] > 0 && pixels[offset] < 128 && pixels[offset + 1] < 128 && pixels[offset + 2] < 128) {
                  left = Math.min(left, column);
                  right = Math.max(right, column);
                  top = Math.min(top, row);
                  bottom = Math.max(bottom, row);
                }
              }
            }
            if (right < left) return Infinity;
            const margin = geometry.quietModules * canvas.width / geometry.columns;
            const horizontalError = Math.max(Math.abs(left - margin), Math.abs(canvas.width - right - 1 - margin));
            return geometry.matrix ? Math.max(horizontalError, Math.abs(top - margin), Math.abs(canvas.height - bottom - 1 - margin)) : horizontalError;
          }, { columns, quietModules: symbology === 'qr' ? 4 : symbology === 'datamatrix' ? 1 : 11, matrix: is2D }), { message: `${symbology} ${handleName}: actual canvas quiet zone agrees with module geometry` }).toBeLessThanOrEqual(2);
        }
        await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
        await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
        await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
        assert.deepEqual(deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!.elements.find(element => element.id === originalBarcode.id), originalBarcode);
      }
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    }
    checks.push({ id: 'BARCODE-RESIZE-MODULE-UI', status: 'passed', evidence: '32 actual drags across Code128/Code39/QR/DataMatrix: 2D aspect, whole-dot module widths at label DPI, unchanged HRT/font/payload, actual layout height, native Save and exact Undo verified' });
    checks.push({ id: 'BARCODE-CANVAS-QUIET-UI', status: 'passed', evidence: 'Actual canvas ink boundaries agree with shared module-based quiet zones after all 32 barcode drags; no percentage inset or fake padding assumed' });
    for (const [textType, menuName, editorTitle, content] of [
      ['word-processor', 'Word Processor', 'Word Processor Rich Text Editor', 'TRACE 000101'],
      ['rtf', 'RTF', 'RTF (Rich Text Format) Editor & Inspector', '{\\rtf1\\ansi Batch \\b 000101\\b0\\par Second line}'],
      ['html', 'HTML', 'HTML Markup Container Editor', '<p>Batch <strong>000101</strong></p><p>Second line</p>'],
      ['xaml', 'XAML', 'XAML Text Markup Editor & Inspector', '<TextBlock>Batch <Run FontWeight="Bold" Text="000101"/><LineBreak/>Second line</TextBlock>'],
    ]) {
      const previousIds = saved.elements.map(element => element.id);
      await page.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
      await page.getByText(menuName, { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      const richElement = saved.elements.find(element => !previousIds.includes(element.id)) as TextElement;
      assert.equal(richElement.textType, textType);
      const richCanvas = page.locator(`#canvas-el-${richElement.id}`);
      await richCanvas.dblclick({ position: { x: 12, y: 5 } });
      const richDialog = page.locator('div.fixed.inset-0').filter({ has: page.getByText(editorTitle, { exact: true }) });
      await expect(richDialog).toBeVisible();
      await richDialog.locator('textarea').first().fill(content);
      if (textType === 'word-processor') {
        await richDialog.getByRole('button', { name: '+ Add Fragment', exact: true }).click();
        await richDialog.locator('textarea').nth(1).fill(' SECOND');
      }
      await richDialog.getByRole('button', { name: 'Apply Changes', exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      const editedRich = saved.elements.find(element => element.id === richElement.id) as TextElement;
      assert.ok(editedRich.richContentHtml);
      if (textType === 'word-processor') {
        assert.equal(editedRich.runs?.length, 2);
        assert.equal(editedRich.runs?.[0].text, content);
      } else {
        assert.equal(textType === 'rtf' ? editedRich.rtfRaw : textType === 'xaml' ? editedRich.xamlRaw : editedRich.text, content);
      }
      await expect(richCanvas).toContainText('000101');
    }
    checks.push({ id: 'TEXT-RICH-EDIT-UI', status: 'passed', evidence: 'Actual Word Processor/RTF/HTML/XAML double-click editors apply structured/raw content, update the canvas, and persist native content fields' });
    for (const [textType, menuName] of [['single-line', 'Single Line'], ['multi-line', 'Multi-line'], ['arc', 'Arc'], ['symbol-font', 'Symbol Font Characters']]) {
      const previousIds = saved.elements.map(element => element.id);
      await page.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
      await page.getByText(menuName, { exact: true }).click();
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      const typedElement = saved.elements.find(element => !previousIds.includes(element.id)) as TextElement;
      assert.equal(typedElement.textType, textType);
      const typedCanvas = page.locator(`#canvas-el-${typedElement.id}`);
      await typedCanvas.dblclick({ position: { x: 12, y: 5 } });
      if (textType === 'symbol-font') {
        const symbolDialog = page.locator('div.fixed.inset-0').filter({ has: page.getByText('Insert Symbols or Special Characters', { exact: true }) });
        await expect(symbolDialog).toBeVisible();
        await symbolDialog.getByRole('button', { name: 'Insert', exact: true }).click();
      } else {
        await typedCanvas.locator('textarea').fill(textType === 'multi-line' ? 'TRACE 000101\nSECOND LINE' : 'TRACE 000101');
        await typedCanvas.locator('textarea').press(textType === 'multi-line' ? 'Control+Enter' : 'Enter');
      }
      await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      const editedTyped = saved.elements.find(element => element.id === typedElement.id) as TextElement;
      if (textType === 'symbol-font') assert.equal(editedTyped.symbolUnicode, '\u00a9');
      else assert.equal(editedTyped.text, textType === 'multi-line' ? 'TRACE 000101\nSECOND LINE' : 'TRACE 000101');
      if (textType === 'arc') {
        const arcBounds = await typedCanvas.locator('svg').evaluate(svg => {
          const viewport = (svg as SVGSVGElement).viewBox.baseVal;
          const glyphs = svg.querySelector('text')!.getBBox();
          return { x: glyphs.x, y: glyphs.y, width: glyphs.width, height: glyphs.height, viewportWidth: viewport.width, viewportHeight: viewport.height };
        });
        assert.ok(arcBounds.x >= -0.1 && arcBounds.y >= -0.1 && arcBounds.x + arcBounds.width <= arcBounds.viewportWidth + 0.1 && arcBounds.y + arcBounds.height <= arcBounds.viewportHeight + 0.1, `Arc glyphs clipped: ${JSON.stringify(arcBounds)}`);
      }
      if (textType === 'multi-line') {
        await verifyAutoContent(typedElement.id);
        saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
      }
    }
    checks.push({ id: 'TEXT-BASIC-EDIT-UI', status: 'passed', evidence: 'Actual Single Line/Multi-line/Arc/Symbol editors apply content, preserve native fields, and keep Arc glyph bounds inside the object' });
    checks.push({ id: 'TEXT-AUTO-CONTENT-UI', status: 'passed', evidence: 'Single-line and multi-line Auto Size bounds grow with actual toolbar font changes; numeric width switches to a fixed box; exact Undo and native content preservation verified' });
    const combinedOutput = generateWindowsDriverHtml(saved);
    assert.ok(!combinedOutput.includes('\\rtf1'), 'Windows-driver output must render RTF, not print its source controls');
    assert.ok(!combinedOutput.includes('&lt;TextBlock'), 'Windows-driver output must render XAML, not print escaped XML');
    assert.ok(combinedOutput.includes('<textPath'), 'Arc must remain curved in Windows-driver output');
    await page.getByTitle(/^Insert Shape \(/).click();
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    const regressionDocument = JSON.parse(readFileSync(savedPath, 'utf8'));
    regressionDocument.documentId = 'designer-regression';
    regressionDocument.name = 'Designer Regression';
    const columnWidth = Math.max(70, ...saved.elements.map(element => element.width + 10));
    const rowHeight = Math.max(40, ...saved.elements.map(element => (element.type === 'barcode' ? calculateBarcodeLayout(element).totalHeightMm : element.height) + 10));
    regressionDocument.template = {
      ...saved,
      id: 'designer-regression',
      name: 'Designer Regression',
      dimensions: { ...saved.dimensions, width: columnWidth * 3 + 10, height: rowHeight * Math.ceil(saved.elements.length / 3) + 10, orientation: 'portrait' },
      elements: saved.elements.map((element, index) => ({ ...element, x: 5 + index % 3 * columnWidth, y: 5 + Math.floor(index / 3) * rowHeight })),
    };
    savedPath = path.join(root, 'shared', 'designer-regression.bfl');
    writeFileSync(savedPath, JSON.stringify(regressionDocument, null, 2));
    await application!.evaluate(({ dialog }, filePath) => {
      (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, savedPath);
    await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
    await expect.poll(() => page.locator('#label-canvas-page').evaluate(node => parseFloat((node as HTMLElement).style.width) / parseFloat((node as HTMLElement).style.height))).toBeCloseTo(regressionDocument.template.dimensions.width / regressionDocument.template.dimensions.height, 5);
    await expect(page.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length);
    await page.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
    assert.equal(saved.id, 'designer-regression');
    assert.equal(new Set(saved.elements.filter(element => element.type === 'text').map(element => (element as TextElement).textType).filter(Boolean)).size, 8);
    for (const element of saved.elements) {
      assert.ok(element.x >= 0 && element.y >= 0 && element.x + element.width <= saved.dimensions.width && element.y + element.height <= saved.dimensions.height);
    }
    copyFileSync(savedPath, path.join(evidence, `${mode}-designer-regression.bfl`));
    await page.getByRole('button', { name: /^\d+%$/ }).click();
    await page.getByText('Fit Template in Window', { exact: true }).click();
    const pageCanvas = page.locator('#label-canvas-page');
    const canvasViewport = pageCanvas.locator('xpath=../..');
    const fitButton = page.getByTitle('Fit Template in Window (F3)', { exact: true });
    const assertFitsCurrent = async () => {
      await expect.poll(async () => {
        const fitted = await pageCanvas.boundingBox();
        const usable = await canvasViewport.boundingBox();
        return !!fitted && !!usable &&
          fitted.x >= usable.x + 20 &&
          fitted.y >= usable.y + 20 &&
          fitted.x + fitted.width <= usable.x + usable.width - 20 &&
          fitted.y + fitted.height <= usable.y + usable.height - 20 &&
          Math.abs(fitted.x + fitted.width / 2 - usable.x - usable.width / 2) < 3 &&
          Math.abs(fitted.y + fitted.height / 2 - usable.y - usable.height / 2) < 3;
      }).toBe(true);
      const fitted = await pageCanvas.boundingBox();
      const usable = await canvasViewport.boundingBox();
      assert.ok(fitted && usable, 'Fit command must target a mounted canvas viewport');
      assert.ok(fitted.x >= usable.x + 20, 'Fit command must keep the label inside the viewport on the left');
      assert.ok(fitted.y >= usable.y + 20, 'Fit command must keep the label inside the viewport at the top');
      assert.ok(fitted.x + fitted.width <= usable.x + usable.width - 20, 'Fit command must keep the label inside the viewport on the right');
      assert.ok(fitted.y + fitted.height <= usable.y + usable.height - 20, 'Fit command must keep the label inside the viewport at the bottom');
      assert.ok(Math.abs(fitted.x + fitted.width / 2 - (usable.x + usable.width / 2)) < 3, 'Fit command must center the template horizontally');
      assert.ok(Math.abs(fitted.y + fitted.height / 2 - (usable.y + usable.height / 2)) < 3, 'Fit command must center the template vertically');
      return { fitted, usable };
    };
    const fitAndCheck = async () => {
      await fitButton.click();
      return assertFitsCurrent();
    };

    const toolbarFit = await fitAndCheck();
    await page.screenshot({ path: path.join(evidence, `${mode}-view-fit-template.png`) });
    await page.getByTitle('Zoom In (Ctrl++)', { exact: true }).click();
    await page.keyboard.press('F3');
    const f3Fit = await assertFitsCurrent();
    assert.ok(
      Math.abs(f3Fit.fitted.width - toolbarFit.fitted.width) < 2,
      `F3 and toolbar Fit must produce identical template scale (toolbar=${toolbarFit.fitted.width}x${toolbarFit.fitted.height}, F3=${f3Fit.fitted.width}x${f3Fit.fitted.height})`,
    );
    assert.ok(
      Math.abs(f3Fit.fitted.height - toolbarFit.fitted.height) < 2,
      `F3 and toolbar Fit must produce identical template scale (toolbar=${toolbarFit.fitted.width}x${toolbarFit.fitted.height}, F3=${f3Fit.fitted.width}x${f3Fit.fitted.height})`,
    );
    await page.keyboard.down('Space');
    await page.mouse.move(f3Fit.usable.x + 5, f3Fit.usable.y + 5);
    await page.mouse.down();
    await page.mouse.move(f3Fit.usable.x + 45, f3Fit.usable.y + 30, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.keyboard.press('F3');
    const f3AfterPan = await assertFitsCurrent();
    assert.ok(Math.abs(f3AfterPan.fitted.x - toolbarFit.fitted.x) < 1, 'F3 must reset pan as well as zoom');
    assert.ok(Math.abs(f3AfterPan.fitted.y - toolbarFit.fitted.y) < 1, 'F3 must reset pan as well as zoom');
    const originalWindowSize = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    await page.setViewportSize({
      width: Math.max(900, originalWindowSize.width - 180),
      height: Math.max(700, originalWindowSize.height - 120),
    });
    await expect.poll(async () => {
      const fitted = await pageCanvas.boundingBox();
      const usable = await canvasViewport.boundingBox();
      return !!fitted && !!usable &&
        fitted.x >= usable.x + 20 && fitted.y >= usable.y + 20 &&
        fitted.x + fitted.width <= usable.x + usable.width - 20 &&
        fitted.y + fitted.height <= usable.y + usable.height - 20;
    }).toBe(true);
    await page.setViewportSize(originalWindowSize);
    await expect.poll(async () => {
      const fitted = await pageCanvas.boundingBox();
      const usable = await canvasViewport.boundingBox();
      return !!fitted && !!usable &&
        Math.abs(fitted.x + fitted.width / 2 - usable.x - usable.width / 2) < 3 &&
        Math.abs(fitted.y + fitted.height / 2 - usable.y - usable.height / 2) < 3;
    }).toBe(true);
    await page.screenshot({ path: path.join(evidence, `${mode}-view-fit-template-f3.png`) });
    checks.push({ id: 'VIEW-FIT-001', status: 'passed', evidence: 'Toolbar and F3 use the measured canvas viewport, restore the whole template after manual zoom, and center it with padding' });

    const templateBytesBeforeViewportGestures = readFileSync(savedPath);
    const selectedTarget = page.locator('[id^="canvas-el-"]').first();
    await selectedTarget.click();
    const selectedTargetId = await selectedTarget.getAttribute('id');
    assert.ok(selectedTargetId);
    const selectedHandle = page.locator(`#${selectedTargetId}`).getByTitle('Resize bottom-right', { exact: true });
    await expect(selectedHandle).toBeVisible();

    const directionPairs = [
      [0.2, 0.2, 0.65, 0.62],
      [0.65, 0.62, 0.2, 0.2],
      [0.65, 0.2, 0.2, 0.62],
      [0.2, 0.62, 0.65, 0.2],
    ] as const;
    for (const [startXRatio, startYRatio, endXRatio, endYRatio] of directionPairs) {
      await fitButton.click();
      await assertFitsCurrent();
      const startPage = await pageCanvas.boundingBox();
      const startViewport = await canvasViewport.boundingBox();
      assert.ok(startPage && startViewport);
      const startX = startPage.x + startXRatio * startPage.width;
      const startY = startPage.y + startYRatio * startPage.height;
      const endX = startPage.x + endXRatio * startPage.width;
      const endY = startPage.y + endYRatio * startPage.height;
      const normalizedLeft = Math.min(startXRatio, endXRatio);
      const normalizedTop = Math.min(startYRatio, endYRatio);
      const normalizedWidth = Math.abs(endXRatio - startXRatio);
      const normalizedHeight = Math.abs(endYRatio - startYRatio);
      const beforeViewBytes = readFileSync(savedPath);
      const selectedHandleCount = await page.locator(`#${selectedTargetId}`).getByTitle('Resize bottom-right', { exact: true }).count();

      const zoomRectangleButton = page.getByTitle('Zoom to Rectangle', { exact: true });
      await zoomRectangleButton.click();
      await expect(canvasViewport).toHaveClass(/cursor-crosshair/);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 8 });
      await expect(page.getByTestId('zoom-rectangle-overlay')).toBeVisible();
      if (startXRatio === 0.2 && startYRatio === 0.2) {
        await page.screenshot({ path: path.join(evidence, `${mode}-view-zoom-rectangle-selection.png`) });
      }
      await page.mouse.up();
      await expect(page.getByTestId('zoom-rectangle-overlay')).toHaveCount(0);
      await expect(zoomRectangleButton).not.toHaveClass(/bg-blue-100/);
      await expect.poll(async () => {
        const pageBounds = await pageCanvas.boundingBox();
        const viewportBounds = await canvasViewport.boundingBox();
        if (!pageBounds || !viewportBounds) return false;
        const selectedCenterX = pageBounds.x + (normalizedLeft + normalizedWidth / 2) * pageBounds.width;
        const selectedCenterY = pageBounds.y + (normalizedTop + normalizedHeight / 2) * pageBounds.height;
        return Math.abs(selectedCenterX - (viewportBounds.x + viewportBounds.width / 2)) < 6 &&
          Math.abs(selectedCenterY - (viewportBounds.y + viewportBounds.height / 2)) < 6;
      }).toBe(true);
      const zoomedPage = await pageCanvas.boundingBox();
      const zoomedViewport = await canvasViewport.boundingBox();
      assert.ok(zoomedPage && zoomedViewport);
      const selectedRegionCenterX = zoomedPage.x + (normalizedLeft + normalizedWidth / 2) * zoomedPage.width;
      const selectedRegionCenterY = zoomedPage.y + (normalizedTop + normalizedHeight / 2) * zoomedPage.height;
      assert.ok(
        Math.abs(selectedRegionCenterX - (zoomedViewport.x + zoomedViewport.width / 2)) < 6,
        `Zoomed rectangle must be horizontally centered (selection=${selectedRegionCenterX}, viewport=${zoomedViewport.x + zoomedViewport.width / 2}, page=${JSON.stringify(zoomedPage)}, viewportBounds=${JSON.stringify(zoomedViewport)}, ratios=${JSON.stringify([normalizedLeft, normalizedWidth])})`,
      );
      assert.ok(
        Math.abs(selectedRegionCenterY - (zoomedViewport.y + zoomedViewport.height / 2)) < 6,
        `Zoomed rectangle must be vertically centered (selection=${selectedRegionCenterY}, viewport=${zoomedViewport.y + zoomedViewport.height / 2})`,
      );
      const selectionWidthPx = normalizedWidth * zoomedPage.width;
      const selectionHeightPx = normalizedHeight * zoomedPage.height;
      assert.ok(
        Math.abs(selectionWidthPx - (zoomedViewport.width - 48)) < 5 ||
        Math.abs(selectionHeightPx - (zoomedViewport.height - 48)) < 5,
        'Zoomed rectangle must fill one usable viewport dimension without distorting aspect ratio',
      );
      assert.equal(readFileSync(savedPath).compare(beforeViewBytes), 0, 'Zoom gesture must not modify the saved document');
      assert.equal(await page.locator(`#${selectedTargetId}`).getByTitle('Resize bottom-right', { exact: true }).count(), selectedHandleCount, 'Zoom gesture must preserve object selection');
      await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
      if (startXRatio === 0.2 && startYRatio === 0.2) {
        await page.screenshot({ path: path.join(evidence, `${mode}-view-zoom-to-rectangle.png`) });
      }
    }

    await fitButton.click();
    await assertFitsCurrent();
    const beforeEscapeFit = await pageCanvas.boundingBox();
    await page.getByTitle('Zoom to Rectangle', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('zoom-rectangle-overlay')).toHaveCount(0);
    await expect(page.getByTitle('Zoom to Rectangle', { exact: true })).not.toHaveClass(/bg-blue-100/);
    const afterEscapeFit = await pageCanvas.boundingBox();
    assert.ok(
      beforeEscapeFit && afterEscapeFit && Math.abs(beforeEscapeFit.width - afterEscapeFit.width) < 2,
      `Escape must cancel the rectangle tool without changing zoom (before=${beforeEscapeFit?.width}, after=${afterEscapeFit?.width})`,
    );

    await page.getByTitle('Zoom to Rectangle', { exact: true }).click();
    await page.evaluate(() => {
      (window as any).__zoomRectPointerId = null;
      window.addEventListener('pointerdown', (event) => {
        (window as any).__zoomRectPointerId = event.pointerId;
      }, { capture: true, once: true });
    });
    const cancelViewport = await canvasViewport.boundingBox();
    assert.ok(cancelViewport);
    await page.mouse.move(cancelViewport.x + 35, cancelViewport.y + 35);
    await page.mouse.down();
    await page.mouse.move(cancelViewport.x + 120, cancelViewport.y + 100);
    await expect(page.getByTestId('zoom-rectangle-overlay')).toBeVisible();
    const capturedPointerId = await page.evaluate(() => (window as any).__zoomRectPointerId);
    assert.equal(typeof capturedPointerId, 'number');
    await canvasViewport.evaluate((node, pointerId) => {
      node.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        pointerId,
        clientX: 0,
        clientY: 0,
      }));
    }, capturedPointerId);
    await page.mouse.up();
    await expect(page.getByTestId('zoom-rectangle-overlay')).toHaveCount(0);
    await expect(page.getByTitle('Zoom to Rectangle', { exact: true })).not.toHaveClass(/bg-blue-100/);

    const beforeTinyDrag = await pageCanvas.boundingBox();
    const tinyStart = await canvasViewport.boundingBox();
    assert.ok(beforeTinyDrag && tinyStart);
    await page.getByTitle('Zoom to Rectangle', { exact: true }).click();
    await page.mouse.move(tinyStart.x + 30, tinyStart.y + 30);
    await page.mouse.down();
    await page.mouse.move(tinyStart.x + 33, tinyStart.y + 33);
    await page.mouse.up();
    const afterTinyDrag = await pageCanvas.boundingBox();
    assert.ok(beforeTinyDrag && afterTinyDrag && Math.abs(beforeTinyDrag.width - afterTinyDrag.width) < 1, 'Tiny drag must not create extreme zoom');

    await fitButton.click();
    await assertFitsCurrent();
    const releaseViewport = await canvasViewport.boundingBox();
    assert.ok(releaseViewport);
    await page.getByTitle('Zoom to Rectangle', { exact: true }).click();
    await page.mouse.move(releaseViewport.x + 40, releaseViewport.y + 40);
    await page.mouse.down();
    await page.mouse.move(releaseViewport.x + releaseViewport.width + 80, releaseViewport.y + releaseViewport.height + 80, { steps: 10 });
    await expect(page.getByTestId('zoom-rectangle-overlay')).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId('zoom-rectangle-overlay')).toHaveCount(0);
    assert.equal(readFileSync(savedPath).compare(templateBytesBeforeViewportGestures), 0, 'Zoom rectangle, cancellation, and release outside viewport must leave document bytes unchanged');
    await expect(page.locator('[title="Unsaved Changes"]')).toHaveCount(0);
    checks.push({ id: 'VIEW-ZOOM-RECT-001', status: 'passed', evidence: 'Four drag directions, active crosshair, visible overlay, centered aspect-preserving fit, Escape, tiny drag, captured outside release, selection preservation, and unchanged native bytes verified' });
    await page.screenshot({ path: path.join(evidence, `${mode}-designer-regression-canvas.png`) });
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByText('Print Preview', { exact: true }).click();
    const closeCombinedPreview = page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true });
    await expect(closeCombinedPreview).toBeVisible();
    for (const textElement of saved.elements.filter(element => element.type === 'text') as TextElement[]) {
      const previewSlot = page.locator(`[data-preview-element-id="${textElement.id}"]`);
      await expect(previewSlot).toBeVisible();
      if (['word-processor', 'rtf', 'html', 'xaml'].includes(textElement.textType!)) {
        await expect(previewSlot).toContainText('000101');
        await expect(previewSlot).not.toContainText('\\rtf1');
        await expect(previewSlot).not.toContainText('<TextBlock');
        await expect(previewSlot).not.toContainText('<p>');
        if (textElement.textType !== 'word-processor') await expect(previewSlot).toContainText('Batch 000101');
      }
      if (textElement.textType === 'arc') {
        await expect(previewSlot.locator('textPath')).toHaveCount(1);
        const arcFits = await previewSlot.locator('svg').evaluate(svg => {
          const bounds = svg.querySelector('text')!.getBBox();
          const viewport = (svg as SVGSVGElement).viewBox.baseVal;
          return bounds.x >= -0.1 && bounds.y >= -0.1 && bounds.x + bounds.width <= viewport.width + 0.1 && bounds.y + bounds.height <= viewport.height + 0.1;
        });
        assert.ok(arcFits, 'Actual Print Preview Arc glyphs remain inside the object bounds');
      }
    }
    checks.push({ id: 'TEXT-PREVIEW-MARKUP-UI', status: 'passed', evidence: 'Actual Print Preview renders Word Processor/RTF/HTML/XAML content rather than source controls, and retains curved Arc text with unclipped glyph bounds' });
    await page.screenshot({ path: path.join(evidence, `${mode}-designer-regression-preview.png`) });
    await closeCombinedPreview.click();
    const regressionPdf = await page.evaluate(async payload => (window as any).barcodeFlow.printers.generatePdf(payload), {
      htmlContent: generateWindowsDriverHtml(saved), widthMm: saved.dimensions.width, heightMm: saved.dimensions.height,
    });
    assert.equal(regressionPdf.success, true, regressionPdf.error);
    const regressionPdfBytes = Buffer.from(regressionPdf.base64Data, 'base64');
    const regressionPdfDocument = await PDFDocument.load(regressionPdfBytes);
    assert.equal(regressionPdfDocument.getPageCount(), 1);
    assert.ok(Math.abs(regressionPdfDocument.getPage(0).getWidth() - saved.dimensions.width * 72 / 25.4) < 1);
    assert.ok(Math.abs(regressionPdfDocument.getPage(0).getHeight() - saved.dimensions.height * 72 / 25.4) < 1);
    writeFileSync(path.join(evidence, `${mode}-designer-regression.pdf`), regressionPdfBytes);
    checks.push({ id: 'DESIGNER-COMBINED-OUTPUT-UI', status: 'passed', evidence: 'UI-created eight text types, four barcode symbologies, shape/image retained in non-overlapping native regression label; real Open/Save/Print Preview and Electron virtual PDF geometry verified; editable BFL, screenshots and PDF retained' });
  }
  await application!.close();
  application = undefined;
  const restarted = await launch();
  await signIn(restarted);
  await application!.evaluate(({ dialog }, filePath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, savedPath);
  await restarted.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await restarted.locator('#canvas-el-product-name').waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await restarted.locator('[id^="canvas-el-"]').count(), saved.elements.length);
  const reopenedDisk = await restarted.evaluate(async filePath => (window as any).electronAPI.readFile(filePath), savedPath);
  assert.equal(reopenedDisk.success, true);
  const reopened = deserializeBarcodeFlowDocument(reopenedDisk.document).template!;
  assert.deepEqual(reopened, saved);
  await restarted.screenshot({ path: path.join(evidence, `${mode}-reopened.png`) });
  checks.push({ id: 'UI-ROUNDTRIP-001', status: 'passed', evidence: 'Editable objects and semantic state survive Electron restart and real IPC reopen' });
  for (const sampleName of ['product', 'shipping', 'inventory', 'expiry', 'data', 'mixed']) {
    const samplePath = path.join(root, 'shared', `release-${sampleName}.bfl`);
    copyFileSync(path.join(workspace, 'public', 'samples', `release-${sampleName}.bfl`), samplePath);
    const sample = deserializeBarcodeFlowDocument(readFileSync(samplePath, 'utf8')).template!;
    await application!.evaluate(({ dialog }, filePath) => {
      (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, samplePath);
    await restarted.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
    await expect(restarted.locator('[id^="canvas-el-"]')).toHaveCount(sample.elements.length);
    if (sampleName === 'expiry') await expect(restarted.locator('#canvas-el-expiry')).toContainText('17/12/2026');
    if (sampleName === 'product') {
      await expect.poll(() => restarted.locator('#canvas-el-product-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    await expect.poll(() => restarted.locator('#canvas-el-product-barcode canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
        if (pixels[pixelIndex + 3] > 0 && pixels[pixelIndex] < 128 && pixels[pixelIndex + 1] < 128 && pixels[pixelIndex + 2] < 128) ink++;
      }
      return ink;
    })).toBeGreaterThan(100);
    await restarted.screenshot({ path: path.join(evidence, `${mode}-${sampleName}.png`) });
    if (sampleName === 'data') {
      await restarted.getByRole('button', { name: 'File', exact: true }).click();
      await restarted.getByText('Print Preview', { exact: true }).click();
      const closePreview = restarted.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true });
      await expect(closePreview).toBeVisible();
      await restarted.screenshot({ path: path.join(evidence, `${mode}-preview.png`) });
      await closePreview.click();
      await expect(closePreview).toBeHidden();
      await expect(restarted.locator('[id^="canvas-el-"]')).toHaveCount(sample.elements.length);
      checks.push({ id: 'UI-PREVIEW-001', status: 'passed', evidence: 'Actual File menu opens preview and Close restores editor; no Print command or physical job submitted' });
    }
    const html = generateWindowsDriverHtml(sample, sample.sampleRecords);
    const pdfResult = await restarted.evaluate(async payload => (window as any).barcodeFlow.printers.generatePdf(payload), {
      htmlContent: html, widthMm: sample.dimensions.width, heightMm: sample.dimensions.height,
    });
    assert.equal(pdfResult.success, true, pdfResult.error);
    const pdfBytes = Buffer.from(pdfResult.base64Data, 'base64');
    const pdf = await PDFDocument.load(pdfBytes);
    assert.equal(pdf.getPageCount(), sample.sampleRecords.length);
    const pageSize = pdf.getPage(0).getSize();
    assert.ok(Math.abs(pageSize.width - sample.dimensions.width * 72 / 25.4) < 1);
    assert.ok(Math.abs(pageSize.height - sample.dimensions.height * 72 / 25.4) < 1);
    writeFileSync(path.join(evidence, `${mode}-${sampleName}.pdf`), pdfBytes);
    checks.push({ id: `E2E-${sampleName.toUpperCase()}`, status: 'passed', evidence: 'Actual canvas pixels/assets and Electron virtual-PDF physical page geometry verified' });
  }
  await application!.evaluate(({ dialog }, filePath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, savedPath);
  await restarted.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await expect(restarted.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length);
  assert.deepEqual(deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template, saved);
  checks.push({ id: 'UI-MULTIDOC-001', status: 'passed', evidence: 'Returning to an edited native file after opening a separate same-ID copy preserves its independent object state and saved source' });
  const portablePath = path.join(root, 'shared', 'edited-product.portable.bfl');
  await application!.evaluate(({ dialog }, filePath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath });
  }, portablePath);
  await restarted.getByRole('button', { name: 'File', exact: true }).click();
  await restarted.getByText('Export Portable Editable Template (.bfl)...', { exact: true }).click();
  await expect.poll(() => existsSync(portablePath)).toBe(true);
  const portable = JSON.parse(readFileSync(portablePath, 'utf8'));
  assert.deepEqual(portable.template.elements, saved.elements);
  assert.deepEqual(portable.template.sampleRecords, [{}]);
  assert.equal(portable.dependencies.credentialsIncluded, false);
  const portableDigest = createHash('sha256').update(readFileSync(portablePath)).digest('hex');
  const nativeUpdatedAt = JSON.parse(readFileSync(savedPath, 'utf8')).metadata.updatedAt;
  await restarted.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => JSON.parse(readFileSync(savedPath, 'utf8')).metadata.updatedAt).not.toBe(nativeUpdatedAt);
  assert.equal(createHash('sha256').update(readFileSync(portablePath)).digest('hex'), portableDigest);
  checks.push({ id: 'UI-PORTABLE-001', status: 'passed', evidence: 'Real File export writes a separate portable editable file, strips sample data, preserves object state, and does not redirect normal Save' });
  await application!.close();
  application = undefined;
  const receiverProfile = path.join(root, 'receiver-profile');
  mkdirSync(path.join(receiverProfile, 'data'), { recursive: true });
  writeFileSync(path.join(receiverProfile, 'data', 'users.json'), JSON.stringify([user]));
  const receiver = await launch(receiverProfile);
  await signIn(receiver);
  const receiverSavedPath = path.join(root, 'receiver-documents', 'edited-copy.bfl');
  await application!.evaluate(({ dialog }, files) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [files.portablePath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: files.receiverSavedPath });
  }, { portablePath, receiverSavedPath });
  await receiver.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await expect(receiver.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length);
  await expect.poll(() => receiver.locator('#canvas-el-product-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await receiver.locator('button[title^="Insert Text Object ("]').click();
  await expect(receiver.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length + 1);
  await receiver.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(receiverSavedPath)).toBe(true);
  const received = JSON.parse(readFileSync(receiverSavedPath, 'utf8'));
  assert.equal(received.template.elements.length, saved.elements.length + 1);
  assert.deepEqual(received.dependencies, portable.dependencies);
  assert.equal(createHash('sha256').update(readFileSync(portablePath)).digest('hex'), portableDigest);
  assert.equal(createHash('sha256').update(readFileSync(fixture)).digest('hex'), fixtureDigest);
  await receiver.screenshot({ path: path.join(evidence, `${mode}-portable-receiver.png`) });
  checks.push({ id: 'UI-SHARE-001', status: 'passed', evidence: 'A separate clean test profile reopens embedded assets and editable objects, saves an independent edit, preserves dependencies and sender bytes; same host/fonts, not cross-machine certification' });
  await application!.close();
  application = undefined;
  if (mode === 'installed') {
    const installation = path.dirname(executablePath);
    const installer = path.join(workspace, 'dist-electron-build', 'BarcodeFlow_Setup_Dev_Unsigned.exe');
    const savedDigest = createHash('sha256').update(readFileSync(savedPath)).digest('hex');
    const usersDigest = createHash('sha256').update(readFileSync(path.join(dataDir, 'users.json'))).digest('hex');
    execFileSync(installer, ['/S', '/currentuser', `/D=${installation}`], { timeout: 120000 });
    assert.equal(createHash('sha256').update(readFileSync(savedPath)).digest('hex'), savedDigest);
    assert.equal(createHash('sha256').update(readFileSync(path.join(dataDir, 'users.json'))).digest('hex'), usersDigest);
    const upgraded = await launch();
    await signIn(upgraded);
    await application!.evaluate(({ dialog }, filePath) => {
      (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, savedPath);
    await upgraded.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
    await expect(upgraded.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length);
    const launchEnvironment = {
      ...process.env,
      NODE_PATH: '',
      NODE_ENV: 'production',
      BARCODEFLOW_USER_DATA_DIR: profile,
    };
    const mainProcessId = application!.process().pid;
    execFileSync(executablePath, [], { cwd: root, env: launchEnvironment, stdio: 'ignore', timeout: 30000 });
    assert.equal(application!.process().pid, mainProcessId, 'A repeated launch must retain the existing app process');
    checks.push({ id: 'SINGLE-INSTANCE-001', status: 'passed', evidence: 'A second installed-executable launch focuses the existing isolated instance' });

    execFileSync(executablePath, [portablePath], { cwd: root, env: launchEnvironment, stdio: 'ignore', timeout: 30000 });
    await expect(upgraded.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length);
    checks.push({ id: 'FILE-OPEN-FORWARD-001', status: 'passed', evidence: 'A second installed launch forwards a native .bfl path to the existing instance without covering the editor with Welcome' });

    await upgraded.locator('button[title^="Insert Text Object ("]').click();
    await expect.poll(async () => upgraded.evaluate(async () => {
      const snapshot = await (window as any).electronAPI.readRecoverySnapshot();
      return snapshot?.documents?.length || 0;
    })).toBeGreaterThan(0);
    await upgraded.screenshot({ path: path.join(evidence, `${mode}-before-force-close.png`) });
    const processToKill = application!.process().pid;
    const killed = application!.waitForEvent('close', { timeout: 20000 });
    execFileSync('taskkill.exe', ['/PID', String(processToKill), '/T', '/F'], { stdio: 'ignore', timeout: 15000 });
    await killed;
    application = undefined;
    assert.equal(createHash('sha256').update(readFileSync(savedPath)).digest('hex'), savedDigest);
    const recoveredPage = await launch();
    await expect(recoveredPage.getByRole('heading', { name: /Recover unsaved BarcodeFlow documents/ })).toBeVisible();
    await expect(recoveredPage.getByRole('heading', { name: 'Welcome!', exact: true })).toHaveCount(0);
    await recoveredPage.screenshot({ path: path.join(evidence, `${mode}-recovery-prompt.png`) });
    await recoveredPage.getByRole('button', { name: 'Recover Snapshot', exact: true }).click();
    await expect(recoveredPage.locator('[id^="canvas-el-"]')).toHaveCount(saved.elements.length + 1);
    await expect(recoveredPage.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
    assert.equal(createHash('sha256').update(readFileSync(savedPath)).digest('hex'), savedDigest);
    checks.push({ id: 'FORCE-KILL-RECOVERY-001', status: 'passed', evidence: 'Only the isolated QA PID was force-terminated; manual installed relaunch recovered the last completed snapshot before Welcome and left the original saved document unchanged' });
    await recoveredPage.getByRole('button', { name: 'Close', exact: true }).click();
    await recoveredPage.evaluate(() => (window as any).electronAPI.closeWindow());
    await recoveredPage.getByRole('button', { name: "Don't Save", exact: true }).click();
    await application!.waitForEvent('close', { timeout: 20000 });
    application = undefined;
    checks.push({ id: 'INSTALL-REINSTALL-001', status: 'passed', evidence: 'Same-version reinstall preserves isolated profile and saved document; installed app reopens editable objects' });
    const uninstaller = path.join(installation, 'Uninstall BarcodeFlow Enterprise Suite.exe');
    assert.ok(existsSync(uninstaller), 'Installed uninstaller is missing');
    execFileSync(uninstaller, ['/S', `/currentuser`, `_?=${installation}`], { timeout: 120000 });
    assert.equal(existsSync(executablePath), false, 'Uninstall did not remove the installed executable');
    assert.equal(createHash('sha256').update(readFileSync(savedPath)).digest('hex'), savedDigest);
    assert.equal(createHash('sha256').update(readFileSync(path.join(dataDir, 'users.json'))).digest('hex'), usersDigest);
    checks.push({ id: 'INSTALL-UNINSTALL-001', status: 'passed', evidence: 'Uninstall removes executable while preserving isolated profile and user document; no default-profile or cross-version upgrade claim' });
  }
  }
} catch (error: any) {
  checks.push({ id: 'SMOKE-FAILURE', status: 'failed', evidence: error.message });
  console.error(`Desktop smoke failed: ${error.message}`);
  if (application) {
    const page = application.windows()[0];
    if (page) {
      await page.screenshot({ path: path.join(evidence, `${mode}-failure.png`) }).catch(() => {});
      await page.screenshot({ path: path.join(evidence, `${mode}-${runId}-failure.png`) }).catch(() => {});
    }
    await application.evaluate(({ app }) => app.exit(1)).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  const report = JSON.stringify({ mode, createdAt: new Date().toISOString(), sourceDigest, root, profile, installerDigest, checks }, null, 2);
  writeFileSync(path.join(evidence, `${mode}-results.json`), report);
  writeFileSync(path.join(evidence, `${mode}-${runId}-results.json`), report);
  console.log(JSON.stringify(checks, null, 2));
}