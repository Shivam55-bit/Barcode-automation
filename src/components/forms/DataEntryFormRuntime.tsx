import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Barcode,
  Check,
  AlertCircle,
  Hash,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { LabelTemplate, PrinterDefinition } from '../../types';
import { DataEntryFormDefinition, DataEntryFormControl } from '../../types/formTypes';
import { evaluateElementData } from '../../services/dataSourceEngine';

interface DataEntryFormRuntimeProps {
  isOpen: boolean;
  template: LabelTemplate;
  printers: PrinterDefinition[];
  defaultPrinterId?: string;
  onClose: () => void;
  onPrint: (enteredData: Record<string, string>, printerId: string, copies: number) => Promise<void> | void;
}

export const DataEntryFormRuntime: React.FC<DataEntryFormRuntimeProps> = ({
  isOpen,
  template,
  printers,
  defaultPrinterId,
  onClose,
  onPrint,
}) => {
  // Determine or auto-generate form definition
  const formDef: DataEntryFormDefinition = useMemo(() => {
    if (template.dataEntryForm && template.dataEntryForm.controls.length > 0) {
      return template.dataEntryForm;
    }

    // Auto-generate standard industrial controls from template elements & named data sources
    const controls: DataEntryFormControl[] = [];
    let order = 0;

    const addedFields = new Set<string>();

    // Check named data sources
    if (template.namedDataSources) {
      template.namedDataSources.forEach((nds) => {
        if (!addedFields.has(nds.name)) {
          addedFields.add(nds.name);
          controls.push({
            id: `auto-${nds.id}`,
            type: nds.name.toLowerCase().includes('date')
              ? 'date'
              : nds.name.toLowerCase().includes('qty')
              ? 'number'
              : 'text',
            label: nds.name.replace(/_/g, ' '),
            boundField: nds.name,
            defaultValue: nds.defaultValue || '',
            order: order++,
            colSpan: 1,
            validation: { required: false },
          });
        }
      });
    }

    // Check elements with dataBinding
    template.elements.forEach((el) => {
      const field = el.dataBinding?.fieldName;
      if (field && !addedFields.has(field)) {
        addedFields.add(field);
        controls.push({
          id: `auto-${el.id}`,
          type: field.toLowerCase().includes('date') ? 'date' : 'text',
          label: field.replace(/_/g, ' '),
          boundField: field,
          defaultValue: el.dataBinding?.defaultValue || '',
          order: order++,
          colSpan: 1,
          validation: { required: false },
        });
      }
    });

    // Fallback if no dynamic fields found
    if (controls.length === 0) {
      controls.push(
        {
          id: 'def-sku',
          type: 'text',
          label: 'Product SKU / Code',
          boundField: 'SKU',
          defaultValue: 'PRD-9001',
          order: 0,
          colSpan: 1,
          validation: { required: true },
        },
        {
          id: 'def-batch',
          type: 'text',
          label: 'Batch / Lot Number',
          boundField: 'BATCH_NO',
          defaultValue: 'BATCH-2026-X1',
          order: 1,
          colSpan: 1,
          validation: { required: true },
        },
        {
          id: 'def-date',
          type: 'date',
          label: 'Mfg / Expiry Date',
          boundField: 'EXP_DATE',
          defaultValue: new Date().toISOString().split('T')[0],
          order: 2,
          colSpan: 1,
        }
      );
    }

    return {
      id: `runtime-${template.id}`,
      title: `${template.name} - Print Station Form`,
      description: 'Enter production data to spool labels to factory printers.',
      controls,
      showPreview: true,
      promptBeforePrint: true,
      autoSubmitOnScan: false,
      defaultCopies: 1,
    };
  }, [template]);

  // Form values state initialized from defaultValues
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    formDef.controls.forEach((ctrl) => {
      initial[ctrl.boundField] = String(ctrl.defaultValue ?? '');
    });
    return initial;
  });

  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(() => {
    return defaultPrinterId || printers.find((p) => p.isDefault)?.id || printers[0]?.id || '';
  });

  const [copies, setCopies] = useState<number>(formDef.defaultCopies || 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId) || printers[0];

  const handleValueChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const ctrl of formDef.controls) {
      const val = (formValues[ctrl.boundField] || '').trim();

      if (ctrl.validation?.required && !val) {
        newErrors[ctrl.boundField] = `${ctrl.label} is required`;
        continue;
      }

      if (ctrl.validation?.minLength && val.length < ctrl.validation.minLength) {
        newErrors[ctrl.boundField] = `${ctrl.label} must be at least ${ctrl.validation.minLength} characters`;
        continue;
      }

      if (ctrl.validation?.pattern && val) {
        try {
          const reg = new RegExp(ctrl.validation.pattern);
          if (!reg.test(val)) {
            newErrors[ctrl.boundField] = ctrl.validation.patternErrorMessage || `Invalid format for ${ctrl.label}`;
          }
        } catch (_) {
          // ignore bad regex pattern
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePrintSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      await onPrint(formValues, selectedPrinterId, copies);
      setSuccessMessage(`Successfully dispatched ${copies} labels to ${selectedPrinter?.name || 'Printer'}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to dispatch print job' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {formDef.title}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Touch Operator Runtime
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formDef.description || 'Fill in dynamic parameters and trigger industrial spooler.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Form Column */}
          <form
            onSubmit={handlePrintSubmit}
            className="flex-1 p-6 overflow-y-auto border-r border-slate-800 flex flex-col justify-between"
          >
            <div className="space-y-5">
              {/* Notification Banner */}
              {successMessage && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in duration-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errors.form && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              {/* Dynamic Controls Grid */}
              <div className="grid grid-cols-2 gap-4">
                {formDef.controls.map((ctrl) => {
                  const val = formValues[ctrl.boundField] ?? '';
                  const hasError = !!errors[ctrl.boundField];

                  return (
                    <div
                      key={ctrl.id}
                      className={ctrl.colSpan === 2 ? 'col-span-2' : 'col-span-1'}
                    >
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {ctrl.type === 'scanner' && <Barcode className="w-3.5 h-3.5 text-rose-400" />}
                          {ctrl.type === 'date' && <Calendar className="w-3.5 h-3.5 text-emerald-400" />}
                          {ctrl.type === 'number' && <Hash className="w-3.5 h-3.5 text-blue-400" />}
                          {ctrl.label}
                        </span>
                        {ctrl.validation?.required && (
                          <span className="text-[10px] text-rose-400 font-normal">*Required</span>
                        )}
                      </label>

                      {ctrl.type === 'dropdown' ? (
                        <select
                          value={val}
                          onChange={(e) => handleValueChange(ctrl.boundField, e.target.value)}
                          disabled={ctrl.readOnly}
                          className={`w-full bg-slate-800/90 border ${
                            hasError ? 'border-rose-500' : 'border-slate-700'
                          } rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                        >
                          <option value="">Select option...</option>
                          {ctrl.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : ctrl.type === 'checkbox' ? (
                        <label className="flex items-center gap-2.5 p-2.5 bg-slate-800/60 border border-slate-700 rounded-xl cursor-pointer text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={val === 'true' || val === '1'}
                            onChange={(e) =>
                              handleValueChange(ctrl.boundField, e.target.checked ? 'true' : 'false')
                            }
                            disabled={ctrl.readOnly}
                            className="rounded border-slate-600 bg-slate-700 text-indigo-600 w-4 h-4"
                          />
                          <span>Confirm verification</span>
                        </label>
                      ) : (
                        <input
                          type={ctrl.type === 'number' ? 'number' : ctrl.type === 'date' ? 'date' : 'text'}
                          placeholder={ctrl.placeholder}
                          value={val}
                          autoFocus={ctrl.autoFocus}
                          readOnly={ctrl.readOnly}
                          onChange={(e) => handleValueChange(ctrl.boundField, e.target.value)}
                          className={`w-full bg-slate-800/90 border ${
                            hasError ? 'border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-700 focus:border-indigo-500'
                          } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors`}
                        />
                      )}

                      {hasError && (
                        <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[ctrl.boundField]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Printer Hardware & Copies Bar */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Destination Industrial Printer
                  </label>
                  <select
                    value={selectedPrinterId}
                    onChange={(e) => setSelectedPrinterId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({(p.protocol || 'driver').toUpperCase()} - {p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Print Copies
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCopies((c) => Math.max(1, c - 1))}
                      className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold text-sm border border-slate-700"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={copies}
                      onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setCopies((c) => c + 1)}
                      className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold text-sm border border-slate-700"
                    >
                      +
                    </button>
                    <span className="text-xs text-slate-400 ml-1">labels</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="pt-6 mt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedPrinter?.status === 'online'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                Printer: <strong className="text-slate-200">{selectedPrinter?.name || 'Default'}</strong>
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
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Transmitting to Spooler...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Print {copies} {copies === 1 ? 'Label' : 'Labels'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Right Live Preview Column */}
          {formDef.showPreview && (
            <div className="w-96 p-6 bg-slate-950 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Live Output Preview
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {template.dimensions.width} x {template.dimensions.height} mm
                  </div>
                </div>

                {/* Scaled Preview Card */}
                <div className="w-full aspect-[4/3] bg-white rounded-xl shadow-2xl p-4 overflow-hidden relative flex flex-col justify-between border-4 border-slate-800">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {template.name}
                    </div>
                    <div className="text-sm font-black text-slate-900 leading-tight">
                      {formValues['SKU'] || formValues['PRODUCT_NAME'] || 'SAMPLE PRODUCT'}
                    </div>
                  </div>

                  {/* Render simulated dynamic elements */}
                  <div className="space-y-1 my-2">
                    {Object.entries(formValues)
                      .slice(0, 4)
                      .map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-[11px] font-mono border-b border-slate-100 pb-0.5">
                          <span className="text-slate-400 font-semibold">{key}:</span>
                          <span className="text-slate-800 font-bold">{val || '---'}</span>
                        </div>
                      ))}
                  </div>

                  {/* Simulated barcode representation */}
                  <div className="flex flex-col items-center justify-center pt-2 border-t border-slate-200">
                    <div className="h-9 w-4/5 flex items-stretch justify-center gap-0.5">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <div
                          key={i}
                          className={`bg-slate-900 ${
                            (i * 7) % 5 === 0 ? 'w-1.5' : (i * 3) % 4 === 0 ? 'w-1' : 'w-0.5'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] font-mono tracking-widest text-slate-700 mt-1">
                      *{formValues['SKU'] || formValues['BATCH_NO'] || 'BCFLOW-2026'}*
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 mt-4">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Industrial Spooler Feed
                </div>
                <div>Protocol: <strong className="text-slate-200">{((selectedPrinter?.protocol) || 'driver').toUpperCase()}</strong></div>
                <div>Target DPI: <strong className="text-slate-200">{selectedPrinter?.dpi || 203} DPI</strong></div>
                <div>Darkness: <strong className="text-slate-200">{selectedPrinter?.darkness ?? 15}/30</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
