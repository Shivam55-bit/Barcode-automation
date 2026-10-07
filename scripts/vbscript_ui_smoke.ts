import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import type { LabelTemplate, TextElement } from '../src/types';

const workspace = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidence = path.join(workspace, 'release-evidence', 'vbscript-ui');
const root = mkdtempSync(path.join(os.tmpdir(), 'barcodeflow-vbscript-'));
const profile = path.join(root, 'profile');
const inputPath = path.join(root, 'vbscript-input.bfl');
const outputPath = path.join(evidence, `VBScript_UI_Test-${runId}.bfl`);
const pdfPath = path.join(evidence, `VBScript_UI_Test-${runId}.pdf`);
const template: LabelTemplate = {
  id: 'vbscript-ui-test',
  name: 'VBScript UI Test',
  description: 'Actual UI test for single-line VBScript data-source workflow.',
  category: 'Logistics',
  version: '1.0',
  status: 'draft',
  tags: ['QA'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'QA',
  dimensions: { width: 100, height: 100, unit: 'mm', dpi: 300, orientation: 'landscape' },
  margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
  elements: [],
  variables: [],
  sampleRecords: [],
} as LabelTemplate;

mkdirSync(path.join(profile, 'data'), { recursive: true });
mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(profile, 'data', 'users.json'), '[]');
writeFileSync(inputPath, JSON.stringify(serializeBarcodeFlowDocument(template), null, 2));

let application: ElectronApplication | undefined;
let page: Page | undefined;
let objectId = '';
let scriptSourceId = '';

async function openDocument(filePath: string) {
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [targetPath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: outputPath });
  }, filePath);
  await page!.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
}

async function saveAs(filePath: string) {
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, filePath);
  await page!.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(filePath)).toBe(true);
}

function savedTemplate() {
  return deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!;
}

try {
  application = await electron.launch({
    executablePath: path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: [path.join(workspace, 'dist-electron', 'main.js')],
    cwd: root,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile },
    timeout: 40000,
  });
  const splash = await application.firstWindow();
  await splash.waitForLoadState('domcontentloaded');
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  const welcomeModal = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'Welcome!' }).last();
  await expect(welcomeModal).toBeVisible({ timeout: 15000 });
  await welcomeModal.getByRole('button', { name: 'Close', exact: true }).click();

  await openDocument(inputPath);
  await expect(page.getByText('VBScript UI Test', { exact: true }).first()).toBeVisible();
  await page.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
  await page.getByTitle('Dynamic multi-line paragraph text with word wrapping and reflow', { exact: true }).click();
  const object = page.locator('[id^="canvas-el-"]').last();
  objectId = (await object.getAttribute('id'))!.slice('canvas-el-'.length);
  await object.click();
  await page.getByTitle('Text Properties Dialog (F8)', { exact: true }).click();

  const properties = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'Text Object Properties' }).last();
  await expect(properties).toBeVisible();
  await properties.getByTitle('New Data Source', { exact: true }).click();
  const wizard = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'New Data Source Wizard' }).last();
  await expect(wizard).toBeVisible();
  await wizard.getByRole('button').filter({ hasText: 'Embedded Data' }).first().click();
  const typeOptionsList = wizard.locator('div[class*="max-h-[210px]"][class*="overflow-y-auto"]');
  await typeOptionsList.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const scriptTypeOption = wizard.getByRole('button', { name: 'Visual Basic Script', exact: true });
  const optionBounds = await scriptTypeOption.boundingBox();
  await page.screenshot({ path: path.join(evidence, `vbscript-wizard-${runId}.png`) });
  if (!optionBounds) throw new Error('The Visual Basic Script type option is not laid out.');
  await scriptTypeOption.click();
  await expect(wizard.getByRole('button', { name: 'Visual Basic Script', exact: true })).toBeVisible();
  await expect(wizard.getByText(/generates or transforms data/)).toBeVisible();
  await page.screenshot({ path: path.join(evidence, `vbscript-wizard-selected-${runId}.png`) });
  await wizard.getByRole('button', { name: 'Next >', exact: true }).click();
  await expect(wizard.getByLabel('Script mode', { exact: true })).toHaveValue('expression');
  await wizard.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(properties.getByLabel('Script mode', { exact: true })).toHaveValue('expression');
  await expect(properties.getByText('Edit with Script Editor', { exact: true })).toBeVisible();

  const scriptSources = properties.locator('[data-source-id]');
  await expect(scriptSources).toHaveCount(2);
  await scriptSources.first().click();
  await properties.getByTitle('Delete Data Source', { exact: true }).click();
  await expect(properties.locator('[data-source-id]')).toHaveCount(1);
  scriptSourceId = (await properties.locator('[data-source-id]').first().getAttribute('data-source-id'))!;
  await properties.getByText('Edit with Script Editor', { exact: true }).click();

  const editor = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'OUTPUT & TEST RESULT' }).last();
  await expect(editor).toBeVisible();
  const codeEditor = editor.locator('textarea').last();
  await expect(codeEditor).toHaveValue('"Sample Text"');
  await codeEditor.fill('"Widget " & UCase("alpha")');
  await editor.getByRole('button', { name: 'Test Script', exact: true }).click();
  await expect(editor.getByText('Success', { exact: true })).toBeVisible();
  await expect(editor.getByText('Widget ALPHA', { exact: true })).toBeVisible();
  await expect(codeEditor).toHaveValue('"Widget " & UCase("alpha")');
  await expect(editor.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await page.screenshot({ path: path.join(evidence, `vbscript-editor-${runId}.png`) });
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(properties.locator('textarea').last()).toHaveValue('"Widget " & UCase("alpha")');
  await expect(properties.locator('[data-source-id]').first()).toContainText('Widget ALPHA');
  await editor.getByRole('button', { name: 'OK', exact: true }).click();

  await expect(properties.locator('textarea').last()).toHaveValue('"Widget " & UCase("alpha")');
  await properties.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.locator(`#canvas-el-${objectId}`)).toContainText('Widget ALPHA');
  await page.screenshot({ path: path.join(evidence, `vbscript-designer-${runId}.png`) });

  await saveAs(outputPath);
  let savedObject = savedTemplate().elements.find(element => element.id === objectId) as TextElement;
  assert.equal(savedObject.dataSources?.length, 1);
  assert.equal(savedObject.dataSources?.[0].id, scriptSourceId);
  assert.equal(savedObject.dataSources?.[0].scriptMode, 'expression');
  assert.equal(savedObject.dataSources?.[0].scriptCode, '"Widget " & UCase("alpha")');
  assert.equal(savedObject.dataSources?.[0].value, 'Widget ALPHA');

  await page.getByText('File', { exact: true }).click();
  await page.getByText('Print Preview', { exact: true }).click();
  const preview = page.locator(`[data-preview-element-id="${objectId}"]`);
  await expect(preview).toContainText('Widget ALPHA');
  await page.screenshot({ path: path.join(evidence, `vbscript-preview-${runId}.png`) });
  await page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true }).click();

  await application.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, pdfPath);
  await page.getByText('File', { exact: true }).click();
  await page.getByText('Export High-Resolution PDF', { exact: true }).click();
  await expect.poll(() => existsSync(pdfPath)).toBe(true);
  const pdf = await PDFDocument.load(readFileSync(pdfPath));
  assert.ok(pdf.getPageCount() > 0, 'PDF export contains at least one page');

  await page.keyboard.press('Control+w');
  await openDocument(outputPath);
  await page.getByRole('button', { name: 'Continue to Canvas', exact: true }).click();
  savedObject = savedTemplate().elements.find(element => element.id === objectId) as TextElement;
  assert.equal(savedObject.dataSources?.[0].scriptMode, 'expression');
  assert.equal(savedObject.dataSources?.[0].scriptCode, '"Widget " & UCase("alpha")');
  assert.equal(savedObject.dataSources?.[0].value, 'Widget ALPHA');
  await expect(page.locator(`#canvas-el-${objectId}`)).toContainText('Widget ALPHA');
  await page.screenshot({ path: path.join(evidence, `vbscript-reopened-${runId}.png`) });

  console.log(JSON.stringify({
    status: 'passed',
    build: path.join(workspace, 'dist-electron', 'main.js'),
    objectId,
    expression: '"Widget " & UCase("alpha")',
    expectedOutput: 'Widget ALPHA',
    actualOutput: savedObject.dataSources?.[0].value,
    persistedMode: savedObject.dataSources?.[0].scriptMode,
    previewText: await page.locator(`#canvas-el-${objectId}`).innerText(),
    pdfPath,
    evidence,
  }, null, 2));
} finally {
  await application?.close();
}
