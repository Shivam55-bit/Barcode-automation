import React from 'react';
import { LabelTemplate, LabelElement, ValidationIssue } from '../../types';
import { validateBarcodeValue, getSymbologyMetadata } from '../../services/barcodeEngine';
import { parseGS1BracketedString, validateGS1CheckDigit } from '../../services/gs1Engine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck, Wrench, X } from 'lucide-react';

interface ValidationInspectorPanelProps {
  template: LabelTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSelectElement: (id: string) => void;
  onAutoFix?: (issue: ValidationIssue) => void;
  activeRecord?: Record<string, string>;
}

export const ValidationInspectorPanel: React.FC<ValidationInspectorPanelProps> = ({
  template,
  isOpen,
  onClose,
  onSelectElement,
  onAutoFix,
  activeRecord = {},
}) => {
  if (!isOpen) return null;

  // Run comprehensive real-time validation checks
  const issues: ValidationIssue[] = [];

  const labelW = template.dimensions.width;
  const labelH = template.dimensions.height;
  const margins = template.margins || { top: 1, bottom: 1, left: 1, right: 1, safeZone: 1 };
  const safeMargin = margins.safeZone || 1;

  template.elements.forEach((el) => {
    // 1. Boundary / Overflow Check
    if (el.x < safeMargin || el.y < safeMargin || el.x + el.width > labelW - safeMargin || el.y + el.height > labelH - safeMargin) {
      issues.push({
        id: `boundary-${el.id}`,
        severity: 'warning',
        elementId: el.id,
        elementName: el.name,
        category: 'Print Boundary',
        message: `Object "${el.name}" is touching or extending outside the safe printable margin (${safeMargin}mm).`,
        autoFixable: true,
        fixAction: 'Fit into Safe Margin',
      });
    }

    // 2. Barcode Specific Checks
    if (el.type === 'barcode') {
      const val = evaluateElementData(el, { record: activeRecord }) || el.value || '';
      const meta = getSymbologyMetadata(el.symbology);

      // Symbology regex validation
      const symCheck = validateBarcodeValue(el.symbology, val);
      if (!symCheck.valid) {
        issues.push({
          id: `sym-${el.id}`,
          severity: 'error',
          elementId: el.id,
          elementName: el.name,
          category: 'Barcode Symbology',
          message: `Symbology ${meta.name} error: ${symCheck.message}`,
        });
      }

      // Check digit check for EAN-13, UPC-A, ITF-14
      if ((el.symbology === 'ean13' || el.symbology === 'upca' || el.symbology === 'itf14') && /^\d+$/.test(val)) {
        const isValidCd = validateGS1CheckDigit(val);
        if (!isValidCd && val.length >= 8) {
          issues.push({
            id: `cd-${el.id}`,
            severity: 'error',
            elementId: el.id,
            elementName: el.name,
            category: 'GS1 Compliance',
            message: `Invalid Modulo-10 Check Digit for ${meta.name} value "${val}".`,
            autoFixable: true,
            fixAction: 'Recalculate Check Digit',
          });
        }
      }

      // GS1 Bracketed format checks
      if (el.symbology === 'gs1-128' || el.symbology === 'gs1-datamatrix' || el.symbology === 'gs1-qr') {
        const parsed = parseGS1BracketedString(val);
        if (!parsed.isValid) {
          issues.push({
            id: `gs1-${el.id}`,
            severity: 'error',
            elementId: el.id,
            elementName: el.name,
            category: 'GS1 Compliance',
            message: `GS1 AI syntax error: ${parsed.errors.join(', ')}`,
          });
        }
      }
    }

    // 3. Data Binding Check
    if (el.dataBinding) {
      const key = el.dataBinding.replace(/[{}]/g, '').trim();
      const hasVar = template.variables.some((v) => v.name === key || v.id === key);
      const hasRecordField = activeRecord[key] !== undefined || template.databaseConnection?.fields.includes(key);
      if (!hasVar && !hasRecordField) {
        issues.push({
          id: `bind-${el.id}`,
          severity: 'warning',
          elementId: el.id,
          elementName: el.name,
          category: 'Data Binding',
          message: `Unresolved data binding source "{{${key}}}" in element "${el.name}".`,
        });
      }
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-300 shadow-xl z-30 flex flex-col max-h-56 text-xs text-slate-700 select-none animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Problem & Validation Inspector (BarTender Standard)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
              errorCount > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {errorCount} Errors
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
              warningCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {warningCount} Warnings
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Issues Table */}
      <div className="flex-1 overflow-y-auto p-2">
        {issues.length === 0 ? (
          <div className="py-6 text-center text-slate-500 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800">All Standards & Print Bounds Compliant</p>
            <p className="text-[11px]">No barcode syntax errors, checksum mismatches, or margin overlaps detected.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase">
                <th className="py-1.5 px-2">Severity</th>
                <th className="py-1.5 px-2">Category</th>
                <th className="py-1.5 px-2">Object</th>
                <th className="py-1.5 px-2">Diagnostic Message</th>
                <th className="py-1.5 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-2">
                    {issue.severity === 'error' ? (
                      <span className="flex items-center gap-1 text-red-600 font-bold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5" /> Warning
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-semibold text-slate-700">{issue.category}</td>
                  <td className="py-2 px-2">
                    {issue.elementId ? (
                      <button
                        onClick={() => onSelectElement(issue.elementId!)}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        {issue.elementName}
                      </button>
                    ) : (
                      'Global'
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-600">{issue.message}</td>
                  <td className="py-2 px-2 text-right">
                    {issue.autoFixable && onAutoFix && (
                      <button
                        onClick={() => onAutoFix(issue)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-bold border border-blue-200 transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        {issue.fixAction || 'Auto-Fix'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
