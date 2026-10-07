import assert from 'node:assert/strict';
import {
  executeVBScript,
  formatVBDate,
  formatVBDateTime,
  formatVBTime,
  parseVBDate,
  vbDateAdd,
  vbDateDiff,
  vbFormatDateTime,
} from '../src/services/vbscriptEngine';
import {
  evaluateSafeScript,
  evaluateDataSourceItem,
  evaluateElementData,
} from '../src/services/dataSourceEngine';
import { executeEnterpriseTransformPipeline } from '../src/services/transformEngine';
import { TextElement, BarcodeElement } from '../src/types';

console.log('\n===============================================================');
console.log('  VBScript Date, DateAdd & Dynamic Expiry Verification Suite');
console.log('===============================================================\n');

const today = new Date();
const expectedToday = formatVBDate(today);

// -------------------------------------------------------------
// 1. VBScript Date, Date(), Now, Time Built-in tests
// -------------------------------------------------------------
console.log('--- 1. Date, Date(), Now, Time semantics ---');
{
  const r1 = executeVBScript('Value = Date');
  assert.equal(r1.success, true);
  assert.equal(r1.value, expectedToday);
  assert.notEqual(r1.value, 'function Date() { [native code] }');
  console.log(`  ✓ Value = Date => ${r1.value}`);

  const r2 = executeVBScript('Value = Date()');
  assert.equal(r2.success, true);
  assert.equal(r2.value, expectedToday);
  console.log(`  ✓ Value = Date() => ${r2.value}`);

  const r3 = executeVBScript('Value = Now');
  assert.equal(r3.success, true);
  assert.ok(r3.value.includes(expectedToday));
  console.log(`  ✓ Value = Now => ${r3.value}`);

  const r4 = executeVBScript('Value = Time');
  assert.equal(r4.success, true);
  assert.match(r4.value, /^\d{2}:\d{2}:\d{2}$/);
  console.log(`  ✓ Value = Time => ${r4.value}`);
}

// -------------------------------------------------------------
// 2. DateAdd Arithmetic & Boundary Handling
// -------------------------------------------------------------
console.log('\n--- 2. DateAdd Arithmetic & Boundary Handling ---');
{
  // Day addition
  const rDay = executeVBScript('Value = DateAdd("d", 9, "18/09/2026")');
  assert.equal(rDay.value, '27/09/2026');
  console.log('  ✓ DateAdd("d", 9, "18/09/2026") => 27/09/2026');

  // Month boundary rollover: 30/12/2026 + 5 days -> 04/01/2027
  const rYearBoundary = executeVBScript('Value = DateAdd("d", 5, "30/12/2026")');
  assert.equal(rYearBoundary.value, '04/01/2027');
  console.log('  ✓ DateAdd("d", 5, "30/12/2026") across year boundary => 04/01/2027');

  // Month addition handling end of month: 31/01/2026 + 1 month -> 28/02/2026
  const rMonthBoundary = executeVBScript('Value = DateAdd("m", 1, "31/01/2026")');
  assert.equal(rMonthBoundary.value, '28/02/2026');
  console.log('  ✓ DateAdd("m", 1, "31/01/2026") => 28/02/2026');

  // Year addition
  const rYearAdd = executeVBScript('Value = DateAdd("yyyy", 2, "18/09/2026")');
  assert.equal(rYearAdd.value, '18/09/2028');
  console.log('  ✓ DateAdd("yyyy", 2, "18/09/2026") => 18/09/2028');

  // Hours / Minutes
  const rHour = executeVBScript('Value = DateAdd("h", 3, "18/09/2026 10:00:00")');
  assert.equal(rHour.value, '18/09/2026 13:00:00');
  console.log('  ✓ DateAdd("h", 3, "18/09/2026 10:00:00") => 18/09/2026 13:00:00');

  // Negative interval (subtract days)
  const rSub = executeVBScript('Value = DateAdd("d", -10, "18/09/2026")');
  assert.equal(rSub.value, '08/09/2026');
  console.log('  ✓ DateAdd("d", -10, "18/09/2026") => 08/09/2026');
}

// -------------------------------------------------------------
// 3. Excel Record ExpiryDays & Dynamic Expiry Date
// -------------------------------------------------------------
console.log('\n--- 3. Excel Record ExpiryDays & Dynamic Expiry Date ---');
{
  const recordShampoo = { ProductName: 'Shampoo 500ml', ExpiryDays: 9, MFGDate: '18/09/2026' };
  const rDynamic = executeVBScript('Value = DateAdd("d", Record("ExpiryDays"), Date)', { record: recordShampoo });
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + 9);
  assert.equal(rDynamic.value, formatVBDate(expectedDate));
  console.log(`  ✓ Value = DateAdd("d", Record("ExpiryDays"), Date) => ${rDynamic.value}`);

  // String ExpiryDays
  const recordStringDays = { ProductName: 'Hair Oil', ExpiryDays: '180', MFGDate: '18/09/2026' };
  const rStrDays = executeVBScript('Value = DateAdd("d", Record("ExpiryDays"), "18/09/2026")', { record: recordStringDays });
  assert.equal(rStrDays.value, '17/03/2027');
  console.log('  ✓ String ExpiryDays ("180") => 17/03/2027');
}

// -------------------------------------------------------------
// 4. MFGDate + ExpiryDays (User Acceptance Scenario)
// -------------------------------------------------------------
console.log('\n--- 4. MFGDate + ExpiryDays Acceptance Scenario ---');
{
  const recordMFG = { ProductName: 'Shampoo 500ml', MFGDate: '18/09/2026', ExpiryDays: 90 };
  const rAcceptance = executeVBScript('Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))', { record: recordMFG });
  assert.equal(rAcceptance.value, '17/12/2026');
  console.log('  ✓ Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate")) => 17/12/2026 (PASS)');

  // ISO MFGDate
  const recordISO = { ProductName: 'Shampoo 500ml', MFGDate: '2026-09-18', ExpiryDays: 90 };
  const rISO = executeVBScript('Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))', { record: recordISO });
  assert.equal(rISO.value, '17/12/2026');
  console.log('  ✓ ISO MFGDate ("2026-09-18") + 90 days => 17/12/2026');
}

// -------------------------------------------------------------
// 5. FormatDateTime Integration
// -------------------------------------------------------------
console.log('\n--- 5. FormatDateTime Integration ---');
{
  const rFmt = executeVBScript('Value = FormatDateTime("18/09/2026", 2)');
  assert.equal(rFmt.value, '18/09/2026');
  console.log('  ✓ FormatDateTime("18/09/2026", 2) => 18/09/2026');

  const rFmtLong = executeVBScript('Value = FormatDateTime("18/09/2026", 1)');
  assert.ok(rFmtLong.value.includes('2026'));
  console.log(`  ✓ FormatDateTime("18/09/2026", 1) => ${rFmtLong.value}`);
}

// -------------------------------------------------------------
// 6. Record Navigation Dynamic Recalculation
// -------------------------------------------------------------
console.log('\n--- 6. Record Navigation Dynamic Recalculation ---');
{
  const records = [
    { ProductName: 'Shampoo', ExpiryDays: 9, MFGDate: '18/09/2026' },
    { ProductName: 'Hair Oil', ExpiryDays: 180, MFGDate: '18/09/2026' },
    { ProductName: 'Face Wash', ExpiryDays: 365, MFGDate: '18/09/2026' },
  ];

  const script = 'Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))';
  const resolved = records.map((rec) => executeVBScript(script, { record: rec }).value);

  assert.deepEqual(resolved, ['27/09/2026', '17/03/2027', '18/09/2027']);
  console.log('  ✓ Navigation dynamically recalculates: ' + resolved.join(' -> '));
}

// -------------------------------------------------------------
// 7. Error Handling on Invalid/Blank Data
// -------------------------------------------------------------
console.log('\n--- 7. Error Handling ---');
{
  // Blank ExpiryDays -> treated as 0 days
  const rBlankDays = executeVBScript('Value = DateAdd("d", Record("ExpiryDays"), "18/09/2026")', { record: { ExpiryDays: '' } });
  assert.equal(rBlankDays.value, '18/09/2026');
  console.log('  ✓ Blank ExpiryDays => adds 0 days => 18/09/2026');

  // Invalid ExpiryDays string
  const rInvalidDays = executeVBScript('Value = DateAdd("d", "abc", "18/09/2026")');
  assert.equal(rInvalidDays.success, false);
  assert.ok(rInvalidDays.error?.includes('Invalid numeric interval'));
  console.log('  ✓ Invalid ExpiryDays ("abc") caught safely: ' + rInvalidDays.error);

  // Invalid MFGDate
  const rInvalidDate = executeVBScript('Value = DateAdd("d", 9, "invalid-date")');
  assert.equal(rInvalidDate.success, false);
  assert.ok(rInvalidDate.error?.includes('Invalid date value'));
  console.log('  ✓ Invalid MFGDate caught safely: ' + rInvalidDate.error);
}

// -------------------------------------------------------------
// 8. End-to-End Pipeline: Canvas, Print Preview & Transform Pipeline
// -------------------------------------------------------------
console.log('\n--- 8. Pipeline: Canvas, Print Preview, Transform Pipeline ---');
{
  const element: TextElement = {
    id: 'txt-exp',
    type: 'text',
    text: 'EXP_DATE',
    x: 10,
    y: 10,
    width: 50,
    height: 10,
    dataSources: [
      {
        id: 'ds-exp',
        type: 'script',
        name: 'Dynamic Expiry Date',
        scriptLanguage: 'vbscript',
        scriptCode: 'Value = "EXP: " & DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))',
        enabled: true,
      },
    ],
  };

  const recordA = { ProductName: 'Shampoo 500ml', MFGDate: '18/09/2026', ExpiryDays: 9 };
  const recordB = { ProductName: 'Hair Oil 200ml', MFGDate: '18/09/2026', ExpiryDays: 90 };

  const canvasValA = evaluateElementData(element, { record: recordA });
  assert.equal(canvasValA, 'EXP: 27/09/2026');
  console.log('  ✓ Canvas resolved Record A: ' + canvasValA);

  const canvasValB = evaluateElementData(element, { record: recordB });
  assert.equal(canvasValB, 'EXP: 17/12/2026');
  console.log('  ✓ Canvas resolved Record B: ' + canvasValB);

  // Transform Pipeline script execution
  const tfmVal = executeEnterpriseTransformPipeline('raw', {
    script: {
      language: 'vbscript',
      code: 'Value = DateAdd("d", Record("ExpiryDays"), Record("MFGDate"))',
    },
  }, { record: recordA });
  assert.equal(tfmVal, '27/09/2026');
  console.log('  ✓ Transform Pipeline resolved: ' + tfmVal);
}

// -------------------------------------------------------------
// 9. JavaScript Engine Intactness
// -------------------------------------------------------------
console.log('\n--- 9. JavaScript Engine Intactness ---');
{
  const jsRes = evaluateSafeScript('return new Date().getFullYear();', {}, 'javascript');
  assert.equal(jsRes, String(new Date().getFullYear()));
  console.log('  ✓ JavaScript Engine new Date().getFullYear() => ' + jsRes);

  const jsRecordRes = evaluateSafeScript('return "EXP: " + Record("ExpiryDays");', { record: { ExpiryDays: 9 } }, 'javascript');
  assert.equal(jsRecordRes, 'EXP: 9');
  console.log('  ✓ JavaScript Engine Record() access => ' + jsRecordRes);
}

console.log('\n===============================================================');
console.log('  ALL VBSCRIPT DATE & EXPIRY TESTS PASSED SUCCESSFULLY! (100%)');
console.log('===============================================================\n');
