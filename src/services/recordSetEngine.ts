/**
 * BarcodeFlow Enterprise Record Set Engine
 *
 * Centralized Query / Filter / Sort / Search engine that transforms the raw
 * dataset rows into the authoritative visible record set consumed by the
 * Record Navigator, Record Browser, Designer Canvas preview, Print Preview and
 * the Print Engine.
 *
 * This is the single place where structured filters (spec 23), multi-field
 * sorting (spec 24) and free-text search are resolved so every screen shows the
 * exact same records in the exact same order.
 */

import { FilterCondition, SortCondition } from './providers/IDataSourceProvider';

export type { FilterCondition, SortCondition };

export interface VisibleRecord {
  /** Resolved record data */
  data: Record<string, any>;
  /** Stable 0-based index into the original unfiltered record array */
  sourceRecordIndex: number;
  /** 1-based spreadsheet row number (header offset applied) */
  sourceRowNumber: number;
  /** 1-based number within the current visible (filtered/sorted) set */
  displayedRecordNumber: number;
}

export interface BuildVisibleRecordSetOptions {
  /** Free-text search across all columns (matches RecordNavigator quick filter) */
  search?: string;
  /** Structured filter conditions with AND/OR logic */
  filters?: FilterCondition[];
  /** Multi-field sort priority list */
  sort?: SortCondition[];
  /** 1-based header row of the source spreadsheet (defaults to 1) */
  headerRow?: number;
}

function toComparable(raw: any): { num: number | null; str: string } {
  if (raw === null || raw === undefined) return { num: null, str: '' };
  const str = String(raw).trim();
  if (str === '') return { num: null, str: '' };
  // Only treat as numeric when the whole string is a clean number (preserves SKUs like "00123")
  const num = /^[+-]?\d+(\.\d+)?$/.test(str) ? Number(str) : null;
  return { num: Number.isNaN(num as number) ? null : num, str };
}

/**
 * Evaluates a single filter condition against a record.
 */
export function evaluateFilterCondition(record: Record<string, any>, cond: FilterCondition): boolean {
  const fieldVal = record[cond.field];
  const { num: fieldNum, str: fieldStr } = toComparable(fieldVal);
  const fieldStrLower = fieldStr.toLowerCase();

  const { num: cmpNum, str: cmpStr } = toComparable(cond.value);
  const cmpStrLower = cmpStr.toLowerCase();

  switch (cond.operator) {
    case 'equals':
      // Prefer numeric comparison when both sides are numeric
      if (fieldNum !== null && cmpNum !== null) return fieldNum === cmpNum;
      return fieldStrLower === cmpStrLower;
    case 'notEquals':
      if (fieldNum !== null && cmpNum !== null) return fieldNum !== cmpNum;
      return fieldStrLower !== cmpStrLower;
    case 'contains':
      return fieldStrLower.includes(cmpStrLower);
    case 'notContains':
      return !fieldStrLower.includes(cmpStrLower);
    case 'startsWith':
      return fieldStrLower.startsWith(cmpStrLower);
    case 'endsWith':
      return fieldStrLower.endsWith(cmpStrLower);
    case 'greaterThan':
      if (fieldNum !== null && cmpNum !== null) return fieldNum > cmpNum;
      return fieldStr > cmpStr;
    case 'greaterThanOrEqual':
      if (fieldNum !== null && cmpNum !== null) return fieldNum >= cmpNum;
      return fieldStr >= cmpStr;
    case 'lessThan':
      if (fieldNum !== null && cmpNum !== null) return fieldNum < cmpNum;
      return fieldStr < cmpStr;
    case 'lessThanOrEqual':
      if (fieldNum !== null && cmpNum !== null) return fieldNum <= cmpNum;
      return fieldStr <= cmpStr;
    case 'between': {
      const { num: n2, str: s2 } = toComparable(cond.value2);
      if (fieldNum !== null && cmpNum !== null && n2 !== null) {
        const lo = Math.min(cmpNum, n2);
        const hi = Math.max(cmpNum, n2);
        return fieldNum >= lo && fieldNum <= hi;
      }
      return fieldStr >= cmpStr && fieldStr <= s2;
    }
    case 'isEmpty':
      return fieldStr === '';
    case 'isNotEmpty':
      return fieldStr !== '';
    case 'isNull':
      return fieldVal === null || fieldVal === undefined;
    case 'isNotNull':
      return fieldVal !== null && fieldVal !== undefined;
    default:
      return true;
  }
}

/**
 * Applies an ordered list of filter conditions using their per-condition
 * AND/OR logic connector. The logic on condition[i] describes how it joins with
 * the accumulated result of the previous conditions (left-associative), which
 * matches BarTender's Query Builder behaviour.
 */
export function applyRecordFilters<T extends Record<string, any>>(
  records: T[],
  filters?: FilterCondition[]
): T[] {
  if (!filters || filters.length === 0) return records;
  const active = filters.filter((f) => f && f.field && f.operator);
  if (active.length === 0) return records;

  return records.filter((rec) => {
    let result = evaluateFilterCondition(rec, active[0]);
    for (let i = 1; i < active.length; i++) {
      const cond = active[i];
      const pass = evaluateFilterCondition(rec, cond);
      // The logic connector belongs to the current condition and joins it to the left.
      if ((cond.logic || 'AND') === 'OR') {
        result = result || pass;
      } else {
        result = result && pass;
      }
    }
    return result;
  });
}

/**
 * Multi-field stable sort. Numeric fields compare numerically, text fields use
 * locale comparison. Empty values sort last regardless of direction.
 */
export function applyRecordSort<T extends Record<string, any>>(
  records: T[],
  sort?: SortCondition[]
): T[] {
  if (!sort || sort.length === 0) return records;
  const active = sort.filter((s) => s && s.field);
  if (active.length === 0) return records;

  // Decorate-sort-undecorate for stability across engines
  return records
    .map((rec, idx) => ({ rec, idx }))
    .sort((a, b) => {
      for (const s of active) {
        const av = toComparable(a.rec[s.field]);
        const bv = toComparable(b.rec[s.field]);
        const dir = s.direction === 'desc' ? -1 : 1;

        // Empty values always sink to the bottom
        const aEmpty = av.str === '';
        const bEmpty = bv.str === '';
        if (aEmpty && bEmpty) continue;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        let cmp = 0;
        if (av.num !== null && bv.num !== null) {
          cmp = av.num - bv.num;
        } else {
          cmp = av.str.localeCompare(bv.str, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (cmp !== 0) return cmp * dir;
      }
      // Stable fallback: preserve original order
      return a.idx - b.idx;
    })
    .map((entry) => entry.rec);
}

/**
 * Free text search across all column values (case-insensitive contains).
 */
export function applyRecordSearch<T extends Record<string, any>>(records: T[], search?: string): T[] {
  const q = (search || '').trim().toLowerCase();
  if (!q) return records;
  return records.filter((rec) =>
    Object.values(rec).some((val) => String(val ?? '').toLowerCase().includes(q))
  );
}

/**
 * Authoritative pipeline: raw rows -> filters -> search -> sort -> visible set.
 * Source identity (sourceRecordIndex / sourceRowNumber) is preserved so record
 * selection, print and save/reopen always refer to the same physical rows even
 * after filtering and reordering.
 */
export function buildVisibleRecordSet(
  rawRecords: Record<string, any>[],
  options: BuildVisibleRecordSetOptions = {}
): VisibleRecord[] {
  const headerRow = options.headerRow || 1;

  // 1. Decorate with stable source identity BEFORE any reordering/filtering
  let working: VisibleRecord[] = rawRecords.map((rec, i) => ({
    data: rec,
    sourceRecordIndex: i,
    sourceRowNumber: i + headerRow + 1,
    displayedRecordNumber: i + 1,
  }));

  // 2. Structured filters
  if (options.filters && options.filters.length > 0) {
    working = working.filter((item) =>
      applyRecordFilters([item.data], options.filters).length > 0
    );
  }

  // 3. Free-text search
  if (options.search && options.search.trim()) {
    const searched = applyRecordSearch(
      working.map((w) => w.data),
      options.search
    );
    const searchedSet = new Set(searched);
    working = working.filter((item) => searchedSet.has(item.data));
  }

  // 4. Sorting (multi-field)
  if (options.sort && options.sort.length > 0) {
    const sortedData = applyRecordSort(
      working.map((w) => w.data),
      options.sort
    );
    const orderMap = new Map<Record<string, any>, number>();
    sortedData.forEach((d, i) => orderMap.set(d, i));
    working = [...working].sort(
      (a, b) => (orderMap.get(a.data) ?? 0) - (orderMap.get(b.data) ?? 0)
    );
  }

  // 5. Re-number the visible sequence (1-based) while keeping source identity
  return working.map((item, idx) => ({ ...item, displayedRecordNumber: idx + 1 }));
}
