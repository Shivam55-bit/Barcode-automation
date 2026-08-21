import React from 'react';
import {
  LabelTemplate,
  LabelElement,
  TextElement,
  BarcodeElement,
  ShapeElement,
  ImageElement,
  TableElement,
  DpiOption,
  UnitType,
} from '../../types';
import { SYMBOLOGY_CATALOG, validateBarcodeValue } from '../../services/barcodeEngine';
import {
  Sliders,
  Maximize,
  Move,
  RotateCw,
  Eye,
  Lock,
  Type,
  Barcode,
  Square,
  Palette,
  Table as TableIcon,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RightDockPanelProps {
  template: LabelTemplate;
  selectedElementIds: string[];
  onUpdateTemplate: (updates: Partial<LabelTemplate>) => void;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
  onClose?: () => void;
}

export const RightDockPanel: React.FC<RightDockPanelProps> = ({
  template,
  selectedElementIds,
  onUpdateTemplate,
  onUpdateElement,
  onOpenBarcodePicker,
  onOpenBarcodeProperties,
  onClose,
}) => {
  const selectedElement = template.elements.find(
    (el) => el.id === selectedElementIds[0]
  );

  const updateProp = (updates: Partial<LabelElement>) => {
    if (selectedElement) {
      onUpdateElement(selectedElement.id, updates);
    }
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none text-xs text-slate-700 shadow-xs z-20">
      {/* Panel Header */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800 text-xs tracking-tight">
            {selectedElement ? `Properties: ${selectedElement.name}` : 'Label & Canvas Setup'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedElement && (
            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase">
              {selectedElement.type}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Properties Panel / Panel Band Karein (Ctrl+M)"
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center ml-1"
            >
              <span className="font-bold text-sm leading-none">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Property Controls Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* CASE A: No element selected -> Global Label Template Settings */}
        {!selectedElement && (
          <div className="space-y-4">
            {/* Dimensions */}
            <Section title="Label Dimensions & DPI">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={template.dimensions.width}
                    onChange={(e) =>
                      onUpdateTemplate({
                        dimensions: {
                          ...template.dimensions,
                          width: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    value={template.dimensions.height}
                    onChange={(e) =>
                      onUpdateTemplate({
                        dimensions: {
                          ...template.dimensions,
                          height: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Thermal Print DPI
                  </label>
                  <select
                    value={template.dimensions.dpi}
                    onChange={(e) =>
                      onUpdateTemplate({
                        dimensions: {
                          ...template.dimensions,
                          dpi: Number(e.target.value) as DpiOption,
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                  >
                    <option value={203}>203 DPI (8 dpmm)</option>
                    <option value={300}>300 DPI (12 dpmm)</option>
                    <option value={600}>600 DPI (24 dpmm)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Orientation
                  </label>
                  <select
                    value={template.dimensions.orientation}
                    onChange={(e) =>
                      onUpdateTemplate({
                        dimensions: {
                          ...template.dimensions,
                          orientation: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </Section>

            {/* Margins & Bleed */}
            <Section title="Margins & Print Safe Area">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Top / Bottom (mm)
                  </label>
                  <input
                    type="number"
                    value={template.margins.top}
                    onChange={(e) =>
                      onUpdateTemplate({
                        margins: {
                          ...template.margins,
                          top: Number(e.target.value),
                          bottom: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Left / Right (mm)
                  </label>
                  <input
                    type="number"
                    value={template.margins.left}
                    onChange={(e) =>
                      onUpdateTemplate({
                        margins: {
                          ...template.margins,
                          left: Number(e.target.value),
                          right: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </Section>

            {/* Standard & Metadata */}
            <Section title="Compliance Standard & Category">
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Industry Standard
                  </label>
                  <select
                    value={template.complianceStandard || 'GS1-128'}
                    onChange={(e) =>
                      onUpdateTemplate({
                        complianceStandard: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                  >
                    <option value="GS1-128">GS1-128 Logistics Master</option>
                    <option value="FDA-UDI">FDA UDI 21 CFR 830 Medical</option>
                    <option value="GHS-Hazmat">OSHA GHS Chemical Hazmat</option>
                    <option value="AIAG-B10">AIAG B-10 Automotive</option>
                    <option value="Avery-Standard">Avery Retail Standard</option>
                    <option value="Custom">Custom Proprietary Spec</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) => onUpdateTemplate({ name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                  />
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* CASE B: Specific Element Selected */}
        {selectedElement && (
          <div className="space-y-4">
            {/* 1. Geometry & Position (Common to all elements) */}
            <Section title="Geometry & Layout">
              {/* Enterprise Security & Locked Fields Section */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Field Lock & Security</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      selectedElement.locked
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {selectedElement.locked ? 'LOCKED / FIXED' : 'EDITABLE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-600 font-semibold block mb-0.5">Master Lock</label>
                    <select
                      value={selectedElement.locked ? 'locked' : 'unlocked'}
                      onChange={(e) => {
                        const isLock = e.target.value === 'locked';
                        updateProp({
                          locked: isLock,
                          editable: !isLock,
                          isEditable: !isLock,
                          allowMove: !isLock,
                          allowResize: !isLock,
                          allowRotate: !isLock,
                          allowDelete: !isLock,
                          allowContentEdit: !isLock,
                          allowPropertyEdit: !isLock,
                          allowVariableEdit: !isLock,
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold outline-none"
                    >
                      <option value="unlocked">Unlocked (Editable)</option>
                      <option value="locked">Locked (Fixed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 font-semibold block mb-0.5">Object Name</label>
                    <input
                      type="text"
                      value={selectedElement.name}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {/* Granular Permission Toggles */}
                <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10.5px]">
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowMove !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowMove: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Allow Move</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowResize !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowResize: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Allow Resize</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowRotate !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowRotate: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Allow Rotate</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowDelete !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowDelete: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Allow Delete</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowContentEdit !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowContentEdit: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Content Edit</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.allowVariableEdit !== false && !selectedElement.locked}
                      disabled={selectedElement.locked}
                      onChange={(e) => updateProp({ allowVariableEdit: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Variable Edit</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    X Position (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.x}
                    onChange={(e) => updateProp({ x: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    Y Position (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.y}
                    onChange={(e) => updateProp({ y: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.width}
                    onChange={(e) => updateProp({ width: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.height}
                    onChange={(e) => updateProp({ height: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    Rotation (°)
                  </label>
                  <input
                    type="number"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.rotation || 0}
                    onChange={(e) => updateProp({ rotation: Number(e.target.value) % 360 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                    Opacity ({Math.round(selectedElement.opacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={selectedElement.opacity}
                    onChange={(e) => updateProp({ opacity: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </Section>

            {/* 2. TEXT SPECIFIC PROPERTIES */}
            {selectedElement.type === 'text' && (
              <Section title="Typography & Content">
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Text Object Type
                    </label>
                    <select
                      value={(selectedElement as TextElement).textType || 'single-line'}
                      onChange={(e) => updateProp({ textType: e.target.value as any, multiline: e.target.value === 'multi-line' || e.target.value === 'word-processor' })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none font-medium text-slate-800"
                    >
                      <optgroup label="Text Objects">
                        <option value="single-line">Single Line</option>
                        <option value="multi-line">Multi-line</option>
                        <option value="word-processor">Word Processor</option>
                        <option value="arc">Arc (Curved)</option>
                        <option value="symbol-font">Symbol Font Characters</option>
                      </optgroup>
                      <optgroup label="Markup Language Containers">
                        <option value="rtf">RTF (Rich Text Format)</option>
                        <option value="html">HTML Markup</option>
                        <option value="xaml">XAML Container</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Text Content / Markup
                    </label>
                    <textarea
                      rows={3}
                      value={(selectedElement as TextElement).text}
                      onChange={(e) => updateProp({ text: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Variable Data Binding
                    </label>
                    <select
                      value={(selectedElement as TextElement).dataBinding || ''}
                      onChange={(e) => updateProp({ dataBinding: e.target.value || undefined })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none font-mono"
                    >
                      <option value="">(None - Static Value)</option>
                      {template.variables.map((v) => (
                        <option key={v.id} value={`{{${v.name}}}`}>
                          {`{{${v.name}}}`} - {v.defaultValue}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Font Family
                      </label>
                      <select
                        value={(selectedElement as TextElement).fontFamily}
                        onChange={(e) => updateProp({ fontFamily: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                        <option value="Courier, monospace">Courier (Thermal OCR)</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="Arial Black, sans-serif">Arial Heavy</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Font Size (pt)
                      </label>
                      <input
                        type="number"
                        value={(selectedElement as TextElement).fontSize}
                        onChange={(e) => updateProp({ fontSize: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Font Weight
                      </label>
                      <select
                        value={(selectedElement as TextElement).fontWeight}
                        onChange={(e) => updateProp({ fontWeight: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="normal">Regular</option>
                        <option value="bold">Bold (Zebra Heavy)</option>
                        <option value="800">Black / Extra Bold</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Text Align
                      </label>
                      <select
                        value={(selectedElement as TextElement).textAlign}
                        onChange={(e) => updateProp({ textAlign: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Text Color
                      </label>
                      <input
                        type="color"
                        value={(selectedElement as TextElement).color || '#000000'}
                        onChange={(e) => updateProp({ color: e.target.value })}
                        className="w-full h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Letter Spacing
                      </label>
                      <input
                        type="number"
                        value={(selectedElement as TextElement).letterSpacing || 0}
                        onChange={(e) => updateProp({ letterSpacing: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* 3. BARCODE SPECIFIC PROPERTIES */}
            {selectedElement.type === 'barcode' && (
              <Section title="Barcode Symbology & Settings">
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-1.5 rounded">
                    <span className="text-[11px] font-semibold text-blue-900">BarTender Barcode Object</span>
                    {onOpenBarcodeProperties && (
                      <button
                        onClick={onOpenBarcodeProperties}
                        className="px-2 py-0.5 bg-white hover:bg-blue-100 border border-blue-300 text-blue-800 text-[10px] font-bold rounded shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3 text-blue-600" />
                        Full Properties Dialog...
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-slate-500 font-medium">
                        Symbology
                      </label>
                      <button
                        onClick={onOpenBarcodePicker}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Browse All...
                      </button>
                    </div>
                    <select
                      value={(selectedElement as BarcodeElement).symbology}
                      onChange={(e) =>
                        updateProp({ symbology: e.target.value as any })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                    >
                      {SYMBOLOGY_CATALOG.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Barcode Encoded Value
                    </label>
                    <textarea
                      rows={2}
                      value={(selectedElement as BarcodeElement).value}
                      onChange={(e) => updateProp({ value: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Variable Binding
                    </label>
                    <select
                      value={(selectedElement as BarcodeElement).dataBinding || ''}
                      onChange={(e) => updateProp({ dataBinding: e.target.value || undefined })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none font-mono"
                    >
                      <option value="">(None - Static Barcode)</option>
                      {template.variables.map((v) => (
                        <option key={v.id} value={`{{${v.name}}}`}>
                          {`{{${v.name}}}`} - {v.defaultValue}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Narrow Bar Width
                      </label>
                      <input
                        type="number"
                        step="0.2"
                        min="1"
                        max="5"
                        value={(selectedElement as BarcodeElement).barWidth || 1.5}
                        onChange={(e) => updateProp({ barWidth: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Bar Height (mm)
                      </label>
                      <input
                        type="number"
                        value={(selectedElement as BarcodeElement).barHeight || 15}
                        onChange={(e) => updateProp({ barHeight: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(selectedElement as BarcodeElement).includeText}
                        onChange={(e) => updateProp({ includeText: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Human Readable Text</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(selectedElement as BarcodeElement).quietZone}
                        onChange={(e) => updateProp({ quietZone: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Quiet Zone</span>
                    </label>
                  </div>
                </div>
              </Section>
            )}

            {/* 4. SHAPE SPECIFIC PROPERTIES */}
            {selectedElement.type === 'shape' && (
              <Section title="Shape & Border Styling">
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Fill Color
                      </label>
                      <input
                        type="color"
                        value={(selectedElement as ShapeElement).fillColor || '#ffffff'}
                        onChange={(e) => updateProp({ fillColor: e.target.value })}
                        className="w-full h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Border Color
                      </label>
                      <input
                        type="color"
                        value={(selectedElement as ShapeElement).strokeColor || '#000000'}
                        onChange={(e) => updateProp({ strokeColor: e.target.value })}
                        className="w-full h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Border Width (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={(selectedElement as ShapeElement).strokeWidth}
                        onChange={(e) => updateProp({ strokeWidth: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Corner Radius (mm)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={(selectedElement as ShapeElement).cornerRadius}
                        onChange={(e) => updateProp({ cornerRadius: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="space-y-2 pb-3 border-b border-slate-100 last:border-0">
    <h4 className="text-[11px] font-bold text-slate-900 tracking-tight flex items-center justify-between">
      <span>{title}</span>
    </h4>
    {children}
  </div>
);
