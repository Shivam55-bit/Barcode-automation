import React, { useState } from 'react';
import { Settings, Sliders, CheckCircle, Monitor, Printer, Globe } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ViewportState, UnitType, DpiOption } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  defaultDpi: DpiOption;
  setDefaultDpi: (dpi: DpiOption) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  viewport,
  setViewport,
  defaultDpi,
  setDefaultDpi,
}) => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'printing' | 'system'>('canvas');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Platform & Designer Preferences"
      subtitle="Configure canvas rendering, units, thermal spooling defaults, and compliance checks"
      maxWidth="2xl"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
        >
          Save & Close
        </button>
      }
    >
      <div className="space-y-4">
        {/* Navigation */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'canvas'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Canvas & Grid</span>
          </button>
          <button
            onClick={() => setActiveTab('printing')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'printing'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Thermal Printing Defaults</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Compliance & Localization</span>
          </button>
        </div>

        {/* Tab 1: Canvas & Grid */}
        {activeTab === 'canvas' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Default Measurement Unit
                </label>
                <select
                  value={viewport.unit}
                  onChange={(e) =>
                    setViewport((prev) => ({ ...prev, unit: e.target.value as UnitType }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="inch">Inches (in)</option>
                  <option value="px">Pixels (px)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Snap Grid Spacing
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={viewport.gridSize}
                    onChange={(e) =>
                      setViewport((prev) => ({ ...prev, gridSize: Number(e.target.value) || 5 }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono outline-none"
                  />
                  <span className="text-xs text-slate-500 font-medium">mm</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <label className="text-xs font-semibold text-slate-700 block">Workspace Display Defaults</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100/70">
                  <input
                    type="checkbox"
                    checked={viewport.showGrid}
                    onChange={(e) => setViewport((prev) => ({ ...prev, showGrid: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Show Coordinate Grid</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100/70">
                  <input
                    type="checkbox"
                    checked={viewport.showRulers}
                    onChange={(e) => setViewport((prev) => ({ ...prev, showRulers: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Show Precision Rulers</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100/70">
                  <input
                    type="checkbox"
                    checked={viewport.snapToGrid}
                    onChange={(e) => setViewport((prev) => ({ ...prev, snapToGrid: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Snap to Grid Boundaries</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100/70">
                  <input
                    type="checkbox"
                    checked={viewport.showMargins}
                    onChange={(e) => setViewport((prev) => ({ ...prev, showMargins: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Show Safe Print Margins</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Printing Defaults */}
        {activeTab === 'printing' && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Default Thermal Resolution (Printhead DPI)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[203, 300, 600].map((dpi) => (
                  <button
                    key={dpi}
                    type="button"
                    onClick={() => setDefaultDpi(dpi as DpiOption)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      defaultDpi === dpi
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-800">{dpi} DPI</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {dpi === 203 && '8 dots/mm (Standard Shipping)'}
                      {dpi === 300 && '12 dots/mm (Pharma / Logistics)'}
                      {dpi === 600 && '24 dots/mm (Micro Electronics UDI)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <span className="font-semibold block">Thermal Printhead Dot Alignment:</span>
              <p className="text-[11px] leading-relaxed">
                ZPL and EPL generators automatically convert vector coordinates into exact integer dot positions (e.g. 1mm = 8.00 dots at 203 DPI, 11.81 dots at 300 DPI) to prevent bar distortion or anti-aliasing artifacts on industrial direct thermal printers.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: System & Compliance */}
        {activeTab === 'system' && (
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-slate-800">FDA 21 CFR Part 11 Electronic Records Compliance</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every template change, approval signature, and print job dispatch generates an immutable SHA-256 timestamped audit trail entry storing the user ID, workstation IP, and differential payload.
              </p>
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Audit Trail Logging: Active & Enforced</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
