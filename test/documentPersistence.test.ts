import assert from 'node:assert/strict';
import test from 'node:test';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument, serializePortableBarcodeFlowDocument, saveDocumentToDisk } from '../src/services/documentFileService';
import type { LabelTemplate } from '../src/types';

export const portableTemplate: LabelTemplate = {
  id: 'roundtrip-label', name: 'Inventory', description: 'Persistence regression',
  category: 'Asset & Inventory', version: '1.0', status: 'draft', tags: [],
  dimensions: { width: 100, height: 50, unit: 'mm', dpi: 300, orientation: 'landscape' },
  margins: { top: 0, right: 0, bottom: 0, left: 0, bleed: 0, safeZone: 0 },
  elements: [], variables: [], sampleRecords: [{ SKU: '008901001001', ExpiryDays: '30' }],
  namedDataSources: [{ id: 'lot', name: 'Lot', type: 'embedded', value: 'LOT-01' }],
  calculatedFields: [{ id: 'total', name: 'Total', formula: 'Price * Qty' }],
  eventScripts: { OnPrintJobStart: 'Value = "started"' },
  eventScriptLanguages: { OnPrintJobStart: 'vbscript' },
  scriptLibraries: [], layers: [], stockId: 'custom-stock', stockName: 'Inventory 100x50',
  objectPrintMethodSettings: {
    scope: 'document', trueTypeText: 'vector', unsupported1D: 'vector',
    unsupported2D: 'raster', lines: 'native', boxes: 'native', ellipses: 'vector',
  },
  codeModifierConfig: { enabled: true, prefix: '^XA' },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', createdBy: 'Operator',
};

test('DOC-001: native JSON round trip preserves all supported behavioral fields', () => {
  const payload = serializeBarcodeFlowDocument(portableTemplate);
  const reopened = deserializeBarcodeFlowDocument(JSON.stringify(payload)).template!;
  assert.deepEqual(reopened, payload.template);
  reopened.calculatedFields![0].formula = 'Price * Qty * 2';
  assert.equal(payload.template!.calculatedFields![0].formula, 'Price * Qty');
});

test('DOC-002: a future schema is rejected instead of lossy best-effort reopening', () => {
  assert.throws(() => deserializeBarcodeFlowDocument({ ...serializeBarcodeFlowDocument(portableTemplate), version: 999 }), /unsupported.*version/i);
});

test('DOC-003: invalid dimensions and duplicate object IDs produce useful errors', () => {
  const payload = serializeBarcodeFlowDocument(portableTemplate);
  payload.template!.dimensions.width = -20;
  assert.throws(() => deserializeBarcodeFlowDocument(payload), /dimensions/i);
  const duplicate = serializeBarcodeFlowDocument(portableTemplate);
  const object = { id: 'same-id', type: 'text', name: 'Text', content: 'ABC', x: 0, y: 0, width: 10, height: 5, rotation: 0 } as any;
  duplicate.template!.elements = [object, structuredClone(object)];
  assert.throws(() => deserializeBarcodeFlowDocument(duplicate), /unique|duplicate/i);
});

test('DOC-004: null or corrupt input does not crash on property access', () => {
  for (const input of [null, undefined, '{bad json', '{}']) {
    assert.throws(() => deserializeBarcodeFlowDocument(input), /invalid|corrupt|unrecognized/i);
  }
});

test('SHARE-001: portable templates exclude connection credentials and sample data by default', () => {
  const source = structuredClone(portableTemplate);
  source.databaseConnection = {
    id: 'source', name: 'Products', type: 'rest_api', fields: ['SKU'], records: [{ SKU: 'PRIVATE' }],
    password: 'TEST_PASSWORD_SENTINEL', headers: { Authorization: 'TEST_TOKEN_SENTINEL' },
    connectionString: 'TEST_CONNECTION_SENTINEL', nested: { api_key: 'TEST_NESTED_SENTINEL' },
    url: 'https://TEST_USERNAME_SENTINEL:TEST_URL_PASSWORD_SENTINEL@example.invalid/data?api_key=TEST_QUERY_SENTINEL&dataset=products',
  } as any;
  const payload = serializePortableBarcodeFlowDocument(source);
  assert.doesNotMatch(JSON.stringify(payload), /TEST_.*_SENTINEL|PRIVATE/);
  assert.equal(payload.dependencies!.credentialsIncluded, false);
  assert.deepEqual(payload.template!.sampleRecords, [{}]);
  assert.equal((source.databaseConnection as any).password, 'TEST_PASSWORD_SENTINEL');
  assert.equal((payload.template!.databaseConnection as any).url, 'https://example.invalid/data?dataset=products');
  const reopened = deserializeBarcodeFlowDocument(JSON.stringify(payload));
  assert.deepEqual(reopened.template, payload.template);
  assert.deepEqual(reopened.dependencies, payload.dependencies);
  reopened.dependencies!.warnings.push('Independent copy');
  assert.notDeepEqual(reopened.dependencies, payload.dependencies);
  const savedAgain = serializeBarcodeFlowDocument({ template: reopened.template, dependencies: payload.dependencies } as any);
  assert.deepEqual(savedAgain.dependencies, payload.dependencies);
  assert.throws(() => deserializeBarcodeFlowDocument({ ...payload, dependencies: { ...payload.dependencies, warnings: 'invalid' } }), /dependency manifest/i);
});

test('SHARE-002: unresolved developer image paths are rejected before sharing', () => {
  const source = structuredClone(portableTemplate);
  source.elements = [{ id: 'image', name: 'Product photograph', type: 'image', x: 1, y: 1, width: 10, height: 10, rotation: 0, src: 'C:\\Developer\\Assets\\product.png' } as any];
  assert.throws(() => serializePortableBarcodeFlowDocument(source), /embedded bitmap/i);
});

test('DOC-005: native saves cannot write over BarTender paths or browser handles', async () => {
  let writes = 0;
  const handle = { name: 'original.BTW', createWritable: () => { writes++; throw new Error('Must not write'); } };
  for (const target of ['C:\\Labels\\original.btw', 'original.BTW', 'original.btw. ', undefined]) {
    const result = await saveDocumentToDisk(target, { template: portableTemplate } as any, 'Operator', target ? undefined : handle);
    assert.equal(result.success, false);
    assert.match(result.error!, /cannot overwrite.*\.btw/i);
  }
  assert.equal(writes, 0);
});