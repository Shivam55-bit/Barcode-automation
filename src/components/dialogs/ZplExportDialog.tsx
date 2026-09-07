import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LabelTemplate } from '../../types';
import { generateZplCode, generateEplCode } from '../../services/zplEngine';
import { Copy, Download, Check, Cpu, Terminal, FileCode } from 'lucide-react';

interface ZplExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  recordData: Record<string, string>;
}

export const ZplExportDialog: React.FC<ZplExportDialogProps> = ({
  isOpen,
  onClose,
  template,
  recordData,
}) => {
  const [activeLang, setActiveLang] = useState<'zpl' | 'epl'>('zpl');
  const [copied, setCopied] = useState(false);

  const zpl = generateZplCode(template, recordData);
  const epl = generateEplCode(template, recordData);
  const currentCode = activeLang === 'zpl' ? zpl : epl;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '_')}.${activeLang === 'zpl' ? 'zpl' : 'epl'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Industrial Thermal Printer Code (ZPL-II / EPL-II)" maxWidth="max-w-3xl">
      <div className="space-y-3 text-xs text-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveLang('zpl')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-colors ${
                activeLang === 'zpl' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zebra ZPL-II</span>
            </button>
            <button
              onClick={() => setActiveLang('epl')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-colors ${
                activeLang === 'epl' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Eltron EPL-II</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-700 shadow-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded font-semibold text-white shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Code View Area */}
        <div className="bg-slate-950 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96 border border-slate-800 shadow-inner select-text">
          <pre className="whitespace-pre-wrap">{currentCode}</pre>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
          <span>Target Resolution: {template.dimensions.dpi} DPI ({template.dimensions.dpi === 203 ? '8 dpmm' : template.dimensions.dpi === 300 ? '12 dpmm' : '24 dpmm'})</span>
          <span>Size: {template.dimensions.width} x {template.dimensions.height} mm</span>
        </div>
      </div>
    </Modal>
  );
};
