import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { PrinterModel } from '../../printer/types';
import { PrinterService } from '../../printer/printerService';
import {
  Printer,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Activity,
  Cpu,
  Zap,
  Info,
  Play,
  Check,
  FileCode,
  Layers,
} from 'lucide-react';

interface PrinterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinterSelected?: (printer: PrinterModel) => void;
}

export const PrinterManagerModal: React.FC<PrinterManagerModalProps> = ({
  isOpen,
  onClose,
  onPrinterSelected,
}) => {
  const [printers, setPrinters] = useState<PrinterModel[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'printers' | 'matrix' | 'diagnostics'>('printers');
  const [testPrintFeedback, setTestPrintFeedback] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPrinters();
    }
  }, [isOpen]);

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const list = await PrinterService.getInstance().getAvailablePrinters(true);
      setPrinters(list);
      if (!selectedPrinterId && list.length > 0) {
        const def = list.find((p) => p.isDefault) || list[0];
        setSelectedPrinterId(def.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId) || printers[0];

  const handleTestPrint = async () => {
    if (!selectedPrinter) return;
    setIsTesting(true);
    setTestPrintFeedback(null);
    try {
      const dummyTemplate = {
        id: 'test-tmpl',
        name: 'BarcodeFlow Hardware Diagnostic Test',
        dimensions: { width: 50, height: 25, unit: 'mm' as const, dpi: (selectedPrinter.dpi as any) || 203, orientation: 'portrait' as const },
        margins: { top: 1, bottom: 1, left: 1, right: 1, bleed: 0, safeZone: 1 },
        elements: [
          {
            id: 't1',
            name: 'Diag Header',
            type: 'text' as const,
            content: `DIAGNOSTIC TEST: ${selectedPrinter.name}`,
            fontSize: 7,
            x: 2,
            y: 2,
            width: 46,
            height: 4,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 1,
          },
          {
            id: 'b1',
            name: 'Diag Barcode',
            type: 'barcode' as const,
            symbology: 'code128',
            value: 'TEST-DIAG-2026',
            includeText: true,
            barHeight: 8,
            barWidth: 1.5,
            x: 2,
            y: 8,
            width: 46,
            height: 12,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 2,
          },
        ],
        variables: [],
        sampleRecords: [],
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Operator',
        version: '1.0',
        status: 'approved' as const,
        category: 'Manufacturing' as const,
        description: 'Test template',
      };

      const res = await PrinterService.getInstance().executeTestPrint(dummyTemplate as any, selectedPrinter);
      if (res.success) {
        setTestPrintFeedback(res.message);
      } else {
        setTestPrintFeedback(`Test print error: ${res.error || res.message}`);
      }
    } catch (err: any) {
      setTestPrintFeedback(`Failed: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Printers & Media Manager" maxWidth="max-w-4xl">
      <div className="space-y-4 text-xs text-slate-700 select-none">
        {/* Tab Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('printers')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'printers' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Installed Printers ({printers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'matrix' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hardware Compatibility Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'diagnostics' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Hardware Diagnostics</span>
            </button>
          </div>

          <button
            onClick={loadPrinters}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold text-slate-700 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Devices</span>
          </button>
        </div>

        {/* TAB 1: Installed Printers */}
        {activeTab === 'printers' && (
          <div className="grid grid-cols-3 gap-4">
            {/* Left list */}
            <div className="col-span-1 space-y-2 max-h-96 overflow-y-auto pr-1">
              {printers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPrinterId(p.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPrinterId === p.id
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                    <span>{p.name}</span>
                    {p.isDefault && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {p.dpi} DPI • {p.preferredRenderer}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Details */}
            {selectedPrinter && (
              <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{selectedPrinter.name}</h4>
                    <div className="text-slate-500 text-xs mt-0.5">
                      Manufacturer: <span className="font-semibold text-slate-800">{selectedPrinter.manufacturer}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold uppercase">
                    {selectedPrinter.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500">System Port:</span>
                    <div className="font-semibold text-slate-900">{selectedPrinter.port || 'USB / Spooler Default'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Hardware Driver:</span>
                    <div className="font-semibold text-slate-900 truncate">{selectedPrinter.driverName || selectedPrinter.model}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Print Resolution:</span>
                    <div className="font-semibold text-slate-900">{selectedPrinter.dpi} DPI</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Preferred Renderer:</span>
                    <div className="font-semibold text-blue-600">{selectedPrinter.preferredRenderer}</div>
                  </div>
                </div>

                {/* Capabilities grid */}
                <div>
                  <div className="font-bold text-slate-900 mb-2">Supported Capabilities:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(selectedPrinter.capabilities)
                      .filter(([k]) => typeof selectedPrinter.capabilities[k as keyof typeof selectedPrinter.capabilities] === 'boolean')
                      .map(([key, val]) => (
                        <div
                          key={key}
                          className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                            val ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span>{val ? '✓' : '✗'}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleTestPrint}
                    disabled={isTesting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTesting ? 'Printing Test Label...' : 'Dispatch Test Label'}</span>
                  </button>
                  {onPrinterSelected && (
                    <button
                      onClick={() => {
                        onPrinterSelected(selectedPrinter);
                        onClose();
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 font-semibold rounded-lg text-slate-700"
                    >
                      Use as Active Printer
                    </button>
                  )}
                </div>

                {testPrintFeedback && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs">
                    {testPrintFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Hardware Compatibility Matrix (Phase 92) */}
        {activeTab === 'matrix' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Printer Device</th>
                  <th className="p-3">Windows Driver Mode</th>
                  <th className="p-3">Native Language Mode</th>
                  <th className="p-3">DPI</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Test Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printers.map((p) => {
                  const isTsc = p.manufacturer.includes('TSC') || p.name.toLowerCase().includes('tsc');
                  const isZebra = p.manufacturer.includes('Zebra') || p.name.toLowerCase().includes('zebra');
                  const isPdf = p.name.toLowerCase().includes('pdf');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="p-3">
                        <span className="text-emerald-700 font-bold">✓ Universal Supported</span>
                      </td>
                      <td className="p-3">
                        {isTsc ? (
                          <span className="text-blue-700 font-semibold">TSPL / TSPL2 Supported</span>
                        ) : isZebra ? (
                          <span className="text-blue-700 font-semibold">ZPL-II Supported</span>
                        ) : isPdf ? (
                          <span className="text-purple-700 font-semibold">Vector PDF Engine</span>
                        ) : (
                          <span className="text-slate-400">Windows Driver Fallback</span>
                        )}
                      </td>
                      <td className="p-3">{p.dpi} DPI</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.isVirtual ? (
                          <span className="text-purple-600 font-medium">Virtual Simulator</span>
                        ) : (
                          <span className="text-slate-500 font-medium">Windows Driver Ready (Needs Hardware Test)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h4 className="font-bold text-base text-slate-900">Live Hardware Diagnostics & Environment</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 mb-2">Desktop Platform Status</div>
                <div>Runtime: <strong>{PrinterService.getInstance().isElectron() ? 'Electron Native Client' : 'Web Browser Service'}</strong></div>
                <div>OS Platform: <strong>Windows (win32)</strong></div>
                <div>Spooler Subsystem: <strong>Win32 winspool.drv + Universal Print Pipeline</strong></div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 mb-2">Active Hardware Target</div>
                <div>Device: <strong>{selectedPrinter?.name || 'None'}</strong></div>
                <div>Driver: <strong>{selectedPrinter?.driverName || 'Generic'}</strong></div>
                <div>Resolution: <strong>{selectedPrinter?.dpi || 203} DPI</strong></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleTestPrint}
                disabled={isTesting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs"
              >
                <Play className="w-4 h-4" />
                <span>Run Diagnostic Test Print (1 Label)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
