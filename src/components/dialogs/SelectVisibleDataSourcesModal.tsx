import React from 'react';
import { DataSourceItem } from '../../types';
import { X, Database, Hash, Clock, Globe, Code2, Layers, Link as LinkIcon, Variable } from 'lucide-react';

interface SelectVisibleDataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSources: DataSourceItem[];
  visibleSourceIds: string[];
  onChangeVisibleSourceIds: (sourceIds: string[]) => void;
}

export const SelectVisibleDataSourcesModal: React.FC<SelectVisibleDataSourcesModalProps> = ({
  isOpen,
  onClose,
  dataSources = [],
  visibleSourceIds = [],
  onChangeVisibleSourceIds,
}) => {
  if (!isOpen) return null;

  const handleToggle = (sourceId: string) => {
    const isCurrentlyVisible = visibleSourceIds.includes(sourceId);
    let nextIds: string[];
    if (isCurrentlyVisible) {
      nextIds = visibleSourceIds.filter((id) => id !== sourceId);
    } else {
      nextIds = [...visibleSourceIds, sourceId];
    }
    onChangeVisibleSourceIds(nextIds);
  };

  const getSourceIcon = (ds: DataSourceItem) => {
    switch (ds.type) {
      case 'database':
      case 'database-field':
        return <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
      case 'serial':
        return <Hash className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
      case 'clock':
        return <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      case 'gs1_ai':
      case 'gs1_databar':
        return <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'gs1_composite':
        return <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
      case 'script':
        return <Code2 className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
      case 'variable':
        return <Variable className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
      case 'linked':
        return <LinkIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
      default:
        return (
          <div className="w-3.5 h-3.5 bg-[#004b98] text-white flex flex-col items-center justify-center rounded-[1px] shadow-2xs shrink-0">
            <svg width="9" height="3" viewBox="0 0 9 3">
              <rect x="0" y="0" width="1" height="3" fill="white" />
              <rect x="2" y="0" width="1.2" height="3" fill="white" />
              <rect x="4" y="0" width="1" height="3" fill="white" />
              <rect x="6" y="0" width="1.2" height="3" fill="white" />
              <rect x="8" y="0" width="1" height="3" fill="white" />
            </svg>
            <span className="text-[5px] font-bold font-mono tracking-tighter leading-none text-blue-100 -mt-0.2">
              BT
            </span>
          </div>
        );
    }
  };

  const getDisplayName = (ds: DataSourceItem, idx: number) => {
    if (ds.name && ds.name.trim()) return ds.name;
    if (ds.type === 'database' || ds.type === 'database-field') return ds.field || ds.databaseField || `Data Source ${idx + 1}`;
    if (ds.type === 'serial') return `Serial Number (${ds.value || '1'})`;
    if (ds.type === 'clock') return `Clock (${ds.dateFormat || 'YYYY-MM-DD'})`;
    if (ds.type === 'gs1_ai') return `GS1 AI ${ds.value ? ds.value : 'Data'}`;
    return ds.value ? `${ds.value}` : `Data Source ${idx + 1}`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 select-none animate-in fade-in duration-100 font-sans">
      <div
        className="w-[460px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching BarTender style */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
          <span className="font-semibold text-slate-900 text-[12.5px]">Select Visible Data Sources</span>
          <button
            onClick={onClose}
            className="w-6 h-5 flex items-center justify-center hover:bg-slate-300/80 rounded-xs text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="p-3.5 bg-[#f8fafc]">
          <div className="border border-[#94a3b8] bg-white rounded-xs p-2 min-h-[190px] max-h-[260px] overflow-y-auto space-y-1 shadow-inner">
            {dataSources.length === 0 ? (
              <div className="text-slate-400 italic text-center py-8">No data sources configured</div>
            ) : (
              dataSources.map((ds, idx) => {
                const sourceId = ds.id || `ds-${idx}`;
                const isChecked = visibleSourceIds.includes(sourceId);
                const name = getDisplayName(ds, idx);

                return (
                  <label
                    key={sourceId}
                    className={`flex items-center gap-2 px-2 py-1 rounded-xs cursor-pointer text-[12px] transition-colors ${
                      isChecked ? 'bg-[#e5f3ff] text-slate-900 font-medium' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(sourceId)}
                      className="w-4 h-4 accent-[#0078d7] rounded-xs cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getSourceIcon(ds)}
                      <span className="truncate">{name}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Buttons matching BarTender: Close and Help */}
        <div className="border-t border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="min-w-[90px] px-4 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-800 font-medium text-[11.5px] shadow-2xs cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="min-w-[90px] px-4 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-800 font-medium text-[11.5px] shadow-2xs cursor-pointer"
          >
            Help
          </button>
        </div>
      </div>
    </div>
  );
};
