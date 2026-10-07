import React, { useState, useMemo } from 'react';
import { X, Search, Database, Bookmark, Calculator, Box, Globe, Printer, Check } from 'lucide-react';
import { NamedDataSource, CalculatedFieldDefinition, LabelElement } from '../../types';

export interface FieldPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (insertionText: string, metadata: { category: string; name: string }) => void;
  formatMode?: 'token' | 'vbscript' | 'javascript' | 'formula' | 'bare';
  availableFields?: string[];
  namedDataSources?: NamedDataSource[];
  calculatedFields?: CalculatedFieldDefinition[];
  elements?: LabelElement[];
  globalData?: Record<string, any>;
  sampleRecord?: Record<string, any>;
  title?: string;
}

export const FieldPickerModal: React.FC<FieldPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectField,
  formatMode: defaultFormatMode = 'token',
  availableFields = [],
  namedDataSources = [],
  calculatedFields = [],
  elements = [],
  globalData = {},
  sampleRecord = {},
  title = 'Field & Data Source Picker',
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formatMode, setFormatMode] = useState<'token' | 'vbscript' | 'javascript' | 'formula' | 'bare'>(defaultFormatMode);
  const [selectedItem, setSelectedItem] = useState<{ category: string; name: string; sample?: string } | null>(null);

  const categories = useMemo(() => [
    { id: 'all', label: 'All Sources', icon: Database },
    { id: 'database', label: 'Database Fields', icon: Database },
    { id: 'named', label: 'Named Sources', icon: Bookmark },
    { id: 'calculated', label: 'Calculated Fields', icon: Calculator },
    { id: 'objects', label: 'Object Values', icon: Box },
    { id: 'global', label: 'Global Data', icon: Globe },
    { id: 'print', label: 'Print Job Fields', icon: Printer },
  ], []);

  const items = useMemo(() => {
    const list: Array<{ category: string; name: string; sample?: string; description?: string }> = [];

    // 1. Database Fields
    (availableFields || []).forEach((f) => {
      const sampleVal = sampleRecord && sampleRecord[f] !== undefined ? String(sampleRecord[f]) : undefined;
      list.push({ category: 'database', name: f, sample: sampleVal, description: 'Active record column' });
    });

    // 2. Named Sources
    (namedDataSources || []).forEach((n) => {
      list.push({ category: 'named', name: n.name, sample: n.defaultValue, description: n.databaseField ? `Bound to ${n.databaseField}` : 'Named variable' });
    });

    // 3. Calculated Fields
    (calculatedFields || []).forEach((c) => {
      list.push({ category: 'calculated', name: c.name, description: c.description || `Formula: ${c.formula}` });
    });

    // 4. Object Values
    (elements || []).forEach((e) => {
      const objName = e.name || `${e.type}_${e.id.slice(0, 6)}`;
      const sampleVal = (e as any).text || (e as any).value || '';
      list.push({ category: 'objects', name: objName, sample: sampleVal, description: `Template ${e.type} object` });
    });

    // 5. Global Data
    Object.keys(globalData || {}).forEach((g) => {
      list.push({ category: 'global', name: g, sample: String((globalData || {})[g]), description: 'Document global variable' });
    });

    // Standard Print Job Fields
    const printJobFields = [
      { name: 'PrintJobName', desc: 'Active print job identifier' },
      { name: 'PrinterName', desc: 'Target physical printer name' },
      { name: 'Copies', desc: 'Copies requested for printing' },
      { name: 'RecordNumber', desc: 'Current 1-based record index' },
      { name: 'TotalRecords', desc: 'Total record count in active batch' },
      { name: 'PrintTimestamp', desc: 'Date/time at time of print' },
    ];
    printJobFields.forEach((p) => {
      list.push({ category: 'print', name: p.name, description: p.desc });
    });

    return list;
  }, [availableFields, namedDataSources, calculatedFields, elements, globalData, sampleRecord]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sample && item.sample.toLowerCase().includes(search.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, search]);

  if (!isOpen) return null;

  const formatInsertion = (cat: string, name: string): string => {
    switch (formatMode) {
      case 'token':
        if (cat === 'global') return `{{Global.${name}}}`;
        if (cat === 'print') return `{{PrintJob.${name}}}`;
        return `{{${name}}}`;
      case 'vbscript':
        if (cat === 'database') return `Record("${name}")`;
        if (cat === 'named') return `NamedSubStrings("${name}")`;
        if (cat === 'global') return `Global("${name}")`;
        if (cat === 'print') return `System.${name}`;
        return `Record("${name}")`;
      case 'javascript':
        if (cat === 'database') return `Record("${name}")`;
        if (cat === 'named') return `NamedSubStrings["${name}"]`;
        if (cat === 'global') return `globalData["${name}"]`;
        if (cat === 'print') return `ctx.${name.toLowerCase()}`;
        return `Record("${name}")`;
      case 'formula':
        if (cat === 'database') return `[${name}]`;
        return name;
      case 'bare':
      default:
        return name;
    }
  };

  const handleApply = (item: { category: string; name: string }) => {
    const formatted = formatInsertion(item.category, item.name);
    onSelectField(formatted, item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-[780px] max-w-full bg-[#f8fafc] rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-800 text-[12px]">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center shadow-xs">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">{title}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search and Format Mode Selector */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search fields, variables, objects, or sample values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-[11.5px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">Insert Format:</span>
            <select
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as any)}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="token">Token: {"{{Field}}"}</option>
              <option value="vbscript">VBScript: Record("Field")</option>
              <option value="javascript">JavaScript: Record("Field")</option>
              <option value="formula">Formula: [Field]</option>
              <option value="bare">Bare: FieldName</option>
            </select>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 min-h-[360px] max-h-[480px]">
          {/* Categories Sidebar */}
          <div className="w-48 bg-slate-50 border-r border-slate-200 p-2 space-y-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = cat.id === 'all' ? items.length : items.filter((i) => i.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-600 text-white font-medium shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Items Grid */}
          <div className="flex-1 p-3 overflow-y-auto bg-white">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <Database className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
                <p className="text-[12px]">No fields found matching criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredItems.map((item) => {
                  const isChosen = selectedItem?.category === item.category && selectedItem?.name === item.name;
                  return (
                    <div
                      key={`${item.category}-${item.name}`}
                      onClick={() => setSelectedItem(item)}
                      onDoubleClick={() => handleApply(item)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isChosen
                          ? 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-semibold text-[11.5px] text-slate-900 truncate">
                          {item.name}
                        </span>
                        <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 shrink-0">
                          {item.category}
                        </span>
                      </div>

                      {item.sample !== undefined && (
                        <div className="text-[10.5px] text-slate-600 truncate bg-slate-100/60 px-1.5 py-0.5 rounded border border-slate-200/60 mb-1">
                          <span className="text-slate-400 font-normal">Active: </span>
                          <span className="font-medium text-emerald-700">{item.sample || '""'}</span>
                        </div>
                      )}

                      {item.description && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {selectedItem ? (
              <span className="font-mono text-slate-800">
                Will insert:{' '}
                <strong className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                  {formatInsertion(selectedItem.category, selectedItem.name)}
                </strong>
              </span>
            ) : (
              <span>Select a field or double-click to insert</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-[11.5px] font-medium rounded hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!selectedItem}
              onClick={() => selectedItem && handleApply(selectedItem)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11.5px] font-semibold rounded shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Insert Field
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default FieldPickerModal;
