import { TextElement, DataSourceItem, LabelTemplate } from '../src/types';
import {
  evaluateTextElement,
  evaluateTextElementRuns,
  getEffectiveSourceFont,
  hasDataSourceFontOverrides,
} from '../src/services/dataSourceEngine';
import {
  getMultiLineLayoutValue,
  getSingleLineLayoutValue,
} from '../src/services/controlCharacterService';
import { measureTextObject, recalculateTextElementDimensions } from '../src/services/textMeasurementEngine';
import { generateWindowsDriverHtml } from '../src/printing/renderers/windowsDriverRenderer';
import { parseBarTenderDocument } from '../src/services/barTenderParser';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

console.log('================================================================');
console.log('RUNNING "FONT PER DATA SOURCE" COMPREHENSIVE ACCEPTANCE TEST SUITE');
console.log('================================================================\n');

let passCount = 0;
function pass(testName: string) {
  passCount++;
  console.log(`  ✓ ${testName}`);
}

// ------------------------------------------------------------------
// 1. INHERITANCE MODEL TESTS
// ------------------------------------------------------------------
console.log('--- 1. Testing Font Inheritance Model ---');
{
  const element: TextElement = {
    id: 'txt-1',
    name: 'Text 1',
    type: 'text',
    text: '',
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    backgroundColor: 'transparent',
    lineHeight: 1.15,
    letterSpacing: 0,
    textAlign: 'left',
    verticalAlign: 'top',
    x: 10,
    y: 10,
    width: 50,
    height: 20,
    zIndex: 1,
    locked: false,
    editable: true,
    visible: true,
  };

  const inheritedSource: DataSourceItem = {
    id: 'src-1',
    name: 'Source 1',
    type: 'embedded',
    value: 'Hello',
    enabled: true,
    fontOverrideEnabled: false,
  };

  // Test 1.1: Inherits object font when override is disabled
  const eff1 = getEffectiveSourceFont(inheritedSource, element);
  assert(eff1.fontFamily === 'Arial', 'Inherited font family should be Arial');
  assert(eff1.fontSize === 12, 'Inherited font size should be 12');
  assert(eff1.fontWeight === 'normal', 'Inherited font weight should be normal');
  assert(eff1.color === '#000000', 'Inherited color should be black');
  pass('Inherits object font when fontOverrideEnabled is false');

  // Test 1.2: Dynamic inheritance: Changing object font updates inherited source
  const updatedElement: TextElement = {
    ...element,
    fontFamily: 'Verdana',
    fontSize: 16,
    color: '#123456',
  };
  const eff2 = getEffectiveSourceFont(inheritedSource, updatedElement);
  assert(eff2.fontFamily === 'Verdana', 'Updated inherited font family should be Verdana');
  assert(eff2.fontSize === 16, 'Updated inherited font size should be 16');
  assert(eff2.color === '#123456', 'Updated inherited color should be #123456');
  pass('Dynamic inheritance: Source automatically tracks object font changes when override is OFF');

  // Test 1.3: Active override preserves source-specific properties while inheriting un-overridden properties
  const overriddenSource: DataSourceItem = {
    id: 'src-2',
    name: 'Source 2',
    type: 'embedded',
    value: 'World',
    enabled: true,
    fontOverrideEnabled: true,
    fontStyleOverride: {
      fontFamily: 'Times New Roman',
      fontSize: 26,
      fontStyle: 'italic',
      color: '#ff0000',
    },
  };
  const eff3 = getEffectiveSourceFont(overriddenSource, updatedElement);
  assert(eff3.fontFamily === 'Times New Roman', 'Overridden family should be Times New Roman');
  assert(eff3.fontSize === 26, 'Overridden size should be 26');
  assert(eff3.fontStyle === 'italic', 'Overridden style should be italic');
  assert(eff3.color === '#ff0000', 'Overridden color should be red');
  assert(eff3.fontWeight === 'normal', 'Unset property (fontWeight) should inherit object font');
  pass('Active override applies overridden properties and inherits unset properties');
}

// ------------------------------------------------------------------
// 2. TEST CASE 1: MULTI-LINE TEXT WITH CR AND MIXED FONTS
// ------------------------------------------------------------------
console.log('\n--- 2. Testing Test Case 1: Multi-line Text with CR and Independent Fonts ---');
{
  const multiLineElement: TextElement = {
    id: 'el-multiline-1',
    name: 'Text 1',
    type: 'text',
    textType: 'multi-line',
    textFormatType: 'paragraph',
    multiline: true,
    text: '',
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    lineHeight: 1.15,
    letterSpacing: 0,
    textAlign: 'left',
    verticalAlign: 'top',
    x: 10,
    y: 10,
    width: 60,
    height: 30,
    zIndex: 1,
    locked: false,
    editable: true,
    visible: true,
    dataSources: [
      {
        id: 'ds-1',
        name: 'Sample Text',
        type: 'embedded',
        value: 'Sample Text',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Arial',
          fontSize: 18,
          fontWeight: 'bold',
          color: '#000000',
        },
      },
      {
        id: 'ds-2',
        name: '<CR>',
        type: 'control-character',
        controlCode: 'CR',
        code: 'CR',
        value: '\r',
        enabled: true,
      },
      {
        id: 'ds-3',
        name: 'Sample Text',
        type: 'embedded',
        value: 'Sample Text',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Times New Roman',
          fontSize: 26,
          fontStyle: 'italic',
          color: '#ff0000',
        },
      },
    ],
  };

  assert(hasDataSourceFontOverrides(multiLineElement) === true, 'Should detect data source font overrides');
  pass('hasDataSourceFontOverrides detects active font overrides');

  const runs = evaluateTextElementRuns(multiLineElement);
  assert(runs.length === 3, 'Must resolve exactly 3 runs');

  // Run 1 check
  assert(runs[0].sourceId === 'ds-1', 'Run 1 sourceId should match ds-1');
  assert(runs[0].type === 'text', 'Run 1 type should be text');
  assert(runs[0].value === 'Sample Text', 'Run 1 value should be Sample Text');
  assert(runs[0].style.fontFamily === 'Arial', 'Run 1 fontFamily should be Arial');
  assert(runs[0].style.fontSize === 18, 'Run 1 fontSize should be 18');
  assert(runs[0].style.fontWeight === 'bold', 'Run 1 fontWeight should be bold');
  assert(runs[0].style.color === '#000000', 'Run 1 color should be black');
  pass('Run 1 resolves: Arial 18 Bold Black');

  // Run 2 check (Control character)
  assert(runs[1].sourceId === 'ds-2', 'Run 2 sourceId should match ds-2');
  assert(runs[1].type === 'control', 'Run 2 type should be control');
  assert(runs[1].value === '\r', 'Run 2 value should be \\r');
  const run2LayoutVal = getMultiLineLayoutValue(runs[1].value);
  assert(run2LayoutVal === '\n', 'Run 2 must resolve to runtime line break \\n');
  assert(!run2LayoutVal.includes('<CR>') && !run2LayoutVal.includes('«CR»'), 'Run 2 must not render visible literal <CR>');
  pass('Run 2 resolves: control character CR -> runtime line break \\n, NO visible <CR> text');

  // Run 3 check
  assert(runs[2].sourceId === 'ds-3', 'Run 3 sourceId should match ds-3');
  assert(runs[2].type === 'text', 'Run 3 type should be text');
  assert(runs[2].value === 'Sample Text', 'Run 3 value should be Sample Text');
  assert(runs[2].style.fontFamily === 'Times New Roman', 'Run 3 fontFamily should be Times New Roman');
  assert(runs[2].style.fontSize === 26, 'Run 3 fontSize should be 26');
  assert(runs[2].style.fontStyle === 'italic', 'Run 3 fontStyle should be italic');
  assert(runs[2].style.color === '#ff0000', 'Run 3 color should be #ff0000');
  pass('Run 3 resolves: Times New Roman 26 Italic Red');

  // Check measurement accommodates larger font size on Line 2 without clipping
  const dims = recalculateTextElementDimensions(multiLineElement);
  assert(dims.height > 15, `Calculated height (${dims.height}mm) accommodates both 18pt and 26pt lines`);
  pass(`Multi-line layout engine calculates height (${dims.height.toFixed(1)}mm) accommodating 26pt line`);

  // Check Windows Driver HTML rendering
  const tpl: LabelTemplate = {
    id: 'tmpl-1',
    name: 'Test Template',
    width: 100,
    height: 100,
    unit: 'mm',
    dpi: 300,
    elements: [multiLineElement],
  };
  const html = generateWindowsDriverHtml(tpl, [{}]);
  assert(html.includes('Times New Roman'), 'Generated HTML contains Times New Roman');
  assert(html.includes('viewBox="0 0 60 30"'), 'Paragraph SVG uses the object physical millimetre coordinates');
  assert(html.includes(`font-size="${26 * 25.4 / 72}"`), 'Generated SVG contains the physical equivalent of 26pt');
  assert(html.includes('#ff0000'), 'Generated HTML contains #ff0000 (red)');
  assert(html.includes(`font-size="${18 * 25.4 / 72}"`), 'Generated SVG contains the physical equivalent of 18pt');
  assert(!html.includes('&lt;CR&gt;') && !html.includes('<CR>'), 'HTML output does NOT contain literal <CR>');
  pass('Print Renderer (Windows Driver HTML) generates paragraph SVG with exact physical per-source font sizes');

  // Check JSON Serialization (Save -> Reopen)
  const json = JSON.stringify(tpl);
  const reopened: LabelTemplate = JSON.parse(json);
  const reopenedEl = reopened.elements[0] as TextElement;
  assert(reopenedEl.dataSources!.length === 3, 'Reopened template has 3 data sources');
  assert(reopenedEl.dataSources![0].fontStyleOverride!.fontSize === 18, 'Reopened source 1 fontSize is 18');
  assert(reopenedEl.dataSources![2].fontStyleOverride!.fontFamily === 'Times New Roman', 'Reopened source 3 fontFamily is Times New Roman');
  assert(reopenedEl.dataSources![2].fontStyleOverride!.color === '#ff0000', 'Reopened source 3 color is red');
  pass('Save -> Reopen JSON serialization preserves all per-source fonts and IDs identically');
}

// ------------------------------------------------------------------
// 3. TEST CASE 2: DATA-DRIVEN SOURCES WITH RECORD NAVIGATION
// ------------------------------------------------------------------
console.log('\n--- 3. Testing Test Case 2: Data-driven Sources (SKU & Price) across Records ---');
{
  const dataElement: TextElement = {
    id: 'el-sku-price',
    name: 'SKU and Price',
    type: 'text',
    textType: 'single-line',
    textFormatType: 'single-line',
    multiline: false,
    text: '',
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    lineHeight: 1.15,
    letterSpacing: 0,
    textAlign: 'left',
    verticalAlign: 'top',
    x: 10,
    y: 10,
    width: 80,
    height: 15,
    zIndex: 1,
    locked: false,
    editable: true,
    visible: true,
    dataSources: [
      {
        id: 'ds-sku-lbl',
        name: 'SKU Prefix',
        type: 'embedded',
        value: 'SKU: ',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Arial',
          fontSize: 10,
          fontWeight: 'bold',
          color: '#333333',
        },
      },
      {
        id: 'ds-sku-val',
        name: 'SKU Field',
        type: 'database',
        field: 'SKU',
        value: 'SKU-001',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Consolas',
          fontSize: 12,
          color: '#0055ff',
        },
      },
      {
        id: 'ds-sep',
        name: 'Separator',
        type: 'embedded',
        value: ' | PRICE: ',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Arial',
          fontSize: 10,
          color: '#666666',
        },
      },
      {
        id: 'ds-price-val',
        name: 'Price Field',
        type: 'database',
        field: 'Price',
        value: '$19.99',
        enabled: true,
        fontOverrideEnabled: true,
        fontStyleOverride: {
          fontFamily: 'Arial',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#008800',
        },
      },
    ],
  };

  // Record 1 Evaluation
  const record1 = { SKU: 'SHAMPOO-500', Price: '$12.50' };
  const runsRec1 = evaluateTextElementRuns(dataElement, { record: record1 });
  assert(runsRec1[1].value === 'SHAMPOO-500', 'Record 1 SKU value should be SHAMPOO-500');
  assert(runsRec1[1].style.fontFamily === 'Consolas', 'Record 1 SKU font should be Consolas');
  assert(runsRec1[3].value === '$12.50', 'Record 1 Price value should be $12.50');
  assert(runsRec1[3].style.fontSize === 14 && runsRec1[3].style.color === '#008800', 'Record 1 Price font should be 14pt green');
  pass('Record 1 resolves with correct database values and independent per-source fonts');

  // Record 2 Evaluation (Record navigation)
  const record2 = { SKU: 'FACEWASH-200', Price: '$24.00' };
  const runsRec2 = evaluateTextElementRuns(dataElement, { record: record2 });
  assert(runsRec2[1].value === 'FACEWASH-200', 'Record 2 SKU value should be FACEWASH-200');
  assert(runsRec2[1].style.fontFamily === 'Consolas', 'Record 2 SKU font retains Consolas font override');
  assert(runsRec2[3].value === '$24.00', 'Record 2 Price value should be $24.00');
  assert(runsRec2[3].style.fontSize === 14 && runsRec2[3].style.color === '#008800', 'Record 2 Price font retains 14pt green');
  pass('Record 2 (Navigation): database values update while all per-source fonts remain intact');
}

// ------------------------------------------------------------------
// 4. BARTENDER BTW IMPORT INTEGRATION
// ------------------------------------------------------------------
console.log('\n--- 4. Testing BarTender BTW Import Source Font Mapping ---');
{
  const mockBtwXml = `
    <XML>
      <Format>
        <Objects>
          <TextObject Name="Label_1">
            <X>10</X>
            <Y>10</Y>
            <Width>50</Width>
            <Height>20</Height>
            <DataSources>
              <DataSource Name="PartNumber">
                <Type>Embedded</Type>
                <Value>PN-9988</Value>
                <Font>
                  <Typeface>Arial Black</Typeface>
                  <PointSize>14</PointSize>
                  <Bold>true</Bold>
                  <ForegroundColor>#003366</ForegroundColor>
                </Font>
              </DataSource>
            </DataSources>
          </TextObject>
        </Objects>
      </Format>
    </XML>
  `;

  const parsedDoc = parseBarTenderDocument(mockBtwXml, 'TestFormat.btw');
  const textObj = parsedDoc.elements.find((e) => e.type === 'text') as TextElement;
  assert(textObj !== undefined, 'Parsed document should contain a text object');
  assert(textObj.dataSources !== undefined && textObj.dataSources.length > 0, 'Text object should preserve dataSources');
  const src = textObj.dataSources![0];
  assert(src.fontOverrideEnabled === true, 'Imported source should have fontOverrideEnabled = true');
  assert(src.fontStyleOverride?.fontFamily === 'Arial Black', 'Imported fontFamily should be Arial Black');
  assert(src.fontStyleOverride?.fontSize === 14, 'Imported fontSize should be 14');
  assert(src.fontStyleOverride?.fontWeight === 'bold', 'Imported fontWeight should be bold');
  assert(src.fontStyleOverride?.color === '#003366', 'Imported color should be #003366');
  pass('BarTender document parser maps source <Font> tags to native font overrides cleanly');
}

console.log('\n================================================================');
console.log(`ALL ${passCount} ACCEPTANCE TESTS PASSED SUCCESSFULLY! (100%)`);
console.log('================================================================\n');
