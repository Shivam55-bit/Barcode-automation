/**
 * BarcodeFlow Enterprise Calculated Field Engine
 *
 * Resolves derived fields (e.g. Total = Price * Quantity) in dependency order so
 * they become available like regular fields to Text, Barcode, Scripts and Named
 * Sources (spec 17). Includes circular-dependency detection (spec 11/17).
 */

import { CalculatedFieldDefinition } from '../types';
import { evaluateFormula } from './formulaEngine';
import { applyDataTypeFormatting } from './transformEngine';

export interface CalculatedFieldResolveOptions {
  namedSources?: Record<string, any>;
  system?: {
    userName?: string;
    printerName?: string;
    jobId?: string;
    currentRecordIndex?: number;
    totalRecords?: number;
    pageNumber?: number;
    totalPages?: number;
  };
}

export interface CircularDependencyResult {
  hasCycle: boolean;
  cycles: string[][];
  /** field names that participate in a cycle */
  affectedFields: string[];
}

const IDENTIFIER_RE = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * Extracts the set of calculated-field names referenced by a formula.
 */
function extractReferences(formula: string, fieldNames: Set<string>): string[] {
  if (!formula) return [];
  const tokens = formula.match(IDENTIFIER_RE) || [];
  const refs = new Set<string>();
  for (const t of tokens) {
    if (fieldNames.has(t)) refs.add(t);
  }
  return [...refs];
}

/**
 * Detects circular dependencies among calculated field definitions.
 */
export function detectCircularDependencies(
  defs: CalculatedFieldDefinition[]
): CircularDependencyResult {
  const active = defs.filter((d) => d && d.name && d.enabled !== false);
  const nameSet = new Set(active.map((d) => d.name));
  const graph = new Map<string, string[]>();
  for (const d of active) {
    graph.set(d.name, extractReferences(d.formula, nameSet).filter((r) => r !== d.name));
  }

  const cycles: string[][] = [];
  const affected = new Set<string>();
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  active.forEach((d) => color.set(d.name, WHITE));
  const stack: string[] = [];

  const visit = (node: string) => {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      if (color.get(dep) === GRAY) {
        // Found a back-edge -> extract the cycle from the stack
        const start = stack.indexOf(dep);
        const cycle = stack.slice(start);
        cycles.push([...cycle, dep]);
        cycle.forEach((n) => affected.add(n));
      } else if (color.get(dep) === WHITE) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  active.forEach((d) => {
    if (color.get(d.name) === WHITE) visit(d.name);
  });

  return { hasCycle: cycles.length > 0, cycles, affectedFields: [...affected] };
}

/**
 * Returns a topologically sorted order of field names (dependencies first).
 * Fields involved in cycles are appended last so they can be flagged as errors.
 */
function topologicalOrder(defs: CalculatedFieldDefinition[]): { order: string[]; cyclic: Set<string> } {
  const active = defs.filter((d) => d && d.name && d.enabled !== false);
  const nameSet = new Set(active.map((d) => d.name));
  const deps = new Map<string, string[]>();
  for (const d of active) {
    deps.set(d.name, extractReferences(d.formula, nameSet).filter((r) => r !== d.name));
  }

  const { affectedFields } = detectCircularDependencies(active);
  const cyclic = new Set(affectedFields);

  const order: string[] = [];
  const visited = new Set<string>();

  const visit = (node: string, path: Set<string>) => {
    if (visited.has(node) || cyclic.has(node)) return;
    if (path.has(node)) return; // safety
    path.add(node);
    for (const dep of deps.get(node) || []) {
      if (!cyclic.has(dep)) visit(dep, path);
    }
    path.delete(node);
    if (!visited.has(node)) {
      visited.add(node);
      order.push(node);
    }
  };

  active.forEach((d) => visit(d.name, new Set()));
  // Append cyclic fields at the end so they resolve to an error marker
  active.forEach((d) => {
    if (cyclic.has(d.name) && !order.includes(d.name)) order.push(d.name);
  });

  return { order, cyclic };
}

/**
 * Resolves calculated fields against a record and returns a NEW record object
 * augmented with the computed values. The original record is not mutated.
 */
export function resolveCalculatedFields(
  record: Record<string, any>,
  defs?: CalculatedFieldDefinition[],
  options: CalculatedFieldResolveOptions = {}
): Record<string, any> {
  if (!defs || defs.length === 0) return record;
  const active = defs.filter((d) => d && d.name && d.formula && d.enabled !== false);
  if (active.length === 0) return record;

  const defByName = new Map(active.map((d) => [d.name, d]));
  const { order, cyclic } = topologicalOrder(active);
  const working: Record<string, any> = { ...record };

  for (const name of order) {
    const def = defByName.get(name);
    if (!def) continue;

    if (cyclic.has(name)) {
      working[name] = `[Circular: ${name}]`;
      continue;
    }

    const res = evaluateFormula(def.formula, {
      record: working, // includes already-resolved calculated fields
      namedSources: options.namedSources,
      system: options.system,
    });

    if (!res.success) {
      working[name] = `[Calc Error: ${res.error}]`;
      continue;
    }

    if (def.format) {
      // Formatted fields become display strings (not intended for further math)
      working[name] = applyDataTypeFormatting(res.value, def.format);
    } else if (/^[+-]?\d+(\.\d+)?$/.test(String(res.value).trim())) {
      // Keep clean numeric results as numbers so dependent formulas chain
      // arithmetically (Total + GSTAmount) instead of string-concatenating.
      working[name] = Number(res.value);
    } else {
      working[name] = res.value;
    }
  }

  return working;
}

/**
 * Validates a single formula against a sample record. Returns an error message
 * if the formula is invalid, otherwise null. Useful for the field editor UI.
 */
export function validateCalculatedField(
  def: CalculatedFieldDefinition,
  sampleRecord: Record<string, any> = {}
): string | null {
  if (!def.name || !def.name.trim()) return 'Field name is required.';
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(def.name)) {
    return `Invalid field name "${def.name}". Use letters, numbers and underscores (no spaces).`;
  }
  if (!def.formula || !def.formula.trim()) return 'Formula is required.';
  const res = evaluateFormula(def.formula, { record: sampleRecord });
  return res.success ? null : res.error || 'Invalid formula.';
}
