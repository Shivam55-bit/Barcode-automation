import React, { useState } from 'react';
import {
  Printer,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  Gauge,
  Sun,
  Maximize2,
  FileCode
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { PrinterDefinition } from '../../types';

interface PrinterCalibrationModalProps {
  printers: PrinterDefinition[];
  onClose: () => void;
  onCalibrationSaved?: (printer: any) => void;
}

export const PrinterCalibrationModal: React.FC<PrinterCalibrationModalProps> = ({
  printers,
  onClose,
  onCalibrationSaved,
}) => {
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printers[0]?.id || '');
  const [labelWidth, setLabelWidth] = useState<number>(100);
  const [labelHeight, setLabelHeight] = useState<number>(50);
  const [mediaType, setMediaType] = useState<'gap' | 'black_mark' | 'continuous'>('gap');
  const [dpi, setDpi] = useState<number>(300);
  const [darkness, setDarkness] = useState<number>(15);
  const [speed, setSpeed] = useState<number>(6);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRunCalibration = async (testPage: boolean = false) => {
    setIsCalibrating(true);
    setStatusMessage(null);
    try {
      const res = await apiService.printersExt.calibrate({
        printerId: selectedPrinterId,
        labelWidth,
        labelHeight,
        mediaType,
        dpi,
        darkness,
        speed,
        testPage,
      });

      setStatusMessage(res.message);
      if (onCalibrationSaved && res.printer) {
        onCalibrationSaved(res.printer);
      }
    } catch (err: any) {
      alert(`Calibration failed: ${err.message}`);
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full flex flex-col overflow-hidden text-white shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Thermal Printer Calibration Wizard</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                  ZEBRA / TSC / SATO
                </span>
              </h2>
              <p className="text-xs text-slate-400">Configure darkness, print speed, DPI, and stock sensor alignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {statusMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Printer Selection */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-300">Select Target Thermal Printer</label>
            <select
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type}) — {p.ipAddress}:{p.port}
                </option>
              ))}
            </select>
          </div>

          {/* Grid Controls */}
          <div className="grid grid-cols-2 gap-4">
            {/* Stock Dimensions */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Label Stock Dimensions</span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Width (mm)</label>
                  <input
                    type="number"
                    value={labelWidth}
                    onChange={(e) => setLabelWidth(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Height (mm)</label>
                  <input
                    type="number"
                    value={labelHeight}
                    onChange={(e) => setLabelHeight(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Media Sensor Type</label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="gap">Die-Cut Gap Sensor</option>
                  <option value="black_mark">Black Mark Sensor</option>
                  <option value="continuous">Continuous Feed</option>
                </select>
              </div>
            </div>

            {/* Printhead Controls */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Printhead Calibration</span>
              </span>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Printer Resolution (DPI)</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-white"
                >
                  <option value={203}>203 DPI (8 dots/mm)</option>
                  <option value={300}>300 DPI (12 dots/mm)</option>
                  <option value={600}>600 DPI (24 dots/mm)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Darkness (Heat Index):</span>
                  <span className="font-mono text-amber-400">{darkness} / 30</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={darkness}
                  onChange={(e) => setDarkness(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Print Speed:</span>
                  <span className="font-mono text-blue-400">{speed} IPS</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-blue-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => handleRunCalibration(true)}
            disabled={isCalibrating}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Print Calibration Test Pattern</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => handleRunCalibration(false)}
              disabled={isCalibrating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
            >
              {isCalibrating ? 'Saving Config...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
