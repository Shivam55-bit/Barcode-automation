import React, { useState } from 'react';
import { ObjectEventHook } from '../../types';
import { X, Code2, Play, CheckCircle2, AlertCircle } from 'lucide-react';

interface DocumentEventScriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveScripts?: (scripts: Record<string, string>) => void;
}

const EVENTS = [
  { id: 'OnStartJob', label: 'OnStartJob', description: 'Executed once when the print job begins before any records are processed.' },
  { id: 'OnEndJob', label: 'OnEndJob', description: 'Executed once after all records and labels in the print job have completed.' },
  { id: 'OnNewRecord', label: 'OnNewRecord', description: 'Executed each time a new database record is loaded for formatting.' },
  { id: 'OnPrePrint', label: 'OnPrePrint', description: 'Executed immediately prior to rendering the label graphics/streams.' },
  { id: 'OnPostPrint', label: 'OnPostPrint', description: 'Executed immediately after a label copy has been dispatched to the spooler.' },
  { id: 'OnSerialize', label: 'OnSerialize', description: 'Executed when serial counters and dynamic increment variables advance.' },
];

export const DocumentEventScriptsModal: React.FC<DocumentEventScriptsModalProps> = ({
  isOpen,
  onClose,
  onSaveScripts,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<string>('OnNewRecord');
  const [scripts, setScripts] = useState<Record<string, string>>({
    OnStartJob: '// Global Job Init\nconsole.log("Print job started at " + new Date().toISOString());',
    OnNewRecord: '// Access fields using record.FIELD_NAME\nif (record.PRICE && Number(record.PRICE) > 100) {\n  record.DISCOUNT = "10%";\n}',
    OnPrePrint: '// Final transform before rasterizing/ZPL generation\n// Value = Value.trim().toUpperCase();',
    OnSerialize: '// Custom serialization\n// Value = "SN-" + pad(Counter, 6);',
    OnPostPrint: '// Post print verification\n// console.log("Label printed successfully");',
    OnEndJob: '// Cleanup at end of print batch',
  });

  const [testOutput, setTestOutput] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestScript = () => {
    try {
      const code = scripts[selectedEvent] || '';
      const dummyRecord: Record<string, any> = {
        SKU: 'SKU-99482',
        PRICE: '120.00',
        LOT: 'LOT-2026-X89',
      };
      // Safe simulation
      const fn = new Function('record', 'console', `${code}; return record;`);
      const logs: string[] = [];
      const mockConsole = {
        log: (...args: any[]) => logs.push(args.join(' ')),
      };
      const result = fn(dummyRecord, mockConsole);
      setTestOutput(`✅ Executed successfully.\nLogs: ${logs.join('\n') || 'None'}\nUpdated Record: ${JSON.stringify(result, null, 2)}`);
    } catch (err: any) {
      setTestOutput(`❌ Script Error: ${err.message}`);
    }
  };

  const handleSave = () => {
    if (onSaveScripts) {
      onSaveScripts(scripts);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[740px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Code2 className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              BarTender Document-Level Event Control Scripts (VBScript / JavaScript)
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
        <div className="flex flex-1 min-h-[380px] max-h-[480px] bg-white">
          {/* Left Events List */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 p-2 space-y-1 select-none">
            <div className="text-[11px] font-bold text-slate-500 uppercase px-1 mb-1">Event Hooks</div>
            {EVENTS.map((ev) => (
              <div
                key={ev.id}
                onClick={() => {
                  setSelectedEvent(ev.id);
                  setTestOutput(null);
                }}
                className={`p-2 rounded-xs cursor-pointer transition-colors ${
                  selectedEvent === ev.id ? 'bg-[#0078d7] text-white font-bold' : 'hover:bg-slate-200 text-slate-800'
                }`}
              >
                <div className="text-xs font-mono">{ev.label}</div>
                <div className={`text-[10px] truncate ${selectedEvent === ev.id ? 'text-blue-100' : 'text-slate-500'}`}>
                  {scripts[ev.id]?.length ? '• Script configured' : 'Empty'}
                </div>
              </div>
            ))}
          </div>

          {/* Right Editor */}
          <div className="flex-1 p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="font-bold text-slate-900 text-xs font-mono">{selectedEvent}</div>
                  <div className="text-[11px] text-slate-500">
                    {EVENTS.find((e) => e.id === selectedEvent)?.description}
                  </div>
                </div>

                <button
                  onClick={handleTestScript}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Test Script</span>
                </button>
              </div>

              <textarea
                rows={11}
                value={scripts[selectedEvent] || ''}
                onChange={(e) => setScripts({ ...scripts, [selectedEvent]: e.target.value })}
                className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="// Enter JavaScript / VBScript simulation here..."
              />

              {testOutput && (
                <div className="p-2.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {testOutput}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={handleSave}
            className="px-5 py-1 bg-[#0078d7] hover:bg-[#005a9e] text-white border border-[#005a9e] rounded-xs text-[12px] font-bold shadow-2xs cursor-pointer min-w-[70px]"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-slate-800 text-[12px] font-medium shadow-2xs cursor-pointer min-w-[70px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
