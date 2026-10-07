import assert from 'node:assert/strict';
import test from 'node:test';
import { getTextElementMarkup, parseRtfToHtml } from '../src/services/textMarkupEngine';
import { evaluateTextElement, evaluateTextElementRuns } from '../src/services/dataSourceEngine';
import type { TextElement } from '../src/types';
import { layoutParagraph } from '../src/services/paragraphLayout';
import { CONTROL_CHARACTERS } from '../src/services/symbolService';
import { measureTextObject } from '../src/services/textMeasurementEngine';
import { getMultiLineLayoutValue, insertAtSelection } from '../src/services/controlCharacterService';
import { serializeBarcodeFlowDocument, deserializeBarcodeFlowDocument } from '../src/services/documentFileService';
import type { LabelTemplate } from '../src/types';

test('paragraph hanging indent, physical tab stops, paragraph reset and mixed-font widths have independent expected positions', () => {
  const element = { width: 14, height: 40, fontSize: 10, lineHeight: 1, indentationMode: 'hanging', indentationMm: 4,
    tabStops: [4], defaultTabIntervalMm: 4 } as TextElement;
  const runs = [
    { sourceId: 'label', type: 'text', value: 'D:\t', style: { fontSize: 10 } },
    { sourceId: 'field', type: 'text', value: 'abcdef ghijkl', style: { fontSize: 10, fontWeight: 'bold' } },
    { sourceId: 'status', type: 'text', value: '\r', style: { fontSize: 10 } },
    { sourceId: 'status-value', type: 'text', value: '\nS:\tOK', style: { fontSize: 10 } },
  ] as any;
  const result = layoutParagraph(element, runs, text => [...text].length);
  assert.equal(result.lines.length, 3);
  assert.deepEqual(result.segments.filter(segment => segment.text.trim()).map(segment => [segment.text, segment.x, segment.line]),
    [['D:', 0, 0], ['abcdef', 4, 0], ['ghijkl', 4, 1], ['S:', 0, 2], ['OK', 4, 2]]);
  assert.equal(result.segments[1].sourceId, 'field');
  assert.equal(result.segments[1].style.fontWeight, 'bold');
  assert.equal(layoutParagraph({ ...element, width: 95.3 }, runs, text => [...text].length).width, 95.3);
  const aligned = layoutParagraph({ ...element, textAlign: 'right' }, [{ sourceId: 'one', type: 'text', value: 'AB CD', style: {} }], text => text.length);
  assert.deepEqual(aligned.segments.map(segment => segment.x), [9, 11, 12]);
});

test('four-source composition preserves identities, controls, bindings, missing fields and source-level inheritance', () => {
  const text = { id: 'qa-text', type: 'text', text: '', fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal',
    dataSources: [
      { id: 'literal-description', name: 'Description', type: 'embedded', value: 'Description:\t', valueEncoding: 'raw' },
      { id: 'description-field', name: 'QA description', type: 'database-field', field: 'qa_description', value: '', valueEncoding: 'raw',
        fontOverrideEnabled: true, fontStyleOverride: { fontWeight: 'bold' } },
      { id: 'literal-status', name: 'Status', type: 'embedded', value: '\rStatus:\t', valueEncoding: 'raw' },
      { id: 'status-field', name: 'Status', type: 'database-field', field: 'subinventory_status', value: '', valueEncoding: 'raw' },
    ] } as TextElement;
  assert.equal(evaluateTextElement(text, { record: { qa_description: 'Long 日本語 «CR»', subinventory_status: 'Active' } }),
    'Description:\tLong 日本語 «CR»\rStatus:\tActive');
  assert.equal(evaluateTextElement(text, { record: { qa_description: null, subinventory_status: '' } }), 'Description:\t\rStatus:\t');
  assert.match(evaluateTextElement(text, { record: {} }), /Missing field: qa_description/);
  const runs = evaluateTextElementRuns(text, { record: { qa_description: 'Value', subinventory_status: 'Active' } });
  assert.deepEqual(runs.map(run => run.sourceId), ['literal-description', 'description-field', 'literal-status', 'status-field']);
  assert.equal(runs[0].style.fontWeight, 'normal');
  assert.equal(runs[1].style.fontWeight, 'bold');
  assert.equal(runs[2].style.fontWeight, 'normal');
  const disabledControl = { ...text, dataSources: [...text.dataSources!, { id: 'disabled', name: 'Disabled CR', type: 'control-character' as const,
    controlCode: 'CR', enabled: false, value: '' }] };
  assert.deepEqual(evaluateTextElementRuns(disabledControl, { record: { qa_description: 'Value', subinventory_status: 'Active' } }).map(run => run.sourceId),
    ['literal-description', 'description-field', 'literal-status', 'status-field']);
});
import { CANONICAL_CONTROL_CHARACTERS, getControlByToken, insertAtSelection, normalizeLineBreaks,
  resolveStoredControlValue } from '../src/services/controlCharacterService';

test('ASCII control registry covers exact C0 and DEL values without confusing decimal and hexadecimal lookup', () => {
  assert.deepEqual(CANONICAL_CONTROL_CHARACTERS.map(control => control.code), [...Array.from({ length: 32 }, (_, index) => index), 127]);
  for (const control of CANONICAL_CONTROL_CHARACTERS) {
    assert.equal(control.runtimeValue.charCodeAt(0), control.code);
    assert.equal(control.decimal, control.code);
    assert.equal(control.hex, control.code.toString(16).toUpperCase().padStart(2, '0'));
  }
  assert.equal(getControlByToken('13')?.abbr, 'CR');
  assert.equal(getControlByToken('0x0D')?.abbr, 'CR');
  assert.deepEqual(CONTROL_CHARACTERS.map(control => [control.code, control.hex, control.abbr, control.char]),
    CANONICAL_CONTROL_CHARACTERS.map(control => [control.code, control.hex, control.abbr, control.runtimeValue]));
  assert.match(CONTROL_CHARACTERS.find(control => control.code === 29)!.barcodeUsage!, /distinct/);
});

test('raw controls and intentionally literal tokens remain distinct, with legacy token compatibility and no NUL truncation', () => {
  const raw = 'A\x00B\tC\r\nD\rE\nF literal «CR» <<CR>>';
  assert.equal(resolveStoredControlValue(raw, 'raw'), raw);
  assert.equal(JSON.parse(JSON.stringify({ value: raw })).value, raw);
  assert.equal(resolveStoredControlValue('A<<CR>>B', 'legacy-control-tokens'), 'A\rB');
  assert.equal(normalizeLineBreaks('A\r\nB\rC\nD'), 'A\nB\nC\nD');
  assert.deepEqual(insertAtSelection('abcdef', '\t', 2, 4), { value: 'ab\tef', newCursor: 3 });
  assert.deepEqual(insertAtSelection('A\x00B', '\r', 3, 3), { value: 'A\x00B\r', newCursor: 4 });
});

test('RTF header preserves plain text before the first formatting control', () => {
  const html = parseRtfToHtml('{\\rtf1\\ansi Batch \\b 000101\\b0\\par Second line}');
  assert.equal(html.replace(/<[^>]*>/g, ''), 'Batch 000101Second line');
  assert.match(html, /font-weight:bold/);
  assert.match(html, /<br\s*\/?>Second line/);
});

test('RTF ANSI header preserves content without subsequent controls', () => {
  assert.equal(parseRtfToHtml('{\\rtf1\\ansi Plain batch text}'), 'Plain batch text');
});

test('paragraph format does not replace rich-text markup with literal SVG content', () => {
  const element = { textFormatType: 'paragraph', textType: 'rtf', rtfRaw: '{\\rtf1\\ansi Batch \\b Bold\\b0}' } as TextElement;
  assert.match(getTextElementMarkup(element)!, /font-weight:bold/);
  assert.doesNotMatch(getTextElementMarkup(element)!, /<svg/);
  assert.match(getTextElementMarkup({ ...element, textType: 'html', richContentHtml: '<strong>HTML</strong>' })!, /<strong>HTML<\/strong>/);
});

test('paragraph content sizing grows with font while explicit physical width stays fixed', () => {
  const params = { text: 'TRACE 000101\nSECOND LINE', textType: 'multi-line', textFormatType: 'paragraph' as const, fontSize: 10 };
  const normal = measureTextObject(params);
  const larger = measureTextObject({ ...params, fontSize: 14 });
  assert.ok(larger.width > normal.width);
  assert.ok(larger.height > normal.height);
  assert.equal(measureTextObject({ ...params, containerWidthMm: 95.3 }).width, 95.3);
  assert.equal(measureTextObject({ ...params, containerWidthMm: 95.3, fontSize: 14 }).width, 95.3);
});

test('structured CR separators survive source transforms and retain database bindings', () => {
  const element = {
    id: 'cr-transform-label',
    type: 'text',
    text: '',
    textType: 'paragraph',
    textFormatType: 'paragraph',
    fontSize: 10,
    width: 60,
    height: 30,
    lineHeight: 1.2,
    dataSources: [
      { id: 'field-a', name: 'Field A', type: 'database-field', field: 'a', value: '', valueEncoding: 'raw' },
      { id: 'cr-1', name: '<CR>', type: 'control-character', controlCode: 'CR', code: 'CR', decimal: 13, hex: '0D', value: '\r', valueEncoding: 'raw',
        transforms: [{ id: 'trim-cr', type: 'trim', enabled: true, params: { trimType: 'both' } }] },
      { id: 'field-b', name: 'Field B', type: 'database-field', field: 'b', value: '', valueEncoding: 'raw' },
    ],
  } as TextElement;
  const record = { a: 'Item ABC', b: 'Batch 123' };

  assert.equal(evaluateTextElement(element, { record }), 'Item ABC\rBatch 123');
  assert.deepEqual(evaluateTextElementRuns(element, { record }).map(run => [run.sourceId, run.type, run.value]), [
    ['field-a', 'text', 'Item ABC'],
    ['cr-1', 'control', '\r'],
    ['field-b', 'text', 'Batch 123'],
  ]);
  assert.deepEqual(element.dataSources?.filter(source => source.type === 'database-field').map(source => source.field), ['a', 'b']);

  const elementWithLineBreakReplacement = {
    ...element,
    transforms: [{ id: 'remove-cr', type: 'search_replace', enabled: true, params: { search: '\r', replace: '' } }],
  } as TextElement;
  assert.equal(evaluateTextElement(elementWithLineBreakReplacement, { record }), 'Item ABC\rBatch 123');
});

test('ordered field and CR sources keep exact line structure across records, empty fields, legacy tokens and BFL persistence', () => {
  const cr = (id: string) => ({ id, name: '<CR>', type: 'control-character' as const, controlCode: 'CR', code: 'CR', decimal: 13, hex: '0D', value: '\r', valueEncoding: 'raw' as const, enabled: true });
  const element = {
    id: 'three-fields', name: 'Three fields', type: 'text', textType: 'paragraph', textFormatType: 'paragraph',
    text: '', fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal', fontStyle: 'normal', color: '#000000',
    textAlign: 'left', lineHeight: 1.2, x: 4, y: 4, width: 80, height: 30, rotation: 0, opacity: 1,
    locked: false, visible: true, zIndex: 1,
    dataSources: [
      { id: 'field-a', name: 'Field A', type: 'database-field', field: 'fieldA', databaseField: 'fieldA', value: '', valueEncoding: 'raw', enabled: true },
      cr('cr-a-b'),
      { id: 'field-b', name: 'Field B', type: 'database-field', field: 'fieldB', databaseField: 'fieldB', value: '', valueEncoding: 'raw', enabled: true },
      cr('cr-b-c'),
      { id: 'field-c', name: 'Field C', type: 'database-field', field: 'fieldC', databaseField: 'fieldC', value: '', valueEncoding: 'raw', enabled: true },
    ],
  } as TextElement;
  const lineTexts = (item: TextElement, record: Record<string, string>) => {
    const runs = evaluateTextElementRuns(item, { record });
    const layout = layoutParagraph(item, runs, text => [...text].length);
    return Array.from({ length: layout.lines.length }, (_, line) => layout.segments
      .filter(segment => segment.line === line)
      .sort((left, right) => left.x - right.x)
      .map(segment => segment.text)
      .join(''));
  };
  const recordA = { fieldA: 'Item ABC', fieldB: 'Batch 123', fieldC: 'Qty 10' };
  const recordB = { fieldA: 'Item XYZ', fieldB: 'Batch 456', fieldC: 'Qty 7' };

  assert.equal(evaluateTextElement(element, { record: recordA }), 'Item ABC\rBatch 123\rQty 10');
  assert.equal(evaluateTextElement(element, { record: recordA }).charCodeAt(8), 13);
  assert.deepEqual(lineTexts(element, recordA), ['Item ABC', 'Batch 123', 'Qty 10']);
  assert.deepEqual(lineTexts(element, recordB), ['Item XYZ', 'Batch 456', 'Qty 7']);
  assert.deepEqual(element.dataSources?.map(source => source.id), ['field-a', 'cr-a-b', 'field-b', 'cr-b-c', 'field-c']);

  const emptyMiddle = { ...element, dataSources: element.dataSources!.map(source => source.id === 'field-b' ? { ...source, value: '' } : source) } as TextElement;
  assert.equal(evaluateTextElement(emptyMiddle, { record: { ...recordA, fieldB: '' } }), 'Item ABC\r\rQty 10');
  assert.deepEqual(lineTexts(emptyMiddle, { ...recordA, fieldB: '' }), ['Item ABC', '', 'Qty 10']);

  const adjacentCrLf = { ...element, dataSources: [element.dataSources![0], cr('cr'), { ...cr('lf'), controlCode: 'LF', code: 'LF', decimal: 10, hex: '0A', value: '\n' }, element.dataSources![2]] } as TextElement;
  assert.equal(evaluateTextElement(adjacentCrLf, { record: recordA }), 'Item ABC\r\nBatch 123');
  assert.deepEqual(lineTexts(adjacentCrLf, recordA), ['Item ABC', 'Batch 123']);

  const consecutive = { ...element, dataSources: [element.dataSources![0], cr('cr-1'), cr('cr-2'), element.dataSources![2]] } as TextElement;
  assert.deepEqual(lineTexts(consecutive, recordA), ['Item ABC', '', 'Batch 123']);
  assert.deepEqual(lineTexts({ ...element, dataSources: [cr('leading'), element.dataSources![0]] } as TextElement, recordA), ['', 'Item ABC']);
  assert.deepEqual(lineTexts({ ...element, dataSources: [element.dataSources![0], cr('trailing')] } as TextElement, recordA), ['Item ABC', '']);

  const legacy = { ...element, dataSources: [{ id: 'legacy', name: 'Legacy token', type: 'embedded', value: 'Item ABC<<CR>>Batch 123', valueEncoding: 'legacy-control-tokens', enabled: true }] } as TextElement;
  assert.equal(evaluateTextElement(legacy, { record: recordA }), 'Item ABC\rBatch 123');
  const rawToken = { ...element, dataSources: [{ id: 'literal', name: 'Literal token', type: 'embedded', value: 'Item ABC<<CR>>Batch 123 \\r', valueEncoding: 'raw', enabled: true }] } as TextElement;
  assert.equal(evaluateTextElement(rawToken, { record: recordA }), 'Item ABC<<CR>>Batch 123 \\r');
  assert.deepEqual(lineTexts(rawToken, recordA), ['Item ABC<<CR>>Batch 123 \\r']);
  const rawControl = { ...element, dataSources: [{ id: 'raw-cr', name: 'Raw CR', type: 'embedded', value: 'Item ABC\rBatch 123', valueEncoding: 'raw', enabled: true }] } as TextElement;
  assert.deepEqual(lineTexts(rawControl, recordA), ['Item ABC', 'Batch 123']);

  const template = {
    id: 'cr-roundtrip', name: 'CR round-trip', description: 'Synthetic CR persistence fixture', category: 'QA', version: '1.0', status: 'draft', tags: ['QA'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'QA',
    dimensions: { width: 100, height: 60, unit: 'mm', dpi: 300, orientation: 'landscape' },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 0 },
    elements: [element], variables: [], sampleRecords: [recordA, recordB],
  } as LabelTemplate;
  const file = serializeBarcodeFlowDocument(template);
  const reopened = deserializeBarcodeFlowDocument(JSON.parse(JSON.stringify(file)), 'CR round-trip').template!;
  assert.deepEqual(reopened.elements[0].dataSources, element.dataSources);
  assert.deepEqual(lineTexts(reopened.elements[0] as TextElement, recordB), ['Item XYZ', 'Batch 456', 'Qty 7']);

  const markup = getTextElementMarkup(element, evaluateTextElement(element, { record: recordA }), evaluateTextElementRuns(element, { record: recordA }))!;
  assert.doesNotMatch(markup, /(?:&lt;|<)CR(?:&gt;|>)/);
  assert.doesNotMatch(markup, /«CR»/);
  const markupLineYs = [...markup.matchAll(/<text[^>]* y="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(markupLineYs).size, 3);
  assert.match(markup, /Item/);
  assert.match(markup, /Batch/);
  assert.match(markup, /Qty/);
});