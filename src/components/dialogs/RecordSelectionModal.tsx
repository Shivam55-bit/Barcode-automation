import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
  CheckCircle2,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

interface RecordSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRecords: Record<string, any>[];
  columns: string[];
  initialSelectedIndices: number[];
  onApplySelection: (selectedIndices: number[], rangeString: string) => void;
  quantityColumn?: string;
  datasetName?: string;
}

/**
 * Converts array of 0-based indices to a human-readable 1-based range string
 * Example: [0, 1, 2, 4, 6, 7, 8] => "1-3, 5, 7-9"
 */
export function formatIndicesToRangeString(indices: number[]): string {
  if (!indices || indices.length === 0) return '';
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
    } else {
      ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
      start = current;
      end = current;
    }
  }
  ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  return ranges.join(', ');
}

/**
 * Parses a 1-based range string (e.g. "1, 3, 5-10") into an array of 0-based indices
 */
export function parseRangeStringToIndices(rangeStr: string, maxRecords: number): number[] {
  if (!rangeStr || !rangeStr.trim()) return [];
  const parts = rangeStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const result = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const startNum = parseInt(startStr, 10);
      const endNum = parseInt(endStr, 10);
      if (!isNaN(startNum) && !isNaN(endNum)) {
        const from = Math.max(1, Math.min(startNum, endNum));
        const to = Math.min(maxRecords, Math.max(startNum, endNum));
        for (let r = from; r <= to; r++) {
          result.add(r - 1);
        }
      }
    } else {
      const single = parseInt(part, 10);
      if (!isNaN(single) && single >= 1 && single <= maxRecords) {
        result.add(single - 1);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

export const RecordSelectionModal: React.FC<RecordSelectionModalProps> = ({
  isOpen,
  onClose,
  allRecords,
  columns,
  initialSelectedIndices,
  onApplySelection,
  quantityColumn,
  datasetName,
}) => {
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set(initialSelectedIndices));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [rangeInput, setRangeInput] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = new Set(
        initialSelectedIndices.length > 0
          ? initialSelectedIndices
          : allRecords.map((_, i) => i)
      );
      setSelectedSet(initial);
      setRangeInput(formatIndicesToRangeString(Array.from(initial)));
      setSearchTerm('');
      setPage(0);
    }
  }, [isOpen, initialSelectedIndices, allRecords]);

  // Indexed records to keep original position
  const indexedRecords = useMemo(() => {
    return allRecords.map((record, originalIndex) => ({
      record,
      originalIndex,
    }));
  }, [allRecords]);

  // Filtered and sorted records
  const processedRecords = useMemo(() => {
    let result = indexedRecords;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(({ record }) =>
        Object.values(record).some((val) =>
          String(val ?? '').toLowerCase().includes(q)
        )
      );
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const valA = String(a.record[sortColumn] ?? '');
        const valB = String(b.record[sortColumn] ?? '');
        const numA = Number(valA);
        const numB = Number(valB);

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB);
        }
        return sortAsc ? cmp : -cmp;
      });
    }

    return result;
  }, [indexedRecords, searchTerm, sortColumn, sortAsc]);

  const totalPages = Math.ceil(processedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = page * pageSize;
    return processedRecords.slice(start, start + pageSize);
  }, [processedRecords, page, pageSize]);

  // Handle single toggle
  const handleToggleRecord = (index: number) => {
    const next = new Set(selectedSet);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedSet(next);
    setRangeInput(formatIndicesToRangeString(Array.from(next)));
  };

  // Bulk selections
  const handleSelectAll = () => {
    const all = new Set(allRecords.map((_, i) => i));
    setSelectedSet(all);
    setRangeInput(formatIndicesToRangeString(Array.from(all)));
  };

  const handleSelectNone = () => {
    setSelectedSet(new Set());
    setRangeInput('');
  };

  const handleSelectVisible = () => {
    const next = new Set(selectedSet);
    paginatedRecords.forEach(({ originalIndex }) => next.add(originalIndex));
    setSelectedSet(next);
    setRangeInput(formatIndicesToRangeString(Array.from(next)));
  };

  const handleInvertSelection = () => {
    const next = new Set<number>();
    allRecords.forEach((_, i) => {
      if (!selectedSet.has(i)) {
        next.add(i);
      }
    });
    setSelectedSet(next);
    setRangeInput(formatIndicesToRangeString(Array.from(next)));
  };

  // Range text input change
  const handleRangeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
  };

  const handleApplyRangeInput = () => {
    const parsed = parseRangeStringToIndices(rangeInput, allRecords.length);
    setSelectedSet(new Set(parsed));
  };

  // Calculate total labels based on quantityColumn if applicable
  const totalLabels = useMemo(() => {
    let sum = 0;
    selectedSet.forEach((idx) => {
      const row = allRecords[idx];
      if (row) {
        if (quantityColumn && row[quantityColumn]) {
          const parsed = parseInt(String(row[quantityColumn]), 10);
          sum += isNaN(parsed) || parsed <= 0 ? 1 : parsed;
        } else {
          sum += 1;
        }
      }
    });
    return sum;
  }, [selectedSet, allRecords, quantityColumn]);

  const isAllSelected = allRecords.length > 0 && selectedSet.size === allRecords.length;
  const isIndeterminate = selectedSet.size > 0 && selectedSet.size < allRecords.length;

  const handleApply = () => {
    const sorted = Array.from(selectedSet).sort((a, b) => a - b);
    const rangeStr = formatIndicesToRangeString(sorted);
    onApplySelection(sorted, rangeStr);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Database Records to Print"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-3.5 text-xs text-slate-700">
        {/* Top Controls: Search & Range String */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search across all fields (SL No, Color, Barcode...)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-slate-600">Range:</span>
            <input
              type="text"
              value={rangeInput}
              onChange={handleRangeInputChange}
              onBlur={handleApplyRangeInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyRangeInput();
              }}
              placeholder="e.g. 1-5, 7, 9-12"
              className="w-36 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              title="Enter comma-separated row numbers or ranges (e.g. 1-10, 15)"
            />
            <button
              type="button"
              onClick={handleApplyRangeInput}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              Set
            </button>
          </div>
        </div>

        {/* Action Toolbar & Selection Counters */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700"
            >
              Select All ({allRecords.length})
            </button>
            <button
              type="button"
              onClick={handleSelectNone}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700"
            >
              Select None
            </button>
            <button
              type="button"
              onClick={handleSelectVisible}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700"
            >
              Select Page
            </button>
            <button
              type="button"
              onClick={handleInvertSelection}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700"
            >
              Invert
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-slate-500">
              Showing {processedRecords.length} of {allRecords.length} records
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              Selected: {selectedSet.size} records ({totalLabels} labels)
            </span>
          </div>
        </div>

        {/* Records Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-[380px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="w-10 px-3 py-2 text-center">
                  <div
                    onClick={() => {
                      if (isAllSelected) handleSelectNone();
                      else handleSelectAll();
                    }}
                    className="cursor-pointer inline-flex items-center justify-center"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : isIndeterminate ? (
                      <MinusSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="w-14 px-2 py-2 text-center">Record #</th>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => {
                      if (sortColumn === col) {
                        setSortAsc(!sortAsc);
                      } else {
                        setSortColumn(col);
                        setSortAsc(true);
                      }
                    }}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors truncate max-w-[160px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortColumn === col && (
                        <ArrowUpDown className="w-3 h-3 text-indigo-600" />
                      )}
                      {quantityColumn === col && (
                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-normal lowercase">
                          qty
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(({ record, originalIndex }) => {
                  const isSelected = selectedSet.has(originalIndex);
                  return (
                    <tr
                      key={originalIndex}
                      onClick={() => handleToggleRecord(originalIndex)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/60 hover:bg-indigo-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRecord(originalIndex)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-slate-500 font-sans">
                        {originalIndex + 1}
                      </td>
                      {columns.map((col) => {
                        const cellVal = record[col];
                        const isQty = quantityColumn === col;
                        return (
                          <td
                            key={col}
                            className={`px-3 py-2 truncate max-w-[160px] ${
                              isQty
                                ? 'font-bold text-amber-700 bg-amber-50/40'
                                : isSelected
                                ? 'text-slate-900'
                                : 'text-slate-600'
                            }`}
                            title={String(cellVal ?? '')}
                          >
                            {cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
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

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {datasetName ? <span>Connected Source: <strong>{datasetName}</strong></span> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedSet.size === 0}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply Selection ({selectedSet.size} Records)</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
