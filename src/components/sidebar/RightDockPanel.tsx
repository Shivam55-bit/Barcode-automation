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
import { SYMBOLOGY_CATALOG, validateBarcodeValue, calculateBarcodeLayout, getBarcodeSymbolHeight } from '../../services/barcodeEngine';
import { isMultiLineTextElement, isTextFitToBoxEnabled } from '../../services/textMeasurementEngine';
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
  onOpenTextProperties?: () => void;
  onOpenShapeProperties?: () => void;
  onOpenProperties?: () => void;
  onClose?: () => void;
  currentRecordData?: Record<string, any>;
  currentRecordIndex?: number;
  totalRecords?: number;
}

export const RightDockPanel: React.FC<RightDockPanelProps> = ({
  template,
  selectedElementIds,
  onUpdateTemplate,
  onUpdateElement,
  onOpenBarcodePicker,
  onOpenBarcodeProperties,
  onOpenTextProperties,
  onOpenShapeProperties,
  onOpenProperties,
  onClose,
  currentRecordData,
  currentRecordIndex = 0,
  totalRecords = 1,
}) => {
  const selectedElement = template.elements.find(
    (el) => el.id === selectedElementIds[0]
  );
  const selectedTextElement = selectedElement?.type === 'text' ? selectedElement as TextElement : null;
  const hasParagraphAutoHeight = !!selectedTextElement && isMultiLineTextElement(selectedTextElement);
  const textFitEnabled = !!selectedTextElement && isTextFitToBoxEnabled(selectedTextElement);
  const autoHeightEnabled = !textFitEnabled && (selectedTextElement?.autoHeight ?? selectedTextElement?.autoSize === true);

  const updateProp = (updates: Partial<LabelElement>) => {
    if (selectedElement) {
      onUpdateElement(selectedElement.id, updates);
    }
  };

  // Resolve bound field and active record value (Section 10.13)
  const primaryDs = selectedElement?.dataSources?.[0];
  const boundField =
    (primaryDs?.type === 'database' || (primaryDs as any)?.type === 'database-field')
      ? (primaryDs.field || (primaryDs as any).databaseField)
      : (selectedElement as any)?.dataBinding?.replace(/[{}]/g, '') ||
        (selectedElement as any)?.databaseField ||
        '';

  const connectionName = template.databaseConnection?.name || 'Embedded / Sample Dataset';
  const sheetName = template.databaseConnection?.sheetName || 'Sheet1$';
  const resolvedValue = boundField && currentRecordData
    ? currentRecordData[boundField] ?? '(No value)'
    : (selectedElement as any)?.value || (selectedElement as any)?.text || '';

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
            <>
              <button
                onClick={() => {
                  if (selectedElement.type === 'text') (onOpenTextProperties || onOpenProperties)?.();
                  else if (selectedElement.type === 'barcode') (onOpenBarcodeProperties || onOpenProperties)?.();
                  else if (selectedElement.type === 'shape') (onOpenShapeProperties || onOpenProperties)?.();
                  else onOpenProperties?.();
                }}
                title="Open Advanced Properties Dialog (F8)"
                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Sliders className="w-3 h-3 text-blue-600" />
                <span>Modal (F8)</span>
              </button>
              <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase">
                {selectedElement.type}
              </span>
            </>
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
            {/* Section 10.13: Data Source & Active Record Sync */}
            <Section title="Data Source & Active Record">
              <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Connection:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[150px]" title={connectionName}>
                    {connectionName}
                  </span>
                </div>
                {template.databaseConnection?.sheetName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Sheet:</span>
                    <span className="font-mono text-slate-800 font-medium">{sheetName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Field:</span>
                  <span className="font-semibold text-blue-700">{boundField || '(Static Content)'}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-blue-100">
                  <span className="text-slate-600 font-medium">Current Value:</span>
                  <span
                    className="font-bold font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-900 truncate max-w-[150px]"
                    title={String(resolvedValue)}
                  >
                    {String(resolvedValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>Active Record:</span>
                  <span className="font-semibold text-slate-700">
                    {totalRecords > 0 ? `${currentRecordIndex + 1} of ${totalRecords}` : '0 of 0'}
                  </span>
                </div>
              </div>
            </Section>

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
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${selectedElement.locked
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
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] text-slate-500 font-medium">
                      Width (mm)
                    </label>
                    {selectedTextElement && !hasParagraphAutoHeight && selectedTextElement.autoSize !== false && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">Auto</span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.width}
                    onChange={(e) => updateProp({
                      width: Number(e.target.value),
                      ...(hasParagraphAutoHeight ? { sizingMode: 'fixed-width' } : { autoSize: false }),
                      autoFit: false,
                    } as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] text-slate-500 font-medium">
                      Height (mm)
                    </label>
                    {selectedTextElement && (hasParagraphAutoHeight ? autoHeightEnabled : selectedTextElement.autoSize !== false) && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                        {hasParagraphAutoHeight ? 'Auto Height' : 'Auto'}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    disabled={selectedElement.isEditable === false}
                    value={selectedElement.height}
                    onChange={(e) => updateProp({
                      height: Number(e.target.value),
                      autoSize: false,
                      autoHeight: hasParagraphAutoHeight ? false : selectedTextElement?.autoHeight,
                      autoFit: false,
                    } as any)}
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
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-1.5 rounded">
                    <span className="text-[11px] font-semibold text-emerald-950">BarTender Text Object</span>
                    {(onOpenTextProperties || onOpenProperties) && (
                      <button
                        onClick={onOpenTextProperties || onOpenProperties}
                        className="px-2 py-0.5 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-bold rounded shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3 text-emerald-700" />
                        Full Properties Dialog...
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded p-1.5 shadow-2xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-950 select-none">
                      <input
                        type="checkbox"
                        checked={hasParagraphAutoHeight ? !!autoHeightEnabled : textFitEnabled}
                        onChange={(e) => {
                          const isAuto = e.target.checked;
                          if (hasParagraphAutoHeight) {
                            updateProp({
                              autoHeight: isAuto,
                              autoSize: false,
                              autoFit: false,
                              sizingMode: 'fixed-width',
                              autoSizeConfig: {
                                ...(selectedTextElement!.autoSizeConfig || {}),
                                enabled: false,
                                minFontSize: selectedTextElement!.autoSizeConfig?.minFontSize ?? selectedTextElement!.minFontSize ?? 1,
                                maxFontSize: selectedTextElement!.autoSizeConfig?.maxFontSize ?? selectedTextElement!.maxFontSize ?? 720,
                                minWidthScale: selectedTextElement!.autoSizeConfig?.minWidthScale ?? selectedTextElement!.minWidthScale ?? 100,
                                maxWidthScale: selectedTextElement!.autoSizeConfig?.maxWidthScale ?? selectedTextElement!.maxWidthScale ?? 100,
                              },
                            });
                          } else {
                            updateProp({
                              sizingMode: isAuto ? 'fit-to-box' : 'scale-text',
                              autoSize: false,
                              autoHeight: false,
                              autoFit: isAuto,
                              autoSizeConfig: {
                                ...(selectedTextElement!.autoSizeConfig || {}),
                                enabled: isAuto,
                                minFontSize: selectedTextElement!.autoSizeConfig?.minFontSize ?? selectedTextElement!.minFontSize ?? 1,
                                maxFontSize: selectedTextElement!.autoSizeConfig?.maxFontSize ?? selectedTextElement!.maxFontSize ?? 720,
                                minWidthScale: selectedTextElement!.autoSizeConfig?.minWidthScale ?? selectedTextElement!.minWidthScale ?? 100,
                                maxWidthScale: selectedTextElement!.autoSizeConfig?.maxWidthScale ?? selectedTextElement!.maxWidthScale ?? 100,
                              },
                            });
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 accent-[#16a34a]"
                      />
                      <span>{hasParagraphAutoHeight ? 'Auto Height (Reflow Content)' : 'Auto Size (Fit Bounding Box)'}</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {hasParagraphAutoHeight
                        ? autoHeightEnabled ? 'Dynamic Height' : 'Fixed Height'
                        : textFitEnabled ? 'Fitted to Box' : 'Fixed Box'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                      Text Object Type
                    </label>
                    <select
                      value={(selectedElement as TextElement).textType || 'single-line'}
                      onChange={(e) => {
                        const isParagraph = e.target.value === 'multi-line' || e.target.value === 'paragraph';
                        updateProp({
                          textType: e.target.value as any,
                          textFormatType: isParagraph ? 'paragraph' : e.target.value === 'arc' ? 'arc' : 'single-line',
                          multiline: isParagraph || e.target.value === 'word-processor',
                          wrap: isParagraph,
                          wordWrap: isParagraph,
                          autoHeight: isParagraph
                            ? selectedTextElement?.autoHeight ?? true
                            : false,
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none font-medium text-slate-800"
                    >
                      <optgroup label="Text Objects">
                        <option value="single-line">Single Line</option>
                        <option value="multi-line">Multi-line</option>
                        <option value="paragraph">Paragraph (Wrapping)</option>
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
                        value={(selectedElement as TextElement).fontFamily || 'Arial'}
                        onChange={(e) => updateProp({ fontFamily: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Arial Black">Arial Black</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Segoe UI">Segoe UI</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Impact">Impact</option>
                        <option value="Consolas">Consolas</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Font Size (pt)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        step="0.5"
                        value={(selectedElement as TextElement).fontSize}
                        onChange={(e) => updateProp({ fontSize: Math.max(1, Number(e.target.value)) })}
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
                        value={(selectedElement as TextElement).fontWeight || 'normal'}
                        onChange={(e) => updateProp({ fontWeight: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="normal">Regular</option>
                        <option value="bold">Bold (Heavy)</option>
                        <option value="600">Semi Bold</option>
                        <option value="800">Black / Extra Bold</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Font Style
                      </label>
                      <select
                        value={(selectedElement as TextElement).fontStyle || 'normal'}
                        onChange={(e) => updateProp({ fontStyle: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="normal">Normal</option>
                        <option value="italic">Italic</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Text Align
                      </label>
                      <select
                        value={(selectedElement as TextElement).textAlign || 'left'}
                        onChange={(e) => updateProp({ textAlign: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                        Line Height
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.8"
                        max="3.0"
                        value={(selectedElement as TextElement).lineHeight || 1.15}
                        onChange={(e) => updateProp({ lineHeight: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
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
                        step="0.5"
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
                        onChange={(e) => {
                          const newBarH = Number(e.target.value);
                          const bEl = selectedElement as BarcodeElement;
                          const layout = calculateBarcodeLayout({ ...bEl, barHeight: newBarH });
                          updateProp({ barHeight: newBarH, height: Math.max(newBarH, layout.totalHeightMm) });
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(selectedElement as BarcodeElement).includeText}
                        onChange={(e) => {
                          const nextInc = e.target.checked;
                          const bEl = selectedElement as BarcodeElement;
                          const layout = calculateBarcodeLayout({ ...bEl, includeText: nextInc });
                          updateProp({ includeText: nextInc, height: Math.max(bEl.barHeight || 15, layout.totalHeightMm) });
                        }}
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

                  {/* Human Readable Font & Style Controls */}
                  {(selectedElement as BarcodeElement).includeText !== false && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Human-Readable Font & Styling
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                            Font Family
                          </label>
                          <select
                            value={(selectedElement as BarcodeElement).humanReadableFont || (selectedElement as any).fontFamily || 'Arial'}
                            onChange={(e) => updateProp({ humanReadableFont: e.target.value, fontFamily: e.target.value } as any)}
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Segoe UI">Segoe UI</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Consolas">Consolas</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Tahoma">Tahoma</option>
                            <option value="Impact">Impact</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-medium block mb-0.5">
                            Font Size (pt)
                          </label>
                          <input
                            type="number"
                            min="6"
                            max="72"
                            value={(selectedElement as BarcodeElement).humanReadableFontSize || (selectedElement as any).fontSize || 12}
                            onChange={(e) => {
                              const newSize = Number(e.target.value);
                              const bEl = selectedElement as BarcodeElement;
                              const persistentBarH = getBarcodeSymbolHeight(bEl);
                              const layout = calculateBarcodeLayout({
                                ...bEl,
                                barHeight: persistentBarH,
                                humanReadableFontSize: newSize,
                                fontSize: newSize,
                              });
                              updateProp({
                                humanReadableFontSize: newSize,
                                fontSize: newSize,
                                barHeight: persistentBarH,
                                symbol: {
                                  ...(bEl?.symbol || {}),
                                  barHeight: persistentBarH,
                                  moduleWidth: bEl?.symbol?.moduleWidth || bEl?.barWidth || 1.5,
                                },
                                height: layout.totalHeightMm,
                                humanReadable: {
                                  ...(bEl.humanReadable || {}),
                                  fontSize: newSize,
                                  enabled: bEl.includeText !== false,
                                },
                              } as any);
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const bEl = selectedElement as BarcodeElement;
                              const isB = bEl.humanReadableFontStyle === 'bold' || bEl.humanReadableFontStyle === 'bold-italic' || (bEl as any).fontWeight === 'bold';
                              const isI = bEl.humanReadableFontStyle === 'italic' || bEl.humanReadableFontStyle === 'bold-italic' || (bEl as any).fontStyle === 'italic';
                              const nextStyle = isB ? (isI ? 'italic' : 'regular') : (isI ? 'bold-italic' : 'bold');
                              updateProp({ humanReadableFontStyle: nextStyle, fontWeight: isB ? 'normal' : 'bold' } as any);
                            }}
                            className={`w-7 h-6 flex items-center justify-center font-bold text-xs rounded border cursor-pointer transition-colors ${
                              (selectedElement as BarcodeElement).humanReadableFontStyle === 'bold' || (selectedElement as BarcodeElement).humanReadableFontStyle === 'bold-italic' || (selectedElement as any).fontWeight === 'bold'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                            title="Bold"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const bEl = selectedElement as BarcodeElement;
                              const isB = bEl.humanReadableFontStyle === 'bold' || bEl.humanReadableFontStyle === 'bold-italic' || (bEl as any).fontWeight === 'bold';
                              const isI = bEl.humanReadableFontStyle === 'italic' || bEl.humanReadableFontStyle === 'bold-italic' || (bEl as any).fontStyle === 'italic';
                              const nextStyle = isI ? (isB ? 'bold' : 'regular') : (isB ? 'bold-italic' : 'italic');
                              updateProp({ humanReadableFontStyle: nextStyle, fontStyle: isI ? 'normal' : 'italic' } as any);
                            }}
                            className={`w-7 h-6 flex items-center justify-center italic text-xs rounded border cursor-pointer transition-colors ${
                              (selectedElement as BarcodeElement).humanReadableFontStyle === 'italic' || (selectedElement as BarcodeElement).humanReadableFontStyle === 'bold-italic' || (selectedElement as any).fontStyle === 'italic'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                            title="Italic"
                          >
                            I
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const bEl = selectedElement as BarcodeElement;
                              const isU = !!bEl.humanReadableUnderline || (bEl as any).textDecoration === 'underline';
                              updateProp({ humanReadableUnderline: !isU, textDecoration: isU ? 'none' : 'underline' } as any);
                            }}
                            className={`w-7 h-6 flex items-center justify-center underline text-xs rounded border cursor-pointer transition-colors ${
                              !!(selectedElement as BarcodeElement).humanReadableUnderline || (selectedElement as any).textDecoration === 'underline'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                            title="Underline"
                          >
                            U
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-500 font-medium">Color</label>
                          <input
                            type="color"
                            value={(selectedElement as BarcodeElement).humanReadableColor || (selectedElement as any).color || '#000000'}
                            onChange={(e) => updateProp({ humanReadableColor: e.target.value, color: e.target.value } as any)}
                            className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* 4. SHAPE SPECIFIC PROPERTIES */}
            {selectedElement.type === 'shape' && (
              <Section title="Shape & Border Styling">
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-1.5 rounded">
                    <span className="text-[11px] font-semibold text-slate-800">Shape Object</span>
                    {(onOpenShapeProperties || onOpenProperties) && (
                      <button
                        onClick={onOpenShapeProperties || onOpenProperties}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-bold rounded shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3 text-slate-700" />
                        Full Properties Dialog...
                      </button>
                    )}
                  </div>

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
