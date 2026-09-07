import React, { useState } from 'react';
import { OpenDocument } from '../../types';
import { DataEntryFormDefinition, DataEntryFormControl, FormControlType } from '../../types/formTypes';
import { DocumentTabBar } from '../canvas/DocumentTabBar';
import {
  Type,
  Hash,
  List,
  Calendar,
  CheckSquare,
  Barcode,
  Plus,
  Trash2,
  Save,
  Play,
  Settings2,
  FileText,
  Printer,
  ChevronDown,
  LayoutTemplate
} from 'lucide-react';

interface FormWorkspaceViewProps {
  document: OpenDocument;
  onUpdateForm: (form: DataEntryFormDefinition) => void;
  onSaveForm: (instanceId: string) => void;
  // Multi-document Tab Props
  documents: OpenDocument[];
  activeInstanceId: string | null;
  onSelectTab: (instanceId: string) => void;
  onCloseTab: (instanceId: string) => void;
  onNewTemplate: () => void;
  onNewForm: () => void;
  onSaveDoc?: (instanceId: string) => void;
  onSaveAll?: () => void;
  onDuplicateDoc?: (instanceId: string) => void;
  onCloseOthers?: (instanceId: string) => void;
  onCloseAll?: () => void;
  activePrinterName?: string;
  onPrintPreview?: (formData: Record<string, any>) => void;
}

export const FormWorkspaceView: React.FC<FormWorkspaceViewProps> = ({
  document,
  onUpdateForm,
  onSaveForm,
  documents,
  activeInstanceId,
  onSelectTab,
  onCloseTab,
  onNewTemplate,
  onNewForm,
  onSaveDoc,
  onSaveAll,
  onDuplicateDoc,
  onCloseOthers,
  onCloseAll,
  activePrinterName,
  onPrintPreview,
}) => {
  const form: DataEntryFormDefinition = document.form || {
    id: document.instanceId,
    title: document.name,
    description: 'Operator Data Entry Form for manual variable entry before printing.',
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
        validation: { required: true },
      },
      {
        id: 'ctrl-2',
        type: 'date',
        label: 'Manufacturing Date',
        boundField: 'MFG_DATE',
        defaultValue: new Date().toISOString().split('T')[0],
        order: 1,
        colSpan: 1,
      },
      {
        id: 'ctrl-3',
        type: 'number',
        label: 'Print Quantity (Copies)',
        boundField: 'COPIES',
        defaultValue: 1,
        order: 2,
        colSpan: 1,
        validation: { min: 1, max: 9999 },
      },
    ],
    showPreview: true,
    promptBeforePrint: true,
    autoSubmitOnScan: false,
    defaultCopies: 1,
  };

  const [mode, setMode] = useState<'design' | 'preview'>('design');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(form.controls[0]?.id || null);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    form.controls.forEach((c) => {
      initial[c.boundField] = c.defaultValue || '';
    });
    return initial;
  });

  const selectedControl = form.controls.find((c) => c.id === selectedControlId);

  const handleAddControl = (type: FormControlType) => {
    const newId = `ctrl-${Date.now()}`;
    const newControl: DataEntryFormControl = {
      id: newId,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      boundField: `FIELD_${form.controls.length + 1}`,
      placeholder: '',
      order: form.controls.length,
      colSpan: 1,
    };
    const updatedForm = {
      ...form,
      controls: [...form.controls, newControl],
    };
    onUpdateForm(updatedForm);
    setSelectedControlId(newId);
  };

  const handleUpdateControl = (id: string, updates: Partial<DataEntryFormControl>) => {
    const updatedForm = {
      ...form,
      controls: form.controls.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    };
    onUpdateForm(updatedForm);
  };

  const handleDeleteControl = (id: string) => {
    const updatedForm = {
      ...form,
      controls: form.controls.filter((c) => c.id !== id),
    };
    onUpdateForm(updatedForm);
    if (selectedControlId === id) {
      setSelectedControlId(updatedForm.controls[0]?.id || null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-none">
      {/* Top Form Sub-Toolbar */}
      <div className="h-10 bg-[#e4ebf5] border-b border-[#cbd5e1] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs mr-3">
            <LayoutTemplate className="w-4 h-4 text-indigo-600" />
            <span>{document.name} (Data Entry Form)</span>
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Mode Switcher */}
          <div className="flex bg-slate-200/80 p-0.5 rounded text-xs border border-slate-300">
            <button
              type="button"
              onClick={() => setMode('design')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                mode === 'design'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Design Form
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                mode === 'preview'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Play className="w-3 h-3" />
              Runtime Preview
            </button>
          </div>

          {mode === 'design' && (
            <>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              {/* Insert Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAddControl('text')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center gap-1"
                >
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  + Text
                </button>
                <button
                  type="button"
                  onClick={() => handleAddControl('number')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center gap-1"
                >
                  <Hash className="w-3.5 h-3.5 text-emerald-600" />
                  + Number
                </button>
                <button
                  type="button"
                  onClick={() => handleAddControl('date')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  + Date
                </button>
                <button
                  type="button"
                  onClick={() => handleAddControl('dropdown')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center gap-1"
                >
                  <List className="w-3.5 h-3.5 text-purple-600" />
                  + Dropdown
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSaveForm(document.instanceId)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Form
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Canvas / Form Area */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="border-b border-slate-200 pb-4 mb-6">
              {mode === 'design' ? (
                <div>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => onUpdateForm({ ...form, title: e.target.value })}
                    className="text-lg font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full px-1"
                  />
                  <input
                    type="text"
                    value={form.description || ''}
                    onChange={(e) => onUpdateForm({ ...form, description: e.target.value })}
                    placeholder="Add form instructions for operator..."
                    className="text-xs text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full px-1 mt-1"
                  />
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{form.title}</h2>
                  {form.description && <p className="text-xs text-slate-500 mt-0.5">{form.description}</p>}
                </div>
              )}
            </div>

            {/* Controls List */}
            <div className="grid grid-cols-2 gap-4">
              {form.controls.map((ctrl) => {
                const isSelected = selectedControlId === ctrl.id;
                return (
                  <div
                    key={ctrl.id}
                    onClick={() => mode === 'design' && setSelectedControlId(ctrl.id)}
                    className={`${
                      ctrl.colSpan === 2 ? 'col-span-2' : 'col-span-1'
                    } p-3 rounded-md transition-all ${
                      mode === 'design'
                        ? isSelected
                          ? 'border-2 border-indigo-500 bg-indigo-50/20 shadow-xs'
                          : 'border border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        {ctrl.label}
                        {ctrl.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {mode === 'design' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                            {ctrl.boundField}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteControl(ctrl.id);
                            }}
                            className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Input Element by Type */}
                    {ctrl.type === 'text' && (
                      <input
                        type="text"
                        placeholder={ctrl.placeholder || 'Enter value...'}
                        value={formData[ctrl.boundField] || ''}
                        onChange={(e) => setFormData({ ...formData, [ctrl.boundField]: e.target.value })}
                        disabled={mode === 'design'}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}
                    {ctrl.type === 'number' && (
                      <input
                        type="number"
                        placeholder={ctrl.placeholder || '0'}
                        value={formData[ctrl.boundField] || ''}
                        onChange={(e) => setFormData({ ...formData, [ctrl.boundField]: e.target.value })}
                        disabled={mode === 'design'}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}
                    {ctrl.type === 'date' && (
                      <input
                        type="date"
                        value={formData[ctrl.boundField] || ''}
                        onChange={(e) => setFormData({ ...formData, [ctrl.boundField]: e.target.value })}
                        disabled={mode === 'design'}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}
                    {ctrl.type === 'dropdown' && (
                      <select
                        value={formData[ctrl.boundField] || ''}
                        onChange={(e) => setFormData({ ...formData, [ctrl.boundField]: e.target.value })}
                        disabled={mode === 'design'}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">-- Select Option --</option>
                        {(ctrl.options || [{ label: 'Option 1', value: 'opt1' }]).map((opt, i) => (
                          <option key={i} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {mode === 'preview' && (
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onPrintPreview && onPrintPreview(formData)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Print Label with Form Values
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Properties Dock for Design Mode */}
        {mode === 'design' && selectedControl && (
          <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-y-auto shrink-0 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>Field Properties</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Field Label</label>
                <input
                  type="text"
                  value={selectedControl.label}
                  onChange={(e) => handleUpdateControl(selectedControl.id, { label: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Bound Template Variable</label>
                <input
                  type="text"
                  value={selectedControl.boundField}
                  onChange={(e) => handleUpdateControl(selectedControl.id, { boundField: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={selectedControl.placeholder || ''}
                  onChange={(e) => handleUpdateControl(selectedControl.id, { placeholder: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Column Width</label>
                <select
                  value={selectedControl.colSpan || 1}
                  onChange={(e) => handleUpdateControl(selectedControl.id, { colSpan: Number(e.target.value) as any })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value={1}>Half Width (1 Column)</option>
                  <option value={2}>Full Width (2 Columns)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedControl.validation?.required || false}
                    onChange={(e) =>
                      handleUpdateControl(selectedControl.id, {
                        validation: { ...selectedControl.validation, required: e.target.checked },
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-700">Required Field</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Document Tab Bar */}
      <DocumentTabBar
        documents={documents}
        activeInstanceId={activeInstanceId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onNewTemplate={onNewTemplate}
        onNewForm={onNewForm}
        onSaveDoc={onSaveDoc}
        onSaveAll={onSaveAll}
        onDuplicateDoc={onDuplicateDoc}
        onCloseOthers={onCloseOthers}
        onCloseAll={onCloseAll}
      />
    </div>
  );
};
