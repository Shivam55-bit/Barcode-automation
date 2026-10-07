import assert from 'node:assert/strict';
import { executeVBScript, createRecordProxy } from '../src/services/vbscriptEngine';
import { executeEnterpriseTransformPipeline, applyTransformPipeline } from '../src/services/transformEngine';
import { evaluateElementData, evaluateSafeScript } from '../src/services/dataSourceEngine';
import { TextElement, BarcodeElement } from '../src/types';

const record1 = {
  ProductID: 'P101',
  ProductName: 'Shampoo 500ml',
  SKU: '000101',
  Barcode: '8901234567890',
  Price: 500,
  Qty: 10,
  BatchNo: 'B101',
  Stock: 20,
  EmptyNotes: '',
  NullNotes: null,
};

const record2 = {
  ProductID: 'P102',
  ProductName: 'Hair Oil 200ml',
  SKU: '000102',
  Barcode: '8901234567891',
  Price: 250,
  Qty: 5,
  BatchNo: 'B102',
  Stock: 15,
  EmptyNotes: '',
  NullNotes: null,
};

const record3 = {
  ProductID: 'P103',
  ProductName: 'Face Wash',
  SKU: '000103',
  Barcode: '8901234567892',
  Price: 150,
  Qty: 2,
  BatchNo: 'B103',
  Stock: 0,
  EmptyNotes: '',
  NullNotes: null,
};

console.log('--- JavaScript Record() Tests ---');
{
  const r1 = evaluateSafeScript('return Record("ProductName");', { record: record1 }, 'javascript');
  assert.equal(r1, 'Shampoo 500ml');
  console.log('  PASS: JS return Record("ProductName") => Shampoo 500ml');

  const r2 = evaluateSafeScript('return Record("Price");', { record: record1 }, 'javascript');
  assert.equal(r2, '500');
  console.log('  PASS: JS return Record("Price") => 500');

  const r3 = evaluateSafeScript('return Record("BatchNo");', { record: record1 }, 'javascript');
  assert.equal(r3, 'B101');
  console.log('  PASS: JS return Record("BatchNo") => B101');

  const r4 = evaluateSafeScript('return Record("SKU");', { record: record1 }, 'javascript');
  assert.equal(r4, '000101');
  console.log('  PASS: JS preserves leading zeroes in SKU => 000101');

  const r5 = evaluateSafeScript('return "PRODUCT: " + Record("ProductName") + " (" + Record("SKU") + ")";', { record: record1 }, 'javascript');
  assert.equal(r5, 'PRODUCT: Shampoo 500ml (000101)');
  console.log('  PASS: JS string concatenation with Record() fields');
}

console.log('--- VBScript Record() Tests ---');
{
  const v1 = executeVBScript('Value = Record("ProductName")', { record: record1 });
  assert.equal(v1.success, true);
  assert.equal(v1.value, 'Shampoo 500ml');
  console.log('  PASS: VBScript Value = Record("ProductName") => Shampoo 500ml');

  const v2 = executeVBScript('Value = Record("Price")', { record: record1 });
  assert.equal(v2.success, true);
  assert.equal(v2.value, '500');
  console.log('  PASS: VBScript Value = Record("Price") => 500');

  const v3 = executeVBScript('Value = Record("BatchNo")', { record: record1 });
  assert.equal(v3.success, true);
  assert.equal(v3.value, 'B101');
  console.log('  PASS: VBScript Value = Record("BatchNo") => B101');

  const v4 = executeVBScript('Value = "LOT-" & Record("BatchNo") & "-" & Record("SKU")', { record: record1 });
  assert.equal(v4.success, true);
  assert.equal(v4.value, 'LOT-B101-000101');
  console.log('  PASS: VBScript Value = "LOT-" & Record("BatchNo") & "-" & Record("SKU") => LOT-B101-000101');
}

console.log('--- Empty, Null, Case-Insensitive and Unknown Fields ---');
{
  const emptyRes = evaluateSafeScript('return Record("EmptyNotes");', { record: record1 }, 'javascript');
  assert.equal(emptyRes, '');
  console.log('  PASS: JS Record("EmptyNotes") does not crash on empty string');

  const nullRes = evaluateSafeScript('return Record("NullNotes");', { record: record1 }, 'javascript');
  assert.equal(nullRes, '');
  console.log('  PASS: JS Record("NullNotes") does not crash on null');

  const caseRes = evaluateSafeScript('return Record("productname");', { record: record1 }, 'javascript');
  assert.equal(caseRes, 'Shampoo 500ml');
  console.log('  PASS: JS Record("productname") case-insensitive resolution');

  const unkJs = evaluateSafeScript('return Record("UnknownField");', { record: record1 }, 'javascript');
  assert.ok(unkJs.includes('Field \'UnknownField\' not found'));
  console.log('  PASS: JS Record("UnknownField") returns safe error message: ' + unkJs);

  const unkVB = executeVBScript('Value = Record("UnknownField")', { record: record1 });
  assert.equal(unkVB.success, false);
  assert.ok(unkVB.error?.includes('Field \'UnknownField\' not found'));
  console.log('  PASS: VBScript Record("UnknownField") flags error: ' + unkVB.error);
}

console.log('--- Record Navigation / Dynamic Record Resolution ---');
{
  const products = [record1, record2, record3];
  const results = products.map((rec) =>
    evaluateSafeScript('return Record("ProductName");', { record: rec }, 'javascript')
  );
  assert.deepEqual(results, ['Shampoo 500ml', 'Hair Oil 200ml', 'Face Wash']);
  console.log('  PASS: Navigation record 1->2->3 dynamically resolves: ' + results.join(' -> '));

  const vbResults = products.map((rec) =>
    executeVBScript('Value = "BATCH-" & Record("BatchNo")', { record: rec }).value
  );
  assert.deepEqual(vbResults, ['BATCH-B101', 'BATCH-B102', 'BATCH-B103']);
  console.log('  PASS: VBScript Navigation dynamically resolves: ' + vbResults.join(' -> '));
}

console.log('--- Transform Pipeline with Script ---');
{
  const textWithScriptTransform: TextElement = {
    id: 'txt-1',
    type: 'text',
    text: 'RawValue',
    x: 0,
    y: 0,
    width: 50,
    height: 10,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    transforms: [
      {
        id: 'tr-1',
        type: 'script',
        enabled: true,
        params: {
          scriptLanguage: 'javascript',
          code: 'return "SKU: " + Record("SKU") + " | " + Record("ProductName");',
        },
      },
    ],
  };

  const canvasVal1 = evaluateElementData(textWithScriptTransform, { record: record1 });
  assert.equal(canvasVal1, 'SKU: 000101 | Shampoo 500ml');
  console.log('  PASS: Canvas evaluateElementData with script transform => ' + canvasVal1);

  const canvasVal2 = evaluateElementData(textWithScriptTransform, { record: record2 });
  assert.equal(canvasVal2, 'SKU: 000102 | Hair Oil 200ml');
  console.log('  PASS: Canvas evaluateElementData updated for Record 2 => ' + canvasVal2);
}

console.log('--- Print Preview Multi-Record Consistency ---');
{
  const barcodeWithVBScript: BarcodeElement = {
    id: 'bc-1',
    type: 'barcode',
    barcodeType: 'CODE128',
    value: 'FALLBACK',
    x: 0,
    y: 0,
    width: 60,
    height: 20,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    transforms: [
      {
        id: 'tr-bc',
        type: 'script',
        enabled: true,
        params: {
          scriptLanguage: 'vbscript',
          code: 'Value = Record("Barcode")',
        },
      },
    ],
  };

  const printRecord1 = evaluateElementData(barcodeWithVBScript, { record: record1, currentRecordIndex: 0 });
  const printRecord2 = evaluateElementData(barcodeWithVBScript, { record: record2, currentRecordIndex: 1 });
  const printRecord3 = evaluateElementData(barcodeWithVBScript, { record: record3, currentRecordIndex: 2 });

  assert.equal(printRecord1, '8901234567890');
  assert.equal(printRecord2, '8901234567891');
  assert.equal(printRecord3, '8901234567892');
  console.log('  PASS: Print preview barcodes: ' + [printRecord1, printRecord2, printRecord3].join(', '));
}

console.log('\nAll 15 Script & Record Integration Tests Passed!');