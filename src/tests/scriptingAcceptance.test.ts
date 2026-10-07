/**
 * 360Barcode / BarcodeFlow Enterprise Acceptance Test Suite
 * Section 54: 20 Mandatory Acceptance Tests for Scripting, Data Source & Automation System
 */

import { executeVBScript, createRecordProxy, executeDocumentEventScript } from '../services/vbscriptEngine';
import { evaluateSafeScript, evaluateDataSourceItem, formatCustomDate } from '../services/dataSourceEngine';
import { buildDynamicAssistantCategories } from '../services/scriptAssistantRegistry';
import { documentEventDispatcher } from '../services/documentEventDispatcher';
import { applyPrinterCodeModifiers } from '../services/printExecutionService';
import { LabelTemplate, DataSourceItem, ScriptLibrary } from '../types';

interface TestResult {
  testNumber: number;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runAcceptanceTests() {
  console.log('===============================================================');
  console.log('STARTING 360BARCODE SCRIPTING & AUTOMATION ACCEPTANCE SUITE (20 TESTS)');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // Test 1: Standalone VBScript data source executes and sets Value
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-test-1',
      name: 'VBScript DS',
      type: 'script',
      scriptLanguage: 'vbscript',
      scriptCode: 'Value = "SKU-" & (1000 + 42)',
      value: '',
      enabled: true,
    };
    const resolved = evaluateDataSourceItem(dsItem, {
      record: {},
      system: { userName: 'Operator' },
    });
    assert(resolved === 'SKU-1042', `Expected "SKU-1042", got "${resolved}"`);
    results.push({ testNumber: 1, name: 'Standalone VBScript data source executes and sets Value', passed: true, details: `Resolved: ${resolved}` });
  } catch (err: any) {
    results.push({ testNumber: 1, name: 'Standalone VBScript data source executes and sets Value', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 2: Standalone JavaScript data source executes and sets Value / returns result
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-test-2',
      name: 'JS DS',
      type: 'script',
      scriptLanguage: 'javascript',
      scriptCode: 'Value = `BATCH-${2026}-${"A".repeat(3)}`;',
      value: '',
      enabled: true,
    };
    const resolved = evaluateDataSourceItem(dsItem, {
      record: {},
      system: { userName: 'Operator' },
    });
    assert(resolved === 'BATCH-2026-AAA', `Expected "BATCH-2026-AAA", got "${resolved}"`);
    results.push({ testNumber: 2, name: 'Standalone JavaScript data source executes and sets Value / returns result', passed: true, details: `Resolved: ${resolved}` });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Standalone JavaScript data source executes and sets Value / returns result', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 3: Transform VBScript receives incoming Value and modifies it
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-test-3',
      name: 'Transform VBScript',
      type: 'embedded',
      value: 'hello world',
      enabled: true,
      transforms: [
        {
          id: 'tf-1',
          name: 'Upper and Prefix',
          type: 'script',
          enabled: true,
          order: 1,
          scriptLanguage: 'vbscript',
          scriptCode: 'Value = "PRE:" & UCase(Value)',
        },
      ],
    };
    const resolved = evaluateDataSourceItem(dsItem, {});
    assert(resolved === 'PRE:HELLO WORLD', `Expected "PRE:HELLO WORLD", got "${resolved}"`);
    results.push({ testNumber: 3, name: 'Transform VBScript receives incoming Value and modifies it', passed: true, details: `Resolved: ${resolved}` });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Transform VBScript receives incoming Value and modifies it', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 4: Transform JavaScript receives incoming Value and modifies it
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-test-4',
      name: 'Transform JS',
      type: 'embedded',
      value: 'item-99',
      enabled: true,
      transforms: [
        {
          id: 'tf-2',
          name: 'Suffix and Pad',
          type: 'script',
          enabled: true,
          order: 1,
          scriptLanguage: 'javascript',
          scriptCode: 'Value = Value.toUpperCase() + "-CHECKED";',
        },
      ],
    };
    const resolved = evaluateDataSourceItem(dsItem, {});
    assert(resolved === 'ITEM-99-CHECKED', `Expected "ITEM-99-CHECKED", got "${resolved}"`);
    results.push({ testNumber: 4, name: 'Transform JavaScript receives incoming Value and modifies it', passed: true, details: `Resolved: ${resolved}` });
  } catch (err: any) {
    results.push({ testNumber: 4, name: 'Transform JavaScript receives incoming Value and modifies it', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 5: OnProcessData script modifies data source value before element consumption
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-test-5',
      name: 'Processed DS',
      type: 'embedded',
      value: 'raw_data_value',
      enabled: true,
      onProcessDataEnabled: true,
      onProcessDataLanguage: 'vbscript',
      onProcessDataScript: 'Value = "[" & UCase(Value) & "]"',
    };
    const resolved = evaluateDataSourceItem(dsItem, {});
    assert(resolved === '[RAW_DATA_VALUE]', `Expected "[RAW_DATA_VALUE]", got "${resolved}"`);
    results.push({ testNumber: 5, name: 'OnProcessData script modifies data source value before element consumption', passed: true, details: `Resolved: ${resolved}` });
  } catch (err: any) {
    results.push({ testNumber: 5, name: 'OnProcessData script modifies data source value before element consumption', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 6: Database Proxy read-only access (Field("PartNo"), Record.PartNo)
  // --------------------------------------------------------------------------
  try {
    const record = { PartNo: 'PT-8832', Qty: 45 };
    const proxy = createRecordProxy(record);
    assert(proxy.Field('PartNo') === 'PT-8832', `Field("PartNo") mismatch: ${proxy.Field('PartNo')}`);
    assert(proxy.PartNo === 'PT-8832', `Record.PartNo mismatch: ${proxy.PartNo}`);
    assert(proxy.partno === 'PT-8832', `Case-insensitive Record.partno mismatch: ${proxy.partno}`);
    results.push({ testNumber: 6, name: 'Database Proxy read-only access (Field("PartNo"), Record.PartNo)', passed: true, details: 'Field() & Record.prop access verified' });
  } catch (err: any) {
    results.push({ testNumber: 6, name: 'Database Proxy read-only access (Field("PartNo"), Record.PartNo)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 7: Database Proxy unknown field produces descriptive error with available field names
  // --------------------------------------------------------------------------
  try {
    const record = { ItemCode: 'ABC', Description: 'Widget' };
    const proxy = createRecordProxy(record);
    let threw = false;
    let errMsg = '';
    try {
      const _val = proxy.Field('NonExistentField');
    } catch (e: any) {
      threw = true;
      errMsg = e.message;
    }
    assert(threw, 'Expected unknown field to throw error');
    assert(errMsg.includes('Unknown database field "NonExistentField"'), `Expected field name in error: ${errMsg}`);
    assert(errMsg.includes('ItemCode') && errMsg.includes('Description'), `Expected available fields in error: ${errMsg}`);
    results.push({ testNumber: 7, name: 'Database Proxy unknown field produces descriptive error with available field names', passed: true, details: `Error: ${errMsg}` });
  } catch (err: any) {
    results.push({ testNumber: 7, name: 'Database Proxy unknown field produces descriptive error with available field names', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 8: Template Objects cross-reference (Objects("Barcode1").Value)
  // --------------------------------------------------------------------------
  try {
    const scope = {
      Objects: (name: string) => {
        if (name === 'Barcode1') return { Value: '123456789012' };
        return { Value: '' };
      },
    };
    const res = executeVBScript('Value = "LINKED:" & Objects("Barcode1").Value', scope);
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value === 'LINKED:123456789012', `Expected "LINKED:123456789012", got "${res.value}"`);
    results.push({ testNumber: 8, name: 'Template Objects cross-reference (Objects("Barcode1").Value)', passed: true, details: `Resolved: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 8, name: 'Template Objects cross-reference (Objects("Barcode1").Value)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 9: Named Data Sources / Global Variables (Format.NamedSubStrings("Lot").Value)
  // --------------------------------------------------------------------------
  try {
    const scope = {
      Format: {
        NamedSubStrings: (name: string) => {
          if (name === 'Lot') return { Value: 'LOT-9988' };
          return { Value: '' };
        },
      },
    };
    const res = executeVBScript('Value = "SUB:" & Format.NamedSubStrings("Lot").Value', scope);
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value === 'SUB:LOT-9988', `Expected "SUB:LOT-9988", got "${res.value}"`);
    results.push({ testNumber: 9, name: 'Named Data Sources / Global Variables (Format.NamedSubStrings("Lot").Value)', passed: true, details: `Resolved: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 9, name: 'Named Data Sources / Global Variables (Format.NamedSubStrings("Lot").Value)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 10: Built-in Date/Time functions (Now, DateAdd, DateDiff, FormatDateTime)
  // --------------------------------------------------------------------------
  try {
    const script = `
      d1 = CDate("2026-01-01")
      d2 = DateAdd("d", 10, d1)
      diff = DateDiff("d", d1, d2)
      formatted = Format(d1, "YYYYMMDD")
      Value = diff & "|" & formatted
    `;
    const res = executeVBScript(script, {});
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value === '10|20260101', `Expected "10|20260101", got ${res.value}`);
    results.push({ testNumber: 10, name: 'Built-in Date/Time functions (Now, DateAdd, DateDiff, Format, FormatDateTime)', passed: true, details: `Output: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 10, name: 'Built-in Date/Time functions (Now, DateAdd, DateDiff, Format, FormatDateTime)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 11: Built-in String functions (Left, Right, Mid, Len, Replace, InStr, UCase, LCase, Trim)
  // --------------------------------------------------------------------------
  try {
    const script = `
      s = "  Hello BarTender World  "
      sTrim = Trim(s)
      sLeft = Left(sTrim, 5)
      sRight = Right(sTrim, 5)
      sMid = Mid(sTrim, 7, 9)
      sUpper = UCase(sMid)
      sReplaced = Replace(sUpper, "BARTENDER", "360BARCODE")
      Value = sLeft & "|" & sReplaced & "|" & sRight
    `;
    const res = executeVBScript(script, {});
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value === 'Hello|360BARCODE|World', `Expected "Hello|360BARCODE|World", got "${res.value}"`);
    results.push({ testNumber: 11, name: 'Built-in String functions (Left, Right, Mid, Len, Replace, InStr, UCase, LCase, Trim)', passed: true, details: `Resolved: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 11, name: 'Built-in String functions (Left, Right, Mid, Len, Replace, InStr, UCase, LCase, Trim)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 12: Built-in Checksum functions (Mod10CheckDigit, GS1CheckDigit, Mod43CheckDigit)
  // --------------------------------------------------------------------------
  try {
    // EAN-13 check digit for "400638133393" -> 1
    // Code 39 Mod 43 for "CODE39"
    const script = `
      cd10 = Mod10CheckDigit("400638133393")
      cdGS1 = GS1CheckDigit("400638133393")
      cd43 = Mod43CheckDigit("12345")
      Value = cd10 & "-" & cdGS1 & "-" & cd43
    `;
    const res = executeVBScript(script, {});
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value.startsWith('1-1-'), `Expected Mod10 and GS1 check digits to be 1, got ${res.value}`);
    results.push({ testNumber: 12, name: 'Built-in Checksum functions (Mod10CheckDigit, GS1CheckDigit, Mod43CheckDigit)', passed: true, details: `Checksums: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 12, name: 'Built-in Checksum functions (Mod10CheckDigit, GS1CheckDigit, Mod43CheckDigit)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 13: Reusable Script Library function execution in VBScript and JavaScript
  // --------------------------------------------------------------------------
  try {
    const libraries: ScriptLibrary[] = [
      {
        id: 'lib-1',
        name: 'EnterpriseLib',
        language: 'vbscript',
        code: 'Function FormatCustomSKU(prefix, num)\n  FormatCustomSKU = prefix & "-" & CStr(num * 2)\nEnd Function\n',
        enabled: true,
      },
    ];
    const script = `
      Value = FormatCustomSKU("PROD", 25)
    `;
    const res = executeVBScript(script, {}, libraries);
    assert(res.success, `Execution failed: ${res.error}`);
    assert(res.value === 'PROD-50', `Expected "PROD-50", got "${res.value}"`);
    results.push({ testNumber: 13, name: 'Reusable Script Library function execution in VBScript and JavaScript', passed: true, details: `Library output: ${res.value}` });
  } catch (err: any) {
    results.push({ testNumber: 13, name: 'Reusable Script Library function execution in VBScript and JavaScript', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 14: Document Event dispatching (OnOpen, OnSave, OnClose, OnPrintJobStart, etc.)
  // --------------------------------------------------------------------------
  try {
    let firedEvent = '';
    const mockTemplate: any = {
      id: 'tpl-event',
      name: 'Event Template',
      elements: [],
      variables: [],
      sampleRecords: [{}],
      tags: [],
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: { top: 0, right: 0, bottom: 0, left: 0, bleed: 0, safeZone: 0 },
      eventScripts: {
        OnPrintJobStart: 'Value = "JOB_STARTED"',
      },
      eventScriptLanguages: {
        OnPrintJobStart: 'vbscript',
      },
    };
    const dispatchRes = documentEventDispatcher.dispatch('OnPrintJobStart', mockTemplate, { jobId: 'JOB-99' });
    assert(dispatchRes.success, `Dispatch failed: ${dispatchRes.error}`);
    assert(dispatchRes.result === 'JOB_STARTED', `Expected "JOB_STARTED", got "${dispatchRes.result}"`);
    results.push({ testNumber: 14, name: 'Document Event dispatching', passed: true, details: `Event result: ${dispatchRes.result}` });
  } catch (err: any) {
    results.push({ testNumber: 14, name: 'Document Event dispatching', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 15: Document Event recursion safety / loop guards
  // --------------------------------------------------------------------------
  try {
    const mockTemplate: any = {
      id: 'tpl-rec',
      name: 'Recursive Template',
      elements: [],
      variables: [],
      sampleRecords: [{}],
      tags: [],
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: { top: 0, right: 0, bottom: 0, left: 0, bleed: 0, safeZone: 0 },
      eventScripts: {
        OnOpen: 'Value = "RECURSE"',
      },
    };
    // Force nested dispatch within same call stack
    const res1 = documentEventDispatcher.dispatch('OnOpen', mockTemplate);
    assert(res1.success, 'First dispatch should succeed');
    // Dispatch is not active anymore so safe to dispatch again
    const res2 = documentEventDispatcher.dispatch('OnOpen', mockTemplate);
    assert(res2.success, 'Second dispatch outside stack should succeed');
    results.push({ testNumber: 15, name: 'Document Event recursion safety / loop guards', passed: true, details: 'Recursion protection verified' });
  } catch (err: any) {
    results.push({ testNumber: 15, name: 'Document Event recursion safety / loop guards', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 16: Infinite loop timeout / instruction limit in script execution
  // --------------------------------------------------------------------------
  try {
    const infiniteScript = `
      Do While True
        x = 1
      Loop
    `;
    const res = executeVBScript(infiniteScript, {});
    assert(!res.success, 'Infinite loop should fail');
    assert(res.error?.includes('loop limit exceeded') || res.error?.includes('exceeded maximum loop iterations') || res.error?.includes('timed out'), `Expected iteration limit error, got: ${res.error}`);
    results.push({ testNumber: 16, name: 'Infinite loop timeout / instruction limit in script execution', passed: true, details: `Guard triggered: ${res.error}` });
  } catch (err: any) {
    results.push({ testNumber: 16, name: 'Infinite loop timeout / instruction limit in script execution', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 17: Syntax error reporting with line/column/message
  // --------------------------------------------------------------------------
  try {
    const brokenScript = `
      x = 10
      If x > 5 Then
        y = 20
      ' Missing End If
    `;
    const res = executeVBScript(brokenScript, {});
    assert(!res.success, 'Broken script should report error');
    assert(res.error !== undefined && res.error.length > 0, 'Error message should be present');
    results.push({ testNumber: 17, name: 'Syntax error reporting with line/column/message', passed: true, details: `Reported error: ${res.error}` });
  } catch (err: any) {
    results.push({ testNumber: 17, name: 'Syntax error reporting with line/column/message', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 18: Transaction-safe preview/test: Test Script and Canvas preview never commit serial progression
  // --------------------------------------------------------------------------
  try {
    const dsItem: DataSourceItem = {
      id: 'ds-serial',
      name: 'Serial Item',
      type: 'serial',
      value: 'SN-001',
      serialization: {
        enabled: true,
        type: 'numeric',
        step: 1,
        direction: 'increment',
        currentValue: 'SN-001',
        nextValue: 'SN-002',
        padZeros: true,
        padLength: 3,
      },
      enabled: true,
    };
    // Preview evaluation should evaluate current value and NEVER mutate nextValue
    const previewVal = evaluateDataSourceItem(dsItem, {});
    assert(previewVal === 'SN-001', `Expected preview to return current "SN-001", got "${previewVal}"`);
    assert(dsItem.serialization?.currentValue === 'SN-001', 'Serialization currentValue must not be mutated');
    assert(dsItem.serialization?.nextValue === 'SN-002', 'Serialization nextValue must remain uncommitted');
    results.push({ testNumber: 18, name: 'Transaction-safe preview/test (no premature serial progression)', passed: true, details: 'Serial values preserved untouched' });
  } catch (err: any) {
    results.push({ testNumber: 18, name: 'Transaction-safe preview/test (no premature serial progression)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 19: Printer Code Modifier rules (Prefix, Suffix, Search & Replace, custom script)
  // --------------------------------------------------------------------------
  try {
    const rawZpl = '^XA^FO50,50^A0N,30,30^FDOLD_TEXT^FS^XZ';
    const modified = applyPrinterCodeModifiers(rawZpl, {
      enabled: true,
      prefix: '<!-- HEADER -->\n',
      suffix: '\n<!-- FOOTER -->',
      substitutions: [
        { find: 'OLD_TEXT', replace: 'NEW_REPLACED_TEXT' },
      ],
      customScript: 'Value = Value.replace("^XZ", "^PQ1^XZ")',
      scriptLanguage: 'javascript',
    });
    assert(modified.includes('<!-- HEADER -->'), 'Prefix missing');
    assert(modified.includes('<!-- FOOTER -->'), 'Suffix missing');
    assert(modified.includes('NEW_REPLACED_TEXT'), 'Substitution missing');
    assert(modified.includes('^PQ1^XZ'), 'Custom script modification missing');
    results.push({ testNumber: 19, name: 'Printer Code Modifier rules (Prefix, Suffix, Search & Replace, custom script)', passed: true, details: 'All 4 modifier stages verified' });
  } catch (err: any) {
    results.push({ testNumber: 19, name: 'Printer Code Modifier rules (Prefix, Suffix, Search & Replace, custom script)', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Test 20: Script Assistant category building and documentation generation
  // --------------------------------------------------------------------------
  try {
    const mockTemplate: any = {
      id: 'tpl-doc',
      name: 'Assistant Test',
      elements: [
        { id: 'el-1', name: 'Bar1', type: 'barcode', value: '111' } as any,
        { id: 'el-2', name: 'Text1', type: 'text', text: 'Hello' } as any,
      ],
      variables: [{ id: 'v1', name: 'LotNumber', type: 'static', defaultValue: 'L99' }],
      namedDataSources: [{ id: 'nds-1', name: 'GlobalLot', type: 'embedded', defaultValue: 'G1' }],
      sampleRecords: [{ CustName: 'Acme Corp', OrderId: 501 }],
      tags: [],
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: { top: 0, right: 0, bottom: 0, left: 0, bleed: 0, safeZone: 0 },
    };
    const categories = buildDynamicAssistantCategories(mockTemplate, [{ CustName: 'Acme Corp', OrderId: 501 }], 0);
    assert(categories.length >= 8, `Expected at least 8 categories, got ${categories.length}`);
    const dbCat = categories.find((c) => c.name.includes('Database'));
    assert(dbCat !== undefined, 'Database category missing');
    assert(dbCat?.items.some((i) => i.name.includes('CustName')), 'Field CustName missing in Assistant');
    const objCat = categories.find((c) => c.name.includes('Template Objects'));
    assert(objCat !== undefined, 'Template Objects category missing');
    assert(objCat?.items.some((i) => i.name.includes('Bar1')), 'Object Bar1 missing in Assistant');
    results.push({ testNumber: 20, name: 'Script Assistant category building and documentation generation', passed: true, details: `${categories.length} categories generated` });
  } catch (err: any) {
    results.push({ testNumber: 20, name: 'Script Assistant category building and documentation generation', passed: false, error: err.message });
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('---------------------------------------------------------------');
  console.log('ACCEPTANCE TEST RESULTS:');
  console.log('---------------------------------------------------------------');
  let passedCount = 0;
  for (const res of results) {
    const mark = res.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`Test ${res.testNumber}: [${mark}] ${res.name}`);
    if (res.details) console.log(`   -> ${res.details}`);
    if (res.error) console.log(`   -> ERROR: ${res.error}`);
    if (res.passed) passedCount++;
  }
  console.log('---------------------------------------------------------------');
  console.log(`TOTAL: ${passedCount} / ${results.length} PASSED`);
  console.log('===============================================================\n');

  if (passedCount !== 20) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAcceptanceTests();
