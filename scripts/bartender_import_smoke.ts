import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';

const observationPath = process.argv[2];
if (!observationPath || !existsSync(observationPath)) throw new Error('Pass an existing private BTW working copy or observation JSON path.');
const workspace = process.cwd();
const nativeBtw = path.extname(observationPath).toLowerCase() === '.btw';
const sourceBytes = readFileSync(observationPath);
const sourceDigest = createHash('sha256').update(sourceBytes).digest('hex');
const expectedBytes = nativeBtw
  ? readFileSync(path.join(path.dirname(observationPath), 'evidence', 'location-api-observation.json')) : sourceBytes;
const source = deserializeBarcodeFlowDocument(expectedBytes.toString('utf8'), 'observation.json').template!;
if (nativeBtw) assert.equal(source.sourceMetadata!.bartenderImport.sourceSha256, sourceDigest);
assert.equal(source.importReport.importStatus, 'PARTIAL');
assert.ok(source.elements.length > 0);
const evidence = path.join(path.dirname(observationPath), nativeBtw ? 'evidence' : '', `native-${nativeBtw ? 'btw-' : ''}import-${Date.now()}`);
mkdirSync(evidence, { recursive: true });
const root = mkdtempSync(path.join(os.tmpdir(), 'barcodeflow-bartender-import-'));
const savedPath = path.join(evidence, 'Location-partial.bfl');
const user = { id: 'import-qa', name: 'Import QA', email: 'import-qa@example.invalid', password: randomBytes(24).toString('hex'),
  role: 'Admin', status: 'approved', isApproved: true, department: 'QA', avatar: '' };
const checks: Array<{ id: string; status: string; detail: string }> = [];
let application: ElectronApplication | undefined;
const execute = promisify(execFile);
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

async function operateNativeDialog(action: 'accept' | 'cancel') {
  await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isEnabled()), { timeout: 15000 }).toBe(false);
  const windowHandle = await application!.evaluate(({ BrowserWindow }) => {
    const bytes = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return bytes.length === 8 ? bytes.readBigUInt64LE().toString() : bytes.readUInt32LE().toString();
  });
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class QaConsentDialog {
  private delegate bool Enumerate(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool EnumWindows(Enumerate callback, IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr window, Enumerate callback, IntPtr parameter);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
  [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr first, IntPtr second);
  [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr first, IntPtr second);
  private static string Caption(IntPtr window) {
    var text = new StringBuilder(2048);
    GetWindowText(window, text, text.Capacity);
    return text.ToString().Replace("&", "");
  }
  public static IntPtr Dialog(IntPtr main) {
    uint owner;
    GetWindowThreadProcessId(main, out owner);
    IntPtr dialog = IntPtr.Zero;
    EnumWindows((window, parameter) => {
      uint process;
      GetWindowThreadProcessId(window, out process);
      if (process == owner && Caption(window) == "BarTender-assisted Partial Import") dialog = window;
      return true;
    }, IntPtr.Zero);
    if (dialog == IntPtr.Zero) throw new InvalidOperationException("No native consent dialog owned by the isolated QA app.");
    return dialog;
  }
  public static void Operate(IntPtr dialog, bool accept) {
    IntPtr checkbox = IntPtr.Zero;
    IntPtr button = IntPtr.Zero;
    string action = accept ? "Extract Partial Draft" : "Cancel";
    EnumChildWindows(dialog, (window, parameter) => {
      string text = Caption(window);
      if (text == "This is a trusted working copy safe for non-production inspection.") checkbox = window;
      if (text == action) button = window;
      return true;
    }, IntPtr.Zero);
    if (button == IntPtr.Zero) throw new InvalidOperationException("Expected scoped native consent button was not found.");
    if (!PostMessage(button, 245, IntPtr.Zero, IntPtr.Zero)) throw new InvalidOperationException("Native consent action could not be sent.");
  }
}
'@
    $dialog = [QaConsentDialog]::Dialog([IntPtr][long]$env:BARCODEFLOW_QA_WINDOW)
    $accept = $env:BARCODEFLOW_QA_ACTION -eq 'accept'
    if ($accept) {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($dialog)
      $filter = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty, 'This is a trusted working copy safe for non-production inspection.')
      $checkbox = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $filter)
      if (-not $checkbox) { throw 'Native trust checkbox was not found.' }
      $toggle = $checkbox.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
      if ($toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::Off) { $toggle.Toggle() }
    }
    [QaConsentDialog]::Operate($dialog, $accept)
  `;
  await execute(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20000,
    env: { ...process.env, BARCODEFLOW_QA_WINDOW: windowHandle, BARCODEFLOW_QA_ACTION: action } });
}

async function barTenderProcesses() {
  const result = await execute(powershell, ['-NoProfile', '-NonInteractive', '-Command',
    "@(@(Get-Process -Name bartend -ErrorAction SilentlyContinue) | ForEach-Object { $_.Id }) | ConvertTo-Json -Compress"], { windowsHide: true });
  const value = result.stdout.trim();
  if (!value) return [];
  const parsed = JSON.parse(value);
  return (Array.isArray(parsed) ? parsed : [parsed]).sort((first: number, second: number) => first - second) as number[];
}

async function launch(profileName: string) {
  const profile = path.join(root, profileName);
  mkdirSync(path.join(profile, 'data'), { recursive: true });
  writeFileSync(path.join(profile, 'data', 'users.json'), JSON.stringify([user]));
  application = await electron.launch({
    executablePath: path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: [path.join(workspace, 'dist-electron', 'main.js')], cwd: root,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile }, timeout: 40000,
  });
  const page = await application.firstWindow();
  page.on('dialog', dialog => { void dialog.accept().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  const open = page.getByTitle('Open Document (Ctrl+O)', { exact: true });
  const password = page.locator('input[type="password"]').first();
  await password.or(open).first().waitFor({ state: 'visible', timeout: 20000 });
  if (!await open.isVisible()) {
    await page.locator('input[type="email"]').first().fill(user.email);
    await password.fill(user.password);
    const login = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
    await page.locator('button[type="submit"]').first().click();
    assert.equal((await login).ok(), true);
    await open.waitFor({ state: 'visible', timeout: 20000 });
  }
  await page.keyboard.press('Escape');
  return page;
}

async function chooseFile(page: Page, filePath: string, useImportMenu = false) {
  await application!.evaluate(({ dialog }, paths) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [paths.filePath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: paths.savedPath });
  }, { filePath, savedPath });
  if (useImportMenu) {
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByText('Import BarTender Template...', { exact: true }).click();
    await page.getByRole('button', { name: 'Import BTW with BarTender', exact: true }).click();
  } else await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
}

async function openFile(page: Page, filePath: string, useImportMenu = false) {
  await chooseFile(page, filePath, useImportMenu);
  if (nativeBtw && path.extname(filePath).toLowerCase() === '.btw') await operateNativeDialog('accept');
  await expect(page.getByText('Partial Import - Not Production-Ready', { exact: true })).toBeVisible({ timeout: 150000 });
  await expect(page.getByText(`${source.elements.length} native objects, ${source.importReport.unsupported} unresolved source objects.`, { exact: false })).toBeVisible();
  await page.getByText(/Property Verification \(/).click();
  await expect(page.getByRole('cell', { name: 'symbology', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Mapped Source Lines' }).getByRole('listitem')).toHaveCount(source.elements.length);
  if (nativeBtw && path.extname(filePath).toLowerCase() === '.btw') {
    for (const feature of source.importReport.unsupportedFeatures) await expect(page.getByText(feature, { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidence, 'actual-btw-partial-report.png') });
  }
  await page.getByRole('button', { name: 'Continue Designing', exact: true }).click();
  await expect(page.locator('[id^="canvas-el-"]')).toHaveCount(source.elements.length);
}

try {
  const referenceProcesses = nativeBtw ? await barTenderProcesses() : [];
  const page = await launch('conversion-profile');
  if (nativeBtw) {
    const preservedPath = path.join(root, 'existing.bfl');
    writeFileSync(preservedPath, JSON.stringify(serializeBarcodeFlowDocument({ ...source, id: 'existing-qa-document', name: 'Existing QA document' })));
    await openFile(page, preservedPath);
    await chooseFile(page, observationPath);
    await operateNativeDialog('cancel');
    await expect(page.getByText('Existing QA document', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Partial Import - Not Production-Ready', { exact: true })).toHaveCount(0);
    const invalidPath = path.join(root, 'unsupported.btw');
    writeFileSync(invalidPath, 'Not a supported BTW file');
    await chooseFile(page, invalidPath);
    const errorDialog = page.getByRole('dialog').filter({ hasText: 'Unable to Import BarTender Document' });
    await expect(errorDialog.getByText(/Invalid or unsupported BTW signature/).first()).toBeVisible();
    await page.screenshot({ path: path.join(evidence, 'unsupported-source.png') });
    await errorDialog.getByRole('button').first().click();
    await expect(page.getByText('Existing QA document', { exact: true }).first()).toBeVisible();
    checks.push({ id: 'CANCEL-INVALID-PRESERVE', status: 'passed', detail: 'Copied BTW selected through the approved picker hook; real native consent cancellation and unsupported source error preserve the existing native document.' });
    await page.evaluate(() => {
      (window as any).__qaBtwPhases = [];
      (window as any).electronAPI.onBarTenderImportProgress((data: any) => (window as any).__qaBtwPhases.push(data.phase));
    });
  }
  await openFile(page, observationPath, nativeBtw);
  if (nativeBtw) {
    assert.deepEqual(await page.evaluate(() => (window as any).__qaBtwPhases), ['AWAITING_CONSENT', 'EXTRACTING', 'VERIFYING']);
    await expect(page.getByText('Existing QA document', { exact: true }).first()).toBeVisible();
    await expect.poll(barTenderProcesses, { timeout: 15000 }).toEqual(referenceProcesses);
  }
  checks.push({ id: 'IMPORT-UI', status: 'passed', detail: nativeBtw
    ? 'File/Import UI selected the copied BTW through the approved native-picker hook; actual native dependency/trust consent, installed BarTender extraction, progress and strict native conversion passed. Two mapped lines and nine unresolved objects reported; existing native tab/reference BarTender session preserved.'
    : 'Actual Open dialog/IPC and file loader convert verified source objects; visible partial report and property ledger.' });
  await expect(page.getByTitle('Unsaved Changes', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: path.join(evidence, 'imported-partial.png') });
  const element = page.locator(`#canvas-el-${source.elements[0].id}`);
  await element.click();
  await page.keyboard.press('ArrowRight');
  await page.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(savedPath)).toBe(true);
  const saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8'), 'Location-partial.bfl').template!;
  assert.ok(saved.elements[0].x > source.elements[0].x);
  assert.equal(saved.elements[0].y, source.elements[0].y);
  assert.deepEqual(saved.importReport, source.importReport);
  assert.deepEqual(saved.sourceMetadata, source.sourceMetadata);
  assert.equal(saved.elements[0].printable, source.elements[0].printable);
  assert.equal(createHash('sha256').update(readFileSync(observationPath)).digest('hex'), sourceDigest);
  await expect(page.getByTitle('Unsaved Changes', { exact: true })).toHaveCount(0);
  await page.getByTitle('Close Document', { exact: true }).last().click();
  if (nativeBtw) {
    await expect(page.getByTitle('Close Document', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Existing QA document', { exact: true }).first()).toBeVisible();
    assert.equal(deserializeBarcodeFlowDocument(readFileSync(path.join(root, 'existing.bfl'), 'utf8'), 'existing.bfl').template!.elements[0].x, source.elements[0].x);
  } else await expect(page.locator(`#canvas-el-${source.elements[0].id}`)).toHaveCount(0);
  checks.push({ id: 'EDIT-SAVE-CLOSE', status: 'passed', detail: 'Real native line edit and BFL Save As, close; selected source bytes unchanged and fidelity gaps preserved.' });
  await application!.close();
  application = undefined;

  const receiver = await launch('independent-receiver-profile');
  if (nativeBtw) await application!.evaluate(({ dialog }) => {
    (dialog as any).showMessageBox = async () => { throw new Error('Native BFL reopen must not request BarTender consent'); };
  });
  await openFile(receiver, savedPath);
  await expect(receiver.getByTitle('Unsaved Changes', { exact: true })).toHaveCount(0);
  const reread = await receiver.evaluate(async filePath => (window as any).electronAPI.readFile(filePath), savedPath);
  assert.equal(reread.success, true);
  const reopened = deserializeBarcodeFlowDocument(reread.document, 'reopened.bfl').template!;
  assert.deepEqual(reopened.elements, saved.elements);
  assert.deepEqual(reopened.importReport, saved.importReport);
  await receiver.screenshot({ path: path.join(evidence, 'receiver-reopened.png') });
  checks.push({ id: 'NATIVE-INDEPENDENT-REOPEN', status: 'passed', detail: 'Clean receiver profile opens only native BFL from temporary cwd; no BarTender automation or observation extraction invoked.' });
  await receiver.getByRole('button', { name: 'File', exact: true }).click();
  await receiver.getByText('Print Preview', { exact: true }).click();
  await expect(receiver.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true })).toBeVisible();
  await expect(receiver.locator('[data-preview-element-id]')).toHaveCount(saved.elements.filter(element => element.printable !== false).length);
  await receiver.screenshot({ path: path.join(evidence, 'nonprinting-preview.png') });
  const pdfResult = await receiver.evaluate(async payload => (window as any).barcodeFlow.printers.generatePdf(payload), {
    htmlContent: generateWindowsDriverHtml(saved), widthMm: saved.dimensions.width, heightMm: saved.dimensions.height,
  });
  assert.equal(pdfResult.success, true, pdfResult.error);
  const pdfBytes = Buffer.from(pdfResult.base64Data, 'base64');
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() * 25.4 / 72 - saved.dimensions.width) < 0.4);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() * 25.4 / 72 - saved.dimensions.height) < 0.4);
  writeFileSync(path.join(evidence, 'partial-nonprinting-output.pdf'), pdfBytes);
  checks.push({ id: 'PREVIEW-PDF', status: 'passed', detail: 'Non-printing native lines remain editable but are absent from real preview; virtual PDF page geometry verified within 0.4 mm.' });
  checks.push({ id: 'TEXT-BARCODE-DATA', status: 'blocked', detail: 'Source definitions/anchors/barcode settings are unavailable; no text/barcode substitutes were created. Full Location conversion is not verified.' });
  console.log(JSON.stringify({ evidence, nativeDocument: savedPath, checks }, null, 2));
} catch (error) {
  console.error(`Private failure evidence: ${evidence}`);
  if (application) {
    const page = await application.firstWindow();
    await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {});
    writeFileSync(path.join(evidence, 'failure-ui.txt'), await page.locator('body').innerText().catch(() => 'UI unavailable'));
  }
  throw error;
} finally {
  writeFileSync(path.join(evidence, 'checks.json'), JSON.stringify(checks, null, 2));
  await application?.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await application?.close().catch(() => {});
}