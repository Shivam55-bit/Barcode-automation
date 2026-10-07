import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { LabelTemplate, TextElement, BarcodeElement, ImageElement } from '../src/types';
import { serializePortableBarcodeFlowDocument } from '../src/services/documentFileService';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';

const image = new PNG({ width: 24, height: 24 });
for (let row = 0; row < 24; row++) {
  for (let column = 0; column < 24; column++) {
    const offset = (row * 24 + column) * 4;
    const packagePixel = row >= 3 && row <= 20 && column >= 4 && column <= 19;
    image.data[offset] = packagePixel ? 35 : 255;
    image.data[offset + 1] = packagePixel ? 130 : 255;
    image.data[offset + 2] = packagePixel ? 90 : 255;
    image.data[offset + 3] = 255;
  }
}
const embeddedImage = `data:image/png;base64,${PNG.sync.write(image).toString('base64')}`;
const record = { ProductName: 'Industrial Fastener Kit', SKU: '000101', Barcode: '5901234123457', Price: '450.00', Qty: '2', BatchNo: 'B101', Stock: '20', ExpiryDays: '90', MFGDate: '18/09/2026' };
const text = (id: string, value: string, y: number): TextElement => ({
  id, name: id, type: 'text', x: 4, y, width: 80, height: 7, rotation: 0,
  text: value, textType: 'single-line', fontFamily: 'Arial', fontSize: 11,
  color: '#000000', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
  textAlign: 'left', verticalAlign: 'top', lineHeight: 1.2, visible: true, printable: true,
} as TextElement);
const barcode: BarcodeElement = {
  id: 'product-barcode', name: 'Product Barcode', type: 'barcode', x: 4, y: 30, width: 70, height: 20,
  rotation: 0, value: '{{SKU}}', symbology: 'code128', barWidth: 2, barHeight: 12,
  includeText: true, humanReadableFont: 'Arial', humanReadableFontSize: 10,
  foregroundColor: '#000000', backgroundColor: '#ffffff', visible: true, printable: true,
} as BarcodeElement;
const productImage: ImageElement = { id: 'product-image', name: 'Embedded package image', type: 'image', x: 84, y: 4, width: 12, height: 12, rotation: 0, src: embeddedImage, visible: true, printable: true } as ImageElement;
const template: LabelTemplate = {
  id: 'release-product', name: 'Release Product Label', description: 'Portable editable verification fixture',
  category: 'Asset & Inventory', version: '1.0', status: 'draft', tags: ['Release Fixture'],
  dimensions: { width: 100, height: 60, unit: 'mm', dpi: 300, orientation: 'landscape' },
  margins: { top: 0, left: 0, right: 0, bottom: 0, bleed: 0, safeZone: 0 },
  elements: [text('product-name', '{{ProductName}}', 4), text('price', 'Price: {{Price}}', 14), productImage, barcode],
  variables: [], sampleRecords: [record],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', createdBy: 'Release Fixture',
};
const fixtures = [
  template,
  { ...template, id: 'release-shipping', name: 'Release Shipping Label', elements: [
    { ...text('shipping-address', 'RECEIVER\n14 Industrial Road\nMumbai 400001', 4), textType: 'multi-line', multiline: true, wrap: true, height: 22 },
    { ...barcode, value: 'SHIP-000101' },
  ] },
  { ...template, id: 'release-inventory', name: 'Release Inventory Label', elements: [text('batch', 'Batch: {{BatchNo}}', 4), text('serial', 'Serial: 000101', 14), barcode] },
  { ...template, id: 'release-expiry', name: 'Release Expiry Label', elements: [
    text('product-name', '{{ProductName}}', 4),
    { ...text('expiry', '', 14), dataSources: [{ id: 'expiry-source', type: 'script', scriptLanguage: 'vbscript', scriptCode: 'Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))', value: '', enabled: true }] },
    barcode,
  ] },
  { ...template, id: 'release-data', name: 'Release Multi-record Label', sampleRecords: [record, { ...record, ProductName: 'Thermal Ribbon', SKU: '000102', Price: '1250.00', BatchNo: 'B102' }] },
  { ...template, id: 'release-mixed', name: 'Release Mixed Objects', elements: [
    ...template.elements,
    { id: 'border', name: 'Border', type: 'shape', shapeType: 'rectangle', x: 1, y: 1, width: 98, height: 58, rotation: 0, strokeColor: '#000000', strokeWidth: 0.25, fillColor: 'transparent', visible: true, printable: true },
  ] },
] as LabelTemplate[];

mkdirSync('public/samples', { recursive: true });
mkdirSync('release-evidence/labels', { recursive: true });
for (const fixture of fixtures) {
  const payload = serializePortableBarcodeFlowDocument(fixture, { includeSampleData: true });
  writeFileSync(`public/samples/${fixture.id}.bfl`, JSON.stringify(payload, null, 2));
  writeFileSync(`release-evidence/labels/${fixture.id}.html`, generateWindowsDriverHtml(fixture, fixture.sampleRecords));
}
console.log(`Generated ${fixtures.length} portable editable .bfl samples and actual driver-rendered HTML labels.`);