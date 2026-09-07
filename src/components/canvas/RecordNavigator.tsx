import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  FileSpreadsheet,
  Table,
} from 'lucide-react';
import { DatabaseConnectionConfig } from '../../types';

export interface RecordNavigatorProps {
  currentRecordIndex: number; // 0-based
  totalRecords: number;
  filteredCount?: number;
  unfilteredTotal?: number;
  isLoading?: boolean;
  selectedCount?: number;
  connection?: DatabaseConnectionConfig;
  currentRecordData?: Record<string, any>;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onGoToRecord: (recordNumber: number) => void; // 1-based human number
  onRefresh?: () => void;
  onOpenRecordBrowser?: () => void;
  onOpenDataConnector?: () => void;
  onSearchFilterChange?: (query: string) => void;
  searchFilter?: string;
}

export const RecordNavigator: React.FC<RecordNavigatorProps> = ({
  currentRecordIndex,
  totalRecords,
  filteredCount,
  unfilteredTotal,
  isLoading = false,
  selectedCount = 0,
  connection,
  currentRecordData,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onGoToRecord,
  onRefresh,
  onOpenRecordBrowser,
  onOpenDataConnector,
  onSearchFilterChange,
  searchFilter = '',
}) => {
  const displayTotal = filteredCount !== undefined ? filteredCount : totalRecords;
  const currentHumanRecord = displayTotal > 0 ? currentRecordIndex + 1 : 0;

  const [inputVal, setInputVal] = useState<string>(String(currentHumanRecord));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync internal input state when currentRecordIndex or displayTotal changes
  useEffect(() => {
    setInputVal(String(currentHumanRecord));
    setErrorMessage(null);
  }, [currentHumanRecord, displayTotal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const commitRecordNumber = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setInputVal(String(currentHumanRecord));
      setErrorMessage(null);
      return;
    }

    const val = parseInt(trimmed, 10);

    // Validation: 0, negative values, non-numeric, values greater than total
    if (isNaN(val) || val < 1 || val > displayTotal) {
      const msg = `Record must be between 1 and ${displayTotal}.`;
      setErrorMessage(msg);
      setInputVal(String(currentHumanRecord));
      // Auto-hide validation error after 3 seconds
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setErrorMessage(null);
    onGoToRecord(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRecordNumber();
    } else if (e.key === 'Escape') {
      setInputVal(String(currentHumanRecord));
      setErrorMessage(null);
    }
  };

  const canGoFirst = !isLoading && displayTotal > 0 && currentRecordIndex > 0;
  const canGoPrev = !isLoading && displayTotal > 0 && currentRecordIndex > 0;
  const canGoNext = !isLoading && displayTotal > 0 && currentRecordIndex < displayTotal - 1;
  const canGoLast = !isLoading && displayTotal > 0 && currentRecordIndex < displayTotal - 1;

  const isLinked = connection?.filePath || connection?.type === 'excel';
  const isFiltered = unfilteredTotal !== undefined && unfilteredTotal !== displayTotal;

  return (
    <div className="relative flex items-center justify-between h-9 px-2 bg-slate-100 border-t border-slate-300 text-xs select-none text-slate-700 shadow-inner overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
      {/* Validation Error Tooltip Popover */}
      {errorMessage && (
        <div
          role="alert"
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded shadow-md animate-in fade-in slide-in-from-bottom-1"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-1 text-amber-600 hover:text-amber-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Left: Connected Data Source / Excel Sheet info & Quick preview */}
      <div className="flex items-center gap-2 overflow-hidden mr-2">
        {onOpenDataConnector && (
          <button
            type="button"
            onClick={onOpenDataConnector}
            title={
              connection?.filePath
                ? `Connected to: ${connection.filePath}${connection.sheetName ? ` [${connection.sheetName}$]` : ''}`
                : 'Configure Database / File Connection'
            }
            className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-slate-50 active:bg-slate-200 border border-slate-300 rounded font-semibold text-[11px] text-slate-800 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            {isLinked ? (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )}
            <span className="truncate max-w-[140px] md:max-w-[200px]">
              {connection?.name || 'No Dataset Connected'}
            </span>

            {isLinked && (
              <span className="text-[9px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LINKED
              </span>
            )}
          </button>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Excel File Records (re-reads source spreadsheet)"
            className="p-1 bg-white hover:bg-slate-50 active:bg-slate-200 border border-slate-300 rounded text-slate-600 hover:text-blue-600 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        )}

        {/* View Grid Browser */}
        {onOpenRecordBrowser && displayTotal > 0 && (
          <button
            type="button"
            onClick={onOpenRecordBrowser}
            title="Open Record Browser Table & Filter Manager"
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-800 border border-indigo-200 rounded text-[11px] font-medium cursor-pointer transition-colors shrink-0"
          >
            <Table className="w-3.5 h-3.5 text-indigo-600" />
            <span>View Records</span>
          </button>
        )}

        {/* Live Active Record Preview Strip */}
        {displayTotal > 0 && currentRecordData && (
          <div
            className="hidden xl:flex items-center gap-2 text-[10px] text-slate-500 font-mono pl-2 border-l border-slate-300 truncate max-w-md"
            title="Active record values preview"
          >
            {Object.entries(currentRecordData)
              .filter(([k]) => !k.startsWith('__'))
              .slice(0, 3)
              .map(([k, v]) => (
                <span key={k} className="truncate">
                  <strong className="text-slate-700">{k}:</strong> {String(v ?? '')}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Right / Center: Professional Record Stepper Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Quick Search / Filter Input */}
        {onSearchFilterChange && (
          <div className="flex items-center mr-1">
            {isSearchOpen ? (
              <div className="flex items-center bg-white border border-blue-400 rounded px-1 py-0.5 shadow-2xs">
                <Search className="w-3 h-3 text-slate-400 mr-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchFilter}
                  onChange={(e) => onSearchFilterChange(e.target.value)}
                  placeholder="Filter records..."
                  className="w-24 md:w-32 text-xs outline-none bg-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    onSearchFilterChange('');
                    setIsSearchOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                title={searchFilter ? `Active filter: "${searchFilter}"` : 'Quick Filter Records'}
                className={`p-1 border rounded cursor-pointer transition-colors ${
                  searchFilter
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Selected Count Indicator */}
        {selectedCount > 0 && (
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mr-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {selectedCount} Selected
          </span>
        )}

        {/* Loading Indicator */}
        {isLoading ? (
          <div className="flex items-center gap-1.5 px-3 py-0.5 text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            <span>Refreshing records...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 border border-slate-300 rounded shadow-2xs">
            <span className="text-[11px] font-bold text-slate-600 tracking-tight mr-0.5">
              Record:
            </span>

            {/* |< First Record */}
            <button
              type="button"
              id="record-nav-first"
              disabled={!canGoFirst}
              onClick={onFirst}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="First Record (Ctrl+Home)"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>

            {/* < Previous Record */}
            <button
              type="button"
              id="record-nav-prev"
              disabled={!canGoPrev}
              onClick={onPrevious}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Previous Record (Ctrl+PageUp)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* [ 5 ] of 7 editable input */}
            <div className="flex items-center gap-1 font-mono text-xs">
              <input
                type="text"
                id="record-nav-input"
                disabled={displayTotal === 0 || isLoading}
                value={inputVal}
                onChange={handleInputChange}
                onBlur={commitRecordNumber}
                onKeyDown={handleKeyDown}
                className="w-12 text-center font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded py-0.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all disabled:opacity-40"
                title="Type record number and press Enter"
              />
              <span className="text-slate-400 font-sans">of</span>
              <span
                id="record-nav-total"
                className="font-bold text-slate-700 min-w-[16px]"
                title={isFiltered ? `Filtered from ${unfilteredTotal} total records` : undefined}
              >
                {displayTotal}
              </span>

              {isFiltered && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded ml-0.5 font-sans font-medium">
                  Filtered
                </span>
              )}
            </div>

            {/* > Next Record */}
            <button
              type="button"
              id="record-nav-next"
              disabled={!canGoNext}
              onClick={onNext}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Next Record (Ctrl+PageDown)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* >| Last Record */}
            <button
              type="button"
              id="record-nav-last"
              disabled={!canGoLast}
              onClick={onLast}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Last Record (Ctrl+End)"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
