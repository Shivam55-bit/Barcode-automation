import React from 'react';
import { DatabaseConnectionConfig, LabelTemplate } from '../../types';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Database, FileSpreadsheet, Layers } from 'lucide-react';

interface RecordNavigationBarProps {
  connection?: DatabaseConnectionConfig;
  template?: LabelTemplate;
  currentIndex?: number;
  currentRecordIndex?: number;
  totalRecords?: number;
  onSelectIndex?: (index: number) => void;
  onSelectRecordIndex?: (index: number) => void;
  onOpenDatabaseModal?: () => void;
  onOpenDataConnector?: () => void;
  onImportCSV?: () => void;
}

export const RecordNavigationBar: React.FC<RecordNavigationBarProps> = ({
  connection,
  template,
  currentIndex,
  currentRecordIndex,
  totalRecords,
  onSelectIndex,
  onSelectRecordIndex,
  onOpenDatabaseModal,
  onOpenDataConnector,
  onImportCSV,
}) => {
  const activeIndex = currentIndex ?? currentRecordIndex ?? 0;
  const handleSelect = onSelectIndex || onSelectRecordIndex || (() => {});
  const handleOpenDB = onOpenDatabaseModal || onOpenDataConnector || (() => {});

  const sampleRecs = template?.sampleRecords || [];
  const connRecords = connection?.records || [];
  const records = connRecords.length > 0 ? connRecords : sampleRecs;
  const total = totalRecords ?? records.length;
  const currentRecord = records[activeIndex] || {};

  return (
    <div className="h-9 bg-slate-100 border-t border-slate-300 flex items-center justify-between px-3 text-xs select-none text-slate-700">
      {/* Left: Active Database Indicator */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleOpenDB()}
          className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-bold text-[11px] text-slate-800 shadow-2xs transition-colors cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>{connection ? connection.name : template ? `Dataset: ${template.name}` : 'No Database Connected'}</span>
          <span className="text-[9px] font-mono bg-blue-100 text-blue-800 px-1 rounded ml-1">
            {total > 0 ? `${total} Records` : 'Sample'}
          </span>
        </button>

        {onImportCSV && (
          <button
            type="button"
            onClick={onImportCSV}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-medium cursor-pointer"
          >
            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
            <span>Import CSV</span>
          </button>
        )}

        {total > 0 && currentRecord && (
          <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-500 font-mono pl-2 border-l border-slate-300 truncate max-w-xs">
            {Object.entries(currentRecord).slice(0, 3).map(([k, v]) => (
              <span key={k} className="truncate">
                <strong>{k}:</strong> {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: Record Stepper Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={activeIndex <= 0 || total === 0}
          onClick={() => handleSelect(0)}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          title="First Record (|<)"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={activeIndex <= 0 || total === 0}
          onClick={() => handleSelect(Math.max(0, activeIndex - 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          title="Previous Record (<)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-2 font-mono text-xs">
          <span className="font-bold text-slate-900">{total > 0 ? activeIndex + 1 : 0}</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600">{total > 0 ? total : 0}</span>
        </div>

        <button
          type="button"
          disabled={activeIndex >= total - 1 || total === 0}
          onClick={() => handleSelect(Math.min(total - 1, activeIndex + 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          title="Next Record (>)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={activeIndex >= total - 1 || total === 0}
          onClick={() => handleSelect(Math.max(0, total - 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          title="Last Record (>|)"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
