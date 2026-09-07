import React, { useState } from 'react';
import { VariableDefinition, VariableType } from '../../types';
import { X, Plus, Trash2, Link as LinkIcon, Database, Hash, Sparkles } from 'lucide-react';

interface NamedDataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: VariableDefinition[];
  onUpdateVariables: (variables: VariableDefinition[]) => void;
}

export const NamedDataSourcesModal: React.FC<NamedDataSourcesModalProps> = ({
  isOpen,
  onClose,
  variables,
  onUpdateVariables,
}) => {
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(0);
  const [varList, setVarList] = useState<VariableDefinition[]>(variables || []);

  if (!isOpen) return null;

  const currentVar = varList[selectedVarIndex] || varList[0];

  const handleUpdateCurrent = (updates: Partial<VariableDefinition>) => {
    const updated = varList.map((v, i) => (i === selectedVarIndex ? { ...v, ...updates } : v));
    setVarList(updated);
    onUpdateVariables(updated);
  };

  const handleAddNew = () => {
    const newVar: VariableDefinition = {
      id: `var-${Date.now()}`,
      name: `Named_Source_${varList.length + 1}`,
      type: 'static',
      defaultValue: 'Sample Value',
    };
    const nextList = [...varList, newVar];
    setVarList(nextList);
    setSelectedVarIndex(nextList.length - 1);
    onUpdateVariables(nextList);
  };

  const handleDeleteCurrent = () => {
    if (varList.length <= 1) {
      alert('Must keep at least one named data source.');
      return;
    }
    const nextList = varList.filter((_, i) => i !== selectedVarIndex);
    setVarList(nextList);
    setSelectedVarIndex(Math.max(0, selectedVarIndex - 1));
    onUpdateVariables(nextList);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[660px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <LinkIcon className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Named Data Sources Manager (Global Variables)
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="w-6 h-5 flex items-center justify-center hover:bg-slate-300 text-slate-700 rounded-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-[360px] max-h-[460px] bg-white">
          {/* Left List */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col justify-between">
            <div className="p-2 space-y-1 overflow-y-auto max-h-[380px]">
              <div className="text-[11px] font-bold text-slate-500 uppercase px-1">
                Named Data Sources ({varList.length})
              </div>
              {varList.map((v, idx) => (
                <div
                  key={v.id || idx}
                  onClick={() => setSelectedVarIndex(idx)}
                  className={`p-2 rounded-xs flex items-center gap-2 cursor-pointer transition-colors ${
                    idx === selectedVarIndex ? 'bg-[#0078d7] text-white font-bold' : 'hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{v.name}</span>
                </div>
              ))}
            </div>

            <div className="p-2 bg-slate-200 border-t border-slate-300 flex items-center justify-between">
              <button
                onClick={handleAddNew}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
              <button
                onClick={handleDeleteCurrent}
                className="p-1 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Configuration Form */}
          {currentVar && (
            <div className="flex-1 p-5 space-y-4 overflow-y-auto text-[12px]">
              <div className="space-y-1">
                <label className="text-slate-700 font-medium">Variable Identifier / Name:</label>
                <input
                  type="text"
                  value={currentVar.name}
                  onChange={(e) => handleUpdateCurrent({ name: e.target.value })}
                  className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-mono font-bold text-slate-900"
                />
                <span className="text-[11px] text-slate-500">
                  Referenced in barcodes/text as <code>{'{{' + currentVar.name + '}}'}</code>
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-medium">Data Source Type:</label>
                <select
                  value={currentVar.type}
                  onChange={(e) => handleUpdateCurrent({ type: e.target.value as VariableType })}
                  className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-medium"
                >
                  <option value="static">Static Constant Value</option>
                  <option value="counter">Sequential Number Counter</option>
                  <option value="date">Dynamic Date Offset</option>
                  <option value="time">Dynamic Time</option>
                  <option value="csv">Connected Database Record</option>
                  <option value="gs1_ai">GS1 Application Identifier</option>
                  <option value="formula">JavaScript Formula Expression</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-medium">Default / Sample Value:</label>
                <input
                  type="text"
                  value={currentVar.defaultValue || ''}
                  onChange={(e) => handleUpdateCurrent({ defaultValue: e.target.value })}
                  className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900"
                />
              </div>

              {currentVar.type === 'counter' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 block">Start Counter:</label>
                    <input
                      type="number"
                      value={currentVar.counterStart || 1}
                      onChange={(e) => handleUpdateCurrent({ counterStart: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Step / Increment:</label>
                    <input
                      type="number"
                      value={currentVar.counterStep || 1}
                      onChange={(e) => handleUpdateCurrent({ counterStep: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[12px] font-medium shadow-2xs cursor-pointer min-w-[80px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
