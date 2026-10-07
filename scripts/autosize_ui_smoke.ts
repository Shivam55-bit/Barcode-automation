import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import type { LabelTemplate, TextElement } from '../src/types';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { fitTextToBox } from '../src/services/textMeasurementEngine';

const workspace = process.cwd();
const evidence = path.join(workspace, 'release-evidence', 'autosize-ui');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'barcodeflow-autosize-'));
const profile = path.join(tempRoot, 'profile');
const inputPath = path.join(tempRoot, 'autosize-input.bfl');
const outputPath = path.join(evidence, 'Auto_Size_UI_Test.bfl');
const pdfPath = path.join(evidence, 'Auto_Size_UI_Test.pdf');
let currentDocumentPath = inputPath;
const sentence = 'Opening the modal must preserve the intended range.';
const paragraph = `errorCode:\n'EXCEL_INVALID_WORKBOOK',\nerror: 'Workbook metadata'`;
const paragraphId = 'autosize-paragraph';
const singleId = 'autosize-single';
const referenceId = 'autosize-reference';

function textElement(id: string, text: string, textType: 'single-line' | 'paragraph'): TextElement {
  const multiline = textType === 'paragraph';
  return {
    id,
    name: id,
    type: 'text',
    x: 10,
    y: multiline ? 25 : 10,
    width: 23.9,
    height: 4.9,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    zIndex: 1,
    text,
    textType,
    textFormatType: multiline ? 'paragraph' : 'single-line',
    sizingMode: 'fixed-width',
    autoSize: false,
    autoFit: false,
    autoHeight: false,
    fontFamily: 'Arial',
    fontSize: 30,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    fontWidthScale: 100,
    lineHeight: 1.15,
    letterSpacing: 0,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: multiline,
    wordWrap: multiline,
    multiline,
    minFontSize: 1,
    maxFontSize: 720,
    minWidthScale: 100,
    maxWidthScale: 100,
    autoSizeConfig: {
      enabled: false,
      minFontSize: 1,
      maxFontSize: 720,
      minWidthScale: 100,
      maxWidthScale: 100,
      objectWidth: 23.9,
      objectHeight: 4.9,
      horizontalAlignment: 'left',
      verticalAlignment: 'top',
    },
  };
}

const template: LabelTemplate = {
  id: 'autosize-ui-test',
  name: 'Auto Size UI Test',
  description: 'Fixed-box text fitting acceptance fixture.',
  category: 'QA',
  version: '1.0',
  status: 'draft',
  tags: ['QA'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'QA',
  dimensions: { width: 100, height: 60, unit: 'mm', dpi: 300, orientation: 'landscape' },
  margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
  elements: [
    textElement(singleId, sentence, 'single-line'),
    {
      ...textElement(referenceId, 'Sample Text', 'single-line'),
      y: 17,
      fontSize: 12,
    },
    textElement(paragraphId, paragraph, 'paragraph'),
  ],
  variables: [],
  sampleRecords: [],
} as LabelTemplate;

mkdirSync(path.join(profile, 'data'), { recursive: true });
mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(profile, 'data', 'users.json'), '[]');
writeFileSync(inputPath, JSON.stringify(serializeBarcodeFlowDocument(template), null, 2));

let application: ElectronApplication | undefined;
let page: Page | undefined;
const packagedBuild = process.argv.includes('--packaged');

function saved(): LabelTemplate {
  return deserializeBarcodeFlowDocument(readFileSync(currentDocumentPath, 'utf8')).template!;
}

function savedText(id: string): TextElement {
  return saved().elements.find(element => element.id === id) as TextElement;
}

async function openDocument(filePath: string) {
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [targetPath] });
  }, filePath);
  await page!.getByTitle('Open Document (Ctrl+O)', { exact: true }).click();
  currentDocumentPath = filePath;
}

async function saveAs(filePath: string) {
  const previousMtime = existsSync(filePath) ? statSync(filePath).mtimeMs : 0;
  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, filePath);
  await page!.getByTitle('Save As... (Ctrl+Shift+S)', { exact: true }).click();
  await expect.poll(() => existsSync(filePath) && statSync(filePath).mtimeMs > previousMtime).toBe(true);
  currentDocumentPath = filePath;
}

async function saveCurrent() {
  const previousMtime = statSync(outputPath).mtimeMs;
  await page!.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => statSync(outputPath).mtimeMs).toBeGreaterThan(previousMtime);
  await expect(page!.locator('[title="Unsaved Changes"]')).toHaveCount(0);
}

async function openAutoSizeProperties(objectId = singleId) {
  const object = page!.locator(`#canvas-el-${objectId}`);
  await object.click({ button: 'right' });
  await page!.getByText('Properties...', { exact: true }).click();
  const modal = page!.locator('div.fixed.inset-0').filter({ has: page!.getByText(/^Text Object Properties/) }).last();
  await expect(modal).toBeVisible();
  await modal.getByText('Text Format', { exact: true }).click();
  await modal.getByRole('button', { name: 'Auto Size', exact: true }).click();
  return modal;
}

async function selectVerticalAlignment(modal: ReturnType<Page['locator']>, value: string) {
  await modal.getByText('Vertical Alignment:', { exact: true }).locator('xpath=..').locator('select').selectOption(value);
}

async function readSingleLineFit(objectId = singleId) {
  const current = savedText(objectId);
  const rendered = await page!.locator(`#canvas-el-${objectId}`).evaluate((node, widthMm) => {
    const frame = node.querySelector<HTMLElement>('[style*="font-size"]');
    const text = node.querySelector<HTMLElement>('[style*="text-align"]');
    if (!frame || !text) throw new Error('Single-line text nodes were not rendered.');
    const range = document.createRange();
    range.selectNodeContents(text);
    const textBounds = range.getBoundingClientRect();
    const objectBounds = node.getBoundingClientRect();
    const scale = objectBounds.width / widthMm;
    const transform = getComputedStyle(text).transform;
    return {
      fontSizePx: parseFloat(getComputedStyle(frame).fontSize),
      fontWidthScale: transform === 'none' ? 100 : Number(transform.match(/^matrix\(([^,]+)/)?.[1]) * 100,
      transformOrigin: getComputedStyle(text).transformOrigin,
      frameBounds: {
        left: frame.getBoundingClientRect().left,
        right: frame.getBoundingClientRect().right,
        width: frame.getBoundingClientRect().width,
      },
      textAlign: getComputedStyle(text).textAlign,
      verticalAlign: getComputedStyle(frame).justifyContent,
      textBounds: { left: textBounds.left, right: textBounds.right, top: textBounds.top, bottom: textBounds.bottom },
      objectBounds: { left: objectBounds.left, right: objectBounds.right, top: objectBounds.top, bottom: objectBounds.bottom },
      scalePxPerMm: scale,
      fontSizePt: parseFloat(getComputedStyle(frame).fontSize) / scale / (25.4 / 72),
    };
  }, current.width);
  const config = current.autoSizeConfig!;
  assert.ok(rendered.fontSizePt >= config.minFontSize - 0.01 && rendered.fontSizePt <= config.maxFontSize + 0.01,
    `Rendered point size ${rendered.fontSizePt}pt must stay within ${config.minFontSize}-${config.maxFontSize}pt`);
  assert.ok(rendered.textBounds.left >= rendered.objectBounds.left - 1);
  assert.ok(rendered.textBounds.right <= rendered.objectBounds.right + 1,
    `Rendered line right ${rendered.textBounds.right} must fit object right ${rendered.objectBounds.right} (font ${rendered.fontSizePt}pt, width scale ${rendered.fontWidthScale}%, align ${rendered.textAlign}, box ${rendered.objectBounds.left}-${rendered.objectBounds.right}, text ${rendered.textBounds.left}-${rendered.textBounds.right}, frame ${JSON.stringify(rendered.frameBounds)}, origin ${rendered.transformOrigin})`);
  assert.ok(rendered.textBounds.top >= rendered.objectBounds.top - 1);
  assert.ok(rendered.textBounds.bottom <= rendered.objectBounds.bottom + 1,
    `Rendered line bottom ${rendered.textBounds.bottom} must fit object bottom ${rendered.objectBounds.bottom}`);
  return { ...rendered };
}

async function checkParagraphFit(objectId = paragraphId) {
  return page!.locator(`#canvas-el-${objectId}`).evaluate(node => {
    const svg = node.querySelector<SVGSVGElement>('svg[data-paragraph-layout="native"]');
    if (!svg) throw new Error('Fitted paragraph SVG is not present.');
    const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>('text'));
    const boxes = textNodes.map(text => text.getBBox());
    const content = boxes.reduce((bounds, box) => ({
      right: Math.max(bounds.right, box.x + box.width),
      bottom: Math.max(bounds.bottom, box.y + box.height),
    }), { right: 0, bottom: 0 });
    return {
      text: textNodes.map(text => text.textContent || '').join(''),
      lines: new Set(textNodes.map(text => text.getAttribute('y'))).size,
      content,
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      object: { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height },
    };
  });
}

try {
  application = await electron.launch({
    executablePath: packagedBuild
      ? path.join(workspace, 'dist-electron-build', 'win-unpacked', 'BarcodeFlow Enterprise Suite.exe')
      : path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: packagedBuild ? [] : [path.join(workspace, 'dist-electron', 'main.js')],
    cwd: tempRoot,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile },
    timeout: 40000,
  });
  const firstWindow = await application.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  const welcome = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'Welcome!' }).last();
  await expect(welcome).toBeVisible();
  if (await welcome.isVisible()) {
    await welcome.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(welcome).toBeHidden();
    await page.locator('div.fixed.inset-0:visible').filter({ hasText: 'Welcome!' }).waitFor({ state: 'detached' });
  }
  await openDocument(inputPath);
  await expect(page.locator(`#canvas-el-${singleId}`)).toContainText(sentence);
  const initialParagraph = await checkParagraphFit();
  assert.equal(initialParagraph.text, paragraph.replace(/\r\n?|\n/g, ''),
    'Paragraph content is rendered in native SVG text runs even though Playwright cannot expose SVG text through locator text');
  await expect(page.locator(`#canvas-el-${paragraphId} [role="status"]`)).toContainText('Text overflow');

  const initialSingle = savedText(singleId);
  const properties = await openAutoSizeProperties();
  await properties.getByRole('checkbox', { name: 'Auto Size', exact: true }).check();
  await properties.getByLabel('Minimum Font Point Size', { exact: true }).fill('1');
  await properties.getByLabel('Maximum Font Point Size', { exact: true }).fill('720');
  await properties.getByLabel('Minimum Font Width Scale (%)', { exact: true }).fill('100');
  await properties.getByLabel('Maximum Font Width Scale (%)', { exact: true }).fill('100');
  await properties.getByLabel('Auto Size Object Width', { exact: true }).fill('23.9');
  await properties.getByLabel('Auto Size Object Height', { exact: true }).fill('4.9');
  await properties.getByRole('button', { name: 'Horizontal alignment left', exact: true }).click();
  await selectVerticalAlignment(properties, 'top');
  await properties.getByRole('button', { name: 'OK', exact: true }).click();

  const paragraphProperties = await openAutoSizeProperties(paragraphId);
  await paragraphProperties.getByRole('checkbox', { name: 'Auto Size', exact: true }).check();
  await paragraphProperties.getByLabel('Minimum Font Point Size', { exact: true }).fill('1');
  await paragraphProperties.getByLabel('Maximum Font Point Size', { exact: true }).fill('720');
  await paragraphProperties.getByLabel('Minimum Font Width Scale (%)', { exact: true }).fill('100');
  await paragraphProperties.getByLabel('Maximum Font Width Scale (%)', { exact: true }).fill('100');
  await paragraphProperties.getByLabel('Auto Size Object Width', { exact: true }).fill('23.9');
  await paragraphProperties.getByLabel('Auto Size Object Height', { exact: true }).fill('4.9');
  await selectVerticalAlignment(paragraphProperties, 'top');
  await paragraphProperties.getByRole('button', { name: 'OK', exact: true }).click();

  const referenceProperties = await openAutoSizeProperties(referenceId);
  await referenceProperties.getByRole('checkbox', { name: 'Auto Size', exact: true }).check();
  await referenceProperties.getByLabel('Minimum Font Point Size', { exact: true }).fill('1');
  await referenceProperties.getByLabel('Maximum Font Point Size', { exact: true }).fill('720');
  await referenceProperties.getByLabel('Minimum Font Width Scale (%)', { exact: true }).fill('100');
  await referenceProperties.getByLabel('Maximum Font Width Scale (%)', { exact: true }).fill('100');
  await referenceProperties.getByLabel('Auto Size Object Width', { exact: true }).fill('23.9');
  await referenceProperties.getByLabel('Auto Size Object Height', { exact: true }).fill('4.9');
  await referenceProperties.getByRole('button', { name: 'Horizontal alignment left', exact: true }).click();
  await selectVerticalAlignment(referenceProperties, 'top');
  await referenceProperties.getByRole('button', { name: 'OK', exact: true }).click();
  await saveAs(outputPath);

  let current = savedText(singleId);
  assert.equal(current.text, sentence);
  assert.equal(current.sizingMode, 'fit-to-box');
  assert.equal(current.width, 23.9);
  assert.equal(current.height, 4.9);
  assert.equal(current.fontSize, initialSingle.fontSize, 'fitting must not overwrite saved base typography');
  assert.equal(current.autoSizeConfig?.minFontSize, 1);
  assert.equal(current.autoSizeConfig?.maxFontSize, 720);
  assert.equal(current.autoSizeConfig?.minWidthScale, 100);
  assert.equal(current.autoSizeConfig?.maxWidthScale, 100);
  assert.equal(savedText(referenceId).text, 'Sample Text');
  assert.equal(savedText(referenceId).sizingMode, 'fit-to-box');
  assert.equal(savedText(referenceId).autoSizeConfig?.minFontSize, 1);
  assert.equal(savedText(referenceId).autoSizeConfig?.maxFontSize, 720);
  assert.deepEqual([savedText(referenceId).width, savedText(referenceId).height], [23.9, 4.9]);
  const referenceFit = await readSingleLineFit(referenceId);
  assert.equal(referenceFit.fontWidthScale, 100);
  assert.equal(referenceFit.textAlign, 'left');
  assert.equal(referenceFit.verticalAlign, 'flex-start');
  const baselineFit = await readSingleLineFit();
  assert.equal(baselineFit.fontWidthScale, 100, '100% / 100% keeps character proportions');
  assert.equal(baselineFit.textAlign, 'left');
  assert.equal(baselineFit.verticalAlign, 'flex-start');

  const zoomFits = [baselineFit];
  for (const zoom of ['50%', '100%', '200%']) {
    await page!.locator('button[title^="Zoom"][title*="set zoom level"]').click();
    await page!.getByRole('button', { name: zoom, exact: true }).click();
    zoomFits.push(await readSingleLineFit());
  }
  for (const zoomFit of zoomFits.slice(1)) {
    assert.ok(Math.abs(zoomFit.fontSizePt - baselineFit.fontSizePt) < 0.01,
      `Fitted point size must be zoom-independent (${baselineFit.fontSizePt}pt vs ${zoomFit.fontSizePt}pt)`);
    assert.equal(zoomFit.fontWidthScale, baselineFit.fontWidthScale);
  }

  await page!.locator(`#canvas-el-${singleId}`).click();
  const disableAutoSize = await openAutoSizeProperties();
  await disableAutoSize.getByRole('checkbox', { name: 'Auto Size', exact: true }).uncheck();
  await disableAutoSize.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();
  assert.equal(savedText(singleId).sizingMode, 'fixed-width');
  const unfittedPx = await page.locator(`#canvas-el-${singleId} [style*="font-size"]`).first()
    .evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(unfittedPx > baselineFit.fontSizePx, 'turning Auto Size off restores the saved base font size');

  const reenableAutoSize = await openAutoSizeProperties();
  await reenableAutoSize.getByRole('checkbox', { name: 'Auto Size', exact: true }).check();
  await reenableAutoSize.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();

  const beforeLimits = savedText(singleId);
  const limited = await openAutoSizeProperties();
  await limited.getByLabel('Minimum Font Point Size', { exact: true }).fill('8');
  await limited.getByLabel('Maximum Font Point Size', { exact: true }).fill('8');
  await limited.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();
  const fixedPointFit = fitTextToBox(savedText(singleId));
  assert.equal(fixedPointFit.fontSize, 8, 'equal minimum/maximum point limits are honored');
  assert.equal(savedText(singleId).fontSize, beforeLimits.fontSize);
  const fixedPointPx = await page.locator(`#canvas-el-${singleId} [style*="font-size"]`).first()
    .evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(fixedPointPx > baselineFit.fontSizePx, 'minimum/maximum point controls change actual designer glyph size');

  const scaleSettings = await openAutoSizeProperties();
  await scaleSettings.getByLabel('Minimum Font Point Size', { exact: true }).fill('1');
  await scaleSettings.getByLabel('Maximum Font Point Size', { exact: true }).fill('720');
  await scaleSettings.getByLabel('Minimum Font Width Scale (%)', { exact: true }).fill('50');
  await scaleSettings.getByLabel('Maximum Font Width Scale (%)', { exact: true }).fill('150');
  await scaleSettings.getByRole('button', { name: 'Horizontal alignment center', exact: true }).click();
  await selectVerticalAlignment(scaleSettings, 'middle');
  await scaleSettings.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();
  current = savedText(singleId);
  const variableScaleFit = fitTextToBox(current);
  const variableScaleRendered = await readSingleLineFit();
  assert.ok(variableScaleRendered.fontWidthScale >= 50 && variableScaleRendered.fontWidthScale <= 150);
  assert.equal(variableScaleRendered.textAlign, 'center');
  assert.equal(variableScaleRendered.verticalAlign, 'center');
  assert.equal(current.textAlign, 'center');
  assert.equal(current.verticalAlign, 'middle');

  const resizeProps = await openAutoSizeProperties();
  await resizeProps.getByLabel('Auto Size Object Width', { exact: true }).fill('18');
  await resizeProps.getByLabel('Auto Size Object Height', { exact: true }).fill('3.5');
  await resizeProps.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();
  assert.equal(savedText(singleId).width, 18);
  assert.equal(savedText(singleId).height, 3.5);
  assert.equal(savedText(singleId).text, sentence);
  await readSingleLineFit();
  const undoButton = page.getByTitle('Undo (Ctrl+Z)', { exact: true });
  await expect(undoButton).toBeEnabled();
  await undoButton.click();
  await saveCurrent();
  assert.equal(savedText(singleId).width, 23.9, 'Undo restores the prior object width');
  await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await saveCurrent();
  assert.equal(savedText(singleId).width, 18, 'Redo reapplies the object width');

  await page.keyboard.press('Control+w');
  await openDocument(outputPath);
  assert.equal(savedText(singleId).text, sentence);
  assert.equal(savedText(singleId).width, 18);
  assert.equal(savedText(singleId).height, 3.5);
  await page.getByText('File', { exact: true }).click();
  await page.getByText('Print Preview', { exact: true }).click();
  await expect(page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true })).toBeVisible();
  const previewText = page.locator(`[data-preview-element-id="${singleId}"]`);
  await expect(previewText).toContainText(sentence);
  const previewFont = await previewText.locator('[style*="font-size"]').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(previewFont > 0);
  await page.screenshot({ path: path.join(evidence, 'autosize-print-preview.png') });
  await page.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true }).click();

  await application.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, pdfPath);
  await page.getByText('File', { exact: true }).click();
  await page.getByText('Export High-Resolution PDF', { exact: true }).click();
  await expect.poll(() => existsSync(pdfPath)).toBe(true);
  const pdfBytes = readFileSync(pdfPath);
  assert.equal(pdfBytes.subarray(0, 5).toString('ascii'), '%PDF-');
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPages()[0].getWidth() * 25.4 / 72 - 100) < 0.1);
  assert.ok(Math.abs(pdf.getPages()[0].getHeight() * 25.4 / 72 - 60) < 0.1);

  await page.keyboard.press('Control+w');
  await openDocument(outputPath);
  await page.locator(`#canvas-el-${singleId}`).click();
  await page.screenshot({ path: path.join(evidence, 'autosize-designer.png') });
  const paragraphRender = await checkParagraphFit();
  assert.equal(paragraphRender.text, paragraph.replace(/\r\n?|\n/g, ''));
  assert.ok(paragraphRender.lines >= 3);
  assert.ok(paragraphRender.content.right <= paragraphRender.viewBox.width + 0.15);
  assert.ok(paragraphRender.content.bottom <= paragraphRender.viewBox.height + 0.15);

  console.log(JSON.stringify({
    result: 'passed',
    checks: [
      'Auto Size on/off in the real properties dialog while preserving the saved base font',
      '1-720 pt and 100%-100% width-scale reference settings persist and render proportionally',
      'BarTender Sample Text reference fixture retains a 23.9 x 4.9 mm box and left/top alignment',
      'independent fixed point limits, width-scale range, width/height, and horizontal/vertical alignment',
      'designer glyph bounds fit the fixed box; paragraph glyph bounds fit its SVG box',
      'width/height Undo/Redo and save/close/reopen',
      'Print Preview renders the saved text; PDF export produces the expected label dimensions',
    ],
    evidence,
    document: outputPath,
    pdf: pdfPath,
    baselineFit,
    variableScaleFit,
    paragraphRender,
  }, null, 2));
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(evidence, 'autosize-failure.png') }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await application?.close().catch(() => undefined);
}
