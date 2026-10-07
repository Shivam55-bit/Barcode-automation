import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import type { LabelTemplate, TextElement } from '../src/types';
import { serializeBarcodeFlowDocument, deserializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';

const workspace = process.cwd();
const beforeOnly = process.argv.includes('--before');
const root = mkdtempSync(path.join(tmpdir(), 'barcodeflow-cr-ui-'));
const profile = path.join(root, 'profile');
const evidence = path.join(workspace, 'release-evidence', 'cr-workflow', beforeOnly ? 'before' : 'after');
mkdirSync(path.join(profile, 'data'), { recursive: true });
mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(profile, 'data', 'users.json'), '[]');

const records = [
  { fieldA: 'Item ABC', fieldB: 'Batch 123', fieldC: 'Qty 10' },
  { fieldA: 'Item XYZ', fieldB: 'Batch 456', fieldC: 'Qty 7' },
];
const paragraph: TextElement = {
  id: 'cr-ui-label',
  name: 'Three Field CR Label',
  type: 'text',
  textType: 'paragraph',
  textFormatType: 'paragraph',
  text: 'Item ABCBatch 123Qty 10',
  fontFamily: 'Arial',
  fontSize: 10,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#000000',
  lineHeight: 1.2,
  letterSpacing: 0,
  x: 8,
  y: 8,
  width: 80,
  height: 32,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: 1,
  sizingMode: 'fixed-width',
  autoSize: false,
  autoFit: false,
  dataSources: [
    { id: 'field-a', name: 'Field A', type: 'database-field', field: 'fieldA', databaseField: 'fieldA', value: '', valueEncoding: 'raw', enabled: true },
    { id: 'field-b', name: 'Field B', type: 'database-field', field: 'fieldB', databaseField: 'fieldB', value: '', valueEncoding: 'raw', enabled: true },
    { id: 'field-c', name: 'Field C', type: 'database-field', field: 'fieldC', databaseField: 'fieldC', value: '', valueEncoding: 'raw', enabled: true },
  ],
};
const template: LabelTemplate = {
  id: 'cr-ui-template',
  name: 'CR UI Workflow',
  description: 'Three ordered database fields separated by inserted CR sources.',
  category: 'QA',
  version: '1.0',
  status: 'draft',
  tags: ['QA'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'CR workflow QA',
  dimensions: { width: 100, height: 60, unit: 'mm', dpi: 300, orientation: 'landscape' },
  margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
  elements: [paragraph],
  variables: [],
  sampleRecords: records,
};
const fixturePath = path.join(root, 'three-field-input.bfl');
const savedPath = path.join(root, 'three-field-cr-roundtrip.bfl');
writeFileSync(fixturePath, JSON.stringify(serializeBarcodeFlowDocument(template), null, 2));

let application: ElectronApplication | undefined;
let page: Page | undefined;
const checks: string[] = [];

async function insertCarriageReturn(properties: ReturnType<typeof pageLocator>, page: Page) {
  await properties.getByTitle('Insert Special Character Source After Selected Source', { exact: true }).first().click();
  const dialog = page.locator('div.fixed.inset-0').filter({ has: page.getByText('Insert Symbols or Special Characters', { exact: true }) }).last();
  await dialog.getByRole('button', { name: 'Control Characters', exact: true }).click();
  await dialog.getByPlaceholder(/Search control characters/).fill('Carriage Return');
  await dialog.getByRole('row').filter({ has: page.getByText('Carriage Return', { exact: true }) }).click();
  await dialog.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByTitle('Close', { exact: true }).click();
}

function pageLocator(page: Page) {
  return page.locator('div.fixed.inset-0').filter({ has: page.getByText(/^Text Object Properties/) }).last();
}

async function sourceIds(properties: ReturnType<typeof pageLocator>): Promise<string[]> {
  return properties.locator('[data-source-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-source-id') || ''));
}

async function renderedLines(page: Page): Promise<string[]> {
  return page.locator('#canvas-el-cr-ui-label [data-paragraph-layout="native"] text').evaluateAll(nodes => {
    const grouped = new Map<string, Array<{ x: number; text: string }>>();
    for (const node of nodes) {
      const key = node.getAttribute('y') || '0';
      const segments = grouped.get(key) || [];
      segments.push({ x: Number(node.getAttribute('x') || 0), text: node.textContent || '' });
      grouped.set(key, segments);
    }
    return [...grouped.values()].map(segments => segments.sort((left, right) => left.x - right.x).map(segment => segment.text).join(''));
  });
}

async function waitForRenderedLines(page: Page, minimumLines = 3, timeout = 10000) {
  await page.waitForFunction(
    (minLines) => {
      const root = document.querySelector('#canvas-el-cr-ui-label [data-paragraph-layout="native"]');
      return !!root && root.querySelectorAll('text').length >= minLines;
    },
    minimumLines,
    { timeout }
  );
}

try {
  const executablePath = path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe');
  application = await electron.launch({
    executablePath,
    args: [path.join(workspace, 'dist-electron', 'main.js')],
    cwd: root,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile },
    timeout: 40000,
  });
  const splash = await application.firstWindow();
  await splash.waitForLoadState('domcontentloaded');
  await splash.screenshot({ path: path.join(evidence, 'splash.png') });
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await application.evaluate(({ dialog }, openPath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [openPath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: savedPath });
  }, fixturePath);
  await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await expect(page.locator('#canvas-el-cr-ui-label')).toBeVisible();
  await page.locator('#canvas-el-cr-ui-label').click({ button: 'right', position: { x: 8, y: 6 } });
  await page.getByText('Properties...', { exact: true }).click();
  const properties = pageLocator(page);
  await properties.getByText('Data Sources', { exact: true }).first().click();

  await properties.getByTitle('New Data Source', { exact: true }).click();
  const wizard = page.locator('div.fixed.inset-0').filter({ has: page.getByText('New Data Source Wizard', { exact: true }) }).last();
  await expect(wizard).toBeVisible();
  await wizard.getByRole('button', { name: 'Finish', exact: true }).click();

  const sourceRows = properties.locator('[data-source-id]');
  const createdSourceId = await sourceRows.last().getAttribute('data-source-id');
  const createdSource = properties.locator(`[data-source-id="${createdSourceId}"]`);
  await createdSource.click();
  const embeddedEditor = properties.locator('textarea').first();
  await expect(embeddedEditor).toBeVisible();
  await embeddedEditor.click();
  await embeddedEditor.evaluate((element: HTMLTextAreaElement) => {
    element.focus();
    element.setSelectionRange(0, element.value.length);
  });
  const selectionBeforeInsert = await embeddedEditor.evaluate((element: HTMLTextAreaElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    value: element.value,
  }));
  assert.equal(selectionBeforeInsert.value, 'Sample Text');
  assert.equal(selectionBeforeInsert.start, 0);
  assert.equal(selectionBeforeInsert.end, 'Sample Text'.length);

  await properties.getByText('Special Characters...', { exact: true }).first().click();
  const insertDialog = page.locator('div.fixed.inset-0').filter({ has: page.getByText('Insert Symbols or Special Characters', { exact: true }) }).last();
  await insertDialog.getByRole('button', { name: 'Control Characters', exact: true }).click();
  await insertDialog.getByPlaceholder(/Search control characters/i).fill('Carriage Return');
  await insertDialog.getByRole('row').filter({ has: page.getByText('Carriage Return', { exact: true }) }).click();
  await insertDialog.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(insertDialog).toBeVisible();
  await insertDialog.getByTitle('Close', { exact: true }).click();

  const insertedValue = await embeddedEditor.evaluate((element: HTMLTextAreaElement) => ({
    value: element.value,
    length: element.value.length,
    containsLineBreak: /\r|\n/.test(element.value),
  }));
  assert.equal(insertedValue.containsLineBreak, true);
  assert.ok(insertedValue.length > 0);

  await properties.getByTitle('New Data Source', { exact: true }).click();
  const secondWizard = page.locator('div.fixed.inset-0').filter({ has: page.getByText('New Data Source Wizard', { exact: true }) }).last();
  await expect(secondWizard).toBeVisible();
  await secondWizard.getByRole('button', { name: 'Finish', exact: true }).click();

  const finalSources = properties.locator('[data-source-id]');
  assert.equal(await finalSources.count(), 5);
  const sourceThree = finalSources.nth(4);
  await sourceThree.click();
  const finalEditor = properties.locator('textarea').first();
  const finalValue = await finalEditor.inputValue();
  assert.equal(finalValue, 'Sample Text');

  await properties.getByRole('button', { name: 'OK', exact: true }).click();
  await expect.poll(async () => (await renderedLines(page!)).length).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await renderedLines(page!)).some((line) => line.includes('Sample Text'))).toBe(true);
  await page.screenshot({ path: path.join(evidence, 'wizard-cr-two-lines.png') });

  await page.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(savedPath)).toBe(true);
  const saved = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
  const savedText = saved.elements[0] as TextElement;
  const controlSources = savedText.dataSources!.filter((source) => source.type === 'control-character');
  assert.equal(controlSources.length, 1);
  assert.equal(controlSources[0].value.charCodeAt(0), 13);
  checks.push('Wizard flow creates a selected Sample Text placeholder, replaces it with a raw CR source, and preserves two visible lines');

  await page.keyboard.press('Control+w');
  await page.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  await expect.poll(() => page!.locator('#canvas-el-cr-ui-label').count()).toBe(1);
  await expect.poll(async () => (await renderedLines(page!)).length).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await renderedLines(page!)).some((line) => line.includes('Sample Text'))).toBe(true);
  const reopened = deserializeBarcodeFlowDocument(readFileSync(savedPath, 'utf8')).template!;
  const reopenedControl = (reopened.elements[0] as TextElement).dataSources!.find((source) => source.type === 'control-character');
  assert.equal(reopenedControl?.value.charCodeAt(0), 13);
  checks.push('Saved and reopened document keeps the CR-only source and renders the same two lines');
  console.log(JSON.stringify({ mode: 'after', checks, evidence }, null, 2));
  await application.close();
  application = undefined;

  console.log(JSON.stringify({ mode: 'after', checks, evidence, savedPath }, null, 2));
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await application?.close().catch(() => undefined);
}