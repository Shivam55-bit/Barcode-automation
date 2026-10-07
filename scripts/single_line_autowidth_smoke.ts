import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import type { LabelTemplate, TextElement } from '../src/types';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { exportLabelsToPDF } from '../src/services/pdfExportService';

const workspace = process.cwd();
const sentence = 'Opening the modal must preserve the intended range.';
const evidence = path.join(workspace, 'release-evidence', 'single-line-autowidth');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'barcodeflow-single-line-'));
const profile = path.join(tempRoot, 'profile');
const wideInputPath = path.join(tempRoot, 'wide-input.bfl');
const smallInputPath = path.join(tempRoot, 'small-input.bfl');
const outputPath = path.join(evidence, 'Single_Line_Auto_Width_Test.bfl');
const pdfPath = path.join(evidence, 'Single_Line_Auto_Width_Test.pdf');
const smallOutputPath = path.join(evidence, 'Single_Line_Small_Label_Test.bfl');
const smallPdfPath = path.join(evidence, 'Single_Line_Small_Label_Test.pdf');
mkdirSync(path.join(profile, 'data'), { recursive: true });
mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(profile, 'data', 'users.json'), '[]');

function template(id: string, width: number): LabelTemplate {
  return {
    id,
    name: id === 'wide-auto-width' ? 'Single Line Auto Width Test' : 'Single Line Small Label Test',
    description: 'Single-line content-driven sizing acceptance fixture.',
    category: 'QA',
    version: '1.0',
    status: 'draft',
    tags: ['QA'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'QA',
    dimensions: { width, height: 80, unit: 'mm', dpi: 300, orientation: 'landscape' },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
    elements: [],
    variables: [],
    sampleRecords: [],
  } as LabelTemplate;
}

writeFileSync(wideInputPath, JSON.stringify(serializeBarcodeFlowDocument(template('wide-auto-width', 300)), null, 2));
writeFileSync(smallInputPath, JSON.stringify(serializeBarcodeFlowDocument(template('small-auto-width', 36)), null, 2));

let application: ElectronApplication | undefined;
let page: Page | undefined;
const checks: string[] = [];

async function openPath(filePath: string) {
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [targetPath] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: outputPath });
  }, filePath);
  await page!.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
}

async function insertSingleLine(): Promise<{ id: string; element: ReturnType<Page['locator']> }> {
  await page!.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
  await page!.getByTitle('Content-sized single-line text, non-wrapping', { exact: true }).click();
  const element = page!.locator('[id^="canvas-el-"]').last();
  await expect(element).toContainText('Sample Text');
  const id = await element.getAttribute('id');
  assert.ok(id?.startsWith('canvas-el-'));
  await expect(element).toBeVisible();
  return { id: id!.slice('canvas-el-'.length), element };
}

async function pasteIntoSelectedText(element: ReturnType<Page['locator']>, text: string) {
  await element.dblclick();
  const editor = page!.locator('textarea').last();
  await expect(editor).toBeVisible();
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(0, node.value.length));
  await application!.evaluate(({ clipboard }, value) => clipboard.writeText(value), text);
  await editor.press('Control+v');
  await expect(editor).toHaveValue(text);
  return editor;
}

async function saveDocument(pathToSave: string) {
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, pathToSave);
  await page!.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(pathToSave)).toBe(true);
}

async function exportAndCheck(templateToExport: LabelTemplate, output: string, expectedWidthMm: number) {
  const blob = await exportLabelsToPDF(templateToExport, [{}]);
  writeFileSync(output, Buffer.from(await blob.arrayBuffer()));
  const pdf = await PDFDocument.load(readFileSync(output));
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPages()[0].getWidth() * 25.4 / 72 - expectedWidthMm) < 0.1);
}

try {
  const executablePath = path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe');
  application = await electron.launch({
    executablePath,
    args: [path.join(workspace, 'dist-electron', 'main.js')],
    cwd: tempRoot,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile },
    timeout: 40000,
  });
  const splash = await application.firstWindow();
  await splash.waitForLoadState('domcontentloaded');
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await openPath(wideInputPath);
  await expect(page.getByText('Single Line Auto Width Test', { exact: true }).first()).toBeVisible();

  const created = await insertSingleLine();
  const initialBox = await created.element.boundingBox();
  assert.ok(initialBox);
  await page.screenshot({ path: path.join(evidence, 'single-line-before-paste.png') });

  const editor = await pasteIntoSelectedText(created.element, sentence);
  const initialFont = await editor.evaluate(element => getComputedStyle(element).fontSize);
  await expect.poll(async () => (await created.element.boundingBox())?.width ?? 0).toBeGreaterThan(initialBox.width);
  const expandedBox = await created.element.boundingBox();
  assert.ok(expandedBox);
  assert.ok(Math.abs(expandedBox.x - initialBox.x) < 1);
  assert.ok(Math.abs(expandedBox.y - initialBox.y) < 1);
  assert.equal(await editor.evaluate(element => getComputedStyle(element).fontSize), initialFont);
  await page.screenshot({ path: path.join(evidence, 'single-line-after-paste-editing.png') });
  await editor.press('Enter');
  await expect(created.element).toContainText(sentence);
  const committedBox = await created.element.boundingBox();
  assert.ok(committedBox && committedBox.width >= expandedBox.width - 1);
  const storedWidthAfterPaste = Number(await page.getByTitle('Width in mm', { exact: true }).inputValue());
  assert.ok(storedWidthAfterPaste > 40, `Stored object width must grow with content; got ${storedWidthAfterPaste} mm`);
  checks.push('Toolbar-created Single Line uses auto-width; exact clipboard paste stays complete on one line, expands live bounds, preserves font size and top-left anchor.');

  await page.getByTitle('Zoom In (Ctrl++)', { exact: true }).click();
  const zoomedBox = await created.element.boundingBox();
  assert.ok(zoomedBox && committedBox && zoomedBox.width > committedBox.width);
  assert.equal(Number(await page.getByTitle('Width in mm', { exact: true }).inputValue()), storedWidthAfterPaste);
  await page.screenshot({ path: path.join(evidence, 'single-line-zoomed.png') });
  await page.getByTitle('Zoom Out (Ctrl+-)', { exact: true }).click();

  const longerWidth = (await created.element.boundingBox())!.width;
  const shortEditor = await pasteIntoSelectedText(created.element, 'ABC');
  await expect.poll(async () => (await created.element.boundingBox())?.width ?? Number.MAX_SAFE_INTEGER).toBeLessThan(longerWidth);
  await shortEditor.press('Enter');
  await expect(created.element).toContainText('ABC');
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(created.element).toContainText(sentence);
  const undoBox = await created.element.boundingBox();
  assert.ok(undoBox && Math.abs(undoBox.width - committedBox!.width) < 1);
  await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await expect(created.element).toContainText('ABC');
  const redoBox = await created.element.boundingBox();
  assert.ok(redoBox && redoBox.width < undoBox!.width);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(created.element).toContainText(sentence);
  checks.push('Replacing with ABC shrinks the object; undo/redo restores content and corresponding bounds together.');

  const fontSizeInput = page.getByTitle('Font Size').locator('input');
  await fontSizeInput.fill('14');
  await fontSizeInput.press('Enter');
  await expect.poll(async () => Number(await page!.getByTitle('Width in mm', { exact: true }).inputValue())).toBeGreaterThan(storedWidthAfterPaste);
  await fontSizeInput.fill('10');
  await fontSizeInput.press('Enter');
  await expect.poll(async () => Number(await page!.getByTitle('Width in mm', { exact: true }).inputValue())).toBeCloseTo(storedWidthAfterPaste, 0);
  checks.push('Changing font size remeasures width; restoring 10 pt restores the measured width.');

  await page.getByTitle('Rotate 90° CW', { exact: true }).click();
  await expect(created.element).toHaveCSS('transform', /matrix/);
  assert.equal(Number(await page.getByTitle('Width in mm', { exact: true }).inputValue()), storedWidthAfterPaste);
  await page.screenshot({ path: path.join(evidence, 'single-line-rotated.png') });
  await page.getByTitle('Rotate 90° CCW', { exact: true }).click();

  await saveDocument(outputPath);
  const saved = deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!;
  const savedText = saved.elements.find(element => element.id === created.id) as TextElement;
  assert.equal(savedText.text, sentence);
  assert.ok(savedText.width > 40, `Saved model width must fit the complete line; got ${savedText.width} mm`);
  assert.equal(savedText.sizingMode, 'auto-width');
  assert.equal(savedText.autoSize, true);
  assert.equal(savedText.fontSize, 10);
  await exportAndCheck(saved, pdfPath, 300);
  checks.push('Wide-label BFL and PDF preserve the full sentence; exported PDF page uses the 300 mm test label.');

  await page.keyboard.press('Control+w');
  await openPath(outputPath);
  const reopened = deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!;
  const reopenedText = reopened.elements.find(element => element.id === created.id) as TextElement;
  await expect(page!.locator(`#canvas-el-${created.id}`)).toContainText(sentence);
  assert.equal(reopenedText.text, sentence);
  assert.equal(reopenedText.width, savedText.width);
  await page!.getByText('File', { exact: true }).click();
  await page!.getByText('Print Preview', { exact: true }).click();
  await expect(page!.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true })).toBeVisible();
  await expect(page!.getByText(sentence, { exact: true }).last()).toBeVisible();
  await page!.screenshot({ path: path.join(evidence, 'single-line-print-preview.png') });
  await page!.keyboard.press('Escape');
  checks.push('Saved BFL reopens with the same content-driven geometry, and Print Preview visibly renders the full sentence.');

  await page!.keyboard.press('Control+w');
  await openPath(smallInputPath);
  const small = await insertSingleLine();
  const smallEditor = await pasteIntoSelectedText(small.element, sentence);
  await smallEditor.press('Enter');
  await expect(small.element).toContainText(sentence);
  await expect(page!.getByText(/Object extends outside printable area/)).toBeVisible();
  await page!.screenshot({ path: path.join(evidence, 'single-line-small-label-overflow.png') });
  await saveDocument(smallOutputPath);
  const smallSaved = deserializeBarcodeFlowDocument(readFileSync(smallOutputPath, 'utf8')).template!;
  assert.equal((smallSaved.elements[0] as TextElement).text, sentence);
  await exportAndCheck(smallSaved, smallPdfPath, 36);
  checks.push('On a 36 mm label, editing bounds extend past the label with an out-of-bounds warning; PDF remains clipped to the 36 mm page.');

  console.log(JSON.stringify({ checks, evidence, editableTestDocument: outputPath, smallLabelDocument: smallOutputPath, pdfs: [pdfPath, smallPdfPath] }, null, 2));
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(evidence, 'single-line-failure.png') }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await application?.close().catch(() => undefined);
}
