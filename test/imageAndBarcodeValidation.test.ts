/**
 * Unit tests for dynamic image binding (spec 27) and pre-print barcode
 * validation (spec 28).
 * Run: npx tsx test/imageAndBarcodeValidation.test.ts
 */
import { resolveImageElementSrc, normalizeImageSource } from '../src/services/dataSourceEngine';
import { validatePrintDataBarcodes } from '../src/services/printValidationService';
import { LabelTemplate } from '../src/types';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, got?: any, want?: any) {
  if (cond) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.error(`  FAIL: ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
}

console.log('--- normalizeImageSource ---');
assert(normalizeImageSource('data:image/png;base64,AAAA') === 'data:image/png;base64,AAAA', 'data url passthrough');
assert(normalizeImageSource('https://x/y.png') === 'https://x/y.png', 'http passthrough');
assert(normalizeImageSource('C:\\Products\\shampoo.png').startsWith('file:///C:/Products/shampoo.png'), 'windows path -> file url', normalizeImageSource('C:\\Products\\shampoo.png'));
assert(normalizeImageSource('shampoo.png', 'C:\\Products').includes('Products/shampoo.png'), 'relative resolved against base');

console.log('--- resolveImageElementSrc ---');
const staticImg: any = { id: 'i1', type: 'image', src: 'data:image/png;base64,STATIC' };
assert(resolveImageElementSrc(staticImg, { record: {} }) === 'data:image/png;base64,STATIC', 'static image unchanged');

const boundImg: any = { id: 'i2', type: 'image', imageSourceType: 'database', imageField: 'ImagePath', src: '', fallbackSrc: 'data:image/png;base64,FALLBACK' };
assert(
  resolveImageElementSrc(boundImg, { record: { ImagePath: 'C:\\Products\\oil.png' } }).startsWith('file:///C:/Products/oil.png'),
  'bound image resolves record field',
);
assert(
  resolveImageElementSrc(boundImg, { record: { ImagePath: '' } }) === 'data:image/png;base64,FALLBACK',
  'empty bound value falls back',
);
assert(
  resolveImageElementSrc(boundImg, { record: {} }) === 'data:image/png;base64,FALLBACK',
  'missing field falls back',
);

console.log('--- validatePrintDataBarcodes ---');
const template = {
  id: 't1',
  name: 'Test',
  elements: [
    { id: 'b1', type: 'barcode', name: 'EAN13', symbology: 'ean13', visible: true, dataSources: [{ id: 'd', type: 'database-field', field: 'Barcode', value: '{{Barcode}}', enabled: true }] },
  ],
  variables: [],
} as unknown as LabelTemplate;

const goodRecords = [{ Barcode: '4006381333931' }]; // valid 13-digit
const badRecords = [{ Barcode: 'ABC' }, { Barcode: '' }];

const good = validatePrintDataBarcodes(template, goodRecords);
assert(good.valid, 'valid EAN13 passes', good.issues, []);

const bad = validatePrintDataBarcodes(template, badRecords);
assert(!bad.valid, 'invalid EAN13 flagged', bad.valid, false);
assert(bad.issues.length === 2, 'two invalid records reported', bad.issues.length, 2);
assert(bad.issues[0].recordNumber === 1, 'record number is 1-based', bad.issues[0].recordNumber, 1);

console.log(`\nImage + Barcode Validation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
