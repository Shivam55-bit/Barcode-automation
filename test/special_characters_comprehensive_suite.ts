import {
  CONTROL_CHARACTERS,
  COMMON_UNICODE_NAMES,
  UNICODE_SUBSETS,
  getRecentSymbols,
  addRecentSymbol,
} from '../src/services/symbolService';
import {
  CANONICAL_CONTROL_CHARACTERS,
  isControlChar,
  isControlCode,
  getCanonicalToken,
  getControlByCode,
  getControlByToken,
  getControlCharacterDefinition,
  controlCharacterToToken,
  tokenToControlCharacter,
  escapeForDisplay,
  encodeControlCharactersForEditor,
  decodeEditorControlCharacters,
  decodeControlCharacters,
  resolveControlCharacters,
  resolveDataSourceValue,
  resolveForRuntime,
  insertControlCharacterAtSelection,
  insertAtSelection,
  getDataSourceDisplayPreview,
  normalizeLineBreaks,
  normalizeSingleLineText,
  escapeForTextRender,
  parseControlCharacters,
  getMultiLineLayoutValue,
  getSingleLineLayoutValue,
  normalizeTextForMultilineLayout,
} from '../src/services/controlCharacterService';
import {
  evaluateDataSourceItem,
  evaluateTextElement,
  evaluateElementData,
} from '../src/services/dataSourceEngine';
import {
  resolveBarcodeData,
  formatValueForSymbology,
} from '../src/services/barcodeEngine';
import { measureTextObject } from '../src/services/textMeasurementEngine';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';
import { renderZPL } from '../src/printing/renderers/zplRenderer';
import { renderTSPL } from '../src/printing/renderers/tsplRenderer';
import type { TextElement, BarcodeElement, DataSourceItem, LabelTemplate } from '../src/types';
import bwipjs from 'bwip-js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

console.log('\n=============================================================');
console.log('  360Barcode Special Characters & Control Engine Test Suite  ');
console.log('=============================================================\n');

// -----------------------------------------------------------------------------
// 1. Control Characters Table & Mapping Audit (Sections 2 & 3)
// -----------------------------------------------------------------------------
console.log('--- 1. Canonical Control Character Definitions & Tables ---');
const expectedControls = [
  { code: 0, hex: '00', abbr: 'NUL', char: '\x00', token: '«NUL»' },
  { code: 1, hex: '01', abbr: 'SOH', char: '\x01', token: '«SOH»' },
  { code: 2, hex: '02', abbr: 'STX', char: '\x02', token: '«STX»' },
  { code: 3, hex: '03', abbr: 'ETX', char: '\x03', token: '«ETX»' },
  { code: 4, hex: '04', abbr: 'EOT', char: '\x04', token: '«EOT»' },
  { code: 5, hex: '05', abbr: 'ENQ', char: '\x05', token: '«ENQ»' },
  { code: 6, hex: '06', abbr: 'ACK', char: '\x06', token: '«ACK»' },
  { code: 7, hex: '07', abbr: 'BEL', char: '\x07', token: '«BEL»' },
  { code: 8, hex: '08', abbr: 'BS', char: '\x08', token: '«BS»' },
  { code: 9, hex: '09', abbr: 'HT', char: '\t', token: '«HT»' },
  { code: 10, hex: '0A', abbr: 'LF', char: '\n', token: '«LF»' },
  { code: 11, hex: '0B', abbr: 'VT', char: '\x0B', token: '«VT»' },
  { code: 12, hex: '0C', abbr: 'FF', char: '\x0C', token: '«FF»' },
  { code: 13, hex: '0D', abbr: 'CR', char: '\r', token: '«CR»' },
  { code: 14, hex: '0E', abbr: 'SO', char: '\x0E', token: '«SO»' },
  { code: 15, hex: '0F', abbr: 'SI', char: '\x0F', token: '«SI»' },
  { code: 16, hex: '10', abbr: 'DLE', char: '\x10', token: '«DLE»' },
  { code: 17, hex: '11', abbr: 'DC1', char: '\x11', token: '«DC1»' },
  { code: 18, hex: '12', abbr: 'DC2', char: '\x12', token: '«DC2»' },
  { code: 19, hex: '13', abbr: 'DC3', char: '\x13', token: '«DC3»' },
  { code: 20, hex: '14', abbr: 'DC4', char: '\x14', token: '«DC4»' },
  { code: 21, hex: '15', abbr: 'NAK', char: '\x15', token: '«NAK»' },
  { code: 22, hex: '16', abbr: 'SYN', char: '\x16', token: '«SYN»' },
  { code: 23, hex: '17', abbr: 'ETB', char: '\x17', token: '«ETB»' },
  { code: 24, hex: '18', abbr: 'CAN', char: '\x18', token: '«CAN»' },
  { code: 25, hex: '19', abbr: 'EM', char: '\x19', token: '«EM»' },
  { code: 26, hex: '1A', abbr: 'SUB', char: '\x1A', token: '«SUB»' },
  { code: 27, hex: '1B', abbr: 'ESC', char: '\x1B', token: '«ESC»' },
  { code: 28, hex: '1C', abbr: 'FS', char: '\x1C', token: '«FS»' },
  { code: 29, hex: '1D', abbr: 'GS', char: '\x1D', token: '«GS»' },
  { code: 30, hex: '1E', abbr: 'RS', char: '\x1E', token: '«RS»' },
  { code: 31, hex: '1F', abbr: 'US', char: '\x1F', token: '«US»' },
  { code: 127, hex: '7F', abbr: 'DEL', char: '\x7F', token: '«DEL»' },
];

for (const exp of expectedControls) {
  const def = getControlCharacterDefinition(exp.code);
  assert(def !== undefined, `Control code ${exp.code} (${exp.abbr}) found in registry`);
  if (def) {
    assert(def.hex === exp.hex, `Code ${exp.code} has hex 0x${exp.hex} (got ${def.hex})`);
    assert(def.runtimeValue === exp.char, `Code ${exp.code} semantic character matches`);
    assert(def.editorToken === exp.token, `Code ${exp.code} editor token is ${exp.token}`);
  }
}

// Decimal vs Hex Integrity verification
const crDef = getControlCharacterDefinition(13)!;
const lfDef = getControlCharacterDefinition(10)!;
const gsDef = getControlCharacterDefinition(29)!;
const htDef = getControlCharacterDefinition(9)!;

assert(crDef.decimal === 13 && crDef.hex === '0D' && crDef.runtimeValue === '\r', 'CR: Decimal 13, Hex 0D, char \\r');
assert(lfDef.decimal === 10 && lfDef.hex === '0A' && lfDef.runtimeValue === '\n', 'LF: Decimal 10, Hex 0A, char \\n');
assert(gsDef.decimal === 29 && gsDef.hex === '1D' && gsDef.runtimeValue === '\x1D', 'GS: Decimal 29, Hex 1D, char \\x1D');
assert(htDef.decimal === 9 && htDef.hex === '09' && htDef.runtimeValue === '\t', 'HT: Decimal 9, Hex 09, char \\t');

// -----------------------------------------------------------------------------
// 2. Encoder & Decoder Pipeline (Sections 8 & 9)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Encoder & Decoder Pipeline ---');

// Encoding raw control characters -> «TOKEN»
assert(encodeControlCharactersForEditor('\r\n') === '«CR»«LF»', 'encodeControlCharacters: \\r\\n -> «CR»«LF»');
assert(encodeControlCharactersForEditor('\x1D') === '«GS»', 'encodeControlCharacters: \\x1D -> «GS»');
assert(encodeControlCharactersForEditor('\t') === '«HT»', 'encodeControlCharacters: \\t -> «HT»');

// Decoding tokens -> semantic characters
assert(decodeEditorControlCharacters('«CR»«LF»') === '\r\n', 'decodeControlCharacters: «CR»«LF» -> \\r\\n');
assert(decodeEditorControlCharacters('«GS»') === '\x1D', 'decodeControlCharacters: «GS» -> \\x1D');
assert(decodeEditorControlCharacters('«HT»') === '\t', 'decodeControlCharacters: «HT» -> \\t');

// Backward compatibility with <TOKEN> format
assert(decodeEditorControlCharacters('<CR><LF>') === '\r\n', 'decodeControlCharacters: <CR><LF> -> \\r\\n');
assert(decodeEditorControlCharacters('<GS>') === '\x1D', 'decodeControlCharacters: <GS> -> \\x1D');
assert(decodeEditorControlCharacters('<HT>') === '\t', 'decodeControlCharacters: <HT> -> \\t');
assert(decodeEditorControlCharacters('«TAB»') === '\t', 'decodeControlCharacters: alias «TAB» -> \\t');
assert(decodeEditorControlCharacters('<TAB>') === '\t', 'decodeControlCharacters: alias <TAB> -> \\t');

// Escaped tokens handling
assert(decodeEditorControlCharacters('\\«CR»') === '«CR»', 'Escaped token \\«CR» is unescaped to literal «CR»');
assert(decodeEditorControlCharacters('\\<CR>') === '<CR>', 'Escaped token \\<CR> is unescaped to literal <CR>');

// Malformed tokens handling
assert(decodeEditorControlCharacters('«NOT_A_CONTROL»') === '«NOT_A_CONTROL»', 'Malformed token «NOT_A_CONTROL» preserved as-is');
assert(decodeEditorControlCharacters('<div>hello</div>') === '<div>hello</div>', 'HTML tags not corrupted');

// Idempotency
const rawSemantic = 'ABC\x1D123\r\nXYZ';
assert(decodeEditorControlCharacters(rawSemantic) === rawSemantic, 'decodeControlCharacters is idempotent on raw semantic strings');

// -----------------------------------------------------------------------------
// 3. Cursor & Selection Insertion (Sections 4, 5, 24, 25)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Cursor & Selection Insertion Logic ---');

// Test: ABC|123 cursor after ABC (pos 3), insert «CR»
const crCursorTest = insertControlCharacterAtSelection('ABC123', '«CR»', 3, 3);
assert(
  crCursorTest.value === 'ABC«CR»123',
  `ABC|123 inserts «CR» at pos 3 -> "ABC«CR»123" (got "${crCursorTest.value}")`
);
assert(crCursorTest.newCursor === 7, `Cursor after «CR» is 7 (got ${crCursorTest.newCursor})`);

// Test: multi live| text cursor after "multi live" (pos 10), insert «CR»
const mlCursorTest = insertControlCharacterAtSelection('multi live text', '«CR»', 10, 10);
assert(
  mlCursorTest.value === 'multi live«CR» text',
  `multi live| text inserts «CR» -> "multi live«CR» text" (got "${mlCursorTest.value}")`
);
assert(mlCursorTest.newCursor === 14, `Cursor after «CR» is 14 (got ${mlCursorTest.newCursor})`);

// Test: HELLOWORLD cursor after HELLO (pos 5), insert ©
const cursorTest1 = insertControlCharacterAtSelection('HELLOWORLD', '©', 5, 5);
assert(
  cursorTest1.value === 'HELLO©WORLD',
  `HELLOWORLD cursor after HELLO inserts © -> "HELLO©WORLD" (got "${cursorTest1.value}")`
);
assert(cursorTest1.newCursor === 6, `Cursor position updated to 6 (got ${cursorTest1.newCursor})`);

// Test: ABC[123] with 123 selected (pos 3 to 6) replaced with ©
const selectionReplaceTest = insertControlCharacterAtSelection('ABC123', '©', 3, 6);
assert(
  selectionReplaceTest.value === 'ABC©',
  `ABC[123] replaced with © -> "ABC©" (got "${selectionReplaceTest.value}")`
);

// Test: HELLO [WORLD] with WORLD selected (pos 6 to 11) replaced with ®
const selectionTest1 = insertControlCharacterAtSelection('HELLO WORLD', '®', 6, 11);
assert(
  selectionTest1.value === 'HELLO ®',
  `HELLO [WORLD] replaced with ® -> "HELLO ®" (got "${selectionTest1.value}")`
);
assert(selectionTest1.newCursor === 7, `Cursor position updated to 7 (got ${selectionTest1.newCursor})`);

// Test: Price: |500 cursor at pos 7, insert ₹
const rupeeTest = insertControlCharacterAtSelection('Price: 500', '₹', 7, 7);
assert(
  rupeeTest.value === 'Price: ₹500',
  `Price: |500 inserts ₹ -> "Price: ₹500" (got "${rupeeTest.value}")`
);

// -----------------------------------------------------------------------------
// 4. Unicode Symbols (Section 13 & 28)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Unicode Symbols Insertion & Integrity ---');
const sampleSymbols = ['€', '£', '¥', '₹', '©', '®', '™', '·', '§', '†', '‡', '¶', '«', '»', '¼', '½', '¾', '°', '±', '≤', '≥'];
for (const sym of sampleSymbols) {
  const inserted = insertControlCharacterAtSelection('Prefix-', sym, 7, 7);
  assert(inserted.value === `Prefix-${sym}`, `Symbol ${sym} cleanly inserted without corruption`);
}

// -----------------------------------------------------------------------------
// 5. Data Source Tree Preview (Section 7)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Data Source Tree Preview ---');
const dsCr: DataSourceItem = { id: 'ds-cr', name: 'Source 1', type: 'embedded', value: '«CR»', enabled: true };
const dsMulti: DataSourceItem = { id: 'ds-m', name: 'Source 2', type: 'embedded', value: 'multi live «CR» text', enabled: true };
const dsEmpty: DataSourceItem = { id: 'ds-e', name: 'Source 3', type: 'embedded', value: '', enabled: true };

assert(getDataSourceDisplayPreview(dsCr) === '<CR>' || getDataSourceDisplayPreview(dsCr) === '«CR»', `Tree preview for «CR» source is "<CR>" or "«CR»" (got "${getDataSourceDisplayPreview(dsCr)}")`);
assert(getDataSourceDisplayPreview(dsMulti) === 'multi live «CR» text', `Tree preview for multi source is "multi live «CR» text" (got "${getDataSourceDisplayPreview(dsMulti)}")`);
assert(getDataSourceDisplayPreview({ ...dsCr, value: '\r' }) === '<CR>' || getDataSourceDisplayPreview({ ...dsCr, value: '\r' }) === '«CR»', `Tree preview converts raw \\r to "<CR>" or "«CR»"`);

// -----------------------------------------------------------------------------
// 6. Data Source Resolution Engine (Sections 10, 24, 25, 26, 27)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Data Source Engine Evaluation ---');

// Test CR in Multi-line text
const crItem: DataSourceItem = {
  id: 'ds-cr-item',
  name: 'CR Source',
  type: 'embedded',
  value: 'multi live «CR» text',
  enabled: true,
};
const evalCr = evaluateDataSourceItem(crItem, {});
assert(
  evalCr === 'multi live \r text',
  `evaluateDataSourceItem: "multi live «CR» text" -> "multi live \\r text"`
);

// Canvas visual layout for CR: "multi live «CR» text"
const canvasRenderedCr = escapeForTextRender(evalCr);
assert(
  canvasRenderedCr === 'multi live \n text',
  `Canvas visual layout resolves CR to newline without literal «CR» (got ${JSON.stringify(canvasRenderedCr)})`
);
assert(!canvasRenderedCr.includes('«CR»'), 'Literal "«CR»" does NOT appear on canvas output');

// Test CRLF normalization: ABC«CR»«LF»123
const crlfItem: DataSourceItem = {
  id: 'ds-crlf-item',
  name: 'CRLF Source',
  type: 'embedded',
  value: 'ABC«CR»«LF»123',
  enabled: true,
};
const evalCrlf = evaluateDataSourceItem(crlfItem, {});
assert(evalCrlf === 'ABC\r\n123', `evaluateDataSourceItem: "ABC«CR»«LF»123" -> "ABC\\r\\n123"`);
const canvasRenderedCrlf = escapeForTextRender(evalCrlf);
assert(
  canvasRenderedCrlf === 'ABC\n123',
  `ABC«CR»«LF»123 produces ONE logical newline without extra blank lines (got ${JSON.stringify(canvasRenderedCrlf)})`
);

// Test Tab in Data Source: ABC«HT»123
const tabItem: DataSourceItem = {
  id: 'ds-tab',
  name: 'Tab Source',
  type: 'embedded',
  value: 'ABC«HT»123',
  enabled: true,
};
const evalTab = evaluateDataSourceItem(tabItem, {});
assert(evalTab === 'ABC\t123', `evaluateDataSourceItem: "ABC«HT»123" -> "ABC\\t123"`);
assert(evalTab.charCodeAt(3) === 9, 'Char at index 3 is ASCII 9');

// Test GS in Data Source: ABC«GS»123
const gsItem: DataSourceItem = {
  id: 'ds-gs',
  name: 'GS Source',
  type: 'embedded',
  value: 'ABC«GS»123',
  enabled: true,
};
const evalGs = evaluateDataSourceItem(gsItem, {});
assert(evalGs === 'ABC\x1D123', `evaluateDataSourceItem: "ABC«GS»123" -> "ABC\\x1D123"`);

// Verify exact runtime code units (Section 27: A=65, B=66, C=67, GS=29, 1=49, 2=50, 3=51)
const expectedCodeUnits = [65, 66, 67, 29, 49, 50, 51];
const actualCodeUnits = Array.from(evalGs).map((c) => c.charCodeAt(0));
assert(
  JSON.stringify(actualCodeUnits) === JSON.stringify(expectedCodeUnits),
  `Runtime code units match [65, 66, 67, 29, 49, 50, 51] (got ${JSON.stringify(actualCodeUnits)})`
);

// Single line normalization
const singleLineWithCr = 'Hello«CR»«LF»World';
const decSingle = decodeEditorControlCharacters(singleLineWithCr);
const singleLineRendered = normalizeSingleLineText(decSingle);
assert(
  singleLineRendered === 'Hello World',
  `Single line text normalizes CRLF into space: "Hello World" (got "${singleLineRendered}")`
);

// -----------------------------------------------------------------------------
// 7. Multiple Data Sources Targeting (Sections 6, 20, 25)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Multiple Data Sources Targeting ---');

const source1: DataSourceItem = {
  id: 'ds-p1',
  name: 'Source 1',
  type: 'embedded',
  value: 'Product',
  enabled: true,
};

const source2: DataSourceItem = {
  id: 'ds-p2',
  name: 'Source 2',
  type: 'embedded',
  value: '«CR»',
  enabled: true,
};

const source3: DataSourceItem = {
  id: 'ds-p3',
  name: 'Source 3',
  type: 'embedded',
  value: 'Price',
  enabled: true,
};

const multiSourceElement: TextElement = {
  id: 'text-multi-src',
  type: 'text',
  textType: 'multi-line',
  name: 'Multi-Line Text 1',
  x: 10,
  y: 10,
  width: 50,
  height: 25,
  text: '',
  dataSources: [source1, source2, source3],
};

const evaluatedMulti = evaluateTextElement(multiSourceElement, {});
assert(evaluatedMulti === 'Product\rPrice', `Multi-source evaluated text is "Product\\rPrice"`);
const canvasMulti = escapeForTextRender(evaluatedMulti);
assert(canvasMulti === 'Product\nPrice', `Canvas renders multiple sources as "Product\\nPrice" (got ${JSON.stringify(canvasMulti)})`);

// Verify isolating edits to Source 2 only
const editedSource2 = insertControlCharacterAtSelection(source2.value, '«LF»', source2.value.length, source2.value.length);
assert(editedSource2.value === '«CR»«LF»', 'Source 2 updated with «LF»');
assert(source1.value === 'Product', 'Source 1 remains completely untouched');
assert(source3.value === 'Price', 'Source 3 remains completely untouched');

// -----------------------------------------------------------------------------
// 8. Barcode Runtime Encoding with ASCII 29 (Sections 15, 30)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Barcode Runtime Encoding with ASCII 29 ---');

const barcodeEl: BarcodeElement = {
  id: 'barcode-test-1',
  type: 'barcode',
  name: 'Barcode 1',
  symbology: 'code128',
  x: 10,
  y: 30,
  width: 50,
  height: 25,
  value: 'ABC«GS»123',
  dataSources: [
    {
      id: 'ds-bc-1',
      name: 'Primary Data Source',
      type: 'embedded',
      value: 'ABC«GS»123',
      enabled: true,
    },
  ],
};

const resolvedBarcode = resolveBarcodeData(barcodeEl, {});
assert(
  resolvedBarcode.encodedValue === 'ABC\x1D123',
  `resolveBarcodeData: encodedValue is "ABC\\x1D123" (contains ASCII 29: ${resolvedBarcode.encodedValue.charCodeAt(3)})`
);
assert(
  resolvedBarcode.encodedValue.charCodeAt(3) === 29,
  'encodedValue contains ASCII 29 byte (NOT literal "«GS»" or "<GS>")'
);

// Code 128 SVG generation with ASCII 29
try {
  const svg = bwipjs.toSVG({
    bcid: 'code128',
    text: resolvedBarcode.encodedValue,
    scale: 2,
    height: 10,
  });
  assert(svg.length > 500 && svg.includes('<svg'), 'bwip-js generates valid Code 128 SVG with ASCII 29');
} catch (err: any) {
  assert(false, `bwip-js Code 128 error: ${err.message}`);
}

// DataMatrix SVG generation with GS1 / ASCII 29
try {
  const dmSvg = bwipjs.toSVG({
    bcid: 'datamatrix',
    text: resolvedBarcode.encodedValue,
    scale: 2,
  });
  assert(dmSvg.length > 500 && dmSvg.includes('<svg'), 'bwip-js generates valid DataMatrix with ASCII 29');
} catch (err: any) {
  assert(false, `bwip-js DataMatrix error: ${err.message}`);
}

// -----------------------------------------------------------------------------
// 9. Save & Reopen JSON Serialization (Sections 17, 29)
// -----------------------------------------------------------------------------
console.log('\n--- 9. Save & Reopen Serialization ---');

const testSequence = 'ABC«GS»123«CR»XYZ';
const docTemplate = {
  id: 'tmpl-save-test',
  name: 'Test Template',
  elements: [
    {
      id: 'el-test-1',
      type: 'text',
      dataSources: [
        {
          id: 'ds-save-1',
          value: testSequence,
        },
      ],
    },
  ],
};

const serialized = JSON.stringify(docTemplate);
const deserialized = JSON.parse(serialized);
assert(
  deserialized.elements[0].dataSources[0].value === testSequence,
  `Serialization roundtrip: "${testSequence}" preserved exactly in JSON`
);
const reloadedVal = deserialized.elements[0].dataSources[0].value;
const reloadedRuntime = resolveForRuntime(reloadedVal);
assert(reloadedRuntime === 'ABC\x1D123\rXYZ', 'Reloaded document resolves to exact runtime bytes');

// -----------------------------------------------------------------------------
// 10. Undo / Redo Transaction Integrity (Section 18)
// -----------------------------------------------------------------------------
console.log('\n--- 10. Undo / Redo Transaction Integrity ---');

const historyStack: string[] = [];
let currentState = 'ABC123';
historyStack.push(currentState);

// Action: Insert «CR» at pos 3
const step1 = insertControlCharacterAtSelection(currentState, '«CR»', 3, 3);
currentState = step1.value;
historyStack.push(currentState);
assert(currentState === 'ABC«CR»123', 'Step 1: Value is ABC«CR»123');

// Action: Undo
const undone = historyStack[historyStack.length - 2];
assert(undone === 'ABC123', 'Undo step: Reverted to ABC123');

// Action: Redo
const redone = historyStack[historyStack.length - 1];
assert(redone === 'ABC«CR»123', 'Redo step: Re-applied ABC«CR»123');

// -----------------------------------------------------------------------------
// 11. Recently Used Characters (Section 14)
// -----------------------------------------------------------------------------
console.log('\n--- 11. Recently Used Characters ---');

// Mock localStorage for node test
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
};

// Add «CR»
const recents1 = addRecentSymbol('«CR»');
assert(recents1[0] === '«CR»', '«CR» added to front of recent symbols');

// Add ₹
const recents2 = addRecentSymbol('₹');
assert(recents2[0] === '₹' && recents2[1] === '«CR»', '₹ added to front, «CR» shifted to 2nd position');

// -----------------------------------------------------------------------------
// 12. CR Control Character & Layout Value Suite (Bug Fix Verification)
// -----------------------------------------------------------------------------
console.log('\n--- 12. CR Control Character Resolution & Layout Engine Tests ---');

// TEST 1: Exact bug case: "shhhhhsnd<CR>shibam"
const inputBug = 'shhhhhsnd<CR>shibam';
const runtimeBug = parseControlCharacters(inputBug);
assert(runtimeBug === 'shhhhhsnd\rshibam', 'Test 1a: parseControlCharacters("shhhhhsnd<CR>shibam") produces runtime value "shhhhhsnd\\rshibam"');

const multilineBug = getMultiLineLayoutValue(inputBug);
assert(multilineBug === 'shhhhhsnd\nshibam', 'Test 1b: Multi-line layout value produces "shhhhhsnd\\nshibam"');
assert(!multilineBug.includes('<CR>') && !multilineBug.includes('«CR»'), 'Test 1c: Zero visible <CR> or «CR» tokens in multi-line layout');

const editorBug = encodeControlCharactersForEditor(runtimeBug);
assert(editorBug === 'shhhhhsnd«CR»shibam', 'Test 1d: Editor representation is "shhhhhsnd«CR»shibam"');

// Test 1e: Measurement engine calculates 2 lines for shhhhhsnd<CR>shibam
const measuredBug = measureTextObject({
  text: inputBug,
  textType: 'multi-line',
  fontSize: 12,
  fontFamily: 'Arial',
  lineHeight: 1.2,
  containerWidthMm: 100,
});
assert(measuredBug.linesCount === 2, `Test 1e: measureTextObject calculates exactly 2 lines (got ${measuredBug.linesCount})`);

// TEST 2: "FIRST<CR>SECOND<CR>THIRD"
const input2 = 'FIRST<CR>SECOND<CR>THIRD';
const multiline2 = getMultiLineLayoutValue(input2);
assert(multiline2 === 'FIRST\nSECOND\nTHIRD', 'Test 2: FIRST<CR>SECOND<CR>THIRD renders as 3 distinct lines');
assert(!multiline2.includes('<CR>') && !multiline2.includes('«CR»'), 'Test 2b: No tokens in TEST 2 output');

// TEST 3: "FIRST<CR><LF>SECOND" -> Single line break
const input3 = 'FIRST<CR><LF>SECOND';
const multiline3 = getMultiLineLayoutValue(input3);
assert(multiline3 === 'FIRST\nSECOND', 'Test 3a: FIRST<CR><LF>SECOND collapses CRLF to single line break');
const input3b = 'FIRST«CR»«LF»SECOND';
assert(getMultiLineLayoutValue(input3b) === 'FIRST\nSECOND', 'Test 3b: FIRST«CR»«LF»SECOND also collapses to single line break');

// TEST 4: Save & Reopen document preservation
const docWithCR: LabelTemplate = {
  id: 'tmpl-cr',
  name: 'CR Template',
  version: '1.0.0',
  unit: 'mm',
  dimensions: { width: 100, height: 50, dpi: 203 },
  elements: [
    {
      id: 'text-cr',
      type: 'text',
      textType: 'multi-line',
      name: 'TextCR',
      visible: true,
      printable: true,
      x: 10,
      y: 10,
      width: 60,
      height: 25,
      fontSize: 12,
      fontFamily: 'Arial',
      textAlign: 'left',
      dataSources: [{ id: 'ds-cr', type: 'embedded', value: 'FIRST<CR>SECOND' }],
    },
  ],
};
const savedJson = JSON.stringify(docWithCR);
const reopenedDoc: LabelTemplate = JSON.parse(savedJson);
const reopenedTextEl = reopenedDoc.elements[0] as TextElement;
assert(reopenedTextEl.dataSources[0].value === 'FIRST<CR>SECOND', 'Test 4a: Saved/reopened JSON preserves semantic <CR> token in data source');
const reopenedEvaluated = evaluateElementData(reopenedTextEl, { record: {} });
const reopenedLayout = getMultiLineLayoutValue(reopenedEvaluated);
assert(reopenedLayout === 'FIRST\nSECOND', 'Test 4b: Reopened document canvas layout displays "FIRST\\nSECOND"');
assert(!reopenedLayout.includes('<CR>'), 'Test 4c: No <CR> on reopened document canvas');

// TEST 5: Print Preview and Print renderers (Windows HTML, ZPL, TSPL)
const printHtml = generateWindowsDriverHtml(docWithCR);
assert(!printHtml.includes('&lt;CR&gt;') && !printHtml.includes('<CR>') && !printHtml.includes('«CR»'), 'Test 5a: Windows Driver HTML does NOT contain <CR> or «CR»');
assert(printHtml.includes('FIRST\nSECOND'), 'Test 5b: Windows Driver HTML contains resolved newline "FIRST\\nSECOND" with pre-wrap');

const zplOutput = renderZPL(docWithCR);
assert(!zplOutput.includes('<CR>') && !zplOutput.includes('«CR»'), 'Test 5c: ZPL output does NOT contain <CR> or «CR»');
assert(zplOutput.includes('FIRST\\&SECOND'), 'Test 5d: ZPL converts newline to \\& in ^FB block');

const tsplOutput = renderTSPL(docWithCR);
assert(!tsplOutput.includes('<CR>') && !tsplOutput.includes('«CR»'), 'Test 5e: TSPL output does NOT contain <CR> or «CR»');
assert(tsplOutput.includes('"FIRST"') && tsplOutput.includes('"SECOND"'), 'Test 5f: TSPL renders FIRST and SECOND as discrete positioned lines');

// TEST 6: Barcode Warning: GS control character in Barcode
const barcodeElGS: BarcodeElement = {
  id: 'bc-gs',
  type: 'barcode',
  name: 'BarcodeGS',
  symbology: 'code128',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 50,
  height: 20,
  dataSources: [{ id: 'ds-bc', type: 'embedded', value: 'ABC<GS>123' }],
};
const bcResolved = resolveBarcodeData(barcodeElGS, { record: {} });
assert(bcResolved.encodedValue === 'ABC\x1D123', 'Test 6a: Barcode resolves <GS> to ASCII 29 (\\x1D), NOT a newline');
assert(!bcResolved.encodedValue.includes('\n'), 'Test 6b: Barcode does NOT contain visual newline');

// TEST 7: Single Line Text vs Multi Line Text
const singleLineEl: TextElement = {
  id: 'el-sl-1',
  type: 'text',
  textType: 'single-line',
  name: 'SingleLineText',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 50,
  height: 10,
  fontSize: 12,
  fontFamily: 'Arial',
  textAlign: 'left',
  dataSources: [{ id: 'ds-sl', type: 'embedded', value: 'ABC<CR>XYZ' }],
};
const slEvaluated = evaluateElementData(singleLineEl, { record: {} });
const slLayout = getSingleLineLayoutValue(slEvaluated);
assert(slLayout === 'ABC XYZ', 'Test 7a: Single-line text layout normalizes CR to space "ABC XYZ" without breaking into 2 lines');
assert(!slLayout.includes('<CR>'), 'Test 7b: Single-line layout does NOT contain literal <CR>');
assert(singleLineEl.dataSources[0].value === 'ABC<CR>XYZ', 'Test 7c: Data source maintains underlying control character token');
assert(slEvaluated === 'ABC\rXYZ', 'Test 7d: Runtime value preserves semantic \\r carriage return');

// -----------------------------------------------------------------------------
// 13. Advanced Multi-Line Text Data Sources & Control Character Engine Tests (TESTS A-J)
// -----------------------------------------------------------------------------
console.log('\n--- 13. Advanced Multi-Line Text Data Sources & Control Character Engine (TESTS A-J) ---');

// TEST A: Sources = "Sample Text", <CR> (control-character), "Sample Text"
const testA_El: TextElement = {
  id: 'el-test-a',
  type: 'text',
  textType: 'multi-line',
  name: 'Text 1',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 60,
  height: 25,
  fontSize: 12,
  fontFamily: 'Arial',
  textAlign: 'left',
  dataSources: [
    { id: 'ds-a-1', type: 'embedded', value: 'Sample Text' },
    {
      id: 'ds-a-2',
      type: 'control-character',
      name: '<CR>',
      controlCode: 'CR',
      code: 'CR',
      decimal: 13,
      hex: '0D',
      value: '<CR>',
    },
    { id: 'ds-a-3', type: 'embedded', value: 'Sample Text' },
  ],
};
const testA_Evaluated = evaluateElementData(testA_El, { record: {} });
assert(testA_Evaluated === 'Sample Text\rSample Text', 'TEST A: Evaluated stream is exactly "Sample Text\\rSample Text"');
const crIndexA = 'Sample Text'.length;
assert(testA_Evaluated.charCodeAt(crIndexA) === 13, `TEST A: Character code at boundary index ${crIndexA} is exactly ASCII 13 (got ${testA_Evaluated.charCodeAt(crIndexA)})`);
const testA_Layout = normalizeTextForMultilineLayout(testA_Evaluated);
assert(testA_Layout === 'Sample Text\nSample Text', 'TEST A: Canvas layout displays 2 lines "Sample Text\\nSample Text"');
assert(!testA_Layout.includes('<CR>') && !testA_Layout.includes('«CR»'), 'TEST A: Zero "<CR>" or "«CR»" on canvas');

// TEST B: Sources = "ABC", CR, "DEF", CR, "GHI"
const testB_El: TextElement = {
  id: 'el-test-b',
  type: 'text',
  textType: 'multi-line',
  name: 'Text B',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 60,
  height: 25,
  fontSize: 12,
  fontFamily: 'Arial',
  textAlign: 'left',
  dataSources: [
    { id: 'ds-b-1', type: 'embedded', value: 'ABC' },
    { id: 'ds-b-2', type: 'control-character', controlCode: 'CR', value: '<CR>' },
    { id: 'ds-b-3', type: 'embedded', value: 'DEF' },
    { id: 'ds-b-4', type: 'control-character', controlCode: 'CR', value: '<CR>' },
    { id: 'ds-b-5', type: 'embedded', value: 'GHI' },
  ],
};
const testB_Evaluated = evaluateElementData(testB_El, { record: {} });
assert(testB_Evaluated === 'ABC\rDEF\rGHI', 'TEST B: Evaluated stream is "ABC\\rDEF\\rGHI"');
const testB_Layout = getMultiLineLayoutValue(testB_Evaluated);
assert(testB_Layout === 'ABC\nDEF\nGHI', 'TEST B: Canvas layout displays 3 distinct lines: ABC\\nDEF\\nGHI');
assert(!testB_Layout.includes('<CR>'), 'TEST B: No literal <CR> in layout');

// TEST C: Sources = "ABC", "DEF" -> Exactly "ABCDEF" with NO artificial space or newline
const testC_El: TextElement = {
  id: 'el-test-c',
  type: 'text',
  textType: 'multi-line',
  name: 'Text C',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 60,
  height: 25,
  dataSources: [
    { id: 'ds-c-1', type: 'embedded', value: 'ABC' },
    { id: 'ds-c-2', type: 'embedded', value: 'DEF' },
  ],
};
const testC_Evaluated = evaluateElementData(testC_El, { record: {} });
assert(testC_Evaluated === 'ABCDEF', 'TEST C: Sources concatenated without space or newline: "ABCDEF"');
assert(getMultiLineLayoutValue(testC_Evaluated) === 'ABCDEF', 'TEST C: Canvas layout is exactly "ABCDEF"');

// TEST D: Embedded Multi-line data = "Hello\nWorld"
const testD_El: TextElement = {
  id: 'el-test-d',
  type: 'text',
  textType: 'multi-line',
  name: 'Text D',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 60,
  height: 25,
  dataSources: [{ id: 'ds-d-1', type: 'embedded', value: 'Hello\nWorld' }],
};
const testD_Evaluated = evaluateElementData(testD_El, { record: {} });
const testD_Layout = getMultiLineLayoutValue(testD_Evaluated);
assert(testD_Layout === 'Hello\nWorld', 'TEST D: Embedded multi-line value "Hello\\nWorld" renders as 2 lines');

// TEST E: Database ProductName, CR, Database SKU
const testE_Record = { ProductName: 'Shampoo 500ml', SKU: '000101' };
const testE_El: TextElement = {
  id: 'el-test-e',
  type: 'text',
  textType: 'multi-line',
  name: 'Text E',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 60,
  height: 25,
  dataSources: [
    { id: 'ds-e-1', type: 'database-field', databaseField: 'ProductName', field: 'ProductName', value: 'Shampoo 500ml' },
    { id: 'ds-e-2', type: 'control-character', controlCode: 'CR', value: '<CR>' },
    { id: 'ds-e-3', type: 'database-field', databaseField: 'SKU', field: 'SKU', value: '000101' },
  ],
};
const testE_Evaluated = evaluateElementData(testE_El, { record: testE_Record });
assert(testE_Evaluated === 'Shampoo 500ml\r000101', 'TEST E: Database fields with CR evaluate to "Shampoo 500ml\\r000101"');
const testE_Layout = getMultiLineLayoutValue(testE_Evaluated);
assert(testE_Layout === 'Shampoo 500ml\n000101', 'TEST E: Layout renders as "Shampoo 500ml\\n000101"');

// TEST F: Save/reopen test with structured control-character data source
const testF_Doc: LabelTemplate = {
  id: 'tmpl-f',
  name: 'Test F Template',
  version: '1.0.0',
  unit: 'mm',
  dimensions: { width: 100, height: 50, dpi: 203 },
  elements: [testA_El],
};
const testF_Json = JSON.stringify(testF_Doc);
const testF_Reopened: LabelTemplate = JSON.parse(testF_Json);
const testF_ReopenedEl = testF_Reopened.elements[0] as TextElement;
assert(testF_ReopenedEl.dataSources.length === 3, 'TEST F: Reopened document preserves all 3 data sources independently');
assert(testF_ReopenedEl.dataSources[1].type === 'control-character', 'TEST F: Second data source remains type "control-character"');
assert(testF_ReopenedEl.dataSources[1].controlCode === 'CR', 'TEST F: Second data source preserves controlCode "CR"');
assert(testF_ReopenedEl.dataSources[1].decimal === 13, 'TEST F: Second data source preserves decimal 13');
const testF_ReopenedLayout = getMultiLineLayoutValue(evaluateElementData(testF_ReopenedEl, { record: {} }));
assert(testF_ReopenedLayout === 'Sample Text\nSample Text', 'TEST F: Reopened template renders identically: "Sample Text\\nSample Text"');

// TEST G: Move Up / Move Down source ordering
const testG_Sources = [
  { id: 'ds-g-1', type: 'embedded', value: 'Sample Text' },
  { id: 'ds-g-2', type: 'control-character', controlCode: 'CR', value: '<CR>' },
  { id: 'ds-g-3', type: 'embedded', value: 'Sample Text 2' },
];
// Move CR from index 1 down to index 2
const testG_MovedSources = [testG_Sources[0], testG_Sources[2], testG_Sources[1]];
const testG_El: TextElement = {
  ...testA_El,
  dataSources: testG_MovedSources as any,
};
const testG_Evaluated = evaluateElementData(testG_El, { record: {} });
assert(testG_Evaluated === 'Sample TextSample Text 2\r', 'TEST G: Reordering immediately updates concatenated stream');
assert(getMultiLineLayoutValue(testG_Evaluated) === 'Sample TextSample Text 2\n', 'TEST G: Layout immediately reflects new ordering');

// TEST H: Single Line object with CR does NOT create multiple visual lines
const testH_El: TextElement = {
  id: 'el-test-h',
  type: 'text',
  textType: 'single-line',
  name: 'Text H',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 50,
  height: 10,
  dataSources: [
    { id: 'ds-h-1', type: 'embedded', value: 'Line1' },
    { id: 'ds-h-2', type: 'control-character', controlCode: 'CR', value: '<CR>' },
    { id: 'ds-h-3', type: 'embedded', value: 'Line2' },
  ],
};
const testH_Evaluated = evaluateElementData(testH_El, { record: {} });
const testH_Layout = getSingleLineLayoutValue(testH_Evaluated);
assert(testH_Layout === 'Line1 Line2', 'TEST H: Single-line object flattens CR to single space "Line1 Line2" without line break');
assert(!testH_Layout.includes('\n'), 'TEST H: Single-line object contains zero newlines');

// TEST I: Multi-line object with Enter / newline creates line break
const testI_El: TextElement = {
  id: 'el-test-i',
  type: 'text',
  textType: 'multi-line',
  name: 'Text I',
  visible: true,
  printable: true,
  x: 10,
  y: 10,
  width: 50,
  height: 25,
  dataSources: [{ id: 'ds-i-1', type: 'embedded', value: 'First Line\nSecond Line' }],
};
const testI_Layout = getMultiLineLayoutValue(evaluateElementData(testI_El, { record: {} }));
assert(testI_Layout === 'First Line\nSecond Line', 'TEST I: Multi-line object with Enter breaks across lines');

// TEST J: Ensure literal user text "\<CR>" can remain literal when escaped
const testJ_Literal = 'Literal \\<CR> Text';
const testJ_Parsed = parseControlCharacters(testJ_Literal);
assert(testJ_Parsed === 'Literal <CR> Text', 'TEST J: Escaped \\<CR> unescapes to literal "<CR>" without converting to newline');
assert(testJ_Parsed.includes('<CR>'), 'TEST J: Literal <CR> preserved in string');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n=============================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log('=============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
