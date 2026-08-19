import React from 'react';
import { DatabaseConnectionConfig } from '../../types';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Database, FileSpreadsheet, Layers } from 'lucide-react';

interface RecordNavigationBarProps {
  connection?: DatabaseConnectionConfig;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenDatabaseModal: () => void;
}

export const RecordNavigationBar: React.FC<RecordNavigationBarProps> = ({
  connection,
  currentIndex,
  onSelectIndex,
  onOpenDatabaseModal,
}) => {
  const records = connection?.records || [];
  const total = records.length;
  const currentRecord = records[currentIndex] || {};

  return (
    <div className="h-9 bg-slate-100 border-t border-slate-300 flex items-center justify-between px-3 text-xs select-none text-slate-700">
      {/* Left: Active Database Indicator */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDatabaseModal}
          className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-bold text-[11px] text-slate-800 shadow-2xs transition-colors"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>{connection ? connection.name : 'No Database Connected'}</span>
          <span className="text-[9px] font-mono bg-blue-100 text-blue-800 px-1 rounded ml-1">
            {total > 0 ? `${total} Records` : 'Sample'}
          </span>
        </button>

        {total > 0 && currentRecord && (
          <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-500 font-mono pl-2 border-l border-slate-300 truncate max-w-xs">
            {Object.entries(currentRecord).slice(0, 3).map(([k, v]) => (
              <span key={k} className="truncate">
                <strong>{k}:</strong> {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: Record Stepper Controls */}
      <div className="flex items-center gap-1">
        <button
          disabled={currentIndex <= 0 || total === 0}
          onClick={() => onSelectIndex(0)}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="First Record (|<)"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        <button
          disabled={currentIndex <= 0 || total === 0}
          onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Previous Record (<)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-2 font-mono text-xs">
          <span className="font-bold text-slate-900">{total > 0 ? currentIndex + 1 : 0}</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600">{total > 0 ? total : 0}</span>
        </div>

        <button
          disabled={currentIndex >= total - 1 || total === 0}
          onClick={() => onSelectIndex(Math.min(total - 1, currentIndex + 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Next Record (>)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          disabled={currentIndex >= total - 1 || total === 0}
          onClick={() => onSelectIndex(Math.max(0, total - 1))}
          className="p-1 text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Last Record (>|)"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
