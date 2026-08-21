import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Calendar,
  DollarSign,
  Barcode,
  Hash,
  Send,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight
} from 'lucide-react';
import { LabelTemplate, BarcodeBatchJob, BarcodeBatchItem } from '../../types';

interface GenerateBarcodeModalProps {
  template: LabelTemplate;
  onGenerateAndSend?: (job: BarcodeBatchJob) => void;
  onGenerateSuccess?: (job: BarcodeBatchJob) => void;
  onClose: () => void;
  currentUserName?: string;
  isOpen?: boolean;
}

export const GenerateBarcodeModal: React.FC<GenerateBarcodeModalProps> = ({
  template,
  onGenerateAndSend,
  onGenerateSuccess,
  onClose,
  currentUserName = 'Administrator',
}) => {
  // Form fields according to enterprise requirements
  const [productName, setProductName] = useState(template.name.replace('.btw', ''));
  const [itemCode, setItemCode] = useState('ITM-MED-88910');
  const [batchNumber, setBatchNumber] = useState('BATCH-2026-X8');
  const [lotNumber, setLotNumber] = useState('LOT-9921');
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDate, setExpDate] = useState(
    new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [mrp, setMrp] = useState('$149.00');
  const [packFrom, setPackFrom] = useState<number>(1);
  const [packTo, setPackTo] = useState<number>(10);
  const [autoSendToViewer, setAutoSendToViewer] = useState(true);

  const totalPacks = Math.max(1, packTo - packFrom + 1);

  // Generate preview of items
  const generatedItems: BarcodeBatchItem[] = Array.from({ length: totalPacks }, (_, idx) => {
    const packNum = packFrom + idx;
    const pageNum = idx + 1;
    const serial = `SN-${batchNumber.replace(/[^a-zA-Z0-9]/g, '')}-${String(packNum).padStart(4, '0')}`;
    const barcodeVal = `(01)00850006539987(17)${expDate.replace(/-/g, '').slice(2)}(10)${lotNumber}(21)${serial}`;

    return {
      pageNumber: pageNum,
      packNumber: packNum,
      packLabel: `Pack ${packNum}`,
      itemCode,
      batchNumber,
      lotNumber,
      mfgDate,
      expDate,
      mrp,
      serialNumber: serial,
      fullBarcodeData: barcodeVal,
      isPrinted: false,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newJob: BarcodeBatchJob = {
      id: `BAT-${Date.now().toString().slice(-6)}`,
      jobCode: `BAT-2026-${Math.floor(100 + Math.random() * 900)}`,
      templateId: template.id,
      templateName: template.name,
      productName,
      itemCode,
      batchNumber,
      lotNumber,
      mfgDate,
      expDate,
      mrp,
      packFrom,
      packTo,
      totalPages: totalPacks,
      items: generatedItems,
      status: autoSendToViewer ? 'sent_to_viewer' : 'barcode_generated',
      generatedBy: currentUserName,
      generatedAt: new Date().toLocaleString(),
      sentToViewerAt: autoSendToViewer ? new Date().toLocaleString() : undefined,
    };

    if (onGenerateAndSend) {
      onGenerateAndSend(newJob);
    }
    if (onGenerateSuccess) {
      onGenerateSuccess(newJob);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Admin: Generate Serialized Barcodes & 10-Page Document</h2>
                <span className="bg-emerald-500/30 border border-emerald-400 text-emerald-100 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Approved Template
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Template: <span className="font-semibold text-white">{template.name}</span> ({template.dimensions.width}×{template.dimensions.height} mm)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <span className="font-bold">Automated 10-Page Multi-Pack Serialization:</span> Generating this job creates 
              individualized unique barcode labels for each pack (Pack 1 to Pack {totalPacks}), stamping batch, lot, expiry, 
              and dynamic GS1 data. Once generated, it will be automatically dispatched to the Viewer / Print Operator station.
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Item / SKU Code</label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number</label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lot Number</label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mfg Date</label>
              <input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Exp Date</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MRP / Unit Price</label>
              <input
                type="text"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pack From (Start)</label>
              <input
                type="number"
                min="1"
                max={packTo}
                value={packFrom}
                onChange={(e) => setPackFrom(parseInt(e.target.value) || 1)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pack To (End - default 10)</label>
              <input
                type="number"
                min={packFrom}
                max="50"
                value={packTo}
                onChange={(e) => setPackTo(parseInt(e.target.value) || 10)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Generated Pages Preview Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Generated 10-Page Serialized Sequence ({totalPacks} Labels)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Each page corresponds to 1 Pack label
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Page #</th>
                      <th className="py-2 px-3">Pack Label</th>
                      <th className="py-2 px-3">Serial Number</th>
                      <th className="py-2 px-3">Lot / Batch</th>
                      <th className="py-2 px-3">Encoded Barcode Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {generatedItems.map((item) => (
                      <tr key={item.pageNumber} className="hover:bg-blue-50/50">
                        <td className="py-1.5 px-3 font-bold text-blue-700">Page {item.pageNumber}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-900 bg-slate-50/80">{item.packLabel}</td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-slate-700">{item.serialNumber}</td>
                        <td className="py-1.5 px-3 text-[11px] text-slate-600">{item.lotNumber} / {item.batchNumber}</td>
                        <td className="py-1.5 px-3 font-mono text-[10px] text-slate-500 truncate max-w-xs">{item.fullBarcodeData}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Direct Send to Viewer checkbox */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sendToViewerCheck"
                checked={autoSendToViewer}
                onChange={(e) => setAutoSendToViewer(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="sendToViewerCheck" className="text-xs text-slate-700 cursor-pointer">
                <span className="font-bold text-slate-900 block">Step 5: Send Directly to Viewer for Printing</span>
                <span className="text-[11px] text-slate-500">Automatically push this serialized 10-page document to the Viewer / Print Operator station for execution.</span>
              </label>
            </div>
            <Send className="w-4 h-4 text-blue-600 shrink-0" />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Barcode className="w-4 h-4" />
              <span>Generate Barcodes & Dispatch to Viewer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
