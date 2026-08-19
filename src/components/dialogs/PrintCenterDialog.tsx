import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LabelTemplate, PrinterDefinition, PrintJob } from '../../types';
import { Printer as PrinterIcon, CheckCircle2, AlertCircle, Settings2, Play, FileText, Cpu, Check, Layers } from 'lucide-react';
import { generateZPL, generateTSPL, generateEPL } from '../../services/zplEngine';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { EnterprisePrintSpooler } from '../../services/printSpoolerService';
import { apiService } from '../../services/apiService';

interface PrintCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  printers: PrinterDefinition[];
  recordData: Record<string, string>;
  onJobSubmitted: (job: PrintJob) => void;
}

export const PrintCenterDialog: React.FC<PrintCenterDialogProps> = ({
  isOpen,
  onClose,
  template,
  printers,
  recordData,
  onJobSubmitted,
}) => {
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printers[0]?.id || 'p-1');
  const [copies, setCopies] = useState<number>(1);
  const [darkness, setDarkness] = useState<number>(18);
  const [printSpeed, setPrintSpeed] = useState<number>(6); // ips
  const [printMethod, setPrintMethod] = useState<'thermal_transfer' | 'direct_thermal'>('thermal_transfer');
  const [outputFormat, setOutputFormat] = useState<'zpl' | 'tspl' | 'epl' | 'pdf'>('zpl');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobSuccess, setJobSuccess] = useState<string | null>(null);

  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId) || printers[0];

  const handleExecutePrint = async () => {
    setIsSubmitting(true);
    try {
      if (outputFormat === 'pdf') {
        const recordsToPrint = template.databaseConnection?.records?.length
          ? template.databaseConnection.records
          : [recordData];
        await exportLabelsToPDF(template, recordsToPrint);
      }

      const records = template.databaseConnection?.records?.length
        ? template.databaseConnection.records
        : [recordData];

      let dispatchedJob: PrintJob;
      try {
        dispatchedJob = await apiService.printJobs.dispatch({
          templateId: template.id,
          printerId: selectedPrinter.id,
          copies,
          records,
          format: outputFormat,
          submittedBy: 'David Chen (Print Operator)',
          template,
        });
      } catch {
        const spooler = EnterprisePrintSpooler.getInstance();
        dispatchedJob = spooler.dispatchJob({
          template,
          printer: selectedPrinter,
          copies,
          records,
          format: outputFormat,
          submittedBy: 'David Chen (Print Operator)',
        });
      }

      onJobSubmitted(dispatchedJob);
      setJobSuccess(`Print job #${dispatchedJob.id} dispatched to ${selectedPrinter.name} (${outputFormat.toUpperCase()}) successfully.`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        setJobSuccess(null);
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Print execution error: ${err.message}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Industrial Print Center & Spooler (BarTender Standard)" maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs text-slate-700">
        {jobSuccess ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Job Sent to Enterprise Spooler</h3>
            <p className="text-slate-600">{jobSuccess}</p>
          </div>
        ) : (
          <>
            {/* Target Printer Selection */}
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
                <PrinterIcon className="w-4 h-4 text-blue-600" />
                Select Industrial Thermal / Network Printer
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {printers.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPrinterId(p.id);
                      if (p.protocol === 'tspl') setOutputFormat('tspl');
                      else if (p.protocol === 'epl') setOutputFormat('epl');
                      else if (p.protocol === 'pdf') setOutputFormat('pdf');
                      else setOutputFormat('zpl');
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPrinterId === p.id
                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        p.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span>{p.dpi} DPI ({p.dpi === 203 ? '8 dpmm' : p.dpi === 300 ? '12 dpmm' : '24 dpmm'})</span>
                      <span>•</span>
                      <span className="font-mono">{p.ipAddress}:{p.port}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Print Parameters */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Copies / Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Printer Language Protocol</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold text-blue-900"
                >
                  <option value="zpl">ZPL II (Zebra Industrial)</option>
                  <option value="tspl">TSPL (TSC / Honeywell)</option>
                  <option value="epl">EPL2 (Eltron Legacy)</option>
                  <option value="pdf">Vector PDF Export</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Thermal Head Darkness</label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={darkness}
                  onChange={(e) => setDarkness(parseInt(e.target.value, 10))}
                  className="w-full mt-2 accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Light (1)</span>
                  <span className="font-bold text-slate-700">{darkness}</span>
                  <span>Dark (30)</span>
                </div>
              </div>
            </div>

            {/* Print Scope info */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Print Job Batch Summary</span>
                <span className="text-[10px] text-slate-500">
                  Template: <strong>{template.name}</strong> • Records: {template.databaseConnection?.records?.length || 1} • Total Labels: {copies * (template.databaseConnection?.records?.length || 1)}
                </span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded">
                Raw Direct Stream
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={onClose}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePrint}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isSubmitting ? 'Spooling...' : 'Dispatch Print Job'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
