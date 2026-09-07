import { mmToDots, dotsToMm } from './src/printer/dpiService.js';
import { BUILTIN_STOCK_PRESETS, mediaService } from './src/printer/mediaService.js';
import { PRINTER_PROFILES, resolvePrinterProfile } from './src/printer/printerProfiles.js';
import { renderZPL } from './src/printing/renderers/zplRenderer.js';
import { renderTSPL } from './src/printing/renderers/tsplRenderer.js';
import { renderEPL } from './src/printing/renderers/eplRenderer.js';
import { generateWindowsDriverHtml } from './src/printing/renderers/windowsDriverRenderer.js';
import { validatePrintJob } from './src/printer/printValidation.js';
import type { LabelTemplate } from './src/types/index.js';
import type { PrinterModel } from './src/printer/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('\n=== BarcodeFlow Enterprise Printing Subsystem Test Suite ===\n');

// 1. DPI & Dot Calculation Tests
console.log('--- 1. DPI & Dot Conversion ---');
const dots203 = mmToDots(50, 203);
assert(dots203 === 400, `50mm at 203 DPI = 400 dots (got ${dots203})`);

const dots300 = mmToDots(50, 300);
assert(dots300 === 591, `50mm at 300 DPI = 591 dots (got ${dots300})`);

const dots600 = mmToDots(50, 600);
assert(dots600 === 1181, `50mm at 600 DPI = 1181 dots (got ${dots600})`);

const mmBack = dotsToMm(400, 203);
assert(Math.abs(mmBack - 50) < 0.1, `400 dots at 203 DPI converts back to ~50mm (got ${mmBack})`);

// 2. Media & Stock Presets
console.log('\n--- 2. Media & Stock Presets ---');
const mrpPreset = mediaService.getStockById('stock-mrp-50x25');
assert(!!mrpPreset, '50 x 25 mm MRP Label preset exists');
assert(mrpPreset?.widthMm === 50 && mrpPreset?.heightMm === 25, 'MRP preset dimensions are 50x25 mm');
assert(mrpPreset?.verticalGapMm === 3, 'MRP preset gap is 3mm');

const a4Sheet = mediaService.getStockById('stock-a4-sheet-65');
assert(!!a4Sheet, 'A4 65-up multi-column stock preset exists');
const layout65 = mediaService.calculateLabelPositionsOnPage(
  {
    type: 'multiple',
    rows: a4Sheet!.rows,
    columns: a4Sheet!.columns,
    horizontalGap: a4Sheet!.horizontalGapMm,
    verticalGap: a4Sheet!.verticalGapMm,
    margins: {
      top: a4Sheet!.marginTopMm,
      left: a4Sheet!.marginLeftMm,
      right: a4Sheet!.marginRightMm,
      bottom: a4Sheet!.marginBottomMm,
    },
    printOrder: { corner: 'top-left', direction: 'horizontal' },
  },
  a4Sheet!.widthMm,
  a4Sheet!.heightMm
);
assert(layout65.length === 65, `A4 65-up calculates exactly 65 label coordinate items (got ${layout65.length})`);

// 3. Printer Profiles & Fallback Resolution
console.log('\n--- 3. Printer Profiles & Model Resolution ---');
const zebraProfile = resolvePrinterProfile('Zebra ZT410 300dpi (Production Line 1)');
assert(zebraProfile.model === 'ZT410', `Identifies Zebra ZT410 profile (got ${zebraProfile.model})`);
assert(zebraProfile.nativeLanguages?.includes('ZPL') === true, 'Resolved Zebra language includes ZPL');

const tscProfile = resolvePrinterProfile('TSC TE210 High Speed Label Printer');
assert(tscProfile.model === 'TE210', `Identifies TSC TE210 profile (got ${tscProfile.model})`);
assert(tscProfile.nativeLanguages?.includes('TSPL') === true, 'Resolved TSC language includes TSPL');

const pdfPrinter = resolvePrinterProfile('Microsoft Print to PDF');
assert(pdfPrinter.preferredRenderer === 'WINDOWS_DRIVER', 'Microsoft Print to PDF correctly defaults to universal driver renderer');

const unknownPrinter = resolvePrinterProfile('Canon Pixma MG2570S');
assert(unknownPrinter.preferredRenderer === 'WINDOWS_DRIVER', 'Unverified printer safely falls back to universal Windows Driver');

// 4. Test Sample Template & Renderers
console.log('\n--- 4. Renderers & Native Command Output ---');
const sampleTemplate: LabelTemplate = {
  id: 'tmpl-mrp-50x25',
  name: 'MRP 50x25mm Industrial',
  description: '50x25mm pharma MRP label',
  category: 'mrp',
  dimensions: {
    width: 50,
    height: 25,
    unit: 'mm',
    dpi: 203,
    orientation: 'portrait',
  },
  elements: [
    {
      id: 'el-1',
      type: 'text',
      x: 16,
      y: 16,
      width: 368,
      height: 32,
      text: 'ACME PHARMA LTD',
      fontSize: 12,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'center',
      visible: true,
    } as any,
    {
      id: 'el-2',
      type: 'barcode',
      x: 40,
      y: 56,
      width: 320,
      height: 70,
      barcodeType: 'code128',
      barcodeValue: '8901234567890',
      showText: true,
      fontSize: 10,
      color: '#000000',
      visible: true,
    } as any,
    {
      id: 'el-3',
      type: 'text',
      x: 16,
      y: 136,
      width: 368,
      height: 48,
      text: 'MRP: Rs. 145.00 (Incl. of all taxes)\nB.No: BN-9988 Mfg: 09/26 Exp: 08/28',
      fontSize: 9,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      textAlign: 'left',
      visible: true,
    } as any,
  ],
};

// ZPL Renderer test
const zplOutput = renderZPL(sampleTemplate, [{ MRP: '145.00' }], { copies: 2 });
assert(zplOutput.includes('^XA') && zplOutput.includes('^XZ'), 'ZPL output contains ^XA and ^XZ framing');
assert(zplOutput.includes('^BC') || zplOutput.includes('8901234567890'), 'ZPL output encodes Code128 barcode data');
assert(zplOutput.includes('^PQ2'), 'ZPL output sets copy count ^PQ2');

// TSPL Renderer test
const tsplOutput = renderTSPL(sampleTemplate, [{ MRP: '145.00' }], { copies: 2 });
assert(tsplOutput.includes('SIZE 50 mm, 25 mm'), 'TSPL sets exact SIZE 50 mm, 25 mm');
assert(tsplOutput.includes('BARCODE') && tsplOutput.includes('8901234567890'), 'TSPL encodes BARCODE 8901234567890');
assert(tsplOutput.includes('PRINT 2, 1') || tsplOutput.includes('PRINT 2'), 'TSPL specifies PRINT 2 copies');

// EPL Renderer test
const eplOutput = renderEPL(sampleTemplate, [{ MRP: '145.00' }], { copies: 2 });
assert(eplOutput.includes('N\n') || eplOutput.startsWith('N'), 'EPL clears image buffer with N');
assert(eplOutput.includes('P2,1') || eplOutput.includes('P2'), 'EPL specifies print command P2');

// Universal Windows Driver HTML test
const driverHtml = generateWindowsDriverHtml(sampleTemplate, [{ MRP: '145.00' }], { copies: 2 });
assert(driverHtml.includes('size: 50mm 25mm;') && driverHtml.includes('margin: 0;'), 'Driver HTML generates exact @page CSS dimensions 50mm 25mm');
assert(driverHtml.includes('ACME PHARMA LTD'), 'Driver HTML contains label header text');
assert(driverHtml.includes('<svg') && driverHtml.includes('rect'), 'Driver HTML contains vector SVG barcode bars');

// 5. Pre-flight Validation Tests
console.log('\n--- 5. Pre-Flight Validation ---');
const dummyPrinter: PrinterModel = {
  id: 'p1',
  name: 'Zebra ZT410',
  systemName: 'Zebra ZT410',
  manufacturer: 'Zebra',
  model: 'ZT410',
  connectionType: 'network',
  status: 'READY',
  dpi: 203,
  isDefault: true,
  isVirtual: false,
  nativeLanguages: ['ZPL'],
  preferredRenderer: 'ZPL',
  capabilities: {
    color: false,
    duplex: false,
    speedControl: true,
    darknessControl: true,
    gapMedia: true,
    blackMarkMedia: true,
    continuousMedia: true,
    cutter: false,
    peeler: false,
    rfid: false,
  }
};

const validResult = validatePrintJob({
  template: sampleTemplate,
  printer: dummyPrinter,
  records: [{ MRP: '145.00' }],
  copies: 1,
});
assert(validResult.isValid === true, 'Sample template passes pre-flight validation');

// Test missing barcode value validation
const badTemplate: LabelTemplate = {
  ...sampleTemplate,
  elements: [
    {
      id: 'el-bad',
      type: 'barcode',
      x: 10,
      y: 10,
      width: 200,
      height: 50,
      barcodeType: 'code128',
      barcodeValue: '',
      showText: true,
      fontSize: 10,
      color: '#000000',
      visible: true,
    } as any
  ]
};

const badResult = validatePrintJob({
  template: badTemplate,
  printer: dummyPrinter,
  records: [{}],
  copies: 1,
});
assert(badResult.isValid === false, 'Pre-flight validation catches empty barcode values');
assert(badResult.errors.some(e => e.message.toLowerCase().includes('barcode')), 'Error message mentions barcode issue');

console.log(`\n=======================================================`);
console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
console.log(`=======================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
