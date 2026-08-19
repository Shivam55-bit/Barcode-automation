import React, { useState, useEffect, useRef } from 'react';
import { BarcodeElement, BarcodeSymbology, DataSourceItem, DataSourceType, TransformRule, GS1Field } from '../../types';
import { SYMBOLOGY_CATALOG } from '../../services/barcodeEngine';
import { evaluateElementData, formatCustomDate } from '../../services/dataSourceEngine';
import {
  GS1_AI_DICTIONARY,
  calculateGS1CheckDigit,
  validateGS1CheckDigit,
  parseGS1BracketedString,
} from '../../services/gs1Engine';
import {
  X,
  Minus,
  Square,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sparkles,
  Database,
  Sliders,
  Check,
  Globe,
  Layers,
  BarChart2,
  Calendar,
  Hash,
  Clock,
  Link as LinkIcon,
  Code2,
  ChevronDown,
} from 'lucide-react';

import { GS1ApplicationIdentifierWizardModal } from './GS1ApplicationIdentifierWizardModal';

interface BarcodePropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: BarcodeElement | null;
  onUpdateElement: (id: string, updates: Partial<BarcodeElement>) => void;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  onOpenGs1Wizard?: () => void;
}

type PropertyCategory =
  | 'symbology'
  | 'human-readable'
  | 'font'
  | 'text-format'
  | 'border'
  | 'position'
  | 'datasources'
  | 'datasource-item';

type DataSourceTab = 'source' | 'type' | 'transforms';

const SAMPLE_DB_COLUMNS = [
  { name: 'Product_SKU', sample: 'SKU-99482' },
  { name: 'Product_Name', sample: 'Hydrating Facial Cleanser' },
  { name: 'Batch_Lot', sample: 'LOT-2026-X89' },
  { name: 'Expiry_Date', sample: '2027-12-31' },
  { name: 'Serial_Number', sample: 'SN-0004921' },
  { name: 'Price_USD', sample: '24.99' },
  { name: 'GTIN_14', sample: '00850006531234' },
  { name: 'SSCC_18', sample: '008500060000000019' },
  { name: 'Warehouse_Bin', sample: 'BIN-D-42' },
];

export const BarcodePropertiesModal: React.FC<BarcodePropertiesModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  availableVariables = [],
  onOpenGs1Wizard,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('datasource-item');
  const [activeDsIndex, setActiveDsIndex] = useState<number>(0);
  const [activeDsTab, setActiveDsTab] = useState<DataSourceTab>('source');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isGs1AiWizardOpen, setIsGs1AiWizardOpen] = useState<boolean>(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Form local state mirrored from selected element
  const [name, setName] = useState('Barcode 2');
  const [symbology, setSymbology] = useState<BarcodeSymbology>('code128');
  const [value, setValue] = useState('12345678');
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);

  // Symbology & Dimensions
  const [xDimension, setXDimension] = useState(0.78);
  const [heightMm, setHeightMm] = useState(12.7);
  const [checkDigit, setCheckDigit] = useState(true);
  const [barcodeColor, setBarcodeColor] = useState('#000000');

  // Human Readable
  const [hrVisibility, setHrVisibility] = useState<'full' | 'none' | 'custom'>('full');
  const [hrPlacement, setHrPlacement] = useState<'Bottom' | 'Top' | 'None'>('Bottom');
  const [hrAlignment, setHrAlignment] = useState<'Centered' | 'Left' | 'Right'>('Centered');

  // Font
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [pointSize, setPointSize] = useState(12);

  // Border
  const [borderType, setBorderType] = useState<'none' | 'rectangle' | 'ellipse'>('none');

  // Position
  const [posX, setPosX] = useState(10.9);
  const [posY, setPosY] = useState(22.1);
  const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  // Sync state when element opens or changes
  useEffect(() => {
    if (element && isOpen) {
      setName(element.name || 'Barcode 2');
      setSymbology(element.symbology || 'code128');
      setValue(element.value || '12345678');

      // Initialize dataSources
      if (element.dataSources && element.dataSources.length > 0) {
        setDataSources(JSON.parse(JSON.stringify(element.dataSources)));
      } else {
        const initialDs: DataSourceItem = {
          id: `ds-${Date.now()}`,
          name: 'Primary Data Source',
          type: element.dataBinding ? 'variable' : 'embedded',
          value: element.value || '12345678',
          variableName: element.dataBinding ? element.dataBinding.replace(/[{}]/g, '') : undefined,
          enabled: true,
        };
        setDataSources([initialDs]);
      }
      setActiveDsIndex(0);

      setHeightMm(element.height || 12.7);
      setXDimension(element.barWidth ? Number((element.barWidth * 0.35).toFixed(2)) : 0.78);
      setBarcodeColor(element.foregroundColor || '#000000');
      setCheckDigit(element.checkDigit !== false);

      setHrVisibility(element.includeText === false ? 'none' : 'full');
      setHrPlacement(element.textPosition === 'above' ? 'Top' : element.textPosition === 'none' ? 'None' : 'Bottom');
      setHrAlignment(element.humanReadableAlignment === 'left' ? 'Left' : element.humanReadableAlignment === 'right' ? 'Right' : 'Centered');

      setSelectedFont(element.humanReadableFont || 'Arial');
      setPointSize(element.humanReadableFontSize || 12);
      setBorderType(element.borderType || 'none');

      setPosX(element.x || 10.9);
      setPosY(element.y || 22.1);
      setRotationAngle((element.rotation as any) || 0);
    }
  }, [element, isOpen]);

  if (!isOpen || !element) return null;

  const applyChange = (updates: Partial<BarcodeElement>) => {
    onUpdateElement(element.id, updates);
  };

  const currentDsIndex = Math.max(0, Math.min(activeDsIndex, dataSources.length - 1));
  const activeDataSource: DataSourceItem = dataSources[currentDsIndex] || {
    id: 'ds-default',
    name: 'Embedded Source',
    type: 'embedded',
    value: value || '12345678',
    enabled: true,
  };

  const updateDataSourcesState = (newSources: DataSourceItem[]) => {
    setDataSources(newSources);
    const simulatedElement = { ...element, dataSources: newSources };
    const compiled = evaluateElementData(simulatedElement as any, {});
    setValue(compiled);
    applyChange({
      dataSources: newSources,
      value: compiled,
    });
  };

  const updateActiveDataSource = (updates: Partial<DataSourceItem>) => {
    const updated = dataSources.map((ds, idx) => (idx === currentDsIndex ? { ...ds, ...updates } : ds));
    updateDataSourcesState(updated);
  };

  // Add a new Data Source (Supports standard & GS1 Wizards)
  const handleAddNewDataSource = (type: DataSourceType) => {
    setIsAddMenuOpen(false);
    if (type === 'gs1_ai') {
      setIsGs1AiWizardOpen(true);
      return;
    }

    const newId = `ds-${Date.now()}`;
    let newDs: DataSourceItem;

    if (type === 'gs1_composite') {
      newDs = {
        id: newId,
        name: 'GS1 Composite Source',
        type: 'gs1_composite',
        value: '(01)00850006531234|(10)LOT456(17)261231',
        gs1CompositeType: 'CC-A',
        gs1CompositeLinear: '(01)00850006531234',
        gs1Composite2DData: '(10)LOT456(17)261231',
        enabled: true,
      };
    } else if (type === 'gs1_databar') {
      newDs = {
        id: newId,
        name: 'GS1 DataBar Source',
        type: 'gs1_databar',
        value: '(01)00850006531234',
        gs1DataBarVariant: 'omnidirectional',
        gs1AIs: [
          { ai: '01', value: '00850006531234', description: 'GTIN-14 Item Code', dataTitle: 'GTIN' },
        ],
        enabled: true,
      };
    } else {
      newDs = {
        id: newId,
        name: `Source ${dataSources.length + 1}`,
        type,
        value: type === 'embedded' ? '12345678' : type === 'serial' ? '1' : '',
        serialStart: 1,
        serialStep: 1,
        serialPad: 6,
        dateFormat: 'YYYY-MM-DD',
        enabled: true,
      };
    }

    const nextList = [...dataSources, newDs];
    updateDataSourcesState(nextList);
    setActiveDsIndex(nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  const handleApplyGs1Wizard = (fields: GS1Field[], replaceMode: 'replace' | 'insert' | 'append') => {
    const newId = `ds-${Date.now()}`;
    const compiledVal = fields.map((f) => `(${f.ai})${f.value}`).join('');
    const newDs: DataSourceItem = {
      id: newId,
      name: 'GS1 Application Identifier',
      type: 'gs1_ai',
      value: compiledVal,
      gs1AIs: fields,
      enabled: true,
    };

    let nextList: DataSourceItem[];
    if (replaceMode === 'replace') {
      nextList = [newDs];
    } else if (replaceMode === 'insert') {
      nextList = [...dataSources];
      nextList.splice(currentDsIndex, 0, newDs);
    } else {
      nextList = [...dataSources, newDs];
    }

    updateDataSourcesState(nextList);
    setActiveDsIndex(replaceMode === 'insert' ? currentDsIndex : nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  const handleDeleteActiveDataSource = () => {
    if (dataSources.length <= 1) {
      alert('A barcode element must have at least one data source.');
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

  // Get icon and label for tree display
  const getDsTreeMeta = (ds: DataSourceItem) => {
    switch (ds.type) {
      case 'gs1_ai': {
        const preview = ds.gs1AIs && ds.gs1AIs.length > 0
          ? ds.gs1AIs.map(a => `(${a.ai})`).join('')
          : '(01)...';
        return { icon: '🌐', label: `GS1 AI ${preview}` };
      }
      case 'gs1_composite':
        return { icon: '🧩', label: `GS1 Comp (${ds.gs1CompositeType || 'CC-A'})` };
      case 'gs1_databar':
        return { icon: '📊', label: `DataBar (${ds.gs1DataBarVariant || 'Omni'})` };
      case 'database':
        return { icon: '🗄️', label: ds.databaseField ? `[DB] ${ds.databaseField}` : (ds.name || 'DB Field') };
      case 'serial':
        return { icon: '🔢', label: ds.serialPrefix ? `${ds.serialPrefix}000001` : (ds.name || 'SN Counter') };
      case 'clock':
        return { icon: '🕒', label: ds.dateFormat ? formatCustomDate(new Date(), ds.dateFormat) : 'Date' };
      case 'variable':
        return { icon: '🔗', label: ds.variableName ? `{{${ds.variableName}}}` : (ds.name || 'Variable') };
      case 'system':
        return { icon: '⚙️', label: ds.systemVarName || 'SYSTEM.DATE' };
      case 'script':
        return { icon: '⚡', label: ds.name || 'Script' };
      default:
        return { icon: '💾', label: ds.value || '12345678' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      {/* BarTender Window Frame */}
      <div
        className="w-[890px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-amber-400 to-cyan-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <div className="w-full h-full bg-white/90 rounded-xs flex items-center justify-center font-bold text-[8px] text-cyan-800">
                |||
              </div>
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Barcode Properties — [{name}]
            </span>
          </div>

          <div className="flex items-center">
            <button
              title="Minimize"
              className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-300/60 rounded-xs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              title="Maximize"
              className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-300/60 rounded-xs"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs ml-1 shadow-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex flex-1 min-h-[500px] max-h-[600px] bg-white relative">
          {/* LEFT SIDEBAR: Navigation Tree */}
          <div className="w-64 bg-[#f8fafc] border-r border-[#cbd5e1] flex flex-col justify-between select-none relative">
            <div>
              {/* Top Action Bar */}
              <div className="bg-[#e2e8f0] border-b border-[#cbd5e1] p-1 flex items-center gap-1 text-slate-700">
                <button
                  title="Add Data Source..."
                  onClick={() => setIsAddMenuOpen((prev) => !prev)}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-blue-700 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                <button
                  title="GS1 AI Wizard"
                  onClick={() => handleAddNewDataSource('gs1_ai')}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-emerald-600"
                >
                  <Globe className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Link Database Source"
                  onClick={() => handleAddNewDataSource('database')}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-slate-700"
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="p-2 space-y-0.5 text-[11.5px] overflow-y-auto max-h-[440px]">
                {/* Root Object Header */}
                <div
                  onClick={() => setSelectedCategory('symbology')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-xs cursor-pointer font-bold ${
                    selectedCategory === 'symbology'
                      ? 'bg-[#cce0f5] text-slate-950 ring-1 ring-[#70a5d6]'
                      : 'text-slate-900 hover:bg-[#e2e8f0]'
                  }`}
                >
                  <span className="font-mono text-[9px] bg-slate-200 px-1 py-0.2 rounded text-slate-700 font-bold">|||| 123</span>
                  <span>{name || 'Barcode 2'}</span>
                </div>

                {/* Sub Tree: Symbology and Size */}
                <div
                  onClick={() => setSelectedCategory('symbology')}
                  className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                    selectedCategory === 'symbology'
                      ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span className={selectedCategory === 'symbology' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <span className="font-mono text-[9px]">|||||</span>
                  <span>Symbology and Size</span>
                </div>

                {/* Human Readable */}
                <div
                  onClick={() => setSelectedCategory('human-readable')}
                  className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                    selectedCategory === 'human-readable'
                      ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span className={selectedCategory === 'human-readable' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <span className="text-[10px] font-bold">123</span>
                  <span>Human Readable</span>
                </div>

                {/* Font */}
                <div
                  onClick={() => setSelectedCategory('font')}
                  className={`flex items-center gap-1.5 pl-8 pr-2 py-0.8 rounded-xs cursor-pointer ${
                    selectedCategory === 'font'
                      ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span className={selectedCategory === 'font' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <span className="text-[10px] font-serif font-bold text-pink-500">Aᵃ</span>
                  <span>Font</span>
                </div>

                {/* Text Format */}
                <div
                  onClick={() => setSelectedCategory('text-format')}
                  className={`flex items-center gap-1.5 pl-8 pr-2 py-0.8 rounded-xs cursor-pointer ${
                    selectedCategory === 'text-format'
                      ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span className={selectedCategory === 'text-format' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <span className="text-[10px] font-mono underline">A</span>
                  <span>Text Format</span>
                </div>

                {/* Border */}
                <div
                  onClick={() => setSelectedCategory('border')}
                  className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                    selectedCategory === 'border'
                      ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span className={selectedCategory === 'border' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <div className={`w-2.5 h-2.5 border ${selectedCategory === 'border' ? 'border-white' : 'border-slate-700'}`} />
                  <span>Border</span>
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
                  <span className="text-[10px]">⏢</span>
                  <span>Position</span>
                </div>

                {/* Data Sources Root Header */}
                <div
                  onClick={() => setSelectedCategory('datasources')}
                  className={`flex items-center gap-1.5 pl-6 pr-2 py-1 rounded-xs cursor-pointer font-bold transition-colors ${
                    selectedCategory === 'datasources'
                      ? 'bg-[#0078d7] text-white shadow-2xs'
                      : 'text-slate-900 hover:bg-[#e2e8f0]'
                  }`}
                >
                  <span className={selectedCategory === 'datasources' ? 'text-blue-200' : 'text-slate-400 font-mono text-[9px]'}>....</span>
                  <span className="bg-slate-300 text-slate-800 text-[9px] px-0.8 py-0.2 rounded font-mono font-bold">ab</span>
                  <span>Data Sources ({dataSources.length})</span>
                </div>

                {/* All Child Data Source Items in Tree */}
                {dataSources.map((ds, idx) => {
                  const meta = getDsTreeMeta(ds);
                  const isSelected = selectedCategory === 'datasource-item' && currentDsIndex === idx;

                  return (
                    <div
                      key={ds.id || idx}
                      onClick={() => {
                        setActiveDsIndex(idx);
                        setSelectedCategory('datasource-item');
                      }}
                      className={`flex items-center gap-1.5 pl-10 pr-2 py-1 rounded-xs cursor-pointer font-medium transition-all ${
                        isSelected
                          ? 'bg-[#0078d7] text-white font-bold shadow-2xs'
                          : 'text-slate-800 hover:bg-[#e2e8f0]'
                      }`}
                    >
                      <span className={isSelected ? 'text-blue-200 font-mono text-[9px]' : 'text-slate-400 font-mono text-[9px]'}>
                        ....
                      </span>
                      <span className="text-xs">{meta.icon}</span>
                      <span className="truncate max-w-[130px]">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tree Bottom Action Buttons matching BarTender Screenshot */}
            <div className="p-1.5 bg-[#e2e8f0] border-t border-[#cbd5e1] flex items-center justify-between text-slate-700 relative">
              <div className="flex items-center gap-1">
                {/* 1. Add (+) Button with GS1 Dropdown Menu */}
                <div className="relative">
                  <button
                    title="Add Data Source..."
                    onClick={() => setIsAddMenuOpen((prev) => !prev)}
                    className="p-1 hover:bg-[#cbd5e1] rounded-xs text-amber-600 flex items-center cursor-pointer"
                  >
                    <span className="text-sm font-bold leading-none">🌻</span>
                  </button>
                </div>

                {/* 2. Wizard Action */}
                <button
                  title="GS1 Application Identifier Wizard"
                  onClick={() => handleAddNewDataSource('gs1_ai')}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-blue-700"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* 3. Delete */}
                <button
                  title="Delete Selected Data Source"
                  onClick={handleDeleteActiveDataSource}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* 4. Copy */}
                <button
                  title="Copy Value"
                  onClick={() => navigator.clipboard?.writeText(activeDataSource.value || value)}
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

            {/* GS1 & Standard Data Sources Dropdown Menu matching User Screenshot */}
            {isAddMenuOpen && (
              <div
                ref={addMenuRef}
                className="absolute bottom-8 left-2 w-72 bg-white border border-[#94a3b8] shadow-2xl rounded-xs py-1 z-50 text-[11.5px] text-slate-800 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* 1. GS1 Specific Options (Highlighted Top) */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                  GS1 Wizards
                </div>
                <button
                  onClick={() => handleAddNewDataSource('gs1_ai')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white" />
                  <span>GS1 Application Identifier Data Source Wizard</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('gs1_composite')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-600 group-hover:text-white" />
                  <span>GS1 Composite Data Source Wizard</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('gs1_databar')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600 group-hover:text-white" />
                  <span>GS1 DataBar Data Source Wizard</span>
                </button>

                <div className="my-1 border-t border-slate-200" />

                {/* 2. Standard Enterprise Data Source Options */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                  Standard Data Sources
                </div>
                <button
                  onClick={() => handleAddNewDataSource('embedded')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Embedded Constant Data</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('database')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🗄️</span>
                  <span>Database Field Connection</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('serial')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🔢</span>
                  <span>Serial Number / Counter</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('clock')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🕒</span>
                  <span>Clock / Dynamic Date Offset</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('variable')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🔗</span>
                  <span>Template Variable Link</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('system')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>⚙️</span>
                  <span>System Machine Variable</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('script')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>⚡</span>
                  <span>JavaScript Expression</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT MAIN PANEL: Tabs & Property Inputs */}
          <div className="flex-1 p-5 bg-white overflow-y-auto">
            {/* ========================================================================= */}
            {/* 1. SYMBOLOGY AND SIZE                                                     */}
            {/* ========================================================================= */}
            {selectedCategory === 'symbology' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="w-24 text-slate-700 text-[12px]">Symbology:</label>
                  <select
                    value={symbology}
                    onChange={(e) => {
                      const sym = e.target.value as BarcodeSymbology;
                      setSymbology(sym);
                      applyChange({ symbology: sym });
                    }}
                    className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-[12px] text-slate-900 font-medium"
                  >
                    {SYMBOLOGY_CATALOG.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5">
                  <legend className="px-1 text-slate-700 font-medium">Dimensions</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="w-20 text-slate-700">X Dimension:</label>
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="number"
                          step={0.01}
                          value={xDimension}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.78;
                            setXDimension(val);
                            applyChange({ barWidth: Math.max(1, Math.round(val / 0.35)) });
                          }}
                          className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                        />
                        <span className="text-slate-600 text-[11px]">mm</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-16 text-slate-700">Height:</label>
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="number"
                          step={0.1}
                          value={heightMm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 12.7;
                            setHeightMm(val);
                            applyChange({ height: val });
                          }}
                          className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                        />
                        <span className="text-slate-600 text-[11px]">mm</span>
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5">
                  <legend className="px-1 text-slate-700 font-medium">Options</legend>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkDigit}
                      onChange={(e) => {
                        setCheckDigit(e.target.checked);
                        applyChange({ checkDigit: e.target.checked });
                      }}
                      className="rounded-xs text-blue-600"
                    />
                    <span>Include Automated Check Digit (Modulo 10 / 43 / 103)</span>
                  </label>

                  <button
                    onClick={() => handleAddNewDataSource('gs1_ai')}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-3 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-slate-700 font-medium text-[11.5px] cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Create GS1 Application Identifier Data Source...</span>
                  </button>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 2. HUMAN READABLE                                                         */}
            {/* ========================================================================= */}
            {selectedCategory === 'human-readable' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2">
                  <legend className="px-1 text-slate-700 font-medium">Visibility</legend>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="hr-vis"
                        checked={hrVisibility === 'full'}
                        onChange={() => {
                          setHrVisibility('full');
                          applyChange({ includeText: true });
                        }}
                      />
                      <span>Full</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="hr-vis"
                        checked={hrVisibility === 'none'}
                        onChange={() => {
                          setHrVisibility('none');
                          applyChange({ includeText: false });
                        }}
                      />
                      <span>None</span>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5">
                  <legend className="px-1 text-slate-700 font-medium">Position & Alignment</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="w-20 text-slate-700">Placement:</label>
                      <select
                        value={hrPlacement}
                        onChange={(e) => {
                          const p = e.target.value as any;
                          setHrPlacement(p);
                          applyChange({
                            textPosition: p === 'Top' ? 'above' : p === 'None' ? 'none' : 'below',
                            includeText: p !== 'None',
                          });
                        }}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8"
                      >
                        <option value="Bottom">Bottom</option>
                        <option value="Top">Top</option>
                        <option value="None">None</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-20 text-slate-700">Alignment:</label>
                      <select
                        value={hrAlignment}
                        onChange={(e) => {
                          const a = e.target.value as any;
                          setHrAlignment(a);
                          applyChange({ humanReadableAlignment: a.toLowerCase() });
                        }}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8"
                      >
                        <option value="Centered">Centered</option>
                        <option value="Left">Left</option>
                        <option value="Right">Right</option>
                      </select>
                    </div>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 3. FONT, 4. TEXT FORMAT, 5. BORDER, 6. POSITION                          */}
            {/* ========================================================================= */}
            {selectedCategory === 'font' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 text-xs">Font Family:</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => {
                        setSelectedFont(e.target.value);
                        applyChange({ humanReadableFont: e.target.value });
                      }}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="OCR-A Extended">OCR-A Extended</option>
                      <option value="OCR-B 10 Pitch BT">OCR-B 10 Pitch BT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 text-xs">Font Size:</label>
                    <input
                      type="number"
                      value={pointSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 12;
                        setPointSize(val);
                        applyChange({ humanReadableFontSize: val });
                      }}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedCategory === 'text-format' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xs text-xs text-slate-600">
                Controls optical text format and auto-sizing below barcodes.
              </div>
            )}

            {selectedCategory === 'border' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="b-type"
                      checked={borderType === 'none'}
                      onChange={() => {
                        setBorderType('none');
                        applyChange({ borderType: 'none' });
                      }}
                    />
                    <span>None</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="b-type"
                      checked={borderType === 'rectangle'}
                      onChange={() => {
                        setBorderType('rectangle');
                        applyChange({ borderType: 'rectangle' });
                      }}
                    />
                    <span>Rectangle</span>
                  </label>
                </div>
              </div>
            )}

            {selectedCategory === 'position' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <label className="w-10 text-slate-700 text-xs">X:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={posX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPosX(val);
                        applyChange({ x: val });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs"
                    />
                    <span className="text-slate-600 text-xs">mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-10 text-slate-700 text-xs">Y:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={posY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPosY(val);
                        applyChange({ y: val });
                      }}
                      className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs"
                    />
                    <span className="text-slate-600 text-xs">mm</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 7. DATA SOURCES (ROOT CONCATENATION VIEW)                                  */}
            {/* ========================================================================= */}
            {selectedCategory === 'datasources' && (
              <div className="space-y-4">
                <div className="bg-blue-50/80 border border-blue-200 rounded-sm p-3">
                  <div className="text-xs font-bold text-blue-950 mb-1">
                    Compiled Barcode Output Value:
                  </div>
                  <div className="p-2 bg-white border border-blue-300 rounded font-mono text-sm font-bold text-slate-900 select-all break-all">
                    {value || '12345678'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Concatenated Data Sources ({dataSources.length})
                    </span>
                    <button
                      onClick={() => setIsAddMenuOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Data Source</span>
                    </button>
                  </div>

                  <div className="border border-slate-300 rounded-xs overflow-hidden divide-y divide-slate-200">
                    {dataSources.map((ds, idx) => {
                      const meta = getDsTreeMeta(ds);
                      return (
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
                            <span className="text-base">{meta.icon}</span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {ds.name || `Source ${idx + 1}`}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 truncate max-w-[320px]">
                                {meta.label}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              title="Edit Data Source"
                              onClick={() => {
                                setActiveDsIndex(idx);
                                setSelectedCategory('datasource-item');
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-blue-600 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Delete Data Source"
                              onClick={() => {
                                setActiveDsIndex(idx);
                                handleDeleteActiveDataSource();
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 8. ACTIVE DATA SOURCE ITEM (GS1 AI / COMPOSITE / DATABAR & STANDARD)       */}
            {/* ========================================================================= */}
            {selectedCategory === 'datasource-item' && (
              <div className="space-y-4">
                {/* Horizontal Tabs */}
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
                    onClick={() => setActiveDsTab('type')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${
                      activeDsTab === 'type'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Data Type
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

                {/* TAB 1: DATA SOURCE CONFIGURATION */}
                {activeDsTab === 'source' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Source Name:</label>
                      <input
                        type="text"
                        value={activeDataSource.name || `Source ${currentDsIndex + 1}`}
                        onChange={(e) => updateActiveDataSource({ name: e.target.value })}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900"
                      />
                    </div>

                    {/* Type Selector */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Type:</label>
                      <div className="flex-1 relative">
                        <select
                          value={activeDataSource.type || 'embedded'}
                          onChange={(e) => {
                            const newType = e.target.value as DataSourceType;
                            if (newType === 'gs1_ai' && (!activeDataSource.gs1AIs || activeDataSource.gs1AIs.length === 0)) {
                              updateActiveDataSource({
                                type: newType,
                                gs1AIs: [
                                  { ai: '01', value: '00850006531234', description: 'GTIN-14', dataTitle: 'GTIN' },
                                  { ai: '10', value: 'LOT456', description: 'Batch/Lot', dataTitle: 'BATCH/LOT' },
                                ],
                              });
                            } else {
                              updateActiveDataSource({ type: newType });
                            }
                          }}
                          className="w-full bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium cursor-pointer"
                        >
                          <option value="gs1_ai">🌐 GS1 Application Identifier Data Source</option>
                          <option value="gs1_composite">🧩 GS1 Composite Data Source</option>
                          <option value="gs1_databar">📊 GS1 DataBar Data Source</option>
                          <option value="embedded">💾 Embedded Constant Data</option>
                          <option value="database">🗄️ Database Field</option>
                          <option value="serial">🔢 Serial Number / Counter</option>
                          <option value="clock">🕒 Clock / Dynamic Timestamp</option>
                          <option value="variable">🔗 Named Template Variable</option>
                          <option value="system">⚙️ System Variable</option>
                          <option value="script">⚡ JavaScript Expression</option>
                        </select>
                      </div>
                    </div>

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 1: GS1 APPLICATION IDENTIFIER (AI) BUILDER                 */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_ai' && (
                      <div className="space-y-3 pt-2 bg-emerald-50/40 border border-emerald-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                            <Globe className="w-4 h-4 text-emerald-700" />
                            <span>GS1 Application Identifier Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[10.5px] font-semibold">
                            ISO/IEC 15418 Standard
                          </span>
                        </div>

                        {/* Compiled AI Output Preview */}
                        <div className="bg-white border border-emerald-300 p-2.5 rounded-xs space-y-1">
                          <div className="text-[11px] font-bold text-slate-600">Encoded GS1 Bracketed String:</div>
                          <div className="font-mono text-sm font-bold text-slate-900 break-all select-all">
                            {activeDataSource.gs1AIs && activeDataSource.gs1AIs.length > 0
                              ? activeDataSource.gs1AIs.map(a => `(${a.ai})${a.value}`).join('')
                              : '(01)00850006531234'}
                          </div>
                        </div>

                        {/* Quick AI Presets Bar */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-700">Quick Insert Common AIs:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { ai: '01', label: '+ (01) GTIN-14', defaultVal: '00850006531234', title: 'GTIN' },
                              { ai: '10', label: '+ (10) Batch/Lot', defaultVal: 'LOT456', title: 'BATCH/LOT' },
                              { ai: '17', label: '+ (17) Expiry Date', defaultVal: '261231', title: 'USE BY OR EXPIRY' },
                              { ai: '21', label: '+ (21) Serial No.', defaultVal: 'SN987654', title: 'SERIAL' },
                              { ai: '00', label: '+ (00) SSCC-18', defaultVal: '008500060000000019', title: 'SSCC' },
                              { ai: '11', label: '+ (11) Prod Date', defaultVal: '260819', title: 'PROD DATE' },
                              { ai: '3103', label: '+ (3103) Net Wt (kg)', defaultVal: '001500', title: 'NET WEIGHT(kg)' },
                              { ai: '400', label: '+ (400) Order #', defaultVal: 'PO-99482', title: 'ORDER NUMBER' },
                            ].map((preset) => (
                              <button
                                key={preset.ai}
                                type="button"
                                onClick={() => {
                                  const currentAIs = activeDataSource.gs1AIs || [];
                                  const exists = currentAIs.find(a => a.ai === preset.ai);
                                  if (exists) {
                                    alert(`Application Identifier (${preset.ai}) is already in this data source.`);
                                    return;
                                  }
                                  const newField: GS1Field = {
                                    ai: preset.ai,
                                    value: preset.defaultVal,
                                    description: GS1_AI_DICTIONARY[preset.ai]?.description || preset.title,
                                    dataTitle: preset.title,
                                  };
                                  updateActiveDataSource({ gs1AIs: [...currentAIs, newField] });
                                }}
                                className="px-2 py-0.8 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[11px] font-medium shadow-2xs cursor-pointer transition-colors"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Configured AIs Table */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-slate-700">
                            Configured Application Identifiers ({activeDataSource.gs1AIs?.length || 0}):
                          </div>

                          <div className="border border-slate-300 bg-white rounded-xs overflow-hidden divide-y divide-slate-200">
                            {(!activeDataSource.gs1AIs || activeDataSource.gs1AIs.length === 0) ? (
                              <div className="p-3 text-center text-slate-500 text-xs">
                                No Application Identifiers added yet. Click one of the quick buttons above to add fields.
                              </div>
                            ) : (
                              activeDataSource.gs1AIs.map((item, aiIdx) => {
                                const aiDef = GS1_AI_DICTIONARY[item.ai];
                                const isGtinOrSscc = item.ai === '01' || item.ai === '00' || item.ai === '02';
                                const checkDigitValid = isGtinOrSscc ? validateGS1CheckDigit(item.value) : true;

                                return (
                                  <div key={item.ai || aiIdx} className="p-2.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-mono font-bold text-xs rounded border border-emerald-300">
                                        ({item.ai})
                                      </span>
                                      <div>
                                        <div className="font-bold text-slate-900 text-xs">
                                          {item.dataTitle || aiDef?.dataTitle || `AI (${item.ai})`}
                                        </div>
                                        <div className="text-[10.5px] text-slate-500">
                                          {aiDef?.description || 'Custom Application Identifier'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => {
                                          const updatedAIs = activeDataSource.gs1AIs!.map((a, i) =>
                                            i === aiIdx ? { ...a, value: e.target.value } : a
                                          );
                                          updateActiveDataSource({ gs1AIs: updatedAIs });
                                        }}
                                        className="w-48 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono text-xs font-bold text-slate-900"
                                      />

                                      {isGtinOrSscc && (
                                        <button
                                          title="Recalculate Check Digit"
                                          onClick={() => {
                                            const clean = item.value.replace(/\D/g, '');
                                            if (clean.length >= 7) {
                                              const body = clean.slice(0, -1);
                                              const cd = calculateGS1CheckDigit(body);
                                              const updatedAIs = activeDataSource.gs1AIs!.map((a, i) =>
                                                i === aiIdx ? { ...a, value: `${body}${cd}` } : a
                                              );
                                              updateActiveDataSource({ gs1AIs: updatedAIs });
                                            }
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            checkDigitValid
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              : 'bg-amber-100 text-amber-900 border-amber-400'
                                          }`}
                                        >
                                          {checkDigitValid ? '✓ Mod10' : 'Fix Mod10'}
                                        </button>
                                      )}

                                      <button
                                        title="Remove AI Field"
                                        onClick={() => {
                                          const updatedAIs = activeDataSource.gs1AIs!.filter((_, i) => i !== aiIdx);
                                          updateActiveDataSource({ gs1AIs: updatedAIs });
                                        }}
                                        className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 2: GS1 COMPOSITE DATA SOURCE WIZARD                         */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_composite' && (
                      <div className="space-y-3 pt-2 bg-purple-50/40 border border-purple-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
                            <Layers className="w-4 h-4 text-purple-700" />
                            <span>GS1 Composite Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 rounded-full text-[10.5px] font-semibold">
                            ISO/IEC 24723 Composite Symbol
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">Composite 2D Type:</label>
                            <select
                              value={activeDataSource.gs1CompositeType || 'CC-A'}
                              onChange={(e) => updateActiveDataSource({ gs1CompositeType: e.target.value as any })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium"
                            >
                              <option value="CC-A">CC-A (MicroPDF417 - Up to 56 Digits)</option>
                              <option value="CC-B">CC-B (MicroPDF417 - Up to 338 Digits)</option>
                              <option value="CC-C">CC-C (PDF417 - Up to 2361 Digits for GS1-128)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">1D Linear Component Data:</label>
                            <input
                              type="text"
                              value={activeDataSource.gs1CompositeLinear || '(01)00850006531234'}
                              onChange={(e) => updateActiveDataSource({ gs1CompositeLinear: e.target.value })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-mono text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-700 font-medium">2D Composite Component Data:</label>
                          <textarea
                            rows={3}
                            value={activeDataSource.gs1Composite2DData || '(10)BATCH123(17)261231(21)SN987654'}
                            onChange={(e) => updateActiveDataSource({ gs1Composite2DData: e.target.value })}
                            className="w-full bg-white border border-[#94a3b8] rounded p-2 font-mono text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 3: GS1 DATABAR DATA SOURCE WIZARD                           */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_databar' && (
                      <div className="space-y-3 pt-2 bg-blue-50/40 border border-blue-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                            <BarChart2 className="w-4 h-4 text-blue-700" />
                            <span>GS1 DataBar Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[10.5px] font-semibold">
                            POS & Grocery Scanner Ready
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">DataBar Variant:</label>
                            <select
                              value={activeDataSource.gs1DataBarVariant || 'omnidirectional'}
                              onChange={(e) => updateActiveDataSource({ gs1DataBarVariant: e.target.value as any })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium"
                            >
                              <option value="omnidirectional">GS1 DataBar Omnidirectional (14-Digit GTIN)</option>
                              <option value="stacked">GS1 DataBar Stacked (Two-Row)</option>
                              <option value="expanded">GS1 DataBar Expanded (GTIN + Variable Weight/Price)</option>
                              <option value="expanded_stacked">GS1 DataBar Expanded Stacked</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">GTIN-14 Data:</label>
                            <input
                              type="text"
                              value={activeDataSource.value || '00850006531234'}
                              onChange={(e) => updateActiveDataSource({ value: e.target.value })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-mono text-xs font-bold text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard Embedded Data */}
                    {activeDataSource.type === 'embedded' && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-slate-700 font-medium">Embedded Constant Text:</label>
                        <textarea
                          rows={6}
                          value={activeDataSource.value || ''}
                          onChange={(e) => updateActiveDataSource({ value: e.target.value })}
                          className="w-full bg-white border border-[#94a3b8] rounded-xs p-2 font-mono text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                        />
                      </div>
                    )}

                    {/* Standard Database Field */}
                    {activeDataSource.type === 'database' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded-xs">
                        <div className="flex items-center gap-3">
                          <label className="w-28 text-slate-700 font-medium">Database Field:</label>
                          <select
                            value={activeDataSource.databaseField || ''}
                            onChange={(e) => updateActiveDataSource({ databaseField: e.target.value, value: `{{${e.target.value}}}` })}
                            className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium"
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

                    {/* Standard Serial Counter */}
                    {activeDataSource.type === 'serial' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <label className="w-20 text-slate-700 font-medium">Start Value:</label>
                            <input
                              type="number"
                              value={activeDataSource.serialStart || 1}
                              onChange={(e) => updateActiveDataSource({ serialStart: parseInt(e.target.value) || 1 })}
                              className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="w-16 text-slate-700 font-medium">Step:</label>
                            <input
                              type="number"
                              value={activeDataSource.serialStep || 1}
                              onChange={(e) => updateActiveDataSource({ serialStep: parseInt(e.target.value) || 1 })}
                              className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <label className="w-20 text-slate-700 font-medium">Zero Pad:</label>
                            <input
                              type="number"
                              value={activeDataSource.serialPad || 6}
                              onChange={(e) => updateActiveDataSource({ serialPad: parseInt(e.target.value) || 6 })}
                              className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="w-16 text-slate-700 font-medium">Prefix:</label>
                            <input
                              type="text"
                              value={activeDataSource.serialPrefix || ''}
                              onChange={(e) => updateActiveDataSource({ serialPrefix: e.target.value })}
                              className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                              placeholder="SN-"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard Clock Date */}
                    {activeDataSource.type === 'clock' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded-xs">
                        <div className="flex items-center gap-3">
                          <label className="w-28 text-slate-700 font-medium">Date Format:</label>
                          <select
                            value={activeDataSource.dateFormat || 'YYYY-MM-DD'}
                            onChange={(e) => updateActiveDataSource({ dateFormat: e.target.value })}
                            className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-mono"
                          >
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO: 2026-08-19)</option>
                            <option value="YYMMDD">YYMMDD (GS1: 260819)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (European: 19/08/2026)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (US: 08/19/2026)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Standard Variable */}
                    {activeDataSource.type === 'variable' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded-xs">
                        <div className="flex items-center gap-3">
                          <label className="w-28 text-slate-700 font-medium">Variable:</label>
                          <select
                            value={activeDataSource.variableName || ''}
                            onChange={(e) => updateActiveDataSource({ variableName: e.target.value, value: `{{${e.target.value}}}` })}
                            className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium"
                          >
                            <option value="">-- Select Variable --</option>
                            {availableVariables.map((v) => (
                              <option key={v.name} value={v.name}>
                                {v.name} ({v.label || 'Dynamic'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Standard System Variable */}
                    {activeDataSource.type === 'system' && (
                      <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded-xs">
                        <div className="flex items-center gap-3">
                          <label className="w-28 text-slate-700 font-medium">System Variable:</label>
                          <select
                            value={activeDataSource.systemVarName || 'SYSTEM.DATE'}
                            onChange={(e) => updateActiveDataSource({ systemVarName: e.target.value as any })}
                            className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-mono"
                          >
                            <option value="SYSTEM.DATE">SYSTEM.DATE</option>
                            <option value="SYSTEM.TIME">SYSTEM.TIME</option>
                            <option value="SYSTEM.USER">SYSTEM.USER</option>
                            <option value="SYSTEM.PRINTER">SYSTEM.PRINTER</option>
                            <option value="SYSTEM.JOB_ID">SYSTEM.JOB_ID</option>
                            <option value="SYSTEM.PAGE_NUMBER">SYSTEM.PAGE_NUMBER</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Standard Script */}
                    {activeDataSource.type === 'script' && (
                      <div className="space-y-2 pt-2">
                        <label className="text-slate-700 font-medium">JavaScript Expression:</label>
                        <textarea
                          rows={5}
                          value={activeDataSource.scriptCode || ''}
                          onChange={(e) => updateActiveDataSource({ scriptCode: e.target.value })}
                          className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xs outline-none"
                          placeholder='return "LOT-" + record.LOT + "-" + pad(1, 4);'
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DATA TYPE */}
                {activeDsTab === 'type' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Data Type:</label>
                      <select className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900">
                        <option>Text / Alphanumeric (String)</option>
                        <option>Number / Integer</option>
                        <option>Date / Timestamp</option>
                        <option>Currency</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* TAB 3: TRANSFORMS */}
                {activeDsTab === 'transforms' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Transformation Pipeline ({activeDataSource.transforms?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          const newRule: TransformRule = {
                            id: `tr-${Date.now()}`,
                            type: 'case',
                            params: {
                              caseType: 'uppercase',
                            },
                          };
                          updateActiveDataSource({
                            transforms: [...(activeDataSource.transforms || []), newRule],
                          });
                        }}
                        className="px-2 py-0.8 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Transform Step</span>
                      </button>
                    </div>

                    {(!activeDataSource.transforms || activeDataSource.transforms.length === 0) ? (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded text-center text-slate-500 text-xs">
                        No transforms configured. Raw data source value is preserved.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeDataSource.transforms.map((rule, trIdx) => (
                          <div key={rule.id || trIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-400">#{trIdx + 1}</span>
                              <select
                                value={rule.type}
                                onChange={(e) => {
                                  const updatedRules = activeDataSource.transforms!.map((r, i) =>
                                    i === trIdx ? { ...r, type: e.target.value as any } : r
                                  );
                                  updateActiveDataSource({ transforms: updatedRules });
                                }}
                                className="bg-white border border-[#94a3b8] rounded px-2 py-0.5 text-xs font-medium"
                              >
                                <option value="case">Case Conversion</option>
                                <option value="trim">Trim Whitespace</option>
                                <option value="search_replace">Search & Replace</option>
                                <option value="truncate">Truncate / Substring</option>
                                <option value="pad">Character Padding</option>
                                <option value="prefix_suffix">Prefix & Suffix</option>
                              </select>

                              {rule.type === 'case' && (
                                <select
                                  value={rule.params?.caseType || 'uppercase'}
                                  onChange={(e) => {
                                    const updatedRules = activeDataSource.transforms!.map((r, i) =>
                                      i === trIdx ? { ...r, params: { ...r.params, caseType: e.target.value as any } } : r
                                    );
                                    updateActiveDataSource({ transforms: updatedRules });
                                  }}
                                  className="bg-white border border-[#94a3b8] rounded px-2 py-0.5 text-xs"
                                >
                                  <option value="uppercase">UPPERCASE (ABC)</option>
                                  <option value="lowercase">lowercase (abc)</option>
                                  <option value="titlecase">Title Case</option>
                                </select>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                const updatedRules = activeDataSource.transforms!.filter((_, i) => i !== trIdx);
                                updateActiveDataSource({ transforms: updatedRules });
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
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

      {/* GS1 Application Identifier Data Source Wizard Modal */}
      {isGs1AiWizardOpen && (
        <GS1ApplicationIdentifierWizardModal
          isOpen={isGs1AiWizardOpen}
          onClose={() => setIsGs1AiWizardOpen(false)}
          onApply={handleApplyGs1Wizard}
          availableVariables={availableVariables}
        />
      )}
    </div>
  );
};
