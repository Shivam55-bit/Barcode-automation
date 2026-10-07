import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import ZXing from '@zxing/library';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { generatePureSymbolSVG, generateBarcodeSVG, calculateBarcodeLayout, SYMBOLOGY_CATALOG, getBarcodeModuleColumns, quantizeBarcodeWidth } from '../src/services/barcodeEngine';
import bwipjs from 'bwip-js';
import type { BarcodeElement, BarcodeSymbology } from '../src/types';

const { BinaryBitmap, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } = ZXing;
const require = createRequire(import.meta.url);
prepareZXingModule({ overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')) } });

function barcode(symbology: BarcodeSymbology, value: string, is2D = false): BarcodeElement {
  return {
    id: 'decode-symbol', name: 'Decode verification', type: 'barcode',
    x: 0, y: 0, width: is2D ? 30 : 100, height: is2D ? 30 : 15,
    rotation: 0, symbology, value, barWidth: 2, barHeight: is2D ? 30 : 15,
    includeText: true, humanReadableFontSize: 10, visible: true, printable: true,
    foregroundColor: '#000000', backgroundColor: '#ffffff',
  } as BarcodeElement;
}

test('BAR-001: empty data is rejected, never replaced with a sample payload', () => {
  assert.throws(() => generatePureSymbolSVG(barcode('code128', '')), /empty|data|required/i);
  assert.ok(!generateBarcodeSVG(barcode('code128', '')).includes('<path'));
});

test('BAR-CATALOG-UNIQUE: stable catalog identifiers are unique', () => {
  assert.equal(new Set(SYMBOLOGY_CATALOG.map(metadata => metadata.id)).size, SYMBOLOGY_CATALOG.length);
});

for (const metadata of SYMBOLOGY_CATALOG) {
  test(`BAR-CATALOG-${metadata.id}: genuine encoding or explicit unavailability`, () => {
    if (metadata.unsupportedReason) {
      assert.throws(() => generatePureSymbolSVG(barcode(metadata.id, metadata.defaultSample)), /unavailable/i);
    } else {
      assert.match(generatePureSymbolSVG(barcode(metadata.id, metadata.defaultSample, metadata.is2D)), /<svg/);
    }
  });
}

test('BAR-POSICODE-VARIANTS: A/B modules match explicit BWIPP variants', () => {
  const paths = (svg: string) => svg.match(/ d="[^"]+"/g)?.join('');
  const variants = ['a', 'b'] as const;
  const outputs = variants.map(version => {
    const svg = generatePureSymbolSVG(barcode(`posicode-${version}`, 'Abc123'));
    const reference = bwipjs.toSVG({ bcid: 'posicode', text: 'Abc123', version, scale: 2, height: 23, includetext: false });
    assert.equal(paths(svg), paths(reference));
    return paths(svg);
  });
  assert.notEqual(outputs[0], outputs[1]);
});

test('BAR-UNKNOWN: unknown symbologies never become Code 128', () => {
  assert.throws(() => generatePureSymbolSVG(barcode('not-a-symbology' as BarcodeSymbology, '12345678')), /unsupported/i);
});

test('BAR-002: HRT font changes cannot alter barcode modules or symbol height', () => {
  const original = barcode('code128', '000101-BATCH-01');
  const enlarged = { ...original, humanReadableFontSize: 36 };
  assert.equal(generatePureSymbolSVG(enlarged), generatePureSymbolSVG(original));
  assert.equal(calculateBarcodeLayout(enlarged).symbolHeightMm, 15);
  assert.ok(calculateBarcodeLayout(enlarged).totalHeightMm > calculateBarcodeLayout(original).totalHeightMm);
});

for (const [symbology, value, quietModules, matrix] of [
  ['code128', '000101', 11, false],
  ['code39', 'LOT-ABC-001', 11, false],
  ['qr', 'TRACE-000101', 4, true],
  ['datamatrix', 'LOT-B101-000101', 1, true],
] as const) {
  test(`BAR-QUIET-${symbology}: padding is included in encoded module geometry`, () => {
    const plain = { ...barcode(symbology, value, matrix), quietZone: false };
    const padded = { ...plain, quietZone: true };
    assert.equal(getBarcodeModuleColumns(padded), getBarcodeModuleColumns(plain) + quietModules * 2);
    assert.notEqual(generatePureSymbolSVG(padded), generatePureSymbolSVG(plain));
  });
  for (const dpi of [203, 300, 600]) {
    test(`BAR-DOTS-${symbology}-${dpi}: real raster modules occupy whole printer dots`, async () => {
      const element = { ...barcode(symbology, value, matrix), quietZone: true };
      const columns = getBarcodeModuleColumns(element);
      const quantized = quantizeBarcodeWidth(element.width, columns, dpi);
      const width = Math.round(quantized.width * dpi / 25.4);
      const buffer = new Resvg(generatePureSymbolSVG(element), { fitTo: { mode: 'width', value: width }, background: '#ffffff' }).render().asPng();
      const image = PNG.sync.read(buffer);
      assert.equal(image.width, width);
      const row = Math.floor(image.height / 2);
      const dark = (column: number) => image.data[(row * width + column) * 4] < 128;
      const spans: Array<{ dark: boolean; length: number }> = [];
      for (let column = 0; column < width; column++) {
        const currentDark = dark(column);
        const previous = spans[spans.length - 1];
        if (previous && previous.dark === currentDark) previous.length++;
        else spans.push({ dark: currentDark, length: 1 });
      }
      assert.ok(spans.some(span => span.dark));
      assert.ok(spans[0].length >= quietModules * quantized.moduleDots);
      assert.ok(spans[spans.length - 1].length >= quietModules * quantized.moduleDots);
      for (const span of spans) assert.equal(span.length % quantized.moduleDots, 0, `${symbology}: ${span.length}px span is not a whole number of ${quantized.moduleDots}px modules`);
      const decoded = await readBarcodes(buffer, { formats: [matrix ? symbology === 'qr' ? 'QRCode' : 'DataMatrix' : symbology === 'code128' ? 'Code128' : 'Code39'], tryHarder: true });
      assert.equal(decoded[0]?.text, value);
    });
  }
}

test('BAR-CROSS-093: C++ decoder independently checks Code 93 pixels', async () => {
  const symbol = generatePureSymbolSVG(barcode('code93', 'SKU-00991'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="300"><rect width="100%" height="100%" fill="white"/><svg x="40" y="40" width="1180" height="200">${symbol}</svg></svg>`;
  const image = new Resvg(svg).render().asPng();
  const results = await readBarcodes(image, { formats: ['Code93'], tryHarder: true });
  assert.equal(results[0]?.text, 'SKU-00991');
});

const cases: Array<{ symbology: BarcodeSymbology; value: string; is2D?: boolean }> = [
  { symbology: 'code128', value: '000101' },
  { symbology: 'code128', value: 'SHIP-2026-ABCD-0123456789' },
  { symbology: 'code39', value: 'LOT-ABC-001' },
  { symbology: 'code93', value: 'SKU-00991' },
  { symbology: 'ean13', value: '5901234123457' },
  { symbology: 'qr', value: 'https://example.invalid/SKU/000101?batch=B101', is2D: true },
  { symbology: 'datamatrix', value: 'LOT-B101-000101', is2D: true },
  { symbology: 'aztec', value: 'SHIPMENT-000101', is2D: true },
];

for (const [caseIndex, sample] of cases.entries()) {
  for (const dpi of [203, 300, 600]) {
    test(`BAR-DEC-${caseIndex + 1}-${dpi}: ${sample.symbology} decodes application SVG pixels`, () => {
      const element = barcode(sample.symbology, sample.value, sample.is2D);
      const symbol = generatePureSymbolSVG(element);
      const width = Math.round(element.width * dpi / 25.4);
      const height = Math.round(element.barHeight! * dpi / 25.4);
      const quiet = Math.ceil(4 * dpi / 25.4);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + quiet * 2}" height="${height + quiet * 2}"><rect width="100%" height="100%" fill="white"/><svg x="${quiet}" y="${quiet}" width="${width}" height="${height}">${symbol}</svg></svg>`;
      const buffer = new Resvg(svg).render().asPng();
      const image = PNG.sync.read(buffer);
      const luminance = new Uint8ClampedArray(image.width * image.height);
      for (let pixelIndex = 0; pixelIndex < luminance.length; pixelIndex++) {
        const offset = pixelIndex * 4;
        luminance[pixelIndex] = (image.data[offset] + 2 * image.data[offset + 1] + image.data[offset + 2]) / 4;
      }
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, image.width, image.height)));
      assert.equal(new MultiFormatReader().decode(bitmap, new Map()).getText(), sample.value);
      const directory = new URL('../release-evidence/barcodes/', import.meta.url);
      mkdirSync(directory, { recursive: true });
      writeFileSync(new URL(`${sample.symbology}-${caseIndex + 1}-${dpi}.png`, directory), buffer);
    });
  }
}