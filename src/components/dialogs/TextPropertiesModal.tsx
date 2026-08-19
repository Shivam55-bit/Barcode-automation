import React, { useState, useEffect } from 'react';
import { TextElement, DataSourceItem, DataSourceType, TransformRule } from '../../types';
import { evaluateElementData, formatCustomDate } from '../../services/dataSourceEngine';
import {
  X,
  Minus,
  Square,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sliders,
  Database,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';

interface TextPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: TextElement | null;
  onUpdateElement: (id: string, updates: Partial<TextElement>) => void;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
}

type TextCategory =
  | 'text-format'
  | 'font'
  | 'border'
  | 'position'
  | 'datasources'
  | 'datasource-item';

const SAMPLE_DB_COLUMNS = [
  { name: 'Product_SKU', sample: 'SKU-99482' },
  { name: 'Product_Name', sample: 'Hydrating Facial Cleanser' },
  { name: 'Batch_Lot', sample: 'LOT-2026-X89' },
  { name: 'Expiry_Date', sample: '2027-12-31' },
  { name: 'Serial_Number', sample: 'SN-0004921' },
  { name: 'Price_USD', sample: '24.99' },
];

export const TextPropertiesModal: React.FC<TextPropertiesModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  availableVariables = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TextCategory>('datasource-item');
  const [activeDsIndex, setActiveDsIndex] = useState<number>(0);
  const [activeDsTab, setActiveDsTab] = useState<'source' | 'type' | 'transforms'>('source');

  // Local state
  const [name, setName] = useState('Text 1');
  const [text, setText] = useState('Sample Text');
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);

  // Font
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [color, setColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  // Format
  const [wordWrap, setWordWrap] = useState(false);
  const [autoSize, setAutoSize] = useState(false);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [letterSpacing, setLetterSpacing] = useState(0);

  // Position
  const [posX, setPosX] = useState(10);
  const [posY, setPosY] = useState(10);
  const [widthMm, setWidthMm] = useState(40);
  const [heightMm, setHeightMm] = useState(10);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  useEffect(() => {
    if (element && isOpen) {
      setName(element.name || 'Text 1');
      setText(element.text || 'Sample Text');

      if (element.dataSources && element.dataSources.length > 0) {
        setDataSources(JSON.parse(JSON.stringify(element.dataSources)));
      } else {
        setDataSources([
          {
            id: `ds-${Date.now()}`,
            name: 'Primary Text Source',
            type: element.dataBinding ? 'variable' : 'embedded',
            value: element.text || 'Sample Text',
            variableName: element.dataBinding ? element.dataBinding.replace(/[{}]/g, '') : undefined,
            enabled: true,
          },
        ]);
      }
      setActiveDsIndex(0);

      setFontFamily(element.fontFamily || 'Arial');
      setFontSize(element.fontSize || 12);
      setFontWeight((element.fontWeight as any) || 'normal');
      setFontStyle((element.fontStyle as any) || 'normal');
      setColor(element.color || '#000000');
      setTextAlign((element.textAlign as any) || 'left');

      setWordWrap(!!element.wordWrap);
      setAutoSize(!!element.autoSize);
      setLineHeight(element.lineHeight || 1.2);
      setLetterSpacing(element.letterSpacing || 0);

      setPosX(element.x || 10);
      setPosY(element.y || 10);
      setWidthMm(element.width || 40);
      setHeightMm(element.height || 10);
      setRotation((element.rotation as any) || 0);
    }
  }, [element, isOpen]);

  if (!isOpen || !element) return null;

  const applyChange = (updates: Partial<TextElement>) => {
    onUpdateElement(element.id, updates);
  };

  const currentDsIndex = Math.max(0, Math.min(activeDsIndex, dataSources.length - 1));
  const activeDataSource: DataSourceItem = dataSources[currentDsIndex] || {
    id: 'ds-default',
    name: 'Embedded Source',
    type: 'embedded',
    value: text || 'Sample Text',
    enabled: true,
  };

  const updateDataSourcesState = (newSources: DataSourceItem[]) => {
    setDataSources(newSources);
    const simulatedElement = { ...element, dataSources: newSources };
    const compiled = evaluateElementData(simulatedElement as any, {});
    setText(compiled);
    applyChange({
      dataSources: newSources,
      text: compiled,
    });
  };

  const updateActiveDataSource = (updates: Partial<DataSourceItem>) => {
    const updated = dataSources.map((ds, idx) => (idx === currentDsIndex ? { ...ds, ...updates } : ds));
    updateDataSourcesState(updated);
  };

  const handleAddNewDataSource = (type: DataSourceType = 'embedded') => {
    const newId = `ds-${Date.now()}`;
    const newDs: DataSourceItem = {
      id: newId,
      name: `Source ${dataSources.length + 1}`,
      type,
      value: type === 'embedded' ? 'New Text' : type === 'serial' ? '1' : '',
      serialStart: 1,
      serialStep: 1,
      serialPad: 6,
      dateFormat: 'YYYY-MM-DD',
      enabled: true,
    };
    const nextList = [...dataSources, newDs];
    updateDataSourcesState(nextList);
    setActiveDsIndex(nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  const handleDeleteActiveDataSource = () => {
    if (dataSources.length <= 1) {
      alert('A text element must have at least one data source.');
      return;
    }
    const nextList = dataSources.filter((_, idx) => idx !== currentDsIndex);
    updateDataSourcesState(nextList);
    setActiveDsIndex(Math.max(0, currentDsIndex - 1));
  };

  const handleMoveDataSource = (direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? currentDsIndex - 1 : currentDsIndex + 1;
    if (targetIdx < 0 || targetIdx >= dataSources.length) return;
    const nextList = [...dataSources];
    const temp = nextList[currentDsIndex];
    nextList[currentDsIndex] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    updateDataSourcesState(nextList);
    setActiveDsIndex(targetIdx);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[840px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Type className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Text Object Properties — [{name}]
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="w-8 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs ml-1 shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex flex-1 min-h-[480px] max-h-[560px] bg-white">
          {/* LEFT SIDEBAR: Object Tree */}
          <div className="w-60 bg-[#f8fafc] border-r border-[#cbd5e1] flex flex-col justify-between select-none">
            <div className="p-2 space-y-0.5 text-[11.5px] overflow-y-auto max-h-[420px]">
              {/* Root */}
              <div
                onClick={() => setSelectedCategory('font')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs cursor-pointer font-bold text-slate-900 hover:bg-[#e2e8f0]"
              >
                <span className="text-pink-600 font-serif font-bold text-xs">Aᵃ</span>
                <span>{name}</span>
              </div>

              {/* Font */}
              <div
                onClick={() => setSelectedCategory('font')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'font'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <span className={selectedCategory === 'font' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                <span>Font & Typography</span>
              </div>

              {/* Text Format */}
              <div
                onClick={() => setSelectedCategory('text-format')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'text-format'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <span className={selectedCategory === 'text-format' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                <span>Text Format & Alignment</span>
              </div>

              {/* Position */}
              <div
                onClick={() => setSelectedCategory('position')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'position'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <span className={selectedCategory === 'position' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                <span>Position & Size</span>
              </div>

              {/* Data Sources Root */}
              <div
                onClick={() => setSelectedCategory('datasources')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-1 rounded-xs cursor-pointer font-bold ${
                  selectedCategory === 'datasources'
                    ? 'bg-[#0078d7] text-white shadow-2xs'
                    : 'text-slate-900 hover:bg-[#e2e8f0]'
                }`}
              >
                <span className={selectedCategory === 'datasources' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                <span className="bg-slate-300 text-slate-800 text-[9px] px-0.8 py-0.2 rounded font-mono font-bold">ab</span>
                <span>Data Sources ({dataSources.length})</span>
              </div>

              {/* Data Source Items */}
              {dataSources.map((ds, idx) => {
                const isSelected = selectedCategory === 'datasource-item' && currentDsIndex === idx;
                return (
                  <div
                    key={ds.id || idx}
                    onClick={() => {
                      setActiveDsIndex(idx);
                      setSelectedCategory('datasource-item');
                    }}
                    className={`flex items-center gap-1.5 pl-10 pr-2 py-1 rounded-xs cursor-pointer font-medium ${
                      isSelected ? 'bg-[#0078d7] text-white font-bold shadow-2xs' : 'text-slate-800 hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <span className={isSelected ? 'text-blue-200 font-mono text-[9px]' : 'text-slate-400 font-mono text-[9px]'}>
                      ....
                    </span>
                    <span>💾</span>
                    <span className="truncate max-w-[120px]">{ds.name || ds.value || 'Text Source'}</span>
                  </div>
                );
              })}
            </div>

            {/* Tree Bottom Action Buttons */}
            <div className="p-1.5 bg-[#e2e8f0] border-t border-[#cbd5e1] flex items-center justify-between text-slate-700">
              <div className="flex items-center gap-1">
                <button
                  title="Add Data Source (+)"
                  onClick={() => handleAddNewDataSource('embedded')}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Delete Selected Data Source"
                  onClick={handleDeleteActiveDataSource}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Copy Value"
                  onClick={() => navigator.clipboard?.writeText(activeDataSource.value || text)}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  title="Move Up"
                  onClick={() => handleMoveDataSource('up')}
                  disabled={currentDsIndex <= 0}
                  className="p-1 hover:bg-[#cbd5e1] disabled:opacity-30 rounded-xs text-slate-700"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Move Down"
                  onClick={() => handleMoveDataSource('down')}
                  disabled={currentDsIndex >= dataSources.length - 1}
                  className="p-1 hover:bg-[#cbd5e1] disabled:opacity-30 rounded-xs text-slate-700"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT MAIN PANEL */}
          <div className="flex-1 p-5 bg-white overflow-y-auto">
            {/* 1. FONT */}
            {selectedCategory === 'font' && (
              <div className="space-y-4 text-[12px]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-medium">Font Family:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => {
                        setFontFamily(e.target.value);
                        applyChange({ fontFamily: e.target.value });
                      }}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="OCR-A Extended">OCR-A Extended</option>
                      <option value="OCR-B 10 Pitch BT">OCR-B 10 Pitch BT</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-medium">Font Size (pt):</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => {
                        const s = parseInt(e.target.value) || 12;
                        setFontSize(s);
                        applyChange({ fontSize: s });
                      }}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="w-20 text-slate-700">Text Color:</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        applyChange({ color: e.target.value });
                      }}
                      className="w-24 h-6 border border-[#94a3b8] rounded-xs cursor-pointer p-0"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fontWeight === 'bold'}
                        onChange={(e) => {
                          const w = e.target.checked ? 'bold' : 'normal';
                          setFontWeight(w);
                          applyChange({ fontWeight: w });
                        }}
                      />
                      <span className="font-bold">Bold</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fontStyle === 'italic'}
                        onChange={(e) => {
                          const s = e.target.checked ? 'italic' : 'normal';
                          setFontStyle(s);
                          applyChange({ fontStyle: s });
                        }}
                      />
                      <span className="italic">Italic</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TEXT FORMAT */}
            {selectedCategory === 'text-format' && (
              <div className="space-y-4 text-[12px]">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Paragraph Alignment</legend>
                  <div className="flex items-center gap-2">
                    {[
                      { id: 'left', icon: <AlignLeft className="w-4 h-4" />, label: 'Left' },
                      { id: 'center', icon: <AlignCenter className="w-4 h-4" />, label: 'Center' },
                      { id: 'right', icon: <AlignRight className="w-4 h-4" />, label: 'Right' },
                      { id: 'justify', icon: <AlignJustify className="w-4 h-4" />, label: 'Justify' },
                    ].map((align) => (
                      <button
                        key={align.id}
                        type="button"
                        onClick={() => {
                          setTextAlign(align.id as any);
                          applyChange({ textAlign: align.id as any });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xs border cursor-pointer ${
                          textAlign === align.id
                            ? 'bg-[#0078d7] text-white border-[#005a9e] font-bold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {align.icon}
                        <span>{align.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Text Fitting & Wrapping</legend>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wordWrap}
                        onChange={(e) => {
                          setWordWrap(e.target.checked);
                          applyChange({ wordWrap: e.target.checked });
                        }}
                      />
                      <span>Word Wrap (Break text into multiple lines automatically)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSize}
                        onChange={(e) => {
                          setAutoSize(e.target.checked);
                          applyChange({ autoSize: e.target.checked });
                        }}
                      />
                      <span>Auto-Size Font (Shrink font size to fit bounding box)</span>
                    </label>
                  </div>
                </fieldset>
              </div>
            )}

            {/* 3. POSITION */}
            {selectedCategory === 'position' && (
              <div className="space-y-4 text-[12px]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <label className="w-12 text-slate-700">X (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={posX}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setPosX(v);
                        applyChange({ x: v });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="w-12 text-slate-700">Y (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={posY}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setPosY(v);
                        applyChange({ y: v });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <label className="w-12 text-slate-700">Width:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={widthMm}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 10;
                        setWidthMm(v);
                        applyChange({ width: v });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="w-12 text-slate-700">Height:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={heightMm}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 5;
                        setHeightMm(v);
                        applyChange({ height: v });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. DATA SOURCES OVERVIEW */}
            {selectedCategory === 'datasources' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="text-xs font-bold text-blue-950 mb-1">Compiled Text Output:</div>
                  <div className="p-2 bg-white border border-blue-300 rounded font-mono text-sm font-bold text-slate-900 select-all">
                    {text}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Concatenated Data Sources ({dataSources.length})
                    </span>
                    <button
                      onClick={() => handleAddNewDataSource('embedded')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Data Source</span>
                    </button>
                  </div>

                  <div className="border border-slate-300 rounded-xs overflow-hidden divide-y divide-slate-200">
                    {dataSources.map((ds, idx) => (
                      <div
                        key={ds.id || idx}
                        onClick={() => {
                          setActiveDsIndex(idx);
                          setSelectedCategory('datasource-item');
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          idx === currentDsIndex ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{ds.name || `Source ${idx + 1}`}</div>
                            <div className="text-[11px] font-mono text-slate-600 truncate max-w-[280px]">
                              {ds.value || 'Text Value'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. ACTIVE DATA SOURCE ITEM */}
            {selectedCategory === 'datasource-item' && (
              <div className="space-y-4">
                <div className="flex border-b border-[#94a3b8] text-[12px]">
                  <button
                    onClick={() => setActiveDsTab('source')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${
                      activeDsTab === 'source'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Data Source
                  </button>
                  <button
                    onClick={() => setActiveDsTab('transforms')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${
                      activeDsTab === 'transforms'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Transforms ({activeDataSource.transforms?.length || 0})
                  </button>
                </div>

                {activeDsTab === 'source' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Source Name:</label>
                      <input
                        type="text"
                        value={activeDataSource.name || `Source ${currentDsIndex + 1}`}
                        onChange={(e) => updateActiveDataSource({ name: e.target.value })}
                        className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Type:</label>
                      <select
                        value={activeDataSource.type || 'embedded'}
                        onChange={(e) => updateActiveDataSource({ type: e.target.value as any })}
                        className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium cursor-pointer"
                      >
                        <option value="embedded">💾 Embedded Constant Data</option>
                        <option value="database">🗄️ Database Field</option>
                        <option value="serial">🔢 Serial Number / Counter</option>
                        <option value="clock">🕒 Clock / Dynamic Timestamp</option>
                        <option value="variable">🔗 Named Template Variable</option>
                        <option value="system">⚙️ System Variable</option>
                        <option value="script">⚡ JavaScript Expression</option>
                      </select>
                    </div>

                    {activeDataSource.type === 'embedded' && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-slate-700 font-medium">Embedded Constant Text:</label>
                        <textarea
                          rows={5}
                          value={activeDataSource.value || ''}
                          onChange={(e) => updateActiveDataSource({ value: e.target.value })}
                          className="w-full bg-white border border-[#94a3b8] rounded p-2 font-mono text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                        />
                      </div>
                    )}

                    {activeDataSource.type === 'database' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded">
                        <div className="flex items-center gap-3">
                          <label className="w-28 text-slate-700 font-medium">Database Field:</label>
                          <select
                            value={activeDataSource.databaseField || ''}
                            onChange={(e) => updateActiveDataSource({ databaseField: e.target.value, value: `{{${e.target.value}}}` })}
                            className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium"
                          >
                            <option value="">-- Select Field Column --</option>
                            {SAMPLE_DB_COLUMNS.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} (e.g. {col.sample})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[12px] font-medium shadow-2xs cursor-pointer min-w-[80px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
