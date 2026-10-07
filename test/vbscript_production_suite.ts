/**
 * BarcodeFlow Enterprise - VBScript & Document Event Scripting Production Suite
 * Automated comprehensive verification of BarTender VBScript compatibility.
 */

import { executeVBScript, executeDocumentEventScript, isVBScriptCode } from '../src/services/vbscriptEngine';
import { evaluateSafeScript, evaluateDataSourceItem, evaluateElementData } from '../src/services/dataSourceEngine';
import { executeEnterpriseTransformPipeline, applyTransformPipeline } from '../src/services/transformEngine';
import { createPrintPlan } from '../src/services/printPlanService';
import type { LabelTemplate, DataSourceItem, TextElement, BarcodeElement } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (actual !== undefined || expected !== undefined) {
      console.error(`     Expected: ${JSON.stringify(expected)}`);
      console.error(`     Got:      ${JSON.stringify(actual)}`);
    }
    failed++;
  }
}

console.log('\n===============================================================');
console.log('  BarcodeFlow Enterprise: VBScript Subsystem Test Suite');
console.log('===============================================================\n');

const mockRecord = {
  ProductID: 'PRD-7729',
  ProductName: 'High Voltage Relay',
  Category: 'Industrial Electronics',
  SKU: 'REL-48V-01',
  Qty: 45,
  UnitPrice: '124.50',
  MFG_DATE: '2026-05-15',
  LOT: 'LOT-992-B',
};

const mockCtx = {
  record: mockRecord,
  system: {
    userName: 'Operator1',
    printerName: 'Zebra ZT410 (300 dpi)',
    jobId: 'JOB-9901',
    currentRecordIndex: 0,
    totalRecords: 1,
  },
};

// -------------------------------------------------------------
// SECTION 1: Wizard Default & Core BarTender Expressions
// -------------------------------------------------------------
console.log('--- 1. Wizard Default & Concatenation ---');
{
  const res1 = executeVBScript('Value = "BATCH-" & Record("ProductID")', mockCtx);
  assert(res1.value === 'BATCH-PRD-7729', 'Wizard default placeholder: Value = "BATCH-" & Record("ProductID")', res1.value, 'BATCH-PRD-7729');

  const res2 = executeVBScript('"BATCH-" & Record("ProductID")', mockCtx);
  assert(res2.value === 'BATCH-PRD-7729', 'Expression without assignment: "BATCH-" & Record("ProductID")', res2.value, 'BATCH-PRD-7729');

  const res3 = executeVBScript('Value = Record.SKU & " / " & Record.LOT', mockCtx);
  assert(res3.value === 'REL-48V-01 / LOT-992-B', 'Dot property syntax: Record.SKU & " / " & Record.LOT', res3.value, 'REL-48V-01 / LOT-992-B');

  const res4 = executeVBScript('Value = record("productname")', mockCtx);
  assert(res4.value === 'High Voltage Relay', 'Case-insensitive record column lookup: record("productname")', res4.value, 'High Voltage Relay');
}

// -------------------------------------------------------------
// SECTION 2: Built-in String Functions (1-indexed Mid, UCase, etc.)
// -------------------------------------------------------------
console.log('\n--- 2. Built-in String Functions ---');
{
  const rUCase = executeVBScript('Value = UCase(Record("ProductName"))', mockCtx);
  assert(rUCase.value === 'HIGH VOLTAGE RELAY', 'UCase() capitalizes text', rUCase.value, 'HIGH VOLTAGE RELAY');

  const rLCase = executeVBScript('Value = LCase(Record("Category"))', mockCtx);
  assert(rLCase.value === 'industrial electronics', 'LCase() lowercases text', rLCase.value, 'industrial electronics');

  // Mid in VBScript is 1-indexed! Mid("ABCDEF", 2, 3) -> "BCD"
  const rMid = executeVBScript('Value = Mid(Record("SKU"), 1, 3)', mockCtx);
  assert(rMid.value === 'REL', 'Mid() 1-indexed substring: Mid("REL-48V-01", 1, 3)', rMid.value, 'REL');

  const rMidRest = executeVBScript('Value = Mid(Record("SKU"), 5)', mockCtx);
  assert(rMidRest.value === '48V-01', 'Mid() without length returns rest of string', rMidRest.value, '48V-01');

  const rLeft = executeVBScript('Value = Left(Record("SKU"), 3)', mockCtx);
  assert(rLeft.value === 'REL', 'Left() returns first n chars', rLeft.value, 'REL');

  const rRight = executeVBScript('Value = Right(Record("SKU"), 2)', mockCtx);
  assert(rRight.value === '01', 'Right() returns last n chars', rRight.value, '01');

  const rLen = executeVBScript('Value = Len(Record("SKU"))', mockCtx);
  assert(rLen.value === '10', 'Len() returns character count', rLen.value, '10');

  const rTrim = executeVBScript('Value = Trim("   TEST   ")', mockCtx);
  assert(rTrim.value === 'TEST', 'Trim() strips leading and trailing spaces', rTrim.value, 'TEST');

  const rInStr = executeVBScript('Value = InStr(Record("SKU"), "48V")', mockCtx);
  assert(rInStr.value === '5', 'InStr() returns 1-based index (got 5)', rInStr.value, '5');

  const rReplace = executeVBScript('Value = Replace(Record("SKU"), "-", "_")', mockCtx);
  assert(rReplace.value === 'REL_48V_01', 'Replace() replaces all occurrences', rReplace.value, 'REL_48V_01');

  const rSpace = executeVBScript('Value = "A" & Space(3) & "B"', mockCtx);
  assert(rSpace.value === 'A   B', 'Space(n) generates spaces', rSpace.value, 'A   B');

  const rRev = executeVBScript('Value = StrReverse("ABCD")', mockCtx);
  assert(rRev.value === 'DCBA', 'StrReverse() reverses string', rRev.value, 'DCBA');
}

// -------------------------------------------------------------
// SECTION 3: Number, Math & Logic Functions
// -------------------------------------------------------------
console.log('\n--- 3. Numbers, Math & Logic ---');
{
  const rMath = executeVBScript('Value = Round(CDbl(Record("UnitPrice")) * 1.10, 2)', mockCtx);
  assert(rMath.value === '136.95', 'CDbl() arithmetic multiplication with Round()', rMath.value, '136.95');

  const rRound = executeVBScript('Value = Round(124.567, 2)', mockCtx);
  assert(rRound.value === '124.57', 'Round(num, decimals)', rRound.value, '124.57');

  const rInt = executeVBScript('Value = Int(124.99)', mockCtx);
  assert(rInt.value === '124', 'Int() truncates to integer floor', rInt.value, '124');

  const rAbs = executeVBScript('Value = Abs(-42)', mockCtx);
  assert(rAbs.value === '42', 'Abs() returns absolute value', rAbs.value, '42');

  const rIIf = executeVBScript('Value = IIf(Record("Qty") > 10, "IN_STOCK", "OUT_OF_STOCK")', mockCtx);
  assert(rIIf.value === 'IN_STOCK', 'IIf() inline conditional evaluation', rIIf.value, 'IN_STOCK');

  const rIsNum = executeVBScript('Value = IsNumeric(Record("UnitPrice"))', mockCtx);
  assert(rIsNum.value === 'true', 'IsNumeric() returns true for numeric strings', rIsNum.value, 'true');
}

// -------------------------------------------------------------
// SECTION 4: Date & Time Manipulation
// -------------------------------------------------------------
console.log('\n--- 4. Date & Time Functions ---');
{
  const rDateAddDay = executeVBScript('Value = FormatDateTime(DateAdd("d", 7, "2026-09-01"), 2)', mockCtx);
  assert(rDateAddDay.value === '08/09/2026', 'DateAdd("d", 7, ...) adds 7 days', rDateAddDay.value, '08/09/2026');

  const rDateAddMonth = executeVBScript('Value = FormatDateTime(DateAdd("m", 2, "2026-05-15"), 2)', mockCtx);
  assert(rDateAddMonth.value === '15/07/2026', 'DateAdd("m", 2, ...) adds 2 months', rDateAddMonth.value, '15/07/2026');

  const rDateDiff = executeVBScript('Value = DateDiff("d", "2026-09-01", "2026-09-10")', mockCtx);
  assert(rDateDiff.value === '9', 'DateDiff("d", ...) returns days difference', rDateDiff.value, '9');

  const rYear = executeVBScript('Value = Year("2026-09-01")', mockCtx);
  assert(rYear.value === '2026', 'Year() extracts 4-digit year', rYear.value, '2026');

  const rMonthName = executeVBScript('Value = MonthName(5)', mockCtx);
  assert(rMonthName.value === 'May', 'MonthName(5) returns May', rMonthName.value, 'May');
}

// -------------------------------------------------------------
// SECTION 5: Control Flow (Single-line & Multi-line Conditionals)
// -------------------------------------------------------------
console.log('\n--- 5. Conditionals & Statements ---');
{
  // Single-line If Else End If
  const rSingleIf = executeVBScript('If Record("Qty") > 50 Then Value = "BULK" Else Value = "STD" End If', mockCtx);
  assert(rSingleIf.value === 'STD', 'Single-line If ... Else ... End If (false branch)', rSingleIf.value, 'STD');

  // Single-line If without Else
  const rSingleIf2 = executeVBScript('Value = "DEFAULT"\nIf Record("Qty") < 50 Then Value = "LOW_STOCK" End If', mockCtx);
  assert(rSingleIf2.value === 'LOW_STOCK', 'Single-line If without Else (true branch)', rSingleIf2.value, 'LOW_STOCK');

  // Multi-line If ... ElseIf ... Else ... End If
  const multiIfCode = `
Dim status
If Record("Qty") > 100 Then
    status = "OVERSTOCK"
ElseIf Record("Qty") >= 30 Then
    status = "OPTIMAL"
Else
    status = "REORDER"
End If
Value = status & "-" & Record("SKU")
`;
  const rMultiIf = executeVBScript(multiIfCode, mockCtx);
  assert(rMultiIf.value === 'OPTIMAL-REL-48V-01', 'Multi-line If ... ElseIf ... Else ... End If', rMultiIf.value, 'OPTIMAL-REL-48V-01');

  // For ... Next loop
  const forCode = `
Dim i, s
s = ""
For i = 1 To 3
    s = s & i
Next
Value = s
`;
  const rFor = executeVBScript(forCode, mockCtx);
  assert(rFor.value === '123', 'For i = 1 To 3 ... Next loop', rFor.value, '123');
}

// -------------------------------------------------------------
// SECTION 6: Data Source Engine Integration
// -------------------------------------------------------------
console.log('\n--- 6. Data Source Engine Integration ---');
{
  const dsItem: DataSourceItem = {
    id: 'ds-script-1',
    name: 'VBScript SKU Gen',
    type: 'script',
    scriptLanguage: 'vbscript',
    scriptCode: 'Value = "SKU: " & UCase(Record("SKU"))',
    enabled: true,
  };

  const evalVal = evaluateDataSourceItem(dsItem, mockCtx as any);
  assert(evalVal === 'SKU: REL-48V-01', 'evaluateDataSourceItem executes VBScript data source', evalVal, 'SKU: REL-48V-01');

  // Multi-DataSource text element concatenation
  const textEl: TextElement = {
    id: 'text-1',
    type: 'text',
    text: 'Fallback Text',
    x: 10,
    y: 10,
    width: 40,
    height: 10,
    dataSources: [
      {
        id: 'ds-1',
        name: 'Fixed Prefix',
        type: 'embedded',
        value: 'Item: ',
        enabled: true,
      },
      {
        id: 'ds-2',
        name: 'Dynamic VBScript',
        type: 'script',
        scriptLanguage: 'vbscript',
        scriptCode: 'Value = Record("ProductName")',
        enabled: true,
      },
    ],
  };

  const textVal = evaluateElementData(textEl, mockCtx as any);
  assert(textVal === 'Item: High Voltage Relay', 'evaluateElementData concats VBScript data source in text element', textVal, 'Item: High Voltage Relay');

  // Barcode Element integration
  const barcodeEl: BarcodeElement = {
    id: 'bc-1',
    type: 'barcode',
    symbology: 'code128',
    value: 'FALLBACK',
    x: 10,
    y: 20,
    width: 40,
    height: 15,
    dataSources: [
      {
        id: 'ds-bc',
        name: 'Barcode Script',
        type: 'script',
        scriptLanguage: 'vbscript',
        scriptCode: 'Value = "BAR-" & Record("ProductID")',
        enabled: true,
      },
    ],
  };

  const bcVal = evaluateElementData(barcodeEl, mockCtx as any);
  assert(bcVal === 'BAR-PRD-7729', 'evaluateElementData executes VBScript for barcode data', bcVal, 'BAR-PRD-7729');
}

// -------------------------------------------------------------
// SECTION 7: Transform Engine Integration
// -------------------------------------------------------------
console.log('\n--- 7. Transform Pipeline Integration ---');
{
  // executeEnterpriseTransformPipeline with script
  const transformed = executeEnterpriseTransformPipeline('sample-val', {
    script: {
      language: 'vbscript',
      code: 'Value = "TFM_" & UCase(Value)',
    },
  }, { record: mockRecord });
  assert(transformed === 'TFM_SAMPLE-VAL', 'executeEnterpriseTransformPipeline executes VBScript transform', transformed, 'TFM_SAMPLE-VAL');

  // applyTransformPipeline rule execution
  const ruleTransformed = applyTransformPipeline('raw_string', [
    {
      id: 'rule-1',
      type: 'script' as any,
      enabled: true,
      params: {
        scriptLanguage: 'vbscript',
        scriptCode: 'Value = UCase(Value) & "_VERIFIED"',
      },
    },
  ]);
  assert(ruleTransformed === 'RAW_STRING_VERIFIED', 'applyTransformPipeline executes rule-based VBScript', ruleTransformed, 'RAW_STRING_VERIFIED');
}

// -------------------------------------------------------------
// SECTION 8: Document Lifecycle Event Scripts (OnStartJob, OnNewRecord, etc.)
// -------------------------------------------------------------
console.log('\n--- 8. Document Lifecycle Event Scripts ---');
{
  const eventScripts: Record<string, string> = {
    OnStartJob: 'Value = "JOB_STARTED"',
    OnNewRecord: 'If Record("UnitPrice") > 100 Then Record("DISCOUNT") = "15%" Else Record("DISCOUNT") = "0%" End If',
    OnPrePrint: 'Value = "PRE_PRINT_OK"',
  };

  // Test OnNewRecord record mutation
  const rowRecord: Record<string, any> = { ...mockRecord };
  const evRes = executeDocumentEventScript('OnNewRecord', eventScripts, { record: rowRecord });
  assert(evRes.success === true, 'OnNewRecord executes successfully');
  assert(evRes.record?.DISCOUNT === '15%', 'OnNewRecord dynamically augments record with DISCOUNT = 15%', evRes.record?.DISCOUNT, '15%');

  // Test createPrintPlan lifecycle execution
  const testTmpl: LabelTemplate = {
    id: 'tmpl-events',
    name: 'Events Test Template',
    dimensions: { width: 50, height: 25, unit: 'mm' },
    elements: [
      {
        id: 'txt-discount',
        type: 'text',
        text: '{{DISCOUNT}}',
        x: 5,
        y: 5,
        width: 40,
        height: 10,
        dataSources: [
          {
            id: 'ds-disc',
            type: 'database-field',
            databaseField: 'DISCOUNT',
            name: 'Discount Field',
            enabled: true,
          },
        ],
      } as any,
    ],
    databaseConnection: {
      id: 'db-1',
      name: 'Test DB',
      records: [mockRecord],
    } as any,
    eventScripts,
  } as any;

  const plan = createPrintPlan(testTmpl, {
    recordsToPrint: [mockRecord],
    copies: 1,
  });

  assert(plan.items.length === 1, 'Print plan assembled 1 item');
  const evaluatedDiscount = plan.items[0]?.evaluatedValues['txt-discount'];
  assert(evaluatedDiscount === '15%', 'OnNewRecord modified record reflected in evaluated label element output', evaluatedDiscount, '15%');
}

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n===============================================================');
console.log(`  VBScript Suite Results: ${passed} PASSED, ${failed} FAILED`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}
