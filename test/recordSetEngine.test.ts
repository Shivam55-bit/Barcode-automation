/**
 * Unit tests for the centralized Record Set Engine (filter + sort + search).
 * Run: npx tsx test/recordSetEngine.test.ts
 */
import {
  applyRecordFilters,
  applyRecordSort,
  applyRecordSearch,
  buildVisibleRecordSet,
  evaluateFilterCondition,
} from '../src/services/recordSetEngine';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, got?: any, want?: any) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}` + (got !== undefined ? ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})` : ''));
  }
}

const data = [
  { ProductName: 'Shampoo', Category: 'Food', Price: '150', SKU: '00012', Qty: '5' },
  { ProductName: 'Soap', Category: 'Home', Price: '50', SKU: '00007', Qty: '0' },
  { ProductName: 'Oil', Category: 'Food', Price: '250', SKU: '00120', Qty: '12' },
  { ProductName: 'Rice', Category: 'Food', Price: '90', SKU: '00003', Qty: '' },
];

console.log('--- evaluateFilterCondition ---');
assert(evaluateFilterCondition(data[0], { field: 'Category', operator: 'equals', value: 'Food' }), 'equals text');
assert(evaluateFilterCondition(data[0], { field: 'Price', operator: 'greaterThan', value: '100' }), 'numeric greaterThan');
assert(!evaluateFilterCondition(data[1], { field: 'Price', operator: 'greaterThan', value: '100' }), 'numeric greaterThan false');
assert(evaluateFilterCondition(data[0], { field: 'ProductName', operator: 'startsWith', value: 'Sha' }), 'startsWith');
assert(evaluateFilterCondition(data[3], { field: 'Qty', operator: 'isEmpty' }), 'isEmpty on blank');
assert(evaluateFilterCondition(data[2], { field: 'Price', operator: 'between', value: '200', value2: '300' }), 'between numeric');
// Leading-zero SKU must NOT be coerced destructively in equality
assert(evaluateFilterCondition(data[0], { field: 'SKU', operator: 'equals', value: '00012' }), 'leading-zero SKU equals string');

console.log('--- applyRecordFilters (AND/OR) ---');
const foodExpensive = applyRecordFilters(data, [
  { field: 'Category', operator: 'equals', value: 'Food' },
  { field: 'Price', operator: 'greaterThan', value: '100', logic: 'AND' },
]);
assert(foodExpensive.length === 2, 'AND filter Food & Price>100 -> 2', foodExpensive.length, 2);

const foodOrCheap = applyRecordFilters(data, [
  { field: 'Category', operator: 'equals', value: 'Home' },
  { field: 'Price', operator: 'lessThan', value: '100', logic: 'OR' },
]);
// Home(Soap) OR Price<100 (Soap50, Rice90) => Soap, Rice = 2
assert(foodOrCheap.length === 2, 'OR filter -> 2', foodOrCheap.length, 2);

console.log('--- applyRecordSort ---');
const byPriceDesc = applyRecordSort(data, [{ field: 'Price', direction: 'desc' }]);
assert(byPriceDesc[0].ProductName === 'Oil', 'sort Price desc -> Oil first', byPriceDesc[0].ProductName, 'Oil');
const byQtyAsc = applyRecordSort(data, [{ field: 'Qty', direction: 'asc' }]);
// Empty Qty (Rice) must sink to bottom regardless of direction
assert(byQtyAsc[byQtyAsc.length - 1].ProductName === 'Rice', 'empty sorts last', byQtyAsc[byQtyAsc.length - 1].ProductName, 'Rice');

console.log('--- applyRecordSearch ---');
assert(applyRecordSearch(data, 'oil').length === 1, 'search oil -> 1');
assert(applyRecordSearch(data, 'food').length === 3, 'search food -> 3');

console.log('--- buildVisibleRecordSet (identity preserved) ---');
const visible = buildVisibleRecordSet(data, {
  headerRow: 1,
  filters: [{ field: 'Category', operator: 'equals', value: 'Food' }],
  sort: [{ field: 'Price', direction: 'desc' }],
});
assert(visible.length === 3, 'visible Food count 3', visible.length, 3);
assert(visible[0].data.ProductName === 'Oil', 'visible sorted Oil first', visible[0].data.ProductName, 'Oil');
assert(visible[0].displayedRecordNumber === 1, 'displayedRecordNumber renumbered', visible[0].displayedRecordNumber, 1);
// Oil was originally index 2 -> source identity preserved
assert(visible[0].sourceRecordIndex === 2, 'sourceRecordIndex preserved after sort', visible[0].sourceRecordIndex, 2);
// Row number = index + headerRow + 1 = 2 + 1 + 1 = 4
assert(visible[0].sourceRowNumber === 4, 'sourceRowNumber preserved', visible[0].sourceRowNumber, 4);

console.log(`\nRecord Set Engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
