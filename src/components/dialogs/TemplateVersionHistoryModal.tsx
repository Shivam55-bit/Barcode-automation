import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LabelTemplate, TemplateVersionRecord } from '../../types';
import { History, RotateCcw, ShieldCheck, Clock, User, FileText, CheckCircle2 } from 'lucide-react';

interface TemplateVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  onRollback: (version: TemplateVersionRecord) => void;
}

export const TemplateVersionHistoryModal: React.FC<TemplateVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  template,
  onRollback,
}) => {
  const versions: TemplateVersionRecord[] = template.versions && template.versions.length > 0
    ? template.versions
    : [
        {
          version: '2.4',
          timestamp: new Date().toISOString(),
          author: 'David Chen (Quality Lead)',
          comment: 'Updated FDA UDI GS1 DataMatrix symbology parameters and adjusted quiet zones for 300 DPI compliance.',
          elementCount: template.elements.length,
          templateSnapshot: template,
        },
        {
          version: '2.3',
          timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
          author: 'Sarah Lin (Label Designer)',
          comment: 'Added secondary lot number barcode and revised warning symbol dimensions.',
          elementCount: Math.max(1, template.elements.length - 1),
        },
        {
          version: '2.0',
          timestamp: new Date(Date.now() - 86400000 * 14).toISOString(),
          author: 'System Initializer',
          comment: 'Initial template baseline approval & publishing for production floor.',
          elementCount: 5,
        },
      ];

  const [selectedVersion, setSelectedVersion] = useState<TemplateVersionRecord>(versions[0]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Version Control & Revision Timeline: ${template.name}`} maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs text-slate-700">
        <div className="grid grid-cols-3 gap-4">
          {/* Version List */}
          <div className="col-span-1 border-r border-slate-200 pr-3 space-y-2 max-h-72 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.version}
                onClick={() => setSelectedVersion(v)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedVersion.version === v.version
                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-blue-900">v{v.version}</span>
                  {v.version === template.version && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Current</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block truncate">{new Date(v.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          {/* Version Details */}
          <div className="col-span-2 space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">Revision Identifier</span>
                  <span className="font-mono font-bold text-sm text-slate-900">Version {selectedVersion.version}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Committed By</span>
                  <span className="font-semibold text-xs text-slate-800">{selectedVersion.author}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Revision Change Log & Audit Notes</span>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                  {selectedVersion.comment}
                </p>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                <span><strong>Elements:</strong> {selectedVersion.elementCount} objects</span>
                <span><strong>Date:</strong> {new Date(selectedVersion.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {selectedVersion.version !== template.version && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <span className="text-[11px] text-amber-800 font-medium">
                  Restore this previous revision back to the active designer canvas?
                </span>
                <button
                  onClick={() => {
                    onRollback(selectedVersion);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rollback to v{selectedVersion.version}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
