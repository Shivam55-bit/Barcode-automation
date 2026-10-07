/**
 * Unit tests for the Calculated Field Engine (topo order + circular detection).
 * Run: npx tsx test/calculatedFieldEngine.test.ts
 */
import {
  resolveCalculatedFields,
  detectCircularDependencies,
  validateCalculatedField,
} from '../src/services/calculatedFieldEngine';
import { CalculatedFieldDefinition } from '../src/types';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, got?: any, want?: any) {
  if (cond) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.error(`  FAIL: ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
}

const record = { Price: '100', Quantity: '3', GST: '18' };

console.log('--- basic calculation ---');
const defs: CalculatedFieldDefinition[] = [
  { id: '1', name: 'Total', formula: 'Price * Quantity' },
  { id: '2', name: 'GSTAmount', formula: 'Price * GST / 100' },
  { id: '3', name: 'FinalPrice', formula: 'Total + GSTAmount' }, // depends on Total + GSTAmount
];
const out = resolveCalculatedFields(record, defs);
assert(String(out.Total) === '300', 'Total = Price*Quantity', out.Total, '300');
assert(String(out.GSTAmount) === '18', 'GSTAmount = Price*GST/100', out.GSTAmount, '18');
// FinalPrice depends on two other calc fields -> resolved in dependency order, arithmetic (not concat)
assert(String(out.FinalPrice) === '318', 'FinalPrice = Total + GSTAmount (dependency order)', out.FinalPrice, '318');
// original untouched
assert((record as any).Total === undefined, 'original record not mutated');

console.log('--- circular dependency detection ---');
const cyclic: CalculatedFieldDefinition[] = [
  { id: 'a', name: 'A', formula: 'B + 1' },
  { id: 'b', name: 'B', formula: 'A + 1' },
];
const circ = detectCircularDependencies(cyclic);
assert(circ.hasCycle, 'cycle detected A<->B', circ.hasCycle, true);
assert(circ.affectedFields.includes('A') && circ.affectedFields.includes('B'), 'both A and B flagged');
const cyclicOut = resolveCalculatedFields(record, cyclic);
assert(String(cyclicOut.A).startsWith('[Circular'), 'cyclic field marked as error', cyclicOut.A);

console.log('--- no false positive ---');
const linear: CalculatedFieldDefinition[] = [
  { id: '1', name: 'X', formula: 'Price + 1' },
  { id: '2', name: 'Y', formula: 'X * 2' },
];
assert(!detectCircularDependencies(linear).hasCycle, 'no cycle for linear chain');

console.log('--- validation ---');
assert(validateCalculatedField({ id: '1', name: 'Bad Name', formula: 'Price' }) !== null, 'reject name with space');
assert(validateCalculatedField({ id: '1', name: 'Good', formula: 'Price * 2' }, record) === null, 'accept valid formula');
assert(validateCalculatedField({ id: '1', name: 'Good', formula: '' }) !== null, 'reject empty formula');

console.log(`\nCalculated Field Engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
