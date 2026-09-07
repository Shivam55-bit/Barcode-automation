import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Image as ImageIcon,
  Lock
} from 'lucide-react';
import { BarcodeBatchJob, BarcodeBatchItem, LabelTemplate, PrinterDefinition, UserProfile } from '../../types';
import { UnifiedLabelCanvas } from '../canvas/UnifiedLabelCanvas';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { generatePngSnapshot } from '../../services/snapshotService';
import { generateZPL } from '../../services/zplEngine';
import { apiService } from '../../services/apiService';

interface ViewerPrintStationViewProps {
  batchJobs: BarcodeBatchJob[];
  templates: LabelTemplate[];
  printers: PrinterDefinition[];
  currentUserName: string;
  currentUser?: UserProfile;
  allUsers?: UserProfile[];
  onPrintBatch: (jobId: string, pageSelection: 'all' | number[], printerId: string) => void;
  onOpenDesigner?: (templateId: string) => void;
  onNavigateToDashboard?: () => void;
  onNavigateToWorkflow?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const ViewerPrintStationView: React.FC<ViewerPrintStationViewProps> = ({
  batchJobs,
  templates,
  printers,
  currentUserName,
  currentUser,
  allUsers,
  onPrintBatch,
  onOpenDesigner,
  onNavigateToDashboard,
  onNavigateToWorkflow,
  onSwitchUser,
  onLogout,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(batchJobs[0]?.id || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printers[0]?.id || '');
  const [printOption, setPrintOption] = useState<'all' | 'single' | 'range' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1-10');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMessage, setPrintSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState<number>(1.15);

  const selectedJob = batchJobs.find((j) => j.id === selectedJobId) || batchJobs[0];
  const selectedTemplate = templates.find((t) => t.id === selectedJob?.templateId) || templates[0];
  const selectedItem = selectedJob?.items?.find((it) => it.pageNumber === currentPage) || selectedJob?.items?.[0];

  // Log view event on mount or template switch
  useEffect(() => {
    if (selectedJob && selectedTemplate) {
      apiService.viewer
        .log({
          templateId: selectedTemplate.id,
          templateVersion: selectedTemplate.version || '1.0',
          jobId: selectedJob.id,
          action: 'VIEW',
          userName: currentUserName,
          userRole: 'Viewer / Print Operator',
          details: `Viewed page ${currentPage} of job ${selectedJob.jobCode}`,
          pagesViewedOrPrinted: `Page ${currentPage}`,
        })
        .catch(() => {});
    }
  }, [selectedJob?.id, currentPage]);

  // Record mapping for the current page
  const currentPageRecord: Record<string, string> = selectedItem ? {
    PRODUCT_NAME: selectedJob?.productName || '',
    PACK_LABEL: selectedItem.packLabel,
    BATCH_NO: selectedItem.batchNumber,
    LOT_NO: selectedItem.lotNumber,
    EXP_DATE: selectedItem.expDate,
    MFG_DATE: selectedItem.mfgDate,
    MRP: selectedItem.mrp || '$149.00',
    SERIAL_NO: selectedItem.serialNumber || `SN-${selectedItem.packNumber}`,
    FULL_BARCODE: selectedItem.fullBarcodeData,
    CODE_VAL: selectedItem.serialNumber || `SN-${selectedItem.packNumber}`,
  } : {};

  const handleExecutePrint = () => {
    if (!selectedJob) return;

    setIsPrinting(true);
    let pagesToPrint: 'all' | number[] = 'all';

    if (printOption === 'single') {
      pagesToPrint = [currentPage];
    } else if (printOption === 'range') {
      const [start, end] = customRange.split('-').map((n) => parseInt(n.trim(), 10));
      if (start && end) {
        pagesToPrint = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }

    const printerName = printers.find((p) => p.id === selectedPrinterId)?.name || 'Network Thermal Printer';

    setTimeout(() => {
      onPrintBatch(selectedJob.id, pagesToPrint, selectedPrinterId);
      setIsPrinting(false);
      setPrintSuccessMessage(`Successfully spooled 10-Page Document to ${printerName}!`);

      apiService.viewer
        .log({
          templateId: selectedTemplate.id,
          templateVersion: selectedTemplate.version || '1.0',
          jobId: selectedJob.id,
          action: 'PRINT_DISPATCH',
          userName: currentUserName,
          userRole: 'Viewer / Print Operator',
          details: `Printed ${printOption === 'all' ? 'All 10 Pages' : `Page(s) ${JSON.stringify(pagesToPrint)}`} to ${printerName}`,
          pagesViewedOrPrinted: printOption === 'all' ? 'All (1-10)' : String(pagesToPrint),
          printerName,
        })
        .catch(() => {});

      setTimeout(() => setPrintSuccessMessage(null), 4000);
    }, 600);
  };

  const handleExportPDFAllPages = async () => {
    if (!selectedJob || !selectedTemplate) return;

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
    a.download = `${selectedJob.jobCode}_10_Pages_PixelPerfect.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    apiService.viewer
      .log({
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version || '1.0',
        jobId: selectedJob.id,
        action: 'DOWNLOAD_PDF',
        userName: currentUserName,
        userRole: 'Viewer / Print Operator',
        details: `Downloaded 10-page pixel-perfect PDF for ${selectedJob.jobCode}`,
        pagesViewedOrPrinted: 'Pages 1-10',
      })
      .catch(() => {});
  };

  const handleDownloadPNGCurrentPage = async () => {
    if (!selectedTemplate || !selectedItem) return;
    try {
      const pngUrl = await generatePngSnapshot(selectedTemplate, currentPageRecord);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${selectedJob?.jobCode || 'label'}_${selectedItem.packLabel}.png`;
      a.click();

      apiService.viewer
        .log({
          templateId: selectedTemplate.id,
          templateVersion: selectedTemplate.version || '1.0',
          jobId: selectedJob?.id,
          action: 'DOWNLOAD_PNG',
          userName: currentUserName,
          userRole: 'Viewer / Print Operator',
          details: `Downloaded high-res PNG for ${selectedItem.packLabel}`,
          pagesViewedOrPrinted: `Page ${currentPage}`,
        })
        .catch(() => {});
    } catch (err) {
      console.error('PNG download error:', err);
    }
  };

  const handleDownloadZPL = () => {
    if (!selectedJob || !selectedTemplate) return;
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
    <div className="flex-1 flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 select-none">
      {/* Top Application Bar for Viewer */}
      <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-white text-xs select-none shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow-xs transition-colors"
            >
              <span>← Dashboard</span>
            </button>
          )}
          {onOpenDesigner && selectedTemplate && (
            <button
              onClick={() => onOpenDesigner(selectedTemplate.id)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition-colors"
            >
              <span>✏️ Template Builder (Studio)</span>
            </button>
          )}
          {onNavigateToWorkflow && (
            <button
              onClick={onNavigateToWorkflow}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-[11px] font-bold shadow-xs transition-colors"
            >
              <span>🛡️ Approval Workflow (Step 2)</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentUser && allUsers && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[10.5px]">Role:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const target = allUsers?.find((u) => u.id === e.target.value);
                  if (target && onSwitchUser) onSwitchUser(target);
                }}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-white outline-none font-bold"
              >
                {allUsers?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.role} ({u.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-300 font-semibold text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>PRINT STATION ACTIVE</span>
          </span>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10.5px] font-bold transition-all shadow-xs"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Printer className="w-4 h-4" />
            <span>Step 3: Viewer & Thermal Production Print Station</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Multi-Page 10-Pack Serialized Document Spooler</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Role: Viewer / Print Operator
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict read-only view with pixel-perfect unified rendering. Preview each pack page before spooling to thermal printers.
          </p>
        </div>

        {/* Action Controls Header */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadPNGCurrentPage}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Download high-resolution PNG of active page"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={handleExportPDFAllPages}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Download 10-page vector PDF"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download 10-Page PDF</span>
          </button>
          <button
            onClick={handleDownloadZPL}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileCode className="w-3.5 h-3.5 text-purple-600" />
            <span>Raw ZPL</span>
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
        {/* Left Sidebar: Dispatched Batch Jobs (w-80) */}
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
              Live Spooler
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

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
                className="p-1 hover:bg-white rounded text-slate-600"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] w-10 text-center font-bold">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                className="p-1 hover:bg-white rounded text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Central Label Canvas Preview using Unified Common Renderer */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-300 p-5 flex flex-col items-center">
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Verified Production Output Preview ({selectedItem?.packLabel || 'Pack 1'})</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {selectedTemplate?.name} (v{selectedTemplate?.version || '1.0'}) • {selectedTemplate?.dimensions.width}×{selectedTemplate?.dimensions.height} mm (Page {currentPage} of 10)
                </div>
              </div>

              {/* Pixel-Perfect Unified Canvas Render */}
              <div className="border border-dashed border-slate-300 rounded p-1 bg-white">
                {selectedTemplate && (
                  <UnifiedLabelCanvas
                    template={selectedTemplate}
                    recordData={currentPageRecord}
                    mode="viewer"
                    zoom={zoom}
                    showGrid={false}
                    showMargins={true}
                  />
                )}
              </div>

              {/* Encoded Data Inspection */}
              <div className="mt-4 w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Serialized Barcode Payload ({selectedItem?.packLabel}):</span>
                  <span className="font-mono text-blue-600">{selectedItem?.serialNumber}</span>
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

            {/* Field Lock & Security Status Card */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-bold text-amber-900 border-b border-amber-200 pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Field Security & Lock Status</span>
                </span>
                <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                  STRICT READ-ONLY
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-700">
                  <span>🔒 Layout & Geometry:</span>
                  <span className="font-bold text-amber-800">Locked (Immutable)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>🔒 Static Text / Logos:</span>
                  <span className="font-bold text-amber-800">Locked</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>⚡ Serial / Lot / Expiry:</span>
                  <span className="font-bold text-emerald-700">Dynamic Injected</span>
                </div>
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
