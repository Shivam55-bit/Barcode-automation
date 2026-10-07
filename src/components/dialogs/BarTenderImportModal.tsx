import React from 'react';
import { Modal } from '../common/Modal';
import { AlertCircle, FileSpreadsheet, PlusCircle, X, FileCode } from 'lucide-react';

export interface BarTenderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  filePath?: string;
  onOpenCsv?: () => void;
  onOpenExcel?: () => void;
  onNewTemplate?: () => void;
  onSelectSupportedInterchange?: () => void;
  onExtractWithBarTender?: () => void;
}

export const BarTenderImportModal: React.FC<BarTenderImportModalProps> = ({
  isOpen,
  onClose,
  fileName = 'Document.btw',
  filePath,
  onOpenCsv,
  onOpenExcel,
  onNewTemplate,
  onSelectSupportedInterchange,
  onExtractWithBarTender,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="BarTender Document (.btw)"
      maxWidth="lg"
    >
      <div className="p-5 space-y-4 text-slate-800 font-sans text-sm">
        {/* Header Alert Banner */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-amber-900 text-[13px]">
              BarTender .btw files are not BarcodeFlow native documents
            </h4>
            <p className="text-amber-800 text-xs leading-relaxed">
              Target File: <span className="font-mono font-medium text-amber-950">{fileName}</span>
            </p>
          </div>
        </div>

        {/* Explanation & Instructions */}
        <div className="space-y-2 text-xs leading-relaxed text-slate-600">
          <p>
            Assisted <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px]">.btw</code> import requires installed, licensed BarTender Automation/Enterprise Automation with ActiveX support on Windows. Only verified objects become a partial native draft; unresolved properties remain in the report.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <div className="font-semibold text-slate-700 text-xs">Supported Options:</div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>
                Connect the label's database or spreadsheet (Excel / CSV) directly into BarcodeFlow.
              </li>
              <li>
                Create a matching native label and verify its output against the source.
              </li>
              <li>
                Open a documented BarTender observation JSON. Only verified properties are converted; remaining objects and behaviors are reported as unsupported.
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {onExtractWithBarTender && (
              <button type="button" onClick={() => { onClose(); onExtractWithBarTender(); }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded text-xs font-medium flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                Import BTW with BarTender
              </button>
            )}
            {onSelectSupportedInterchange && (
              <button
                type="button"
                onClick={() => { onClose(); onSelectSupportedInterchange(); }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded text-xs font-medium flex items-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                Open Extraction JSON
              </button>
            )}
            {onOpenExcel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExcel();
                }}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Connect Excel/CSV Data
              </button>
            )}
            {onNewTemplate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewTemplate();
                }}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                Design New Label
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
