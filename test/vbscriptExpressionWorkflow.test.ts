import assert from 'node:assert/strict';
import { evaluateDataSourceItem, evaluateElementData, evaluateSafeScript } from '../src/services/dataSourceEngine';
import { DataSourceItem, TextElement } from '../src/types';

const record = {
  ProductName: 'Widget',
  SKU: 'ABC-001',
  Qty: 3,
  ExpiryDays: 30,
};

function scriptSource(scriptCode: string, scriptMode: 'expression' | 'multiline' = 'expression'): DataSourceItem {
  return {
    id: 'script-source-1',
    name: 'VBScript Source',
    type: 'script',
    scriptLanguage: 'vbscript',
    scriptMode,
    scriptCode,
    value: '',
    enabled: true,
  };
}

const sourceContext = { record, currentDateTime: '2026-01-15' } as any;

assert.equal(evaluateDataSourceItem(scriptSource('"Sample Text"'), sourceContext), 'Sample Text');
assert.equal(evaluateSafeScript('"ABC" & "-" & "001"', sourceContext, 'vbscript', 'expression'), 'ABC-001');
assert.equal(evaluateSafeScript('2 + 3 * 4', sourceContext, 'vbscript', 'expression'), '14');
assert.equal(evaluateSafeScript('UCase("abc")', sourceContext, 'vbscript', 'expression'), 'ABC');
assert.equal(
  evaluateSafeScript('"Widget " & UCase("alpha")', sourceContext, 'vbscript', 'expression'),
  'Widget ALPHA'
);
assert.equal(evaluateSafeScript('Len("ABC")', sourceContext, 'vbscript', 'expression'), '3');
assert.equal(evaluateSafeScript('Record("SKU")', sourceContext, 'vbscript', 'expression'), 'ABC-001');

const lineBreakOutput = evaluateSafeScript(
  '"Line 1" & Chr(13) & Chr(10) & "Line 2"',
  sourceContext,
  'vbscript',
  'expression'
);
assert.equal(lineBreakOutput, 'Line 1\r\nLine 2');
assert.equal(lineBreakOutput.split(/\r\n/).length, 2);

const conditionalOutput = evaluateSafeScript(
  'If Record("Qty") > 2 Then\n  Value = "Ready"\nElse\n  Value = "Low"\nEnd If',
  sourceContext,
  'vbscript',
  'multiline'
);
assert.equal(conditionalOutput, 'Ready');

const expiryOutput = evaluateSafeScript(
  'DateAdd("d", Record("ExpiryDays"), Date)',
  sourceContext,
  'vbscript',
  'expression'
);
assert.equal(expiryOutput, '14/02/2026');

const missingField = evaluateDataSourceItem(scriptSource('Record("MissingField")'), sourceContext);
assert.match(missingField, /\[Script Error: .*MissingField.*\]/);

const emptySource = evaluateDataSourceItem(scriptSource(''), sourceContext);
assert.equal(emptySource, '');

const textElement: TextElement = {
  id: 'text-script-composition',
  type: 'text',
  name: 'Composition',
  text: '',
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  rotation: 0,
  zIndex: 1,
  visible: true,
  locked: false,
  dataSources: [
    { id: 'prefix', name: 'Prefix', type: 'embedded', value: 'PRE-', enabled: true },
    scriptSource('"ABC-001"'),
    { id: 'suffix', name: 'Suffix', type: 'embedded', value: '-POST', enabled: true },
  ],
};
assert.equal(evaluateElementData(textElement, sourceContext), 'PRE-ABC-001-POST');

const restoredSource = JSON.parse(JSON.stringify(scriptSource('"Sample Text"'))) as DataSourceItem;
assert.equal(restoredSource.id, 'script-source-1');
assert.equal(restoredSource.scriptMode, 'expression');
assert.equal(evaluateDataSourceItem(restoredSource, sourceContext), 'Sample Text');

console.log('VBScript expression workflow: 17 assertions passed.');
