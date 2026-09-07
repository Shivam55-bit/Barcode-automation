import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRight,
  Database,
  RefreshCw,
  Eye,
  Table as TableIcon,
} from 'lucide-react';
import { LabelTemplate, VariableDefinition } from '../../types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  onImportData: (records: Record<string, string>[]) => void;
  onAutoCreateVariables?: (newVariables: VariableDefinition[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  template,
  onImportData,
  onAutoCreateVariables,
}) => {
  const [csvText, setCsvText] = useState('');
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [previewLimit, setPreviewLimit] = useState(5);
  const [autoMapVars, setAutoMapVars] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

  if (!isOpen) return null;

  // Sample standard CSV presets for quick testing
  const samplePalletCSV = `PALLET_SSCC,SHIP_TO_COMPANY,SHIP_TO_ADDRESS,PO_NUMBER,GTIN_14,BATCH_LOT,EXPIRY_DATE,TOTAL_WEIGHT
(00)008500065123456789,NORTHWEST MEDICAL DEPOT,1200 SUPPLY WAY SEATTLE WA 98101,PO-991204,10850006531238,LOT-NWM-01,271231,512.0 KG
(00)008500065123456790,GLOBAL FREIGHT HUB 4,500 AIRPORT ROAD DALLAS TX 75261,PO-991205,10850006531238,LOT-NWM-02,271231,495.8 KG
(00)008500065123456791,MIDWEST PHARMA LOGISTICS,800 COMMERCE BLVD CHICAGO IL 60607,PO-991206,10850006531238,LOT-NWM-03,280630,620.4 KG
(00)008500065123456792,PACIFIC HEALTH DISTRIBUTORS,3400 HARBOR DRIVE OAKLAND CA 94607,PO-991207,10850006531238,LOT-NWM-04,280630,580.1 KG`;

  const samplePharmaCSV = `PRODUCT_NAME,DOSAGE,ACTIVE_INGREDIENT,NDC_CODE,GTIN_DATAMATRIX,LOT_NUMBER,EXP_DATE,SERIAL_NUMBER
Amoxicillin Clavulanate,500mg / 125mg,Amoxicillin Trihydrate,0093-2274-34,(01)00300932274345(17)280630(10)LOT-AMX-88(21)SN-498102,LOT-AMX-88,06/2028,SN-498102
Amoxicillin Clavulanate,500mg / 125mg,Amoxicillin Trihydrate,0093-2274-34,(01)00300932274345(17)280630(10)LOT-AMX-88(21)SN-498103,LOT-AMX-88,06/2028,SN-498103
Metformin Hydrochloride,850mg ER,Metformin HCl,68180-337-01,(01)00368180337014(17)280930(10)LOT-MET-44(21)SN-882910,LOT-MET-44,09/2028,SN-882910
Atorvastatin Calcium,20mg,Atorvastatin,0071-0156-23,(01)00300710156238(17)290131(10)LOT-ATR-12(21)SN-339201,LOT-ATR-12,01/2029,SN-339201`;

  const parseCSVContent = (content: string) => {
    try {
      setError(null);
      if (!content.trim()) {
        setError('CSV content is empty.');
        return;
      }

      const lines = content
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setError('No rows found in data.');
        return;
      }

      // Simple CSV parse handling quotes
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const rawRows = lines.map(parseLine);

      let headers: string[] = [];
      let dataStart = 0;

      if (hasHeader) {
        headers = rawRows[0].map((h, i) => (h ? h.replace(/^["']|["']$/g, '') : `Column_${i + 1}`));
        dataStart = 1;
      } else {
        headers = rawRows[0].map((_, i) => `Column_${i + 1}`);
      }

      const records: Record<string, string>[] = [];
      for (let i = dataStart; i < rawRows.length; i++) {
        const row = rawRows[i];
        const record: Record<string, string> = {};
        headers.forEach((h, colIdx) => {
          record[h] = row[colIdx] !== undefined ? row[colIdx].replace(/^["']|["']$/g, '') : '';
        });
        records.push(record);
      }

      setParsedHeaders(headers);
      setParsedRows(records);
      setStep('preview');
    } catch (err: any) {
      setError(`Failed to parse CSV: ${err.message || 'Invalid format'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      parseCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (parsedRows.length === 0) {
      setError('Please load valid CSV data before applying.');
      return;
    }

    // Auto-create variables for columns that don't exist yet
    if (autoMapVars && onAutoCreateVariables) {
      const existingVarNames = new Set(template.variables.map((v) => v.name));
      const newVars: VariableDefinition[] = [];

      parsedHeaders.forEach((col) => {
        const cleanName = col.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
        if (!existingVarNames.has(cleanName) && !existingVarNames.has(col)) {
          newVars.push({
            id: `var-csv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            type: 'csv',
            defaultValue: parsedRows[0]?.[col] || '',
            csvColumn: col,
          });
        }
      });

      if (newVars.length > 0) {
        onAutoCreateVariables(newVars);
      }
    }

    onImportData(parsedRows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">CSV & External Data Source Import</h2>
              <p className="text-xs text-slate-500">
                Bind external batch records, serial numbers, and ERP columns to template variables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-4">
              {/* File upload drag & drop area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 text-sm">Click to choose a CSV file</span>
                    <span className="text-slate-500 text-xs block mt-1">Supports UTF-8 CSV, TSV, and semicolon delimited data</span>
                  </div>
                </label>
              </div>

              {/* Paste Text / Sample presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Or Paste Raw CSV Data</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCsvText(samplePalletCSV);
                        parseCSVContent(samplePalletCSV);
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Load Logistics Preset
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={() => {
                        setCsvText(samplePharmaCSV);
                        parseCSVContent(samplePharmaCSV);
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Load Pharma UDI Preset
                    </button>
                  </div>
                </div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Paste CSV rows here (e.g. SERIAL_NO,LOT,EXPIRY)..."
                  className="w-full h-36 font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Parsing Options */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Delimiter</label>
                  <select
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="&#9;">Tab (\t)</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>First row contains column headers</span>
                  </label>
                </div>
                <div className="flex items-center pt-5 justify-end">
                  <button
                    onClick={() => parseCSVContent(csvText)}
                    disabled={!csvText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <span>Parse & Preview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Preview and Mapping Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    Successfully parsed <strong>{parsedRows.length}</strong> record{parsedRows.length === 1 ? '' : 's'} across <strong>{parsedHeaders.length}</strong> column{parsedHeaders.length === 1 ? '' : 's'}.
                  </span>
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Columns Detected */}
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Detected Columns & Variable Binding:</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer font-normal">
                    <input
                      type="checkbox"
                      checked={autoMapVars}
                      onChange={(e) => setAutoMapVars(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Auto-create missing template variables</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsedHeaders.map((hdr) => {
                    const matchedVar = template.variables.find((v) => v.name.toLowerCase() === hdr.toLowerCase() || v.csvColumn === hdr);
                    return (
                      <span
                        key={hdr}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                          matchedVar
                            ? 'bg-blue-50 border-blue-300 text-blue-800'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        }`}
                      >
                        <Database className="w-3 h-3" />
                        <span>{hdr}</span>
                        {matchedVar ? (
                          <span className="text-[9px] bg-blue-200 text-blue-900 px-1 rounded font-bold">Bound: {matchedVar.name}</span>
                        ) : (
                          <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded font-bold">New Variable</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Data Table Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">Preview Data Records (First {Math.min(previewLimit, parsedRows.length)})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Use records in the bottom-left data preview navigator on canvas
                  </span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60 bg-white">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">#</th>
                        {parsedHeaders.map((hdr) => (
                          <th key={hdr} className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {hdr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, previewLimit).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-slate-400 text-[10px] font-bold">{idx + 1}</td>
                          {parsedHeaders.map((hdr) => (
                            <td key={hdr} className="py-1.5 px-3 text-slate-800 whitespace-nowrap truncate max-w-xs">
                              {row[hdr] || <span className="text-slate-300 italic">empty</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Import {parsedRows.length} Records into Template</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
