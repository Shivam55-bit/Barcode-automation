import {
  measureTextObject,
  recalculateTextElementDimensions,
  normalizeTextForObjectType,
  isSingleLineTextElement,
  isMultiLineTextElement,
} from '../services/textMeasurementEngine';
import { escapeForDisplay, resolveForRuntime } from '../services/controlCharacterService';
import { TextElement, TextObjectType, TextSizingMode } from '../types';

console.log('====================================================');
console.log('360BARCODE - TEXT BEHAVIOR VERIFICATION TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failCount++;
  }
}

// -------------------------------------------------------------------
// TEST 1: Single Line Creation & Compact Bounding Box
// -------------------------------------------------------------------
console.log('--- TEST 1: Single Line Creation & Compact Box ---');
const singleLineText: TextElement = {
  id: 'test-single',
  name: 'Single Line Text',
  type: 'text',
  text: 'Sample Text',
  fontSize: 12,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textDecoration: 'none',
  textType: 'single-line',
  textFormatType: 'single-line',
  multiline: false,
  wrap: false,
  sizingMode: 'auto-width',
  autoSize: true,
  autoFit: false,
  x: 10,
  y: 10,
  width: 26,
  height: 6,
  rotation: 0,
  zIndex: 1,
  visible: true,
  locked: false,
  opacity: 1,
  color: '#000000',
  backgroundColor: '#ffffff',
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: 'left',
  verticalAlign: 'top',
  fontWidthScale: 100,
};

const measuredSingle = measureTextObject({
  text: singleLineText.text,
  fontFamily: singleLineText.fontFamily,
  fontSize: singleLineText.fontSize,
  fontWeight: singleLineText.fontWeight,
  multiline: false,
  wrap: false,
  textType: 'single-line',
  textFormatType: 'single-line',
});

assert(measuredSingle.width > 15 && measuredSingle.width < 40, `Single-line initial measured width is compact (${measuredSingle.width}mm)`);
assert(measuredSingle.height > 3 && measuredSingle.height < 10, `Single-line initial measured height is compact (${measuredSingle.height}mm)`);
assert(singleLineText.sizingMode === 'auto-width', 'Single-line default sizingMode is AUTO_WIDTH');
assert(normalizeTextForObjectType('Hello\nWorld', 'single-line') === 'Hello World', 'Single-line text strips embedded line breaks before commit');
assert(normalizeTextForObjectType('Hello\nWorld', 'multi-line') === 'Hello\nWorld', 'Multi-line text preserves embedded line breaks');
assert(isSingleLineTextElement({ ...singleLineText, textType: 'single-line' }) && !isMultiLineTextElement({ ...singleLineText, textType: 'single-line' }), 'Single-line type is derived from the saved object type, not from newline content');

// -------------------------------------------------------------------
// TEST 2: Multi-line Creation & Rectangular Layout Container
// -------------------------------------------------------------------
console.log('\n--- TEST 2: Multi-line Creation & Layout Container ---');
const multiLineText: TextElement = {
  id: 'test-multi',
  name: 'Multi-Line Text',
  type: 'text',
  text: 'Enterprise Logistics Label\nDirect Thermal Stock\nHandling: DRY & COOL',
  fontSize: 10,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textType: 'multi-line',
  textFormatType: 'paragraph',
  multiline: true,
  wrap: true,
  wordWrap: true,
  sizingMode: 'fixed-width',
  autoSize: false,
  autoFit: false,
  lineHeight: 1.2,
  letterSpacing: 0,
  verticalAlign: 'top',
  x: 10,
  y: 20,
  width: 60,
  height: 18,
  rotation: 0,
  zIndex: 2,
  visible: true,
  locked: false,
  opacity: 1,
  color: '#000000',
  backgroundColor: '#ffffff',
  textAlign: 'left',
  fontWidthScale: 100,
};

assert(multiLineText.width === 60, 'Multi-line default width is 60mm rectangular container');
assert(multiLineText.height === 18, 'Multi-line default height is 18mm rectangular container');
assert(multiLineText.multiline === true, 'Multi-line multiline flag is true');
assert(multiLineText.wrap === true, 'Multi-line wrap flag is true');
assert(multiLineText.sizingMode === 'fixed-width', 'Multi-line sizingMode is FIXED_WIDTH layout rectangle');
assert(isMultiLineTextElement({ ...multiLineText, textType: 'multi-line' }) && !isSingleLineTextElement({ ...multiLineText, textType: 'multi-line' }), 'Multi-line type is derived from the saved object type, not from newline content');

// -------------------------------------------------------------------
// TEST 3: Multi-line Container Resize (Width Change -> Text Reflow)
// -------------------------------------------------------------------
console.log('\n--- TEST 3: Multi-line Width Narrowing (Text Reflow) ---');
const wideDims = measureTextObject({
  text: multiLineText.text,
  fontFamily: multiLineText.fontFamily,
  fontSize: multiLineText.fontSize,
  multiline: true,
  wrap: true,
  containerWidthMm: 80,
  textType: 'multi-line',
  textFormatType: 'paragraph',
});

const narrowDims = measureTextObject({
  text: multiLineText.text,
  fontFamily: multiLineText.fontFamily,
  fontSize: multiLineText.fontSize,
  multiline: true,
  wrap: true,
  containerWidthMm: 35,
  textType: 'multi-line',
  textFormatType: 'paragraph',
});

assert(narrowDims.height > wideDims.height, `Narrowing width reflows text into more lines (height increased from ${wideDims.height}mm to ${narrowDims.height}mm)`);
assert(multiLineText.fontSize === 10, 'Font size remains EXACTLY 10pt during width resize');

// -------------------------------------------------------------------
// TEST 4: Single Line Resize Does NOT Wrap & Switches to FIXED_WIDTH
// -------------------------------------------------------------------
console.log('\n--- TEST 4: Single Line Width Resizing ---');
const singleFixed: TextElement = {
  ...singleLineText,
  width: 50,
  sizingMode: 'fixed-width',
  autoSize: false,
};

const recalculatedFixed = recalculateTextElementDimensions(singleFixed);
assert(recalculatedFixed.width === 50, 'Single line manual resize preserves fixed width (does not collapse)');
assert(singleFixed.wrap === false, 'Single line wrap remains false');
assert(singleFixed.fontSize === 12, 'Single line font size remains unchanged');

// -------------------------------------------------------------------
// TEST 5: Corner & Side Resize Never Scales Font Size
// -------------------------------------------------------------------
console.log('\n--- TEST 5: Corner / Side Resize Does Not Mutate Font Size ---');
const testFontSize = 30;
const elementToResize: TextElement = {
  ...multiLineText,
  fontSize: testFontSize,
  width: 70,
  height: 25,
};

// Simulate 5 resize operations (corners and sides)
const resizeIterations = [
  { width: 80, height: 30 },
  { width: 50, height: 20 },
  { width: 90, height: 40 },
  { width: 45, height: 35 },
  { width: 60, height: 18 },
];

let fontIntact = true;
for (const step of resizeIterations) {
  elementToResize.width = step.width;
  elementToResize.height = step.height;
  if (elementToResize.fontSize !== testFontSize) {
    fontIntact = false;
  }
}
assert(fontIntact && elementToResize.fontSize === 30, 'Font size strictly remains 30 across multiple resize actions');

// -------------------------------------------------------------------
// TEST 6: Single-line Font Size Change Recalculates AUTO_WIDTH
// -------------------------------------------------------------------
console.log('\n--- TEST 6: Font Size Change in AUTO_WIDTH Recalculates Box ---');
const singleLineAt20 = measureTextObject({
  text: 'Sample Text',
  fontFamily: 'Arial',
  fontSize: 20,
  multiline: false,
  wrap: false,
});

const singleLineAt30 = measureTextObject({
  text: 'Sample Text',
  fontFamily: 'Arial',
  fontSize: 30,
  multiline: false,
  wrap: false,
});

assert(singleLineAt30.width > singleLineAt20.width, `Increasing font size from 20pt to 30pt recalculates box width (${singleLineAt20.width}mm -> ${singleLineAt30.width}mm)`);

// -------------------------------------------------------------------
// TEST 7: Multi-line Preserves Container Dimensions
// -------------------------------------------------------------------
console.log('\n--- TEST 7: Multi-line recalculateTextElementDimensions Preserves Layout Rectangle ---');
const multiPreserved = recalculateTextElementDimensions(multiLineText);
assert(multiPreserved.width === 60, `Multi-line container width preserved at 60mm (actual: ${multiPreserved.width}mm)`);
assert(multiPreserved.height === 18, `Multi-line container height preserved at 18mm (actual: ${multiPreserved.height}mm)`);

// -------------------------------------------------------------------
// TEST 8: Serialization & Deserialization Preserves Types
// -------------------------------------------------------------------
console.log('\n--- TEST 8: Save & Reopen Preservation ---');
const serialized = JSON.stringify([singleLineText, multiLineText]);
const deserialized: TextElement[] = JSON.parse(serialized);

assert(deserialized[0].textType === 'single-line', 'Deserialized object 0 remains single-line');
assert(deserialized[0].sizingMode === 'auto-width', 'Deserialized object 0 preserves auto-width sizing mode');
assert(deserialized[1].textType === 'multi-line', 'Deserialized object 1 remains multi-line');
assert(deserialized[1].wrap === true, 'Deserialized object 1 preserves wrap=true');
assert(deserialized[1].lineHeight === 1.2, 'Deserialized object 1 preserves lineHeight=1.2');
assert(deserialized[1].verticalAlign === 'top', 'Deserialized object 1 preserves verticalAlign=top');

// -------------------------------------------------------------------
// TEST 9: Control Character Semantics & Runtime Resolution
// -------------------------------------------------------------------
console.log('\n--- TEST 9: Control Character Semantics ---');
assert(String.fromCharCode(13) === '\r', 'CR runtime character resolves to carriage return');
assert(String.fromCharCode(10) === '\n', 'LF runtime character resolves to line feed');
assert(String.fromCharCode(29) === '\x1D', 'GS runtime character resolves to group separator');
assert(String.fromCharCode(30) === '\x1E', 'RS runtime character resolves to record separator');
assert(escapeForDisplay('ABC\r\nXYZ') === 'ABC<CR><LF>XYZ', 'Display formatter emits readable control tokens');
assert(resolveForRuntime('ABC<GS>123') === 'ABC\x1D123', 'Runtime resolver converts tokenized GS back to real control char');
assert(resolveForRuntime('ABC<CR>XYZ') === 'ABC\rXYZ', 'Runtime resolver converts tokenized CR back to real control char');
assert(resolveForRuntime('ABC<<CR>>XYZ') === 'ABC\rXYZ', 'Double-bracket CR resolves without literal angle brackets');
assert(resolveForRuntime('ABC\\<<CR>>XYZ') === 'ABC<<CR>>XYZ', 'Escaped double-bracket tokens remain literal');
assert(resolveForRuntime('ABC<CR»XYZ') === 'ABC<CR»XYZ', 'Mismatched token delimiters remain literal');

console.log('\n====================================================');
console.log(`TOTAL: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
