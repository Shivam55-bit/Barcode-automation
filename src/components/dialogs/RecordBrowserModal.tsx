import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { DatabaseConnectionConfig, RecordFilterCondition, RecordSortCondition, RecordFilterOperator } from '../../types';
import {
  Search,
  ArrowUpDown,
  CheckSquare,
  Square,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Printer,
  CheckCircle2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface RecordBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: DatabaseConnectionConfig | null;
  activeRecordIndex: number;
  onSelectActiveRecord: (index: number) => void;
  selectedIndices: number[];
  onToggleRecordSelection: (index: number) => void;
  onSelectAll: (indices: number[]) => void;
  onClearSelection: () => void;
  onOpenPrintDialog?: () => void;
  /** Persisted structured filters currently driving the record set (spec 23) */
  initialFilters?: RecordFilterCondition[];
  /** Persisted multi-field sort currently driving the record set (spec 24) */
  initialSort?: RecordSortCondition[];
  /** Persist a new query so it drives canvas + print globally */
  onApplyQuery?: (filters: RecordFilterCondition[], sort: RecordSortCondition[]) => void;
}

const FILTER_OPERATORS: { value: RecordFilterOperator; label: string; needsValue: boolean; needsValue2?: boolean }[] = [
  { value: 'equals', label: '= Equals', needsValue: true },
  { value: 'notEquals', label: '≠ Not Equals', needsValue: true },
  { value: 'contains', label: 'Contains', needsValue: true },
  { value: 'notContains', label: 'Does Not Contain', needsValue: true },
  { value: 'startsWith', label: 'Starts With', needsValue: true },
  { value: 'endsWith', label: 'Ends With', needsValue: true },
  { value: 'greaterThan', label: '> Greater Than', needsValue: true },
  { value: 'greaterThanOrEqual', label: '≥ Greater/Equal', needsValue: true },
  { value: 'lessThan', label: '< Less Than', needsValue: true },
  { value: 'lessThanOrEqual', label: '≤ Less/Equal', needsValue: true },
  { value: 'between', label: 'Between', needsValue: true, needsValue2: true },
  { value: 'isEmpty', label: 'Is Empty', needsValue: false },
  { value: 'isNotEmpty', label: 'Is Not Empty', needsValue: false },
];

export const RecordBrowserModal: React.FC<RecordBrowserModalProps> = ({
  isOpen,
  onClose,
  dataset,
  activeRecordIndex,
  onSelectActiveRecord,
  selectedIndices,
  onToggleRecordSelection,
  onSelectAll,
  onClearSelection,
  onOpenPrintDialog,
  initialFilters,
  initialSort,
  onApplyQuery,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;

  const [showQueryPanel, setShowQueryPanel] = useState<boolean>(false);
  const [draftFilters, setDraftFilters] = useState<RecordFilterCondition[]>(initialFilters || []);
  const [draftSort, setDraftSort] = useState<RecordSortCondition[]>(initialSort || []);

  useEffect(() => {
    if (isOpen) {
      setDraftFilters(initialFilters || []);
      setDraftSort(initialSort || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const records = dataset?.records || [];
  const fields = dataset?.fields || (records[0] ? Object.keys(records[0]) : []);

  // Filtered and Sorted Records with original indices preserved
  const processedRecords = useMemo(() => {
    const indexed = records.map((rec, originalIndex) => ({ rec, originalIndex }));

    let result = indexed;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(({ rec }) =>
        Object.values(rec).some((val) => String(val ?? '').toLowerCase().includes(q))
      );
    }

    // Column sort
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = String(a.rec[sortColumn] ?? '');
        const valB = String(b.rec[sortColumn] ?? '');
        const numA = Number(valA);
        const numB = Number(valB);

        let comparison = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          comparison = numA - numB;
        } else {
          comparison = valA.localeCompare(valB);
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [records, searchTerm, sortColumn, sortDirection]);

  // Pagination slice
  const totalPages = Math.ceil(processedRecords.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return processedRecords.slice(start, start + pageSize);
  }, [processedRecords, page, pageSize]);

  // Handle Sort Toggle
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Select all currently filtered
  const handleToggleSelectFiltered = () => {
    const currentFilteredIndices = processedRecords.map((r) => r.originalIndex);
    const allSelected = currentFilteredIndices.every((idx) => selectedIndices.includes(idx));
    if (allSelected) {
      onClearSelection();
    } else {
      onSelectAll(currentFilteredIndices);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dataset ? `Record Browser: ${dataset.name}` : 'Spreadsheet Records'}
      subtitle={`Total: ${records.length} records • Showing ${processedRecords.length} filtered • ${selectedIndices.length} selected for print`}
      maxWidth="6xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectFiltered}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {processedRecords.length > 0 &&
              processedRecords.every((r) => selectedIndices.includes(r.originalIndex)) ? (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                  Deselect All Filtered
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Select All Filtered ({processedRecords.length})
                </>
              )}
            </button>

            {selectedIndices.length > 0 && (
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                {selectedIndices.length} records checked
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onOpenPrintDialog && selectedIndices.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPrintDialog();
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Selected ({selectedIndices.length})
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        {/* Filter & Sort Query Builder (spec 23/24) */}
        {onApplyQuery && (
          <div className="border border-slate-200 rounded-lg bg-slate-50/70">
            <button
              type="button"
              onClick={() => setShowQueryPanel((s) => !s)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-t-lg"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Filter &amp; Sort Query
                {(initialFilters?.length || initialSort?.length) ? (
                  <span className="text-[10px] font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded-full">
                    {(initialFilters?.length || 0) + (initialSort?.length || 0)} active
                  </span>
                ) : null}
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showQueryPanel ? 'rotate-90' : ''}`} />
            </button>

            {showQueryPanel && (
              <div className="px-3 pb-3 space-y-3 border-t border-slate-200 pt-3">
                {/* Filters */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Filters</div>
                  {draftFilters.length === 0 && (
                    <div className="text-[11px] text-slate-400 italic">No filters — all records shown.</div>
                  )}
                  {draftFilters.map((f, idx) => {
                    const opMeta = FILTER_OPERATORS.find((o) => o.value === f.operator);
                    return (
                      <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                        {idx > 0 ? (
                          <select
                            value={f.logic || 'AND'}
                            onChange={(e) =>
                              setDraftFilters((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, logic: e.target.value as 'AND' | 'OR' } : c))
                              )
                            }
                            className="w-16 text-[11px] border border-slate-300 rounded px-1 py-1 bg-white font-semibold text-indigo-700"
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        ) : (
                          <span className="w-16 text-[11px] text-slate-400 text-center">Where</span>
                        )}
                        <select
                          value={f.field}
                          onChange={(e) =>
                            setDraftFilters((prev) => prev.map((c, i) => (i === idx ? { ...c, field: e.target.value } : c)))
                          }
                          className="min-w-[110px] text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          {fields.map((fl) => (
                            <option key={fl} value={fl}>
                              {fl}
                            </option>
                          ))}
                        </select>
                        <select
                          value={f.operator}
                          onChange={(e) =>
                            setDraftFilters((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, operator: e.target.value as RecordFilterOperator } : c))
                            )
                          }
                          className="min-w-[120px] text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          {FILTER_OPERATORS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {opMeta?.needsValue && (
                          <input
                            type="text"
                            value={f.value ?? ''}
                            onChange={(e) =>
                              setDraftFilters((prev) => prev.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)))
                            }
                            placeholder="value"
                            className="w-24 text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                          />
                        )}
                        {opMeta?.needsValue2 && (
                          <input
                            type="text"
                            value={f.value2 ?? ''}
                            onChange={(e) =>
                              setDraftFilters((prev) => prev.map((c, i) => (i === idx ? { ...c, value2: e.target.value } : c)))
                            }
                            placeholder="and"
                            className="w-20 text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setDraftFilters((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Remove filter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => [
                        ...prev,
                        { field: fields[0] || '', operator: 'equals', value: '', logic: 'AND' },
                      ])
                    }
                    disabled={fields.length === 0}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" /> Add Filter
                  </button>
                </div>

                {/* Sort */}
                <div className="space-y-1.5 border-t border-slate-200 pt-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Sort (priority order)</div>
                  {draftSort.length === 0 && (
                    <div className="text-[11px] text-slate-400 italic">No sorting — original row order.</div>
                  )}
                  {draftSort.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-16 text-[11px] text-slate-400 text-center">{idx === 0 ? 'By' : 'then'}</span>
                      <select
                        value={s.field}
                        onChange={(e) =>
                          setDraftSort((prev) => prev.map((c, i) => (i === idx ? { ...c, field: e.target.value } : c)))
                        }
                        className="min-w-[110px] text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                      >
                        {fields.map((fl) => (
                          <option key={fl} value={fl}>
                            {fl}
                          </option>
                        ))}
                      </select>
                      <select
                        value={s.direction}
                        onChange={(e) =>
                          setDraftSort((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, direction: e.target.value as 'asc' | 'desc' } : c))
                          )
                        }
                        className="w-28 text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setDraftSort((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Remove sort"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraftSort((prev) => [...prev, { field: fields[0] || '', direction: 'asc' }])}
                    disabled={fields.length === 0}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" /> Add Sort Field
                  </button>
                </div>

                {/* Apply / Clear */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFilters([]);
                      setDraftSort([]);
                      onApplyQuery([], []);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <X className="w-3 h-3" /> Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cleanFilters = draftFilters.filter((f) => f.field && f.operator);
                      const cleanSort = draftSort.filter((s) => s.field);
                      onApplyQuery(cleanFilters, cleanSort);
                      setPage(0);
                    }}
                    className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Apply Query
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              placeholder="Search across all columns (barcode, SKU, description, lot)..."
              className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-[500px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/95 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      processedRecords.length > 0 &&
                      processedRecords.every((r) => selectedIndices.includes(r.originalIndex))
                    }
                    onChange={handleToggleSelectFiltered}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                </th>
                <th className="py-2.5 px-3 w-12 text-center text-slate-500">#</th>
                <th className="py-2.5 px-3 w-28 text-center">Action</th>
                {fields.map((field) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span>{field}</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          sortColumn === field ? 'text-indigo-600 font-bold' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 3} className="py-12 text-center text-slate-400 text-xs">
                    No matching records found for "{searchTerm}".
                  </td>
                </tr>
              ) : (
                paginatedRows.map(({ rec, originalIndex }) => {
                  const isActive = activeRecordIndex === originalIndex;
                  const isChecked = selectedIndices.includes(originalIndex);

                  return (
                    <tr
                      key={originalIndex}
                      className={`transition-colors ${
                        isActive
                          ? 'bg-indigo-50/70 font-medium'
                          : isChecked
                          ? 'bg-slate-50/80'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleRecordSelection(originalIndex)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                      </td>

                      {/* Row Index */}
                      <td className="py-2 px-3 text-center text-[11px] text-slate-500 font-mono">
                        {originalIndex + 1}
                      </td>

                      {/* Canvas Active Setter */}
                      <td className="py-2 px-3 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                            <Eye className="w-3 h-3" />
                            On Canvas
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectActiveRecord(originalIndex)}
                            className="text-[11px] text-slate-600 hover:text-indigo-600 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors"
                          >
                            Set Active
                          </button>
                        )}
                      </td>

                      {/* Data Columns */}
                      {fields.map((field) => {
                        const val = String(rec[field] ?? '');
                        const isLeadingZero = /^0[0-9]+$/.test(val);

                        return (
                          <td key={field} className="py-2 px-3 whitespace-nowrap text-slate-800">
                            {isLeadingZero ? (
                              <span className="font-mono bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded text-[11px] border border-amber-200">
                                {val}
                              </span>
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
