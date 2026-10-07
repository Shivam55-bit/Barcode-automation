import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import type { LabelTemplate, TextElement } from '../src/types';
import { serializeBarcodeFlowDocument, deserializeBarcodeFlowDocument } from '../src/services/documentFileService';

const workspace = process.cwd();
const evidence = path.join(workspace, 'release-evidence', 'multiline-ui');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'barcodeflow-multiline-'));
const profile = path.join(tempRoot, 'profile');
const inputPath = path.join(tempRoot, 'multiline-input.bfl');
const outputPath = path.join(evidence, `Multiline_UI_Test-${runId}.bfl`);
const pdfPath = path.join(evidence, `Multiline_UI_Test-${runId}.pdf`);
const conversionPdfPath = path.join(evidence, `Single_Line_Conversion-${runId}.pdf`);
const reportPath = path.join(evidence, `layout-evidence-${runId}.json`);
const fixture = 'Implement and verify the Text Properties → Text Format → Auto Size';
const conversionFixture = 'I want to integrate Justdial leads with my own CRM. Please confirm whether Justdial provides a Lead API, Pull API, Push API, webhook, or third-party CRM integration. Please share the API endpoint.';
const sentence = 'Opening the modal must preserve the intended range.';
const variedText = `English first line\n\nहिंदी Hindi text\n${'LONG_UNBROKEN_TEXT_0123456789_'.repeat(5)}\n`;

const template: LabelTemplate = {
  id: 'multiline-ui-test',
  name: 'Multiline UI Test',
  description: 'Fixed-width multiline paste, reflow, and auto-height acceptance fixture.',
  category: 'QA',
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
writeFileSync(path.join(profile, 'recovery-snapshot.json'), JSON.stringify({
  version: 1,
  savedAt: new Date().toISOString(),
  documents: [{ name: 'Document831.btw', document: serializeBarcodeFlowDocument(template) }],
}));

let application: ElectronApplication | undefined;
let page: Page | undefined;
let objectId = '';

function savedText(filePath = outputPath): TextElement {
  const saved = deserializeBarcodeFlowDocument(readFileSync(filePath, 'utf8')).template!;
  return saved.elements.find(element => element.id === objectId) as TextElement;
}

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

async function saveCurrent() {
  const previousMtime = statSync(outputPath).mtimeMs;
  await page!.getByTitle('Save Document (Ctrl+S)', { exact: true }).click();
  await expect.poll(() => statSync(outputPath).mtimeMs).toBeGreaterThan(previousMtime);
}

async function inspectRenderedLayout() {
  return page!.locator(`#canvas-el-${objectId}`).evaluate(node => {
    const svg = node.querySelector<SVGSVGElement>('svg[data-paragraph-layout="native"]');
    if (!svg) throw new Error('The paragraph SVG renderer is not present.');
    const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>('text'));
    const boxes = textNodes.map(text => text.getBBox());
    const lineBaselines = Array.from(new Set(textNodes.map(text => text.getAttribute('y'))));
    const lineBounds = lineBaselines.map(baseline => {
      const lineNodes = textNodes.filter(text => text.getAttribute('y') === baseline);
      const lineBoxes = lineNodes.map(text => text.getBBox()).filter(box => box.width > 0 || box.height > 0);
      return {
        baseline,
        text: lineNodes.map(text => text.textContent || '').join('').trimEnd(),
        x: Math.min(...lineBoxes.map(box => box.x)),
        right: Math.max(...lineBoxes.map(box => box.x + box.width)),
      };
    });
    const contentBounds = boxes.reduce((bounds, box) => ({
      x: Math.min(bounds.x, box.x),
      y: Math.min(bounds.y, box.y),
      right: Math.max(bounds.right, box.x + box.width),
      bottom: Math.max(bounds.bottom, box.y + box.height),
    }), { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });
    const objectBounds = node.getBoundingClientRect();
    const svgBounds = svg.getBoundingClientRect();
    return {
      content: textNodes.map(text => text.textContent || '').join(''),
      lines: lineBaselines.length,
      lineText: lineBounds.map(line => line.text),
      lineBounds,
      stretchedSegments: textNodes.filter(text => text.getAttribute('lengthAdjust') === 'spacing').length,
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      contentBounds: {
        x: contentBounds.x,
        y: contentBounds.y,
        width: contentBounds.right - contentBounds.x,
        height: contentBounds.bottom - contentBounds.y,
        bottom: contentBounds.bottom,
      },
      objectBounds: { width: objectBounds.width, height: objectBounds.height, top: objectBounds.top },
      svgBounds: { width: svgBounds.width, height: svgBounds.height },
      ancestors: (() => {
        const result: Array<{ tag: string; className: string; width: number; height: number; overflowX: string; overflowY: string; clientHeight: number; scrollHeight: number }> = [];
        let current: Element | null = svg;
        while (current) {
          const style = getComputedStyle(current);
          const bounds = current.getBoundingClientRect();
          result.push({
            tag: current.tagName.toLowerCase(),
            className: typeof current.className === 'string' ? current.className : '',
            width: bounds.width,
            height: bounds.height,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            clientHeight: current instanceof HTMLElement ? current.clientHeight : Math.round(bounds.height),
            scrollHeight: current instanceof HTMLElement ? current.scrollHeight : Math.round(bounds.height),
          });
          current = current.parentElement;
        }
        return result;
      })(),
      mmScale: { x: svgBounds.width / svg.viewBox.baseVal.width, y: svgBounds.height / svg.viewBox.baseVal.height },
      fontMetrics: textNodes.slice(0, 6).map(text => ({
        fontFamily: text.getAttribute('font-family'),
        fontSizeMm: text.getAttribute('font-size'),
        fontWeight: text.getAttribute('font-weight'),
        baselineMm: text.getAttribute('y'),
        measuredBounds: (() => {
          const box = text.getBBox();
          return { y: box.y, height: box.height, bottom: box.y + box.height };
        })(),
      })),
    };
  });
}

async function inspectSingleLineLayout(id: string, expectedText: string) {
  return page!.locator(`#canvas-el-${id}`).evaluate((node, text) => {
    const flow = Array.from(node.querySelectorAll('div')).find(element =>
      getComputedStyle(element).whiteSpace === 'nowrap' && element.textContent?.includes(text),
    );
    if (!flow) throw new Error('The single-line text renderer is not using non-wrapping layout.');
    const range = document.createRange();
    range.selectNodeContents(flow);
    const textBounds = range.getBoundingClientRect();
    const lineTops = Array.from(new Set(Array.from(range.getClientRects()).map(rect => Math.round(rect.top * 10) / 10)));
    const objectBounds = node.getBoundingClientRect();
    return {
      text: flow.textContent || '',
      whiteSpace: getComputedStyle(flow).whiteSpace,
      textBounds: { x: textBounds.x, y: textBounds.y, width: textBounds.width, height: textBounds.height, right: textBounds.right },
      objectBounds: { x: objectBounds.x, y: objectBounds.y, width: objectBounds.width, height: objectBounds.height, right: objectBounds.right },
      lines: lineTops.length,
    };
  }, expectedText);
}

async function resizeRightHandle(deltaX: number) {
  const handle = page!.locator(`#canvas-el-${objectId} [title="Resize middle-right"]`);
  const box = await handle.boundingBox();
  assert.ok(box, 'selected paragraph exposes the middle-right width handle');
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2, { steps: 8 });
  await page!.mouse.up();
}

async function resizeToWidth(widthMm: number) {
  const elementBox = await page!.locator(`#canvas-el-${objectId}`).boundingBox();
  assert.ok(elementBox, 'selected paragraph has measurable screen bounds');
  const currentWidth = savedText().width;
  await resizeRightHandle((widthMm - currentWidth) * elementBox.width / currentWidth);
}

async function resizeToHeight(heightMm: number) {
  const elementBox = await page!.locator(`#canvas-el-${objectId}`).boundingBox();
  assert.ok(elementBox, 'selected paragraph has measurable screen bounds');
  const currentHeight = savedText().height;
  const handle = page!.locator(`#canvas-el-${objectId} [title="Resize bottom-center"]`);
  const box = await handle.boundingBox();
  assert.ok(box, 'selected paragraph exposes the bottom-center height handle');
  const deltaY = (heightMm - currentHeight) * elementBox.height / currentHeight;
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + deltaY, { steps: 8 });
  await page!.mouse.up();
}

async function moveElementToPosition(id: string, element: TextElement, xMm: number, yMm: number) {
  const object = page!.locator(`#canvas-el-${id}`);
  const box = await object.boundingBox();
  assert.ok(box, 'selected text object has measurable screen bounds');
  const scaleX = box.width / element.width;
  const scaleY = box.height / element.height;
  await object.click();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(box.x + box.width / 2 + (xMm - element.x) * scaleX,
    box.y + box.height / 2 + (yMm - element.y) * scaleY, { steps: 8 });
  await page!.mouse.up();
}

async function setNumericProperty(label: string, value: number) {
  if (label === 'Font Size (pt)') {
    const input = page!.getByTitle('Font Size').locator('input');
    await expect(input).toBeVisible();
    await input.fill(String(value));
    await input.press('Enter');
  } else if (label === 'Line Height') {
    const select = page!.getByText('Spacing:', { exact: true }).locator('xpath=..').locator('select');
    await expect(select).toBeVisible();
    await select.selectOption(String(value));
  } else {
    throw new Error(`No real editor control is wired for ${label}.`);
  }
}

function assertAutoHeightContentFits(layout: Awaited<ReturnType<typeof inspectRenderedLayout>>, context: string) {
  assert.ok(layout.lines > 0, `${context}: paragraph renders line boxes`);
  assert.ok(layout.contentBounds.bottom <= layout.viewBox.height + 0.001,
    `${context}: rendered glyph bounds end at ${layout.contentBounds.bottom}mm within ${layout.viewBox.height}mm SVG height`);
  assert.ok(Math.abs(layout.objectBounds.width - layout.svgBounds.width) < 1,
    `${context}: SVG width aligns with the selection width`);
  assert.ok(Math.abs(layout.objectBounds.height - layout.svgBounds.height) < 1,
    `${context}: SVG height aligns with the selection height`);
  assert.ok(Math.abs(layout.mmScale.x - layout.mmScale.y) < 0.02,
    `${context}: SVG document units render at the same scale in both axes (${layout.mmScale.x} vs ${layout.mmScale.y}px/mm)`);
}

async function replaceObjectText(id: string, text: string) {
  const object = page!.locator(`#canvas-el-${id}`);
  await object.click();
  await object.dblclick();
  const editor = page!.locator('textarea').last();
  await expect(editor).toBeVisible();
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(0, node.value.length));
  await application!.evaluate(({ clipboard }, value) => clipboard.writeText(value), text);
  await editor.press('Control+v');
  await expect(editor).toHaveValue(text);
  await editor.press('Control+Enter');
}

try {
  application = await electron.launch({
    executablePath: path.join(workspace, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: [path.join(workspace, 'dist-electron', 'main.js')],
    cwd: tempRoot,
    env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production', BARCODEFLOW_USER_DATA_DIR: profile },
    timeout: 40000,
  });
  const splash = await application.firstWindow();
  await splash.waitForLoadState('domcontentloaded');
  await expect.poll(() => application!.windows().some(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))).toBe(true);
  page = application.windows().find(window => /^http:\/\/127\.0\.0\.1:\d+/.test(window.url()))!;
  const welcomeModal = page.locator('div.fixed.inset-0:visible').filter({ hasText: 'Welcome!' }).last();
  await expect(welcomeModal).toBeVisible();
  if (await welcomeModal.isVisible()) {
    await welcomeModal.getByRole('button', { name: 'Close', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(welcomeModal).toBeHidden();
  }
  await expect(page.getByText('Recover unsaved BarcodeFlow documents?', { exact: true })).toHaveCount(0);
  await expect.poll(() => existsSync(path.join(profile, 'recovery-snapshot.json'))).toBe(false);
  await openDocument(inputPath);
  await expect(page.getByText('Multiline UI Test', { exact: true }).first()).toBeVisible();

  await page.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
  await page.getByTitle('Dynamic multi-line paragraph text with word wrapping and reflow', { exact: true }).click();
  const object = page.locator('[id^="canvas-el-"]').last();
  await expect(object).toContainText('Sample Text');
  objectId = (await object.getAttribute('id'))!.slice('canvas-el-'.length);
  await expect(object.locator('svg[data-paragraph-layout="native"]')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'multiline-clip-before-paste.png') });

  await object.dblclick();
  let editor = page.locator('textarea').last();
  await expect(editor).toBeVisible();
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(8, 8));
  await application.evaluate(({ clipboard }, text) => clipboard.writeText(text), conversionFixture);
  await editor.press('Control+v');
  await expect(editor).toHaveValue(`Sample T${conversionFixture}ext`);
  await editor.press('Control+Enter');
  await expect(object.locator('svg[data-paragraph-layout="native"]')).toBeVisible();
  await object.dblclick();
  editor = page.locator('textarea').last();
  await expect(editor).toHaveValue(`Sample T${conversionFixture}ext`,
    { message: 'caret paste preserves both the prefix and suffix of the original Sample Text' });
  await editor.press('Escape');
  await replaceObjectText(objectId, conversionFixture);
  await object.dblclick();
  editor = page.locator('textarea').last();
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(0, node.value.length));
  await application.evaluate(({ clipboard }, text) => clipboard.writeText(text), fixture);
  await editor.press('Control+v');
  await expect(editor).toHaveValue(fixture);
  await editor.press('Control+Enter');
  await expect(object.locator('svg[data-paragraph-layout="native"]')).toBeVisible();
  await setNumericProperty('Font Size (pt)', 12);
  await object.click();

  await saveAs(outputPath);
  await resizeToWidth(80);
  await saveCurrent();
  const initial = savedText();
  assert.equal(initial.text, fixture);
  assert.equal(initial.width, 80);
  assert.equal(initial.sizingMode, 'fixed-width');
  assert.equal(initial.fontSize, 12);
  assert.equal(initial.autoHeight, true);
  const beforeNarrow = await inspectRenderedLayout();
  assertAutoHeightContentFits(beforeNarrow, 'fixture at the initial width');

  await resizeToWidth(50);
  await saveCurrent();
  const narrow = savedText();
  const narrowLayout = await inspectRenderedLayout();
  assert.ok(narrow.width < initial.width, `width handle narrowed from ${initial.width}mm to ${narrow.width}mm`);
  assert.equal(narrow.text, fixture);
  assert.equal(narrow.fontSize, initial.fontSize);
  assert.equal(narrowLayout.lines, 3, 'exact reproduced sentence wraps to three lines at the target width');
  assert.deepEqual(narrowLayout.lineText, ['Implement and verify the', 'Text Properties → Text', 'Format → Auto Size'],
    'exact reproduced sentence wraps at the reported word boundaries');
  assertAutoHeightContentFits(narrowLayout, 'fixture at narrow width');
  await page!.screenshot({ path: path.join(evidence, 'multiline-clip-after.png') });

  await replaceObjectText(objectId, `${fixture}\ngjpqy`);
  await saveCurrent();
  const descenderLayout = await inspectRenderedLayout();
  assert.equal(descenderLayout.lineText.at(-1), 'gjpqy', 'the final rendered line contains real descender glyphs');
  assertAutoHeightContentFits(descenderLayout, 'final line containing descenders');
  await replaceObjectText(objectId, fixture);
  await saveCurrent();

  await resizeToHeight(8);
  await saveCurrent();
  assert.equal(savedText().autoHeight, false, 'manual fixed-height resize explicitly disables automatic height');
  const overflowText = 'I want to integrate Justdial leads with my own CRM. Please confirm whether Justdial provides a Lead API, Pull API, Push API, webhook, or third-party CRM integration. Please share the API endpoint, authentication method, credentials/API key process, documentation, pricing, and activation steps.';
  await replaceObjectText(objectId, overflowText);
  await saveCurrent();
  await expect(page!.locator(`#canvas-el-${objectId} [role="status"]`)).toContainText('Text overflow');
  const fixedOverflow = savedText();
  assert.equal(fixedOverflow.autoHeight, false, 'explicit fixed-height mode remains unchanged when content overflows');
  await page!.screenshot({ path: path.join(evidence, 'multiline-fixed-height-overflow.png') });
  await page!.getByTitle('Grow paragraph height to show all text. Keeps width and font size unchanged.').click();
  await expect(page!.locator(`#canvas-el-${objectId} [role="status"]`)).toHaveCount(0);
  await saveCurrent();
  const grownParagraph = savedText();
  assert.equal(grownParagraph.autoHeight, true, 'the explicit Grow height action enables automatic content height');
  assert.equal(grownParagraph.width, fixedOverflow.width, 'growing to content preserves paragraph width');
  assert.equal(grownParagraph.fontSize, fixedOverflow.fontSize, 'growing to content preserves font size');
  assert.ok(grownParagraph.height > fixedOverflow.height, 'growing to content updates persisted height');
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'user-requested overflow recovery');
  await page!.screenshot({ path: path.join(evidence, 'multiline-fixed-height-grown.png') });
  await page!.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(page!.locator(`#canvas-el-${objectId} [role="status"]`)).toContainText('Text overflow');
  await saveCurrent();
  assert.equal(savedText().autoHeight, false, 'undo restores the explicit fixed-height overflowing state');
  await page!.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await expect(page!.locator(`#canvas-el-${objectId} [role="status"]`)).toHaveCount(0);
  await saveCurrent();
  assert.equal(savedText().autoHeight, true, 'redo restores the content-sized paragraph height');
  await replaceObjectText(objectId, fixture);
  await saveCurrent();

  await replaceObjectText(objectId, conversionFixture);
  await saveCurrent();
  const paragraphBeforeConversion = savedText();
  const paragraphBeforeConversionLayout = await inspectRenderedLayout();
  assert.equal(paragraphBeforeConversion.width, 50, 'pasted long text keeps the selected paragraph width');
  assert.equal(paragraphBeforeConversion.autoHeight, true);
  assert.ok(paragraphBeforeConversionLayout.lines > 1, 'the long content wraps in paragraph mode');
  assertAutoHeightContentFits(paragraphBeforeConversionLayout, 'long paragraph before single-line conversion');
  await page!.screenshot({ path: path.join(evidence, 'multiline-to-single-before.png') });

  await page!.getByTitle('Single Line text format', { exact: true }).click();
  await expect(page!.getByTitle('Single Line text format', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page!.locator(`#canvas-el-${objectId} svg[data-paragraph-layout="native"]`)).toHaveCount(0);
  await saveCurrent();
  const singleLineConversion = savedText();
  const singleLineLayout = await inspectSingleLineLayout(objectId, conversionFixture);
  assert.equal(singleLineConversion.text, conversionFixture, 'single-line conversion preserves complete stored text');
  assert.equal(singleLineConversion.textType, 'single-line');
  assert.equal(singleLineConversion.textFormatType, 'single-line');
  assert.equal(singleLineConversion.sizingMode, 'auto-width');
  assert.equal(singleLineConversion.autoSize, true);
  assert.equal(singleLineConversion.autoFit, false, 'ordinary conversion does not enable fixed-box font fitting');
  assert.equal(singleLineConversion.width > 100, true, 'content width may extend beyond the 100mm label');
  assert.ok(singleLineConversion.width > paragraphBeforeConversion.width);
  assert.ok(singleLineConversion.height < paragraphBeforeConversion.height);
  assert.equal(singleLineConversion.paragraphWidth, paragraphBeforeConversion.width);
  assert.equal(singleLineConversion.fontSize, paragraphBeforeConversion.fontSize);
  assert.deepEqual([singleLineConversion.x, singleLineConversion.y], [paragraphBeforeConversion.x, paragraphBeforeConversion.y],
    "conversion preserves the object's top-left anchor instead of moving it onto the label");
  assert.equal(singleLineLayout.text, conversionFixture);
  assert.equal(singleLineLayout.whiteSpace, 'nowrap');
  assert.ok(singleLineLayout.textBounds.height <= singleLineLayout.objectBounds.height + 2,
    'rendered text bounds fit inside the single-line object height');
  assert.ok(singleLineLayout.objectBounds.width > singleLineLayout.textBounds.width - 1,
    'the selected object bounds contain the complete single-line text');
  assert.ok(singleLineConversion.x + singleLineConversion.width > 100,
    'the editor object is allowed to extend past the physical label boundary');
  await page!.screenshot({ path: path.join(evidence, 'multiline-to-single-after.png') });

  for (const zoom of ['50%', '200%', '100%']) {
    await page!.locator('button[title*="Click to set zoom level."]').click();
    await page!.getByRole('button', { name: zoom, exact: true }).click();
    assert.deepEqual(
      [savedText().x, savedText().y, savedText().width, savedText().height],
      [singleLineConversion.x, singleLineConversion.y, singleLineConversion.width, singleLineConversion.height],
      `${zoom} zoom preserves converted document geometry`,
    );
  }

  await page!.getByText('File', { exact: true }).click();
  await page!.getByText('Print Preview', { exact: true }).click();
  const singleLinePreview = page!.locator(`[data-preview-element-id="${objectId}"]`);
  await expect(singleLinePreview).toBeVisible();
  const previewText = await singleLinePreview.evaluate(node => {
    const flow = Array.from(node.querySelectorAll('div')).find(element => getComputedStyle(element).whiteSpace === 'nowrap');
    return {
      text: node.textContent || '',
      whiteSpace: flow ? getComputedStyle(flow).whiteSpace : '',
      objectWidth: node.getBoundingClientRect().width,
    };
  });
  assert.equal(previewText.text, conversionFixture, 'print preview preserves the complete single-line text');
  assert.equal(previewText.whiteSpace, 'nowrap', 'print preview does not rewrap or shrink the single-line object');
  await page!.screenshot({ path: path.join(evidence, 'single-line-conversion-preview.png') });
  await page!.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true }).click();

  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, conversionPdfPath);
  await page!.getByText('File', { exact: true }).click();
  await page!.getByText('Export High-Resolution PDF', { exact: true }).click();
  await expect.poll(() => existsSync(conversionPdfPath)).toBe(true);
  const conversionPdf = await PDFDocument.load(readFileSync(conversionPdfPath));
  const conversionPdfSize = conversionPdf.getPage(0).getSize();
  assert.ok(Math.abs(conversionPdfSize.width - 100 * 72 / 25.4) < 0.1,
    'single-line PDF retains the 100mm physical page width instead of expanding to fit text');
  assert.ok(Math.abs(conversionPdfSize.height - 100 * 72 / 25.4) < 0.1,
    'single-line PDF retains the 100mm physical page height');

  await page!.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await saveCurrent();
  assert.equal(savedText().textFormatType, 'paragraph', 'one undo restores the paragraph format');
  assert.equal(savedText().width, paragraphBeforeConversion.width, 'undo restores the paragraph width');
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'undo of single-line conversion');
  await page!.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await saveCurrent();
  assert.equal(savedText().textType, 'single-line', 'one redo restores the single-line conversion');
  assert.equal(savedText().width, singleLineConversion.width);
  await page!.keyboard.press('Control+w');
  await openDocument(outputPath);
  const reopenedSingleLine = savedText();
  assert.equal(reopenedSingleLine.text, conversionFixture);
  assert.equal(reopenedSingleLine.textType, 'single-line', 'single-line conversion survives save, close, and reopen');
  assert.equal(reopenedSingleLine.width, singleLineConversion.width);
  assert.equal(reopenedSingleLine.height, singleLineConversion.height);
  assert.equal(reopenedSingleLine.paragraphWidth, paragraphBeforeConversion.width);
  assert.equal((await inspectSingleLineLayout(objectId, conversionFixture)).text, conversionFixture);
  await page!.locator(`#canvas-el-${objectId}`).click();

  await page!.getByTitle('Text Properties Dialog (F8)', { exact: true }).click();
  await page!.getByText('Text Format', { exact: true }).click();
  await page!.getByRole('radio', { name: 'Multi-line', exact: true }).check();
  await page!.getByRole('button', { name: 'OK', exact: true }).click();
  await saveCurrent();
  const restoredParagraph = savedText();
  assert.equal(restoredParagraph.text, conversionFixture, 'format-dialog conversion preserves source content');
  assert.equal(restoredParagraph.textFormatType, 'paragraph');
  assert.equal(restoredParagraph.width, paragraphBeforeConversion.width,
    'switching back from single line restores the remembered paragraph width');
  assert.equal(restoredParagraph.paragraphWidth, paragraphBeforeConversion.width);
  assert.equal(restoredParagraph.autoHeight, true);
  assert.equal(restoredParagraph.fontSize, singleLineConversion.fontSize);
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'restored paragraph format');
  await page!.screenshot({ path: path.join(evidence, 'single-line-to-multiline-restored.png') });

  const conversionLayoutBeforeReopen = await inspectRenderedLayout();
  await page!.keyboard.press('Control+w');
  await openDocument(outputPath);
  const reopenedConversion = savedText();
  assert.equal(reopenedConversion.text, conversionFixture, 'converted text survives save, close, and reopen');
  assert.equal(reopenedConversion.width, restoredParagraph.width);
  assert.equal(reopenedConversion.paragraphWidth, restoredParagraph.paragraphWidth);
  assert.equal(reopenedConversion.height, restoredParagraph.height);
  assert.deepEqual(
    (await inspectRenderedLayout()).viewBox,
    conversionLayoutBeforeReopen.viewBox,
    'reopened paragraph retains its full auto-height layout',
  );
  await page!.locator(`#canvas-el-${objectId}`).click();
  await replaceObjectText(objectId, fixture);
  await saveCurrent();

  await resizeToWidth(80);
  await saveCurrent();
  const wide = savedText();
  const wideLayout = await inspectRenderedLayout();
  assert.ok(wide.width > narrow.width, 'width handle widened the paragraph after narrowing');
  assert.ok(wide.height < narrow.height, 'widening reduced the required auto-height');
  assert.equal(wide.text, fixture);
  assert.equal(wide.fontSize, initial.fontSize);
  assertAutoHeightContentFits(wideLayout, 'fixture at wide width');
  await replaceObjectText(objectId, 'Align me');
  await page!.getByTitle('Align Left', { exact: true }).click();
  await saveCurrent();
  const leftAligned = await inspectRenderedLayout();
  assert.equal(savedText().textAlign, 'left');
  await page!.getByTitle('Align Center', { exact: true }).click();
  await saveCurrent();
  const centerAligned = await inspectRenderedLayout();
  assert.equal(savedText().textAlign, 'center');
  await page!.getByTitle('Align Right', { exact: true }).click();
  await saveCurrent();
  const rightAligned = await inspectRenderedLayout();
  assert.equal(savedText().textAlign, 'right');
  assert.ok(centerAligned.lineBounds[0].x > leftAligned.lineBounds[0].x + 5,
    'center alignment moves visible glyphs toward the middle of the wide paragraph');
  assert.ok(rightAligned.lineBounds[0].x > centerAligned.lineBounds[0].x + 5,
    'right alignment moves visible glyphs to the right of the usable paragraph width');
  assert.equal(savedText().width, 80, 'alignment preserves the fixed paragraph width');
  assert.equal(savedText().fontSize, initial.fontSize, 'alignment preserves font size');
  await page!.screenshot({ path: path.join(evidence, 'text-toolbar-right-alignment.png') });

  await resizeToWidth(35);
  await saveCurrent();
  await replaceObjectText(objectId, 'alpha beta gamma delta epsilon zeta');
  await page!.getByTitle(/Justify: distribute spaces between words/).click();
  const justified = await inspectRenderedLayout();
  await expect(page!.locator(`#canvas-el-${objectId} svg[data-paragraph-layout="native"]`)).toHaveAttribute('data-text-align', 'justify');
  assert.ok(justified.lines >= 2, 'the justify test paragraph wraps into multiple lines');
  assert.ok(justified.lineBounds[0].right > justified.viewBox.width * 0.8 &&
    justified.lineBounds[0].right <= justified.viewBox.width + 0.15,
  'justification expands the first rendered line across the available width');
  await page!.getByTitle(/Distributed: space characters/).click();
  const distributed = await inspectRenderedLayout();
  await expect(page!.locator(`#canvas-el-${objectId} svg[data-paragraph-layout="native"]`)).toHaveAttribute('data-text-align', 'distributed');
  assert.ok(distributed.lines >= 2, 'the distributed test paragraph wraps into multiple lines');
  assert.ok(distributed.stretchedSegments > 0, 'distributed alignment changes actual SVG character spacing');
  assert.ok(distributed.lineBounds[0].right > distributed.viewBox.width * 0.8 &&
    distributed.lineBounds[0].right <= distributed.viewBox.width + 0.15,
  'distributed alignment expands rendered text across the available width');
  await page!.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(page!.locator(`#canvas-el-${objectId} svg[data-paragraph-layout="native"]`)).toHaveAttribute('data-text-align', 'justify');
  await page!.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await saveCurrent();
  assert.equal(savedText().textAlign, 'distributed', 'one redo reapplies the complete alignment update');

  await replaceObjectText(objectId, sentence);
  await saveCurrent();
  assert.equal(savedText().text, sentence);

  await object.dblclick();
  editor = page!.locator('textarea').last();
  await expect(editor).toHaveValue(sentence);
  await editor.pressSequentially('XYZ');
  await editor.press('Control+z');
  await expect(editor).toHaveValue(`${sentence}XY`);
  await editor.press('Control+z');
  await expect(editor).toHaveValue(`${sentence}X`);
  await editor.press('Control+z');
  await expect(editor).toHaveValue(sentence);
  await editor.press('Control+y');
  await editor.press('Control+y');
  await editor.press('Control+y');
  await expect(editor).toHaveValue(`${sentence}XYZ`, { timeout: 5000 });
  await editor.press('Escape');
  await expect(page!.locator('textarea')).toHaveCount(0);
  await object.dblclick();
  editor = page!.locator('textarea').last();
  await expect(editor).toHaveValue(sentence);
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(node.value.length, node.value.length));
  await editor.press('Backspace');
  await editor.press('Backspace');
  await editor.press('Backspace');
  await expect(editor).toHaveValue(sentence.slice(0, -3));
  await editor.pressSequentially(sentence.slice(-3));
  await expect(editor).toHaveValue(sentence);
  await editor.press('Control+Enter');
  await saveCurrent();
  assert.equal(savedText().text, sentence);
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'requested sentence');

  await object.dblclick();
  editor = page!.locator('textarea').last();
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(0, node.value.length));
  await application.evaluate(({ clipboard }, text) => clipboard.writeText(text), variedText);
  await editor.press('Control+v');
  await expect(editor).toHaveValue(variedText);
  await editor.press('Control+Enter');
  await saveCurrent();
  assert.equal(savedText().text, variedText, 'blank lines, trailing newline, Hindi/English, and long words persist verbatim');
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'multiline whitespace/Unicode/long-word fixture');
  await page!.screenshot({ path: path.join(evidence, 'multiline-whitespace-unicode.png') });

  const geometryBeforeFontChange = { width: savedText().width, height: savedText().height, fontSize: savedText().fontSize };
  await setNumericProperty('Font Size (pt)', 14);
  await saveCurrent();
  const largerFont = savedText();
  assert.equal(largerFont.width, geometryBeforeFontChange.width);
  assert.equal(largerFont.fontSize, 14);
  assert.ok(largerFont.height > geometryBeforeFontChange.height, 'font-size increase grows auto-height, not width');
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'larger font');

  const heightBeforeSpacing = largerFont.height;
  await setNumericProperty('Line Height', 2);
  await saveCurrent();
  const adjustedSpacing = savedText();
  assert.equal(adjustedSpacing.width, largerFont.width);
  assert.equal(adjustedSpacing.lineHeight, 2);
  assert.ok(adjustedSpacing.height > heightBeforeSpacing, 'line spacing remeasures paragraph height');
  assertAutoHeightContentFits(await inspectRenderedLayout(), 'updated line spacing');

  const geometryBeforeZoom = await inspectRenderedLayout();
  for (const zoom of ['50%', '100%', '200%']) {
    await page!.locator('button[title*="Click to set zoom level."]').click();
    await page!.getByRole('button', { name: zoom, exact: true }).click();
    const layout = await inspectRenderedLayout();
    assert.deepEqual(layout.viewBox, geometryBeforeZoom.viewBox, `${zoom} changes viewport scale, not document viewBox geometry`);
    assert.equal(savedText().width, adjustedSpacing.width);
    assert.equal(savedText().height, adjustedSpacing.height);
    assertAutoHeightContentFits(layout, `at ${zoom} zoom`);
  }
  await page!.screenshot({ path: path.join(evidence, 'multiline-after-layout.png') });

  await page!.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
  await page!.getByTitle('Curved text along circular or elliptical arc paths', { exact: true }).click();
  const arcObject = page!.locator('[id^="canvas-el-"]').last();
  const arcId = (await arcObject.getAttribute('id'))!.slice('canvas-el-'.length);
  await expect(arcObject.locator('svg[data-arc-text="native"]')).toBeVisible();
  const arcSvg = arcObject.locator('svg[data-arc-text="native"]');
  await expect(arcSvg.locator('textPath')).toHaveText(/.+/);
  await saveCurrent();
  const savedArc = () => deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!
    .elements.find(element => element.id === arcId) as TextElement;
  await moveElementToPosition(arcId, savedArc(), 49.5, 10);
  await saveCurrent();
  assert.ok(Math.abs(savedArc().x - 49.5) < 1, 'arc object can be moved clear of the paragraph without changing its width');
  const initialArcPath = await arcSvg.locator('path').getAttribute('d');
  await page!.getByTitle('Align Left', { exact: true }).click();
  await expect(arcSvg.locator('textPath')).toHaveAttribute('startOffset', '0%');
  await expect(arcSvg.locator('textPath')).toHaveAttribute('text-anchor', 'start');
  await page!.getByTitle('Align Center', { exact: true }).click();
  await expect(arcSvg.locator('textPath')).toHaveAttribute('startOffset', '50%');
  await page!.getByTitle('Arc Text Direction: Counterclockwise', { exact: true }).click();
  const counterClockwisePath = await arcSvg.locator('path').getAttribute('d');
  assert.notEqual(counterClockwisePath, initialArcPath, 'arc direction changes the actual rendered path');
  await page!.screenshot({ path: path.join(evidence, 'text-toolbar-counterclockwise-arc.png') });
  const savedArcDirection = () => savedArc().arcConfig?.direction ?? savedArc().arcDirection ?? 'clockwise';
  await page!.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(arcSvg.locator('path')).toHaveAttribute('d', initialArcPath!);
  await page!.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await saveCurrent();
  assert.equal(savedArcDirection(), 'counter-clockwise', 'arc direction persists in the document model');

  await page!.getByTitle('Text Object Types & Markup Containers...', { exact: true }).click();
  await page!.getByTitle('Content-sized single-line text, non-wrapping', { exact: true }).click();
  const singleLineObject = page!.locator('[id^="canvas-el-"]').last();
  const singleLineId = (await singleLineObject.getAttribute('id'))!.slice('canvas-el-'.length);
  await saveCurrent();
  const savedSingleLine = () => deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!
    .elements.find(element => element.id === singleLineId) as TextElement;
  const initialSingleLineWidth = savedSingleLine().width;
  await moveElementToPosition(singleLineId, savedSingleLine(), 48, 45);
  await replaceObjectText(singleLineId, 'A much wider single-line sample');
  await saveCurrent();
  const expandedSingleLine = savedSingleLine();
  assert.equal(expandedSingleLine.textType, 'single-line');
  assert.ok(expandedSingleLine.width > initialSingleLineWidth, 'actual single-line text editing expands auto-width');
  await replaceObjectText(singleLineId, 'S');
  await saveCurrent();
  assert.ok(savedSingleLine().width < expandedSingleLine.width, 'deleting single-line content shrinks auto-width');
  await page!.getByTitle('Single Line text format', { exact: true }).click();
  await expect(page!.getByTitle('Single Line text format', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page!.screenshot({ path: path.join(evidence, 'text-toolbar-single-line.png') });

  await saveCurrent();
  const saved = savedText();
  await page!.keyboard.press('Control+w');
  await openDocument(outputPath);
  const reopened = savedText();
  assert.equal((deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!
    .elements.find(element => element.id === arcId) as TextElement).arcConfig?.direction,
  'counter-clockwise', 'saved arc direction survives reopening');
  assert.equal((deserializeBarcodeFlowDocument(readFileSync(outputPath, 'utf8')).template!
    .elements.find(element => element.id === singleLineId) as TextElement).text,
  'S', 'single-line content survives reopening after auto-width shrink');
  assert.equal(reopened.text, saved.text);
  assert.equal(reopened.width, saved.width);
  assert.equal(reopened.height, saved.height);
  assert.equal(reopened.fontSize, saved.fontSize);
  assert.equal(reopened.lineHeight, saved.lineHeight);
  const reopenedLayout = await inspectRenderedLayout();
  assertAutoHeightContentFits(reopenedLayout, 'saved and reopened paragraph');
  await page!.getByText('File', { exact: true }).click();
  await page!.getByText('Print Preview', { exact: true }).click();
  await expect(page!.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true })).toBeVisible();
  const previewSvg = page!.locator(`[data-preview-element-id="${objectId}"] svg[data-paragraph-layout="native"]`);
  await expect(previewSvg).toBeVisible();
  await expect(page!.locator(`[data-preview-element-id="${arcId}"] svg[data-arc-text="native"]`)).toBeVisible();
  const previewLayout = await previewSvg.evaluate(svg => {
    const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>('text'));
    const boxes = textNodes.map(text => text.getBBox());
    const bounds = boxes.reduce((result, box) => ({
      x: Math.min(result.x, box.x),
      y: Math.min(result.y, box.y),
      right: Math.max(result.right, box.x + box.width),
      bottom: Math.max(result.bottom, box.y + box.height),
    }), { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });
    return {
      content: textNodes.map(text => text.textContent || '').join(''),
      lines: new Set(textNodes.map(text => text.getAttribute('y'))).size,
      width: svg.viewBox.baseVal.width,
      height: svg.viewBox.baseVal.height,
      bounds,
    };
  });
  assert.equal(previewLayout.content, reopenedLayout.content, 'print preview preserves every rendered source character');
  assert.equal(previewLayout.lines, reopenedLayout.lines, 'print preview shows every wrapped and explicit line');
  assert.ok(previewLayout.bounds.bottom <= previewLayout.height + 0.15, 'print preview glyphs fit the complete paragraph box');
  assert.ok(previewLayout.bounds.x >= -0.25 && previewLayout.bounds.right <= previewLayout.width + 0.25,
    'print preview glyph bounds remain within a 0.25mm font-sidebearing tolerance of the paragraph width');
  await page!.screenshot({ path: path.join(evidence, 'multiline-print-preview.png') });
  await page!.getByTitle('Close Print Preview and Return to Editor (Esc)', { exact: true }).click();

  await application!.evaluate(({ dialog }, targetPath) => {
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, pdfPath);
  await page!.getByText('File', { exact: true }).click();
  await page!.getByText('Export High-Resolution PDF', { exact: true }).click();
  await expect.poll(() => existsSync(pdfPath)).toBe(true);
  const pdfBytes = readFileSync(pdfPath);
  assert.ok(pdfBytes.subarray(0, 5).toString('ascii') === '%PDF-', 'PDF export produced a valid PDF');
  const pdfDocument = await PDFDocument.load(pdfBytes);
  assert.equal(pdfDocument.getPageCount(), 1, 'PDF export contains the expected single label page');
  const xObjects = pdfDocument.context.lookup(
    pdfDocument.getPage(0).node.Resources().lookup(PDFName.of('XObject')),
    PDFDict,
  );
  assert.ok(xObjects.keys().length >= 2, 'PDF embeds separate rendered artwork for both paragraph and arc text');

  const report = {
    result: 'passed',
    fixture,
    assertions: [
      'actual Electron editor paste preserves the exact fixture',
      'narrow and wide width handles reflow while fixed width and font size semantics are preserved',
      'SVG glyph bounds fit the auto-height viewport and selection bounds at each tested width',
      'a final line containing g/j/p/q/y descenders remains inside the measured auto-height viewport',
      'fixed-height overflow remains explicit until Grow height is chosen; the action preserves width/font and supports undo/redo',
      'caret paste preserves existing prefix and suffix while select-all paste replaces only the selected range',
      'paragraph-to-single-line conversion preserves text, typography, anchor, and expands beyond the page with no wrap',
      'single-line PDF keeps the physical page size while preview clips content at the page edge without rewrapping',
      'single-line conversion survives save/close/reopen and the properties-dialog return restores paragraph width',
      'Text Properties switches back to the saved paragraph width and recalculates complete auto-height',
      'sentence replacement, repeated typing/deletion, blank lines, trailing newline, Hindi/English and long unbroken text',
      'font-size and line-height changes remeasure auto-height',
      '50%, 100% and 200% zoom preserve document-coordinate geometry',
      'toolbar left/center/right controls reposition visible glyphs and justify/distributed controls affect wrapped rendering',
      'alignment and arc direction changes are coherent undo/redo operations',
      'arc direction changes path geometry and survives save/reopen and print preview',
      'single-line toolbar mode preserves its state and grows/shrinks rendered object width through actual editing',
      'save, close and reopen preserve source text and measured layout',
      'print preview shows every line and the high-resolution PDF embeds paragraph and arc artwork',
    ],
    evidence,
    editableDocument: outputPath,
    singleLineConversion: {
      paragraph: { width: paragraphBeforeConversion.width, height: paragraphBeforeConversion.height, lines: paragraphBeforeConversionLayout.lines },
      singleLine: { width: singleLineConversion.width, height: singleLineConversion.height, fontSize: singleLineConversion.fontSize, rendered: singleLineLayout },
      restoredParagraph: { width: restoredParagraph.width, height: restoredParagraph.height, lines: conversionLayoutBeforeReopen.lines },
      pdf: { width: conversionPdfSize.width, height: conversionPdfSize.height, path: conversionPdfPath },
    },
    pdf: pdfPath,
    beforeNarrow,
    narrow: { stored: { width: narrow.width, height: narrow.height, fontSize: narrow.fontSize }, rendered: narrowLayout },
    wide: { stored: { width: wide.width, height: wide.height, fontSize: wide.fontSize }, rendered: wideLayout },
    reopened: { stored: { width: reopened.width, height: reopened.height, fontSize: reopened.fontSize }, rendered: reopenedLayout },
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(evidence, 'multiline-failure.png') }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await application?.close().catch(() => undefined);
  rmSync(tempRoot, { recursive: true, force: true });
}
