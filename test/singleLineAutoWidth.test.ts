import assert from 'node:assert/strict';
import test from 'node:test';
import type { LabelTemplate, TextElement } from '../src/types';
import { evaluateTextElement, evaluateTextElementRuns } from '../src/services/dataSourceEngine';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { layoutParagraph } from '../src/services/paragraphLayout';
import { convertTextElementFormat, recalculateTextElementDimensions } from '../src/services/textMeasurementEngine';

const sentence = 'Opening the modal must preserve the intended range.';

function singleLine(value: string): TextElement {
  return {
    id: 'single-line-autowidth',
    name: 'Single Line Test',
    type: 'text',
    text: value,
    textType: 'single-line',
    textFormatType: 'single-line',
    sizingMode: 'auto-width',
    autoSize: true,
    autoFit: false,
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
    x: 24,
    y: 16,
    width: 20,
    height: 6,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 1,
    referencePoint: 'top-left',
    dataSources: [{ id: 'embedded-1', name: 'Embedded Data', type: 'embedded', value, valueEncoding: 'raw', enabled: true }],
  } as TextElement;
}

test('content-driven single-line paste content grows and shrinks bounds without changing typography or anchor', () => {
  const initial = singleLine('Sample Text');
  const initialSize = recalculateTextElementDimensions(initial, initial.text);
  const expanded = {
    ...initial,
    text: sentence,
    dataSources: [{ ...initial.dataSources![0], value: sentence }],
  };
  const expandedSize = recalculateTextElementDimensions(expanded, sentence);
  const shortened = {
    ...expanded,
    text: 'ABC',
    dataSources: [{ ...expanded.dataSources![0], value: 'ABC' }],
  };
  const shortenedSize = recalculateTextElementDimensions(shortened, 'ABC');

  assert.equal(evaluateTextElement(expanded), sentence);
  assert.ok(expandedSize.width > initialSize.width);
  assert.ok(shortenedSize.width < expandedSize.width);
  assert.equal(expanded.fontSize, initial.fontSize);
  assert.equal(expanded.fontFamily, initial.fontFamily);
  assert.equal(expanded.fontWeight, initial.fontWeight);
  assert.equal(expanded.fontStyle, initial.fontStyle);
  assert.equal(expanded.letterSpacing, initial.letterSpacing);
  assert.deepEqual([expanded.x, expanded.y, expanded.referencePoint], [initial.x, initial.y, initial.referencePoint]);
  assert.deepEqual(recalculateTextElementDimensions(expanded, sentence), expandedSize);

  const largerFont = { ...expanded, fontSize: 14 };
  const largerFontSize = recalculateTextElementDimensions(largerFont, sentence);
  const spacedText = { ...expanded, letterSpacing: 1.5 };
  const spacedSize = recalculateTextElementDimensions(spacedText, sentence);
  assert.ok(largerFontSize.width > expandedSize.width);
  assert.ok(spacedSize.width > expandedSize.width);
  assert.equal(largerFont.fontSize, 14);
});

test('multi-source single-line text measures the complete resolved value and survives BFL round-trip', () => {
  const element = singleLine('');
  element.text = sentence;
  element.dataSources = [
    { id: 'part-1', name: 'Opening', type: 'embedded', value: 'Opening the modal must ', valueEncoding: 'raw', enabled: true },
    { id: 'part-2', name: 'Remainder', type: 'embedded', value: 'preserve the intended range.', valueEncoding: 'raw', enabled: true },
  ];
  const dimensions = recalculateTextElementDimensions(element, sentence);
  assert.equal(evaluateTextElement(element), sentence);
  assert.ok(dimensions.width > recalculateTextElementDimensions(singleLine('Sample Text')).width);

  const template = {
    id: 'single-line-test-template',
    name: 'Single Line Auto Width Test',
    description: 'Content-driven single-line sizing acceptance fixture.',
    category: 'QA',
    version: '1.0',
    status: 'draft',
    tags: ['QA'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'QA',
    dimensions: { width: 300, height: 100, unit: 'mm', dpi: 300, orientation: 'landscape' },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
    elements: [element],
    variables: [],
    sampleRecords: [],
  } as LabelTemplate;
  const saved = serializeBarcodeFlowDocument(template);
  const reopened = deserializeBarcodeFlowDocument(JSON.parse(JSON.stringify(saved)), 'Single Line Auto Width').template!;
  const reopenedText = reopened.elements[0] as TextElement;
  assert.equal(evaluateTextElement(reopenedText), sentence);
  assert.equal(reopenedText.width, element.width);
  assert.equal(reopenedText.sizingMode, 'auto-width');
});

test('fixed-width paragraph still wraps to its configured layout width', () => {
  const paragraph = {
    ...singleLine(sentence),
    textType: 'paragraph',
    textFormatType: 'paragraph',
    sizingMode: 'fixed-width',
    autoSize: false,
    multiline: true,
    wrap: true,
    width: 28,
    height: 30,
  } as TextElement;
  const layout = layoutParagraph(paragraph, [{ sourceId: 'paragraph', type: 'text', value: sentence, style: {} }], text => [...text].length);
  assert.equal(recalculateTextElementDimensions(paragraph, sentence).width, 28);
  assert.ok(layout.lines.length > 1);
});

test('paragraph to single-line conversion expands content width and restores paragraph width on return', () => {
  const value = 'I want to integrate Justdial leads with my own CRM. Please confirm whether Justdial provides a Lead API, Pull API, Push API, webhook, or third-party CRM integration. Please share the API endpoint.';
  const paragraph: TextElement = {
    ...singleLine(value),
    textType: 'paragraph',
    textFormatType: 'paragraph',
    sizingMode: 'fixed-width',
    autoSize: false,
    autoHeight: true,
    autoFit: false,
    multiline: true,
    wrap: true,
    wordWrap: true,
    width: 50,
    height: 10,
    paragraphWidth: 50,
    x: 12,
    y: 8,
    fontSize: 12,
  };
  const convertedUpdates = convertTextElementFormat(paragraph, 'single-line', value);
  const single = { ...paragraph, ...convertedUpdates };
  assert.equal(single.id, paragraph.id);
  assert.equal(single.text, value);
  assert.equal(single.textType, 'single-line');
  assert.equal(single.sizingMode, 'auto-width');
  assert.equal(single.autoSize, true);
  assert.equal(single.autoFit, false);
  assert.equal(single.fontSize, paragraph.fontSize);
  assert.equal(single.x, paragraph.x);
  assert.equal(single.y, paragraph.y);
  assert.equal(single.paragraphWidth, 50);
  assert.ok(single.width > 100, 'single-line width is content-driven and may extend beyond the label');
  assert.equal(single.height, recalculateTextElementDimensions(single, value).height);

  const restoredUpdates = convertTextElementFormat(single, 'paragraph', value);
  const restored = { ...single, ...restoredUpdates };
  const restoredLayout = layoutParagraph(restored, [{ sourceId: 'paragraph', type: 'text', value, style: {} }], text => [...text].length);
  assert.equal(restored.text, value, 'visual wrapping never edits the stored source text');
  assert.equal(restored.width, 50, 'switching back restores the previous paragraph width');
  assert.equal(restored.paragraphWidth, 50);
  assert.equal(restored.autoHeight, true);
  assert.equal(restored.sizingMode, 'fixed-width');
  assert.ok(restored.height > single.height);
  assert.ok(restoredLayout.lines.length > 1);
  assert.equal(restored.fontSize, paragraph.fontSize);
  assert.deepEqual([restored.x, restored.y], [paragraph.x, paragraph.y]);
});

test('format conversion preserves explicit fixed-box Auto Size instead of enabling content sizing', () => {
  const element = {
    ...singleLine('Sample Text'),
    textType: 'paragraph',
    textFormatType: 'paragraph',
    sizingMode: 'fit-to-box',
    autoSize: false,
    autoFit: true,
    autoHeight: false,
    autoSizeConfig: {
      enabled: true,
      minFontSize: 6,
      maxFontSize: 24,
      minWidthScale: 50,
      maxWidthScale: 150,
    },
    width: 50,
    height: 20,
  } as TextElement;
  const converted = convertTextElementFormat(element, 'single-line');
  assert.equal(converted.sizingMode, undefined);
  assert.equal(converted.width, undefined);
  assert.equal(converted.height, undefined);
  assert.equal(converted.textType, 'single-line');
  assert.equal(converted.autoFit, undefined);
});

test('database record changes remeasure ordered source runs without flattening their bindings', () => {
  const element = singleLine('');
  element.dataSources = [
    { id: 'prefix', name: 'Prefix', type: 'embedded', value: 'Item: ', valueEncoding: 'raw', enabled: true },
    { id: 'description', name: 'Description', type: 'database-field', field: 'description', value: '', valueEncoding: 'raw', enabled: true },
  ];
  const shortRecord = { description: 'ABC' };
  const longRecord = { description: sentence };
  const shortText = evaluateTextElement(element, { record: shortRecord });
  const longText = evaluateTextElement(element, { record: longRecord });
  const shortWidth = recalculateTextElementDimensions(element, shortText, undefined, evaluateTextElementRuns(element, { record: shortRecord })).width;
  const longWidth = recalculateTextElementDimensions(element, longText, undefined, evaluateTextElementRuns(element, { record: longRecord })).width;

  assert.equal(element.dataSources[1].type, 'database-field');
  assert.ok(longWidth > shortWidth);
  assert.equal(evaluateTextElement(element, { record: longRecord }), `Item: ${sentence}`);
});
