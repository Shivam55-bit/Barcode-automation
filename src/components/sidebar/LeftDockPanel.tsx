import React, { useState } from 'react';
import {
  Boxes,
  Layers,
  Variable,
  Database,
  LayoutTemplate,
  Type,
  Barcode,
  QrCode,
  Grid,
  Square,
  Circle,
  Minus,
  Table,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  ArrowUp,
  ArrowDown,
  Search,
  Upload,
  Sparkles,
  ChevronRight,
  Folder,
  Tag,
  Clock,
} from 'lucide-react';
import { LabelTemplate, LabelElement, VariableDefinition, BarcodeSymbology } from '../../types';

interface LeftDockPanelProps {
  template: LabelTemplate;
  selectedElementIds: string[];
  onSelectElement: (id: string, multi?: boolean) => void;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onReorderElements: (fromIndex: number, toIndex: number) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onInsertElement: (element: Partial<LabelElement>) => void;
  onInsertPreset: (presetType: string) => void;
  onSelectTemplate: (templateId: string) => void;
  templatesList: LabelTemplate[];
  onAddVariable: (variable: VariableDefinition) => void;
  onUpdateVariable: (id: string, variable: Partial<VariableDefinition>) => void;
  onDeleteVariable: (id: string) => void;
  onImportCSV: () => void;
  currentRecordIndex: number;
  onSelectRecordIndex: (index: number) => void;
  onClose?: () => void;
}

export const LeftDockPanel: React.FC<LeftDockPanelProps> = ({
  template,
  selectedElementIds,
  onSelectElement,
  onUpdateElement,
  onReorderElements,
  onDeleteElement,
  onDuplicateElement,
  onInsertElement,
  onInsertPreset,
  onSelectTemplate,
  templatesList,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  onImportCSV,
  currentRecordIndex,
  onSelectRecordIndex,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'layers' | 'variables' | 'data' | 'templates'>('library');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full select-none text-xs text-slate-700 shadow-xs z-20">
      {/* Top Tabs with explicit Close / Cut (✕) button */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50">
        <div className="flex-1 flex overflow-x-auto no-scrollbar">
          <TabButton
            active={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
            icon={<Boxes className="w-3.5 h-3.5" />}
            label="Library"
          />
          <TabButton
            active={activeTab === 'layers'}
            onClick={() => setActiveTab('layers')}
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Layers"
            badge={template.elements.length}
          />
          <TabButton
            active={activeTab === 'variables'}
            onClick={() => setActiveTab('variables')}
            icon={<Variable className="w-3.5 h-3.5" />}
            label="Variables"
            badge={template.variables.length}
          />
          <TabButton
            active={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            icon={<Database className="w-3.5 h-3.5" />}
            label="Data"
          />
          <TabButton
            active={activeTab === 'templates'}
            onClick={() => setActiveTab('templates')}
            icon={<LayoutTemplate className="w-3.5 h-3.5" />}
            label="Templates"
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Close Panel / Panel Band Karein (Ctrl+B)"
            className="p-2 mr-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center"
          >
            <span className="font-bold text-sm leading-none">✕</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* 1. OBJECT LIBRARY */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Standard Elements */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Standard Elements
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LibraryItem
                  icon={<Type className="w-4 h-4 text-blue-600" />}
                  title="Text Box"
                  desc="Static or Variable"
                  dragData={{
                    type: 'text',
                    name: 'Text Field',
                    text: 'Sample Text',
                    fontFamily: 'Helvetica',
                    fontSize: 10,
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textDecoration: 'none',
                    textAlign: 'left',
                    verticalAlign: 'top',
                    color: '#000000',
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    width: 40,
                    height: 8,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'text',
                      name: 'Text Field',
                      text: 'Sample Text',
                      fontFamily: 'Helvetica',
                      fontSize: 10,
                      fontWeight: 'normal',
                      fontStyle: 'normal',
                      textDecoration: 'none',
                      textAlign: 'left',
                      verticalAlign: 'top',
                      color: '#000000',
                      lineHeight: 1.2,
                      letterSpacing: 0,
                      width: 40,
                      height: 8,
                    })
                  }
                />
                <LibraryItem
                  icon={<Barcode className="w-4 h-4 text-emerald-600" />}
                  title="Code 128"
                  desc="1D Industrial Barcode"
                  dragData={{
                    type: 'barcode',
                    name: 'Code128 Barcode',
                    symbology: 'code128',
                    value: 'INV-2026-X89',
                    includeText: true,
                    textPosition: 'below',
                    barWidth: 1.5,
                    barHeight: 14,
                    quietZone: true,
                    foregroundColor: '#000000',
                    backgroundColor: '#ffffff',
                    checkDigit: true,
                    width: 50,
                    height: 18,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'barcode',
                      name: 'Code128 Barcode',
                      symbology: 'code128',
                      value: 'INV-2026-X89',
                      includeText: true,
                      textPosition: 'below',
                      barWidth: 1.5,
                      barHeight: 14,
                      quietZone: true,
                      foregroundColor: '#000000',
                      backgroundColor: '#ffffff',
                      checkDigit: true,
                      width: 50,
                      height: 18,
                    })
                  }
                />
                <LibraryItem
                  icon={<QrCode className="w-4 h-4 text-purple-600" />}
                  title="QR Code"
                  desc="2D Mobile Matrix"
                  dragData={{
                    type: 'barcode',
                    name: 'QR Code',
                    symbology: 'qr',
                    value: 'https://verify.industrial-label.com/tag/884920',
                    includeText: false,
                    textPosition: 'none',
                    barWidth: 2,
                    barHeight: 20,
                    quietZone: true,
                    foregroundColor: '#000000',
                    backgroundColor: '#ffffff',
                    checkDigit: true,
                    width: 25,
                    height: 25,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'barcode',
                      name: 'QR Code',
                      symbology: 'qr',
                      value: 'https://verify.industrial-label.com/tag/884920',
                      includeText: false,
                      textPosition: 'none',
                      barWidth: 2,
                      barHeight: 20,
                      quietZone: true,
                      foregroundColor: '#000000',
                      backgroundColor: '#ffffff',
                      checkDigit: true,
                      width: 25,
                      height: 25,
                    })
                  }
                />
                <LibraryItem
                  icon={<Grid className="w-4 h-4 text-blue-700" />}
                  title="Data Matrix"
                  desc="GS1 / FDA UDI 2D"
                  dragData={{
                    type: 'barcode',
                    name: 'GS1 DataMatrix',
                    symbology: 'gs1-datamatrix',
                    value: '(01)00850006531234(17)261231(10)LOT456',
                    includeText: false,
                    textPosition: 'none',
                    barWidth: 2,
                    barHeight: 20,
                    quietZone: true,
                    foregroundColor: '#000000',
                    backgroundColor: '#ffffff',
                    checkDigit: true,
                    width: 22,
                    height: 22,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'barcode',
                      name: 'GS1 DataMatrix',
                      symbology: 'gs1-datamatrix',
                      value: '(01)00850006531234(17)261231(10)LOT456',
                      includeText: false,
                      textPosition: 'none',
                      barWidth: 2,
                      barHeight: 20,
                      quietZone: true,
                      foregroundColor: '#000000',
                      backgroundColor: '#ffffff',
                      checkDigit: true,
                      width: 22,
                      height: 22,
                    })
                  }
                />
                <LibraryItem
                  icon={<Square className="w-4 h-4 text-amber-600" />}
                  title="Rectangle"
                  desc="Box & Framing"
                  dragData={{
                    type: 'shape',
                    name: 'Rectangle Box',
                    shapeType: 'rectangle',
                    fillColor: 'transparent',
                    strokeColor: '#000000',
                    strokeWidth: 0.4,
                    strokeStyle: 'solid',
                    cornerRadius: 0,
                    width: 40,
                    height: 20,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'shape',
                      name: 'Rectangle Box',
                      shapeType: 'rectangle',
                      fillColor: 'transparent',
                      strokeColor: '#000000',
                      strokeWidth: 0.4,
                      strokeStyle: 'solid',
                      cornerRadius: 0,
                      width: 40,
                      height: 20,
                    })
                  }
                />
                <LibraryItem
                  icon={<Table className="w-4 h-4 text-indigo-600" />}
                  title="Table Grid"
                  desc="Data Table Cells"
                  dragData={{
                    type: 'table',
                    name: 'Data Table',
                    rows: 3,
                    cols: 3,
                    cells: [
                      [{ id: '1', content: 'Item', isHeader: true }, { id: '2', content: 'Qty', isHeader: true }, { id: '3', content: 'Unit', isHeader: true }],
                      [{ id: '4', content: 'Part A' }, { id: '5', content: '10' }, { id: '6', content: 'EA' }],
                      [{ id: '7', content: 'Part B' }, { id: '8', content: '25' }, { id: '9', content: 'KG' }],
                    ],
                    borderColor: '#000000',
                    borderWidth: 0.3,
                    headerBackground: '#f1f5f9',
                    rowHeight: 6,
                    fontSize: 8,
                    width: 60,
                    height: 18,
                  }}
                  onClick={() =>
                    onInsertElement({
                      type: 'table',
                      name: 'Data Table',
                      rows: 3,
                      cols: 3,
                      cells: [
                        [{ id: '1', content: 'Item', isHeader: true }, { id: '2', content: 'Qty', isHeader: true }, { id: '3', content: 'Unit', isHeader: true }],
                        [{ id: '4', content: 'Part A' }, { id: '5', content: '10' }, { id: '6', content: 'EA' }],
                        [{ id: '7', content: 'Part B' }, { id: '8', content: '25' }, { id: '9', content: 'KG' }],
                      ],
                      borderColor: '#000000',
                      borderWidth: 0.3,
                      headerBackground: '#f1f5f9',
                      rowHeight: 6,
                      fontSize: 8,
                      width: 60,
                      height: 18,
                    })
                  }
                />
              </div>
            </div>

            {/* Industrial Ready-Made Blocks */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Industrial Pre-Packaged Blocks</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="space-y-2">
                <IndustrialPresetCard
                  title="GS1-128 Logistics Pallet Block"
                  category="Logistics & Shipping"
                  desc="Complete SSCC-18, PO, and Ship-To address box with dual GS1 barcodes."
                  presetKey="gs1_logistics"
                  onClick={() => onInsertPreset('gs1_logistics')}
                />
                <IndustrialPresetCard
                  title="FDA UDI Medical Device Block"
                  category="Pharma & Healthcare"
                  desc="GS1 DataMatrix + (01) GTIN + (17) Expiry + (10) Lot + (21) Serial."
                  presetKey="fda_udi"
                  onClick={() => onInsertPreset('fda_udi')}
                />
                <IndustrialPresetCard
                  title="Chemical GHS Hazmat Diamond"
                  category="OSHA Hazmat"
                  desc="Red diamond border, DANGER signal word, and SDS QR code."
                  presetKey="ghs_chemical"
                  onClick={() => onInsertPreset('ghs_chemical')}
                />
                <IndustrialPresetCard
                  title="Retail Price & EAN-13 Tag"
                  category="Retail & Commercial"
                  desc="Brand header, product title, bold price, and EAN-13 barcode."
                  presetKey="retail_price"
                  onClick={() => onInsertPreset('retail_price')}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. LAYERS PANEL */}
        {activeTab === 'layers' && (
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Layers ({template.elements.length})</span>
              <span className="text-[10px] text-slate-400">Top to Bottom Z-Index</span>
            </div>

            {template.elements.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No elements on canvas</div>
            ) : (
              [...template.elements]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((el, index) => {
                  const isSelected = selectedElementIds.includes(el.id);
                  return (
                    <div
                      key={el.id}
                      onClick={(e) => onSelectElement(el.id, e.shiftKey)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                        {el.type === 'text' && <Type className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        {el.type === 'barcode' && <Barcode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {el.type === 'shape' && <Square className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {el.type === 'table' && <Table className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        {el.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />}

                        {editingLayerId === el.id ? (
                          <input
                            type="text"
                            defaultValue={el.name}
                            onBlur={(e) => {
                              onUpdateElement(el.id, { name: e.target.value });
                              setEditingLayerId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateElement(el.id, { name: (e.target as HTMLInputElement).value });
                                setEditingLayerId(null);
                              }
                            }}
                            autoFocus
                            className="bg-white border border-blue-400 px-1 py-0.5 rounded text-xs outline-none w-full"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => setEditingLayerId(el.id)}
                            className="truncate text-xs"
                            title="Double-click to rename"
                          >
                            {el.name}
                          </span>
                        )}
                      </div>

                      {/* Layer Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateElement(el.id, { visible: !el.visible });
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          title={el.visible ? 'Hide Layer' : 'Show Layer'}
                        >
                          {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateElement(el.id, { locked: !el.locked });
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          title={el.locked ? 'Unlock Layer' : 'Lock Layer'}
                        >
                          {el.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateElement(el.id);
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          title="Duplicate Layer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteElement(el.id);
                          }}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                          title="Delete Layer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* 3. VARIABLES & FORMULAS */}
        {activeTab === 'variables' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Variables ({template.variables.length})
              </div>
              <button
                onClick={() =>
                  onAddVariable({
                    id: `v-${Date.now()}`,
                    name: `VAR_${template.variables.length + 1}`,
                    type: 'static',
                    defaultValue: 'Value',
                  })
                }
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-2">
              {template.variables.map((v) => (
                <div key={v.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-700 text-xs">{`{{${v.name}}}`}</span>
                    <button
                      onClick={() => onDeleteVariable(v.id)}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Type</label>
                      <select
                        value={v.type}
                        onChange={(e) => onUpdateVariable(v.id, { type: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs outline-none"
                      >
                        <option value="static">Static Text</option>
                        <option value="counter">Auto Counter</option>
                        <option value="date">Live Date</option>
                        <option value="random">Random UUID</option>
                        <option value="gs1_ai">GS1 AI Code</option>
                        <option value="csv">CSV Column</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Default Value</label>
                      <input
                        type="text"
                        value={v.defaultValue}
                        onChange={(e) => onUpdateVariable(v.id, { defaultValue: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. DATA SOURCES */}
        {activeTab === 'data' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Data Records ({template.sampleRecords?.length || 0})
              </div>
              <button
                onClick={onImportCSV}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>
            </div>

            {/* Record Selector */}
            {template.sampleRecords && template.sampleRecords.length > 0 ? (
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-center justify-between">
                  <span>Active Preview Record:</span>
                  <span className="font-bold">
                    #{currentRecordIndex + 1} of {template.sampleRecords.length}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {template.sampleRecords.map((rec, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectRecordIndex(idx)}
                      className={`p-2 rounded border cursor-pointer text-xs font-mono transition-colors ${
                        currentRecordIndex === idx
                          ? 'bg-blue-600 text-white border-blue-700 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span>Record #{idx + 1}</span>
                      </div>
                      <div className="text-[10px] opacity-85 truncate">
                        {Object.entries(rec)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <Database className="w-8 h-8 mx-auto text-slate-300" />
                <p>No external records connected</p>
                <button
                  onClick={onImportCSV}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium shadow-xs"
                >
                  Upload CSV / Excel
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. TEMPLATES & MY DRAFTS BROWSER */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            {/* Quick Filter Pills for My Drafts & Printed */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setTemplateCategoryFilter('all')}
                className={`px-2 py-1 rounded text-[10.5px] font-semibold whitespace-nowrap transition-colors ${
                  templateCategoryFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTemplateCategoryFilter('my_drafts')}
                className={`px-2 py-1 rounded text-[10.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                  templateCategoryFilter === 'my_drafts'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>📂 My Drafts</span>
                <span className="text-[9px] opacity-80">
                  ({templatesList.filter((t) => (t.tags || []).some((tag) => ['Draft', 'Printed'].includes(tag)) || t.status === 'draft').length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateCategoryFilter('printed')}
                className={`px-2 py-1 rounded text-[10.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                  templateCategoryFilter === 'printed'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>🖨 Printed</span>
                <span className="text-[9px] opacity-80">
                  ({templatesList.filter((t) => (t.tags || []).includes('Printed')).length})
                </span>
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates or drafts..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none"
              >
                <option value="all">All Templates</option>
                <option value="my_drafts">📂 My Drafts (Saved & Printed)</option>
                <option value="printed">🖨 Printed History Templates</option>
                <option value="Logistics">Logistics & Shipping</option>
                <option value="Pharma & Healthcare">Pharma & Healthcare</option>
                <option value="Retail">Retail & Commercial</option>
                <option value="Chemical & GHS">Chemical & Hazmat</option>
                <option value="Manufacturing">Manufacturing & Parts</option>
              </select>
            </div>

            {/* Template List */}
            <div className="space-y-2">
              {templatesList
                .filter((t) => {
                  let matchCat = true;
                  if (templateCategoryFilter === 'my_drafts') {
                    matchCat = (t.tags || []).some((tag) => ['Draft', 'Printed'].includes(tag)) || t.status === 'draft';
                  } else if (templateCategoryFilter === 'printed') {
                    matchCat = (t.tags || []).includes('Printed');
                  } else if (templateCategoryFilter !== 'all') {
                    matchCat = t.category === templateCategoryFilter;
                  }

                  const matchSearch =
                    !templateSearch ||
                    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                    t.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
                    (t.tags || []).some((tag) => tag.toLowerCase().includes(templateSearch.toLowerCase()));

                  return matchCat && matchSearch;
                })
                .map((t) => {
                  const isPrinted = (t.tags || []).includes('Printed');
                  const isDraft = (t.tags || []).includes('Draft') || t.status === 'draft';

                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTemplate(t.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        template.id === t.id
                          ? 'bg-blue-50 border-blue-400 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-xs leading-snug">{t.name}</h4>
                          {isPrinted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              🖨 Printed
                            </span>
                          )}
                          {isDraft && !isPrinted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Draft
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {t.dimensions.width}x{t.dimensions.height}mm
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{t.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                        <span className="font-medium text-slate-600">{t.category}</span>
                        <span className="text-blue-600 font-medium hover:underline">Click to Edit →</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}> = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium text-[11px] border-b-2 transition-colors relative ${
      active
        ? 'border-blue-600 text-blue-600 bg-white font-semibold'
        : 'border-transparent text-slate-500 hover:text-slate-800'
    }`}
  >
    {icon}
    <span>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

const LibraryItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  dragData?: any;
}> = ({ icon, title, desc, onClick, dragData }) => (
  <button
    draggable={!!dragData}
    onDragStart={(e) => {
      if (dragData) {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'element', data: dragData }));
        e.dataTransfer.effectAllowed = 'copy';
      }
    }}
    onClick={onClick}
    className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all group flex flex-col justify-between cursor-grab active:cursor-grabbing hover:shadow-xs"
  >
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="font-semibold text-slate-800 group-hover:text-blue-900">{title}</span>
    </div>
    <span className="text-[10px] text-slate-400">{desc}</span>
  </button>
);

const IndustrialPresetCard: React.FC<{
  title: string;
  category: string;
  desc: string;
  presetKey: string;
  onClick: () => void;
}> = ({ title, category, desc, presetKey, onClick }) => (
  <button
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'preset', presetKey }));
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onClick={onClick}
    className="w-full p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all group space-y-1 cursor-grab active:cursor-grabbing hover:shadow-xs"
  >
    <div className="flex items-center justify-between">
      <span className="font-bold text-slate-800 group-hover:text-blue-900 text-xs">{title}</span>
      <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">
        {category}
      </span>
    </div>
    <p className="text-[10px] text-slate-500 leading-snug">{desc}</p>
  </button>
);
