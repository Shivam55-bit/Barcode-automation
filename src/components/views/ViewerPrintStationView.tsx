import React, { useState, useRef } from 'react';
import {
  Printer,
  FileText,
  CheckCircle2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileCode,
  ShieldCheck,
  Clock,
  Sparkles,
  Barcode,
  Search,
  Filter,
  Check
} from 'lucide-react';
import { BarcodeBatchJob, BarcodeBatchItem, LabelTemplate, PrinterDefinition } from '../../types';
import { DesignerCanvas } from '../canvas/DesignerCanvas';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { generateZPL } from '../../services/zplEngine';

interface ViewerPrintStationViewProps {
  batchJobs: BarcodeBatchJob[];
  templates: LabelTemplate[];
  printers: PrinterDefinition[];
  currentUserName: string;
  onPrintBatch: (jobId: string, pageSelection: 'all' | number[], printerId: string) => void;
  onOpenDesigner?: (templateId: string) => void;
}

export const ViewerPrintStationView: React.FC<ViewerPrintStationViewProps> = ({
  batchJobs,
  templates,
  printers,
  currentUserName,
  onPrintBatch,
  onOpenDesigner,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(batchJobs[0]?.id || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printers[0]?.id || '');
  const [printOption, setPrintOption] = useState<'all' | 'single' | 'range' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1-10');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMessage, setPrintSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedJob = batchJobs.find((j) => j.id === selectedJobId) || batchJobs[0];
  const selectedTemplate = templates.find((t) => t.id === selectedJob?.templateId) || templates[0];
  const selectedItem = selectedJob?.items?.find((it) => it.pageNumber === currentPage) || selectedJob?.items?.[0];

  // Helper to resolve dynamic values for this page on the canvas
  const getPageTemplateWithData = (item: BarcodeBatchItem | undefined): LabelTemplate => {
    if (!item || !selectedTemplate) return selectedTemplate;

    const modifiedTemplate: LabelTemplate = JSON.parse(JSON.stringify(selectedTemplate));
    
    // Inject values into elements
    modifiedTemplate.elements = modifiedTemplate.elements.map((el) => {
      if (el.type === 'text') {
        let text = el.text;
        text = text.replace(/{{PACK_LABEL}}/g, item.packLabel);
        text = text.replace(/{{PRODUCT_NAME}}/g, selectedJob.productName);
        text = text.replace(/{{BATCH_NO}}/g, item.batchNumber);
        text = text.replace(/{{LOT_NO}}/g, item.lotNumber);
        text = text.replace(/{{EXP_DATE}}/g, item.expDate);
        text = text.replace(/{{MFG_DATE}}/g, item.mfgDate);
        text = text.replace(/{{MRP}}/g, item.mrp || '$149.00');
        text = text.replace(/{{SERIAL_NO}}/g, item.serialNumber || `SN-${item.packNumber}`);
        return { ...el, text };
      }
      if (el.type === 'barcode') {
        let val = el.value;
        if (el.symbology === 'datamatrix' || el.symbology === 'gs1-128' || el.symbology === 'qr') {
          val = item.fullBarcodeData;
        } else {
          val = item.serialNumber || `SN-${item.packNumber}`;
        }
        return { ...el, value: val };
      }
      return el;
    });

    return modifiedTemplate;
  };

  const handleExecutePrint = () => {
    if (!selectedJob) return;

    setIsPrinting(true);
    let pagesToPrint: 'all' | number[] = 'all';

    if (printOption === 'single') {
      pagesToPrint = [currentPage];
    } else if (printOption === 'range') {
      const [start, end] = customRange.split('-').map(n => parseInt(n.trim()));
      if (start && end) {
        pagesToPrint = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }

    setTimeout(() => {
      onPrintBatch(selectedJob.id, pagesToPrint, selectedPrinterId);
      setIsPrinting(false);
      setPrintSuccessMessage(`Successfully spooled 10-Page Document to ${printers.find(p => p.id === selectedPrinterId)?.name || 'Printer'}!`);
      setTimeout(() => setPrintSuccessMessage(null), 4000);
    }, 600);
  };

  const handleExportPDFAllPages = async () => {
    if (!selectedJob) return;
    
    // Generate multi-record dataset
    const records = selectedJob.items.map((it) => ({
      PRODUCT_NAME: selectedJob.productName,
      PACK_LABEL: it.packLabel,
      BATCH_NO: it.batchNumber,
      LOT_NO: it.lotNumber,
      EXP_DATE: it.expDate,
      MFG_DATE: it.mfgDate,
      MRP: it.mrp || '$149.00',
      SERIAL_NO: it.serialNumber || `SN-${it.packNumber}`,
      FULL_BARCODE: it.fullBarcodeData,
      CODE_VAL: it.serialNumber || `SN-${it.packNumber}`,
    }));

    const pdfBlob = await exportLabelsToPDF(selectedTemplate, records, 1);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob.jobCode}_10_Pages.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZPL = () => {
    if (!selectedJob) return;
    const zplPages = selectedJob.items.map((it) => {
      const record = {
        PRODUCT_NAME: selectedJob.productName,
        PACK_LABEL: it.packLabel,
        BATCH_NO: it.batchNumber,
        LOT_NO: it.lotNumber,
        EXP_DATE: it.expDate,
        MFG_DATE: it.mfgDate,
        MRP: it.mrp || '$149.00',
        SERIAL_NO: it.serialNumber || `SN-${it.packNumber}`,
        FULL_BARCODE: it.fullBarcodeData,
        CODE_VAL: it.serialNumber || `SN-${it.packNumber}`,
      };
      return generateZPL(selectedTemplate, record);
    });

    const combinedZpl = zplPages.join('\n\n');
    const blob = new Blob([combinedZpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob.jobCode}_10_Pages.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredJobs = batchJobs.filter(
    (j) =>
      j.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.templateName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 text-slate-800 select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Printer className="w-4 h-4" />
            <span>Step 6: Viewer / Print Operator Station</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Multi-Page 10-Pack Serialized Document Spooler</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Role: Viewer / Print Operator
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Received from Admin after approval. Preview each page (Pack 1 to Pack 10) before executing final thermal batch print.
          </p>
        </div>

        {/* Print Execution Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDFAllPages}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 10-Page PDF</span>
          </button>
          <button
            onClick={handleDownloadZPL}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw 10-Page ZPL</span>
          </button>
          <button
            onClick={handleExecutePrint}
            disabled={isPrinting || !selectedJob}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all transform active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Spooling Batch...' : 'PRINT 10-PAGE DOCUMENT'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {printSuccessMessage && (
        <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{printSuccessMessage}</span>
          </div>
          <button onClick={() => setPrintSuccessMessage(null)} className="text-emerald-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Dispatched Batch Jobs */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3.5 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 flex items-center justify-between">
            <span>INCOMING PRINT JOBS ({filteredJobs.length})</span>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
              Live Queue
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredJobs.map((job) => {
              const isSelected = job.id === selectedJobId;
              return (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{job.jobCode}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.status === 'printed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {job.status === 'printed' ? 'PRINTED' : 'READY TO PRINT'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate">{job.productName}</div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{job.totalPages} Pages (Packs {job.packFrom}-{job.packTo})</span>
                    <span className="font-mono text-[10px]">{job.batchNumber}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Dispatched by {job.generatedBy} • {job.generatedAt}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Live 10-Page Preview & Multi-Page Navigation */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-200/70 relative">
          {/* Top Pagination & Pack Toolbar */}
          <div className="bg-white/90 backdrop-blur-xs border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-2xs z-10">
            {/* Page Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white disabled:opacity-40 text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Page</span>
                  <span className="bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200 text-blue-700 font-mono">
                    {currentPage}
                  </span>
                  <span>of {selectedJob?.totalPages || 10}</span>
                </div>
                <button
                  disabled={currentPage >= (selectedJob?.totalPages || 10)}
                  onClick={() => setCurrentPage((p) => Math.min(selectedJob?.totalPages || 10, p + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white disabled:opacity-40 text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Pack Pill Quick Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
                {selectedJob?.items.map((it) => (
                  <button
                    key={it.pageNumber}
                    onClick={() => setCurrentPage(it.pageNumber)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      currentPage === it.pageNumber
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {it.packLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Item Specs */}
            {selectedItem && (
              <div className="hidden lg:flex items-center gap-3 text-xs bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-500">Serial:</span>
                <span className="font-mono font-bold text-slate-800">{selectedItem.serialNumber}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Lot:</span>
                <span className="font-mono font-semibold text-slate-700">{selectedItem.lotNumber}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Exp:</span>
                <span className="font-medium text-slate-700">{selectedItem.expDate}</span>
              </div>
            )}
          </div>

          {/* Central Label Canvas Preview */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div className="bg-white rounded-xl shadow-xl border border-slate-300 p-4 flex flex-col items-center">
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Live Thermal Label Preview ({selectedItem?.packLabel || 'Pack 1'})
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedTemplate?.name} • {selectedTemplate?.dimensions.width}×{selectedTemplate?.dimensions.height} mm (Page {currentPage} of 10)
                </div>
              </div>

              {/* Dynamic Render of Canvas */}
              <div className="border border-dashed border-slate-300 rounded p-1 bg-white">
                <DesignerCanvas
                  template={getPageTemplateWithData(selectedItem)}
                  selectedElementIds={[]}
                  activeTool="select"
                  viewport={{
                    zoom: 1.2,
                    panX: 0,
                    panY: 0,
                    showGrid: false,
                    showRulers: false,
                    showGuides: false,
                    showMargins: true,
                    snapToGrid: false,
                    snapToElements: false,
                    gridSize: 5,
                    unit: 'mm',
                    previewRecordIndex: 0,
                  }}
                  onSelectElement={() => {}}
                  onUpdateElement={() => {}}
                  onAddElement={() => {}}
                  onUpdateDimensions={() => {}}
                />
              </div>

              {/* Encoded Data Inspection */}
              <div className="mt-4 w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Encoded Barcode Payload:</span>
                  <span className="font-mono text-blue-600">{selectedItem?.packLabel}</span>
                </div>
                <div className="font-mono text-[11px] bg-white border border-slate-200 rounded p-1.5 text-slate-800 break-all select-text">
                  {selectedItem?.fullBarcodeData}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Thermal Printer Routing & Batch Controls */}
        <div className="w-84 bg-white border-l border-slate-200 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Print Spooler Destination
              </h3>
              <p className="text-[11px] text-slate-500">
                Select target network thermal printer for this 10-page document
              </p>
            </div>

            {/* Printer Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Target Printer</label>
              <select
                value={selectedPrinterId}
                onChange={(e) => setSelectedPrinterId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.brand} - {p.dpi} DPI)
                  </option>
                ))}
              </select>
            </div>

            {/* Print Range Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Page Selection</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="printOpt"
                    checked={printOption === 'all'}
                    onChange={() => setPrintOption('all')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">Print Entire 10-Page Document (Packs 1-10)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="printOpt"
                    checked={printOption === 'single'}
                    onChange={() => setPrintOption('single')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Print Current Page Only ({selectedItem?.packLabel || 'Page 1'})</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="printOpt"
                    checked={printOption === 'range'}
                    onChange={() => setPrintOption('range')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Custom Range:</span>
                </label>
                {printOption === 'range' && (
                  <input
                    type="text"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="e.g. 1-5"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono"
                  />
                )}
              </div>
            </div>

            {/* Document Metadata Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>10-Page Batch Summary</span>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                  {selectedJob?.jobCode}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Product:</span>
                <span className="font-semibold text-slate-800 text-right">{selectedJob?.productName}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Packs:</span>
                <span className="font-bold text-indigo-700">{selectedJob?.totalPages} Packs (Pages)</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Batch / Lot:</span>
                <span className="font-mono text-slate-700">{selectedJob?.batchNumber} / {selectedJob?.lotNumber}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Dispatched:</span>
                <span className="text-slate-600">{selectedJob?.generatedAt}</span>
              </div>
            </div>
          </div>

          {/* Action Trigger in Sidebar */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={handleExecutePrint}
              disabled={isPrinting || !selectedJob}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Transmitting to Thermal Printer...' : 'EXECUTE PRINT JOB'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              Sends raw thermal commands directly over TCP Port 9100
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
