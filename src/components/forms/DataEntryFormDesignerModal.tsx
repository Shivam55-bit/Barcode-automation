import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Save,
  Eye,
  Type,
  Hash,
  List,
  Calendar,
  CheckSquare,
  Barcode,
  Settings,
  AlertCircle,
  FileText
} from 'lucide-react';
import { LabelTemplate } from '../../types';
import {
  DataEntryFormDefinition,
  DataEntryFormControl,
  FormControlType,
  FormControlOption
} from '../../types/formTypes';

interface DataEntryFormDesignerModalProps {
  isOpen: boolean;
  template: LabelTemplate;
  onClose: () => void;
  onSave: (form: DataEntryFormDefinition) => void;
}

export const DataEntryFormDesignerModal: React.FC<DataEntryFormDesignerModalProps> = ({
  isOpen,
  template,
  onClose,
  onSave,
}) => {
  const initialForm: DataEntryFormDefinition = template.dataEntryForm || {
    id: `form-${template.id}`,
    title: `${template.name} - Print Entry Form`,
    description: 'Enter the required production lot, date, or serialization values before spooling.',
    controls: [
      {
        id: 'ctrl-1',
        type: 'text',
        label: 'Batch / Lot Number',
        boundField: 'BATCH_NO',
        placeholder: 'e.g. LOT-2026-X8',
        defaultValue: 'LOT-2026-X8',
        order: 0,
        colSpan: 1,
        validation: { required: true, minLength: 3 },
      },
      {
        id: 'ctrl-2',
        type: 'date',
        label: 'Manufacturing Date',
        boundField: 'MFG_DATE',
        defaultValue: new Date().toISOString().split('T')[0],
        order: 1,
        colSpan: 1,
        validation: { required: true },
      },
      {
        id: 'ctrl-3',
        type: 'scanner',
        label: 'Scan Product Barcode',
        boundField: 'SKU',
        placeholder: 'Scan barcode with handheld reader...',
        order: 2,
        colSpan: 2,
        autoFocus: true,
      },
    ],
    showPreview: true,
    promptBeforePrint: true,
    autoSubmitOnScan: false,
    defaultCopies: 1,
  };

  const [formDef, setFormDef] = useState<DataEntryFormDefinition>(initialForm);
  const [selectedControlId, setSelectedControlId] = useState<string>(
    formDef.controls[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'designer' | 'preview'>('designer');
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  if (!isOpen) return null;

  const selectedControl = formDef.controls.find((c) => c.id === selectedControlId);

  // Available candidate fields from template elements and named data sources
  const candidateFields = Array.from(
    new Set([
      ...(template.namedDataSources?.map((nds) => nds.name) || []),
      ...(template.variables?.map((v) => v.name) || []),
      ...template.elements
        .filter((e) => e.dataBinding?.fieldName)
        .map((e) => e.dataBinding!.fieldName),
      ...template.elements.map((e) => e.name || e.id),
      'SKU',
      'BATCH_NO',
      'LOT_NO',
      'EXP_DATE',
      'MFG_DATE',
      'SERIAL_NO',
      'OPERATOR_NAME',
      'LINE_ID',
      'QUANTITY',
    ])
  );

  const handleAddControl = (type: FormControlType) => {
    const newId = `ctrl-${Date.now()}`;
    const defaultLabels: Record<FormControlType, string> = {
      text: 'Text Input',
      textarea: 'Notes / Description',
      number: 'Quantity / Weight',
      dropdown: 'Select Option',
      date: 'Date Field',
      checkbox: 'Verify Checkbox',
      scanner: 'Barcode Scanner Input',
      datasetPicker: 'Select Dataset Record',
    };

    const newControl: DataEntryFormControl = {
      id: newId,
      type,
      label: defaultLabels[type] || 'New Input Field',
      boundField: candidateFields[0] || 'FIELD',
      placeholder: `Enter ${defaultLabels[type]}...`,
      colSpan: type === 'textarea' || type === 'scanner' ? 2 : 1,
      order: formDef.controls.length,
      validation: { required: false },
      options:
        type === 'dropdown'
          ? [
              { label: 'Option A', value: 'A' },
              { label: 'Option B', value: 'B' },
              { label: 'Option C', value: 'C' },
            ]
          : undefined,
    };

    setFormDef({
      ...formDef,
      controls: [...formDef.controls, newControl],
    });
    setSelectedControlId(newId);
  };

  const handleUpdateControl = (id: string, updates: Partial<DataEntryFormControl>) => {
    setFormDef({
      ...formDef,
      controls: formDef.controls.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const handleDeleteControl = (id: string) => {
    const remaining = formDef.controls.filter((c) => c.id !== id);
    setFormDef({ ...formDef, controls: remaining });
    if (selectedControlId === id) {
      setSelectedControlId(remaining[0]?.id || '');
    }
  };

  const handleMoveControl = (id: string, direction: 'up' | 'down') => {
    const idx = formDef.controls.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= formDef.controls.length) return;

    const list = [...formDef.controls];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    // re-index order
    list.forEach((c, i) => (c.order = i));
    setFormDef({ ...formDef, controls: list });
  };

  const handleSave = () => {
    onSave(formDef);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Print-Time Data Entry Form Designer
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Industrial Edition
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Design touch-friendly operator forms with input validation for warehouse and factory printing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('designer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'designer'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Designer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Form Preview
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'designer' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Control Toolbox & Controls List */}
            <div className="w-72 border-r border-slate-800 flex flex-col bg-slate-900/50">
              {/* Toolbox */}
              <div className="p-3 border-b border-slate-800">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Add Form Controls
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddControl('text')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <Type className="w-3.5 h-3.5 text-indigo-400" />
                    Text Input
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddControl('number')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <Hash className="w-3.5 h-3.5 text-blue-400" />
                    Number
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddControl('date')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Date Picker
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddControl('dropdown')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <List className="w-3.5 h-3.5 text-amber-400" />
                    Dropdown
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddControl('checkbox')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                    Checkbox
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddControl('scanner')}
                    className="flex items-center gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded text-xs text-slate-200 transition-colors text-left"
                  >
                    <Barcode className="w-3.5 h-3.5 text-rose-400" />
                    Scanner In
                  </button>
                </div>
              </div>

              {/* Controls List in Order */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Form Structure ({formDef.controls.length})
                </div>
                {formDef.controls.map((ctrl, idx) => (
                  <div
                    key={ctrl.id}
                    onClick={() => setSelectedControlId(ctrl.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedControlId === ctrl.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                        {idx + 1}
                      </span>
                      <span className="truncate">{ctrl.label}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveControl(ctrl.id, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveControl(ctrl.id, 'down');
                        }}
                        disabled={idx === formDef.controls.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteControl(ctrl.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle & Right: Properties & Form Settings */}
            <div className="flex-1 flex overflow-hidden">
              {/* Selected Control Properties */}
              <div className="flex-1 p-6 overflow-y-auto border-r border-slate-800">
                {selectedControl ? (
                  <div className="space-y-4 max-w-xl">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-400" />
                      Field Properties: {selectedControl.label}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Display Label
                        </label>
                        <input
                          type="text"
                          value={selectedControl.label}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, { label: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Target Variable / Element
                        </label>
                        <select
                          value={selectedControl.boundField}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, { boundField: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          {candidateFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={selectedControl.placeholder || ''}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, { placeholder: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Default Value
                        </label>
                        <input
                          type="text"
                          value={String(selectedControl.defaultValue || '')}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, { defaultValue: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Grid Column Width
                        </label>
                        <select
                          value={selectedControl.colSpan || 1}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, {
                              colSpan: Number(e.target.value) as 1 | 2,
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value={1}>Half Width (1 Column)</option>
                          <option value={2}>Full Width (2 Columns)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-4 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedControl.validation?.required || false}
                            onChange={(e) =>
                              handleUpdateControl(selectedControl.id, {
                                validation: {
                                  ...selectedControl.validation,
                                  required: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                          />
                          Required Field
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedControl.readOnly || false}
                            onChange={(e) =>
                              handleUpdateControl(selectedControl.id, {
                                readOnly: e.target.checked,
                              })
                            }
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                          />
                          Read-Only
                        </label>
                      </div>
                    </div>

                    {/* Validation Settings */}
                    <div className="p-4 bg-slate-800/50 border border-slate-700/80 rounded-xl space-y-3">
                      <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
                        Industrial Input Validation
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Min Length
                          </label>
                          <input
                            type="number"
                            value={selectedControl.validation?.minLength || ''}
                            onChange={(e) =>
                              handleUpdateControl(selectedControl.id, {
                                validation: {
                                  ...selectedControl.validation,
                                  minLength: e.target.value ? Number(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Max Length
                          </label>
                          <input
                            type="number"
                            value={selectedControl.validation?.maxLength || ''}
                            onChange={(e) =>
                              handleUpdateControl(selectedControl.id, {
                                validation: {
                                  ...selectedControl.validation,
                                  maxLength: e.target.value ? Number(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Regex Format Pattern (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="^[A-Z0-9_-]+$"
                          value={selectedControl.validation?.pattern || ''}
                          onChange={(e) =>
                            handleUpdateControl(selectedControl.id, {
                              validation: {
                                ...selectedControl.validation,
                                pattern: e.target.value || undefined,
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <FileText className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">Select a control to customize its properties</p>
                  </div>
                )}
              </div>

              {/* Form Global Settings */}
              <div className="w-80 p-6 overflow-y-auto space-y-4 bg-slate-900/30">
                <h3 className="text-sm font-semibold text-white">Form Options</h3>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Form Title
                  </label>
                  <input
                    type="text"
                    value={formDef.title}
                    onChange={(e) => setFormDef({ ...formDef, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDef.description || ''}
                    onChange={(e) => setFormDef({ ...formDef, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Default Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDef.defaultCopies}
                    onChange={(e) =>
                      setFormDef({ ...formDef, defaultCopies: Math.max(1, Number(e.target.value)) })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={formDef.showPreview}
                      onChange={(e) => setFormDef({ ...formDef, showPreview: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    Display Real-Time Label Preview
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={formDef.autoSubmitOnScan}
                      onChange={(e) =>
                        setFormDef({ ...formDef, autoSubmitOnScan: e.target.checked })
                      }
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    Auto-Print When Barcode Scanned
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Live Form Preview Mode */
          <div className="flex-1 p-8 overflow-y-auto bg-slate-950 flex justify-center">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">{formDef.title}</h3>
                {formDef.description && (
                  <p className="text-xs text-slate-400 mt-1">{formDef.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {formDef.controls.map((ctrl) => (
                  <div
                    key={ctrl.id}
                    className={ctrl.colSpan === 2 ? 'col-span-2' : 'col-span-1'}
                  >
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {ctrl.label}
                      {ctrl.validation?.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>

                    {ctrl.type === 'dropdown' ? (
                      <select
                        value={previewValues[ctrl.boundField] || ctrl.defaultValue || ''}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [ctrl.boundField]: e.target.value })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        {ctrl.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : ctrl.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 mt-2">
                        <input
                          type="checkbox"
                          checked={!!previewValues[ctrl.boundField]}
                          onChange={(e) =>
                            setPreviewValues({
                              ...previewValues,
                              [ctrl.boundField]: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                        />
                        Confirmed
                      </label>
                    ) : (
                      <input
                        type={ctrl.type === 'number' ? 'number' : ctrl.type === 'date' ? 'date' : 'text'}
                        placeholder={ctrl.placeholder}
                        value={previewValues[ctrl.boundField] ?? ctrl.defaultValue ?? ''}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [ctrl.boundField]: e.target.value })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  Simulated Values: <span className="text-indigo-300">{Object.keys(previewValues).length} captured</span>
                </div>
                <button
                  type="button"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 shadow"
                >
                  Simulate Print ({formDef.defaultCopies} Copies)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <div className="text-xs text-slate-400">
            {formDef.controls.length} input controls mapped to template variables
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <Save className="w-4 h-4" />
              Save Form to Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
