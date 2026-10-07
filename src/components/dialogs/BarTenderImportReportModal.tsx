import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Printer,
  Type,
  Barcode as BarcodeIcon,
  Image as ImageIcon,
  Minus,
  Square,
  Radio,
  FileText,
  Sliders,
  Check,
} from 'lucide-react';
import { ImportReportStats } from '../../services/barTenderParser';

export interface BarTenderImportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: ImportReportStats | null;
  documentName?: string;
  onContinue?: () => void;
  onSelectAnotherPrinter?: () => void;
  onUseDefaultPrinter?: () => void;
  currentPrinterName?: string;
  isPrinterAvailable?: boolean;
  defaultPrinterName?: string;
}

export const BarTenderImportReportModal: React.FC<BarTenderImportReportModalProps> = ({
  isOpen,
  onClose,
  report,
  documentName,
  onContinue,
  onSelectAnotherPrinter,
  onUseDefaultPrinter,
  currentPrinterName,
  isPrinterAvailable,
  defaultPrinterName,
}) => {
  const [printerAssigned, setPrinterAssigned] = useState<string | null>(null);

  if (!isOpen || !report) return null;

  const docTitle = documentName || report.fileName || 'BarTender Document';
  const isPartial = report.importStatus === 'PARTIAL' || report.fullyEditable <= 1;
  const detectedPrinter = currentPrinterName || report.detectedPrinter || 'Not verified';
  const printerVerified = detectedPrinter !== 'Not verified';
  const printerUnavailable = printerVerified && (isPrinterAvailable === false || (report.printerAvailable === false && !printerAssigned));

  const handleContinue = () => {
    onClose();
    onContinue?.();
  };

  const handleUseDefault = () => {
    onUseDefaultPrinter?.();
    if (defaultPrinterName) {
      setPrinterAssigned(defaultPrinterName);
    }
  };

  const handleSelectAnother = () => {
    onSelectAnotherPrinter?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPartial ? 'Partial Import' : 'BarTender Import Completed'}
      maxWidth="lg"
    >
      <div className="p-5 space-y-4 text-slate-800 font-sans text-sm select-none">
        {/* Header Status Banner */}
        {isPartial ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <div className="p-1.5 bg-amber-600 text-white rounded-md shrink-0 mt-0.5 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-amber-950 text-sm flex items-center gap-2">
                Partial Import - Not Production-Ready
              </h4>
              <p className="text-amber-900 text-xs leading-relaxed">
                <span className="font-mono font-medium text-amber-950">{docTitle}</span>: {report.fullyEditable + report.partiallyEditable} native objects, {report.unsupported} unresolved source objects. Unavailable settings and behaviors are listed below.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-start gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-md shrink-0 mt-0.5 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-emerald-950 text-sm flex items-center gap-2">
                Structured Objects Converted to Native Elements
              </h4>
              <p className="text-emerald-800 text-xs leading-relaxed">
                Source file <span className="font-mono font-medium text-emerald-950">{docTitle}</span> was parsed and converted into individually selectable and editable canvas objects.
              </p>
            </div>
          </div>
        )}

        {report.propertyEvidence?.some(entry => entry.property === 'lineEndpoints' && entry.mapped) && (
          <div className="text-xs space-y-1">
            <h4 className="font-semibold">Mapped Source Lines (Partial)</h4>
            <ul aria-label="Mapped Source Lines" className="list-disc pl-5">
              {report.propertyEvidence.filter(entry => entry.property === 'lineEndpoints' && entry.mapped).map(entry => (
                <li key={entry.sourceName}>{entry.sourceName}: editable native line; unresolved style and printing conditions remain in the ledger.</li>
              ))}
            </ul>
          </div>
        )}

        {report.unsupportedFeatures?.length ? (
          <div className="text-xs space-y-1">
            <h4 className="font-semibold">Unresolved Source Objects ({report.unsupported})</h4>
            <ul aria-label="Unresolved Source Objects" className="list-disc pl-5 space-y-1">
              {report.unsupportedFeatures.map((feature, index) => <li key={index}>{feature}</li>)}
            </ul>
          </div>
        ) : null}

        {/* Conversion Statistics Grid */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Discovered</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{report.totalDiscovered}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Source elements</div>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-center">
            <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Native Objects</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{report.fullyEditable + report.partiallyEditable}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">{report.fullyEditable} fully mapped; {report.partiallyEditable} partial</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Fallback</div>
            <div className="text-xl font-bold text-slate-700 mt-0.5">{report.graphicFallback}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Vector / Graphic</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Unsupported</div>
            <div className="text-xl font-bold text-slate-700 mt-0.5">{report.unsupported}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Specialized</div>
          </div>
        </div>

        {/* Separate Object Categories Breakdown Grid (Requirement 4) */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Source Object Breakdown
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <Type className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.textObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Text Objects</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <BarcodeIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.barcodeObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Barcode Objects</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <Minus className="w-4 h-4 text-teal-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.lineObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Line Dividers</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <Square className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.shapeObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Shapes / Boxes</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.imageObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Images</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.unsupportedObjects ?? 0}</div>
                <div className="text-[10px] text-slate-500">Unsupported</div>
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2.5 col-span-2">
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">{report.metadataRecords ?? 0}</div>
                <div className="text-[10px] text-slate-500">Metadata / Non-Design Records</div>
              </div>
            </div>
          </div>
        </div>

        {/* PRINTER WARNING & CONFIGURATION SECTION */}
        <div className={`p-3.5 rounded-lg border space-y-2.5 ${printerUnavailable ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Printer className={`w-4 h-4 shrink-0 mt-0.5 ${printerUnavailable ? 'text-amber-600' : 'text-slate-600'}`} />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                  Target Printer: <span className="font-mono text-slate-900">{detectedPrinter}</span>
                  {printerUnavailable && (
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-semibold">
                      Unavailable Locally
                    </span>
                  )}
                  {printerAssigned && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Assigned: {printerAssigned}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {!printerVerified
                    ? 'Source printer and media compatibility are unverified. This partial draft is not a production label.'
                    : printerUnavailable
                    ? `The template references "${detectedPrinter}", which is not installed on this workstation. Label geometry (width & height) is preserved. You can continue designing normally or switch printers.`
                    : 'The source printer or an active Windows printer is configured.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Printer Actions */}
          {printerUnavailable && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {defaultPrinterName && (
                <button
                  type="button"
                  onClick={handleUseDefault}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Use Windows Default ({defaultPrinterName})
                </button>
              )}
              {onSelectAnotherPrinter && (
                <button
                  type="button"
                  onClick={handleSelectAnother}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  Select Another Printer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Verification of Indivdually Editable Objects (Requirement 7) */}
        {report.allObjectsIndividuallyEditable && !isPartial ? (
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              All converted objects (Text, Barcodes, Shapes, Lines) are <strong>verified as individually selectable and editable</strong>. You can click any object on canvas to move, resize, rotate, or edit properties. Saving creates a native <code>.bfl</code> document without altering template geometry.
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Partial Import Notice:</strong> Converted objects remain editable, but omitted objects and unverified properties prevent a complete source-label reproduction. Save as a separate native document; do not use this draft for production.
            </div>
          </div>
        )}

        {report.propertyEvidence?.length ? (
          <details className="border-t border-slate-200 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-800">Property Verification ({report.propertyEvidence.length})</summary>
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="w-full text-xs text-left">
                <thead><tr><th className="p-2">Object</th><th className="p-2">Property</th><th className="p-2">Status</th><th className="p-2">Mapped</th><th className="p-2">Evidence / Gap</th></tr></thead>
                <tbody>{report.propertyEvidence.map((entry, index) => (
                  <tr key={`${entry.sourceName}-${entry.property}-${index}`} className="border-t border-slate-100">
                    <td className="p-2 align-top">{entry.sourceName}</td><td className="p-2 align-top">{entry.property}</td>
                    <td className="p-2 align-top">{entry.status}</td><td className="p-2 align-top">{entry.mapped ? 'Yes' : 'No'}</td>
                    <td className="p-2 align-top">{entry.detail}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        ) : null}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Version: <span className="font-medium text-slate-700">{report.sourceVersion || 'BarTender'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleContinue}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              Continue Designing
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
