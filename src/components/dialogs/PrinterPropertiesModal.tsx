import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PrinterDefinition, DpiOption } from '../../types';
import {
  Sliders,
  Printer,
  Cpu,
  Gauge,
  Sun,
  Layers,
  Save,
  RotateCcw,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

interface PrinterPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  printer: PrinterDefinition;
  darkness: number;
  printSpeed: number;
  mediaType?: 'continuous' | 'gap' | 'black_mark' | 'die_cut';
  onSaveProperties: (props: {
    darkness: number;
    speed: number;
    mediaType: 'continuous' | 'gap' | 'black_mark' | 'die_cut';
    dpi: DpiOption;
  }) => void;
}

export const PrinterPropertiesModal: React.FC<PrinterPropertiesModalProps> = ({
  isOpen,
  onClose,
  printer,
  darkness: initialDarkness,
  printSpeed: initialSpeed,
  mediaType: initialMediaType = 'gap',
  onSaveProperties,
}) => {
  const [darkness, setDarkness] = useState<number>(initialDarkness);
  const [speed, setSpeed] = useState<number>(initialSpeed);
  const [mediaType, setMediaType] = useState<'continuous' | 'gap' | 'black_mark' | 'die_cut'>(
    (printer.mediaType as any) || initialMediaType
  );
  const [dpi, setDpi] = useState<DpiOption>(printer.dpi || 203);
  const [printMethod, setPrintMethod] = useState<'thermal_transfer' | 'direct_thermal'>('thermal_transfer');
  const [cutterMode, setCutterMode] = useState<'tear_off' | 'cutter' | 'peel'>('tear_off');

  const handleResetDefaults = () => {
    setDarkness(18);
    setSpeed(6);
    setMediaType('gap');
    setDpi(printer.dpi || 203);
    setPrintMethod('thermal_transfer');
    setCutterMode('tear_off');
  };

  const handleSave = () => {
    onSaveProperties({
      darkness,
      speed,
      mediaType,
      dpi,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Printer Properties — ${printer.name}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs text-slate-700">
        {/* Hardware Status Header */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{printer.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  {printer.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Model: {printer.model || 'Thermal Label Printer'} • Port: {printer.ipAddress}:{printer.port}
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500 font-mono">
            <div>Driver: {printer.brand || 'Windows'} {(printer.protocol || 'driver').toUpperCase()}</div>
            <div>Resolution: {dpi} DPI</div>
          </div>
        </div>

        {/* Print Head & Heat Darkness Setting */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" />
              Darkness / Burn Temperature (1 - 30)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={darkness}
                onChange={(e) => setDarkness(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-14 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-center text-slate-900"
              />
              <span className="text-[11px] text-slate-400 font-mono">/ 30</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={darkness}
            onChange={(e) => setDarkness(parseInt(e.target.value, 10))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Light (Low heat)</span>
            <span>Standard (18 - 22)</span>
            <span>Heavy (High contrast)</span>
          </div>
        </div>

        {/* Print Speed & Resolution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-600" />
              Print Speed (ips)
            </label>
            <select
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value={2.0}>2.0 ips (High Precision Barcodes)</option>
              <option value={3.0}>3.0 ips (Standard Precision)</option>
              <option value={4.0}>4.0 ips (Recommended Default)</option>
              <option value={6.0}>6.0 ips (High Throughput)</option>
              <option value={8.0}>8.0 ips (Industrial Fast)</option>
              <option value={10.0}>10.0 ips (Maximum Speed)</option>
              <option value={12.0}>12.0 ips (Ultra Speed)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-600" />
              Resolution / DPI
            </label>
            <select
              value={dpi}
              onChange={(e) => setDpi(parseInt(e.target.value, 10) as DpiOption)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value={203}>203 DPI (8 dots/mm)</option>
              <option value={300}>300 DPI (12 dots/mm)</option>
              <option value={600}>600 DPI (24 dots/mm - High Res)</option>
            </select>
          </div>
        </div>

        {/* Media Sensor & Print Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Media Sensor Type
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value="gap">Gap / Web Sensing (Die-Cut)</option>
              <option value="black_mark">Black Mark Sensing (Reflective)</option>
              <option value="continuous">Continuous (Roll / Receipt)</option>
              <option value="die_cut">Notch / Hole Sensing</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-purple-600" />
              Print Method
            </label>
            <select
              value={printMethod}
              onChange={(e) => setPrintMethod(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value="thermal_transfer">Thermal Transfer (Ribbon Required)</option>
              <option value="direct_thermal">Direct Thermal (Heat Sensitive Paper)</option>
            </select>
          </div>
        </div>

        {/* Tear-off / Cutter Handling */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
          <label className="text-xs font-bold text-slate-800">Media Handling Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'tear_off', label: 'Tear-off' },
              { id: 'cutter', label: 'Auto Cutter' },
              { id: 'peel', label: 'Peel & Present' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCutterMode(opt.id as any)}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                  cutterMode === opt.id
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Save Properties
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
