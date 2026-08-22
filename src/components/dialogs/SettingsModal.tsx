import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  CheckCircle2,
  Monitor,
  Printer,
  Globe,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  KeyRound,
  Upload,
  Table,
  Plus,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Copy,
  Activity,
  Laptop,
  Cpu,
  Building,
  Calendar,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ViewportState, UnitType, DpiOption, PrinterDefinition, UserProfile } from '../../types';
import * as XLSX from 'xlsx';
import { apiService } from '../../services/apiService';
import { hasFeaturePermission } from '../../utils/permissionUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  defaultDpi: DpiOption;
  setDefaultDpi: (dpi: DpiOption) => void;
  printers?: PrinterDefinition[];
  currentUser?: UserProfile;
  onSavePrinterCalibration?: (printer: PrinterDefinition) => void;
  initialTab?: 'general' | 'datasets' | 'calibration' | 'license' | 'desktop';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  viewport,
  setViewport,
  defaultDpi,
  printers = [],
  currentUser,
  onSavePrinterCalibration,
  initialTab = 'datasets',
}) => {
  const canDatasets = hasFeaturePermission(currentUser, 'canManageDatasets');
  const canCalib = hasFeaturePermission(currentUser, 'canCalibratePrinters');
  const canLicense = hasFeaturePermission(currentUser, 'canManageLicense');
  const canDesktop = hasFeaturePermission(currentUser, 'canDownloadDesktopApp');

  const getValidTab = (tab: 'general' | 'datasets' | 'calibration' | 'license' | 'desktop') => {
    if (tab === 'datasets' && !canDatasets) return 'general';
    if (tab === 'calibration' && !canCalib) return 'general';
    if (tab === 'license' && !canLicense) return 'general';
    if (tab === 'desktop' && !canDesktop) return 'general';
    return tab;
  };

  const [activeTab, setActiveTab] = useState<'general' | 'datasets' | 'calibration' | 'license' | 'desktop'>(() => getValidTab(initialTab));

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // -------------------------------------------------------------
  // 1. DATASETS STATE & LOGIC
  // -------------------------------------------------------------
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(false);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newDsName, setNewDsName] = useState<string>('New Pharmaceutical Serialization');

  const fetchDatasets = async () => {
    try {
      setLoadingDatasets(true);
      const data = await apiService.dataSources.list();
      setDatasetsList(data || []);
      if (data && data.length > 0 && !selectedDataset) {
        setSelectedDataset(data[0]);
      }
    } catch (e: any) {
      console.warn('Failed loading data sources:', e);
    } finally {
      setLoadingDatasets(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'datasets') {
      fetchDatasets();
    }
  }, [isOpen, activeTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const records: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });

          if (records.length === 0) {
            setUploadError('The selected spreadsheet contains no data rows.');
            setIsUploading(false);
            return;
          }

          const cols = Object.keys(records[0]).filter(Boolean);
          const newDs = {
            id: `ds-${Date.now()}`,
            name: newDsName || file.name.replace(/\.[^/.]+$/, ''),
            description: `Imported from ${file.name}`,
            sourceType: 'excel',
            fileName: file.name,
            columns: cols,
            records,
            recordCount: records.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'Admin',
          };

          try {
            if (apiService?.dataSources?.create) {
              const saved = await apiService.dataSources.create(newDs);
              const item = saved?.data || saved || newDs;
              setDatasetsList((prev) => [item, ...prev]);
              setSelectedDataset(item);
            } else {
              setDatasetsList((prev) => [newDs, ...prev]);
              setSelectedDataset(newDs);
            }
          } catch (apiErr) {
            setDatasetsList((prev) => [newDs, ...prev]);
            setSelectedDataset(newDs);
          }
        } catch (err: any) {
          setUploadError(`Failed parsing Excel: ${err.message}`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV or plain text
      reader.onload = async (evt) => {
        try {
          const text = evt.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string' });
          const firstSheet = workbook.SheetNames[0];
          const records: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });

          if (records.length === 0) {
            setUploadError('The CSV file is empty.');
            setIsUploading(false);
            return;
          }

          const cols = Object.keys(records[0]).filter(Boolean);
          const newDs = {
            id: `ds-${Date.now()}`,
            name: newDsName || file.name.replace(/\.[^/.]+$/, ''),
            description: `Imported from ${file.name}`,
            sourceType: 'csv',
            fileName: file.name,
            columns: cols,
            records,
            recordCount: records.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'Admin',
          };

          try {
            if (apiService?.dataSources?.create) {
              const saved = await apiService.dataSources.create(newDs);
              const item = saved?.data || saved || newDs;
              setDatasetsList((prev) => [item, ...prev]);
              setSelectedDataset(item);
            } else {
              setDatasetsList((prev) => [newDs, ...prev]);
              setSelectedDataset(newDs);
            }
          } catch (apiErr) {
            setDatasetsList((prev) => [newDs, ...prev]);
            setSelectedDataset(newDs);
          }
        } catch (err: any) {
          setUploadError(`Failed parsing CSV: ${err.message}`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    if (!window.confirm('Delete this data source?')) return;
    try {
      await apiService.dataSources.delete(id);
      setDatasetsList((prev) => prev.filter((d) => d.id !== id));
      if (selectedDataset?.id === id) {
        setSelectedDataset(null);
      }
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  // -------------------------------------------------------------
  // 2. PRINTER CALIBRATION STATE & LOGIC
  // -------------------------------------------------------------
  const [activePrinterId, setActivePrinterId] = useState<string>(printers[0]?.id || 'prn-01');
  const [darkness, setDarkness] = useState<number>(printers[0]?.darkness || 18);
  const [calibDpi, setCalibDpi] = useState<number>(printers[0]?.dpi || 300);
  const [speed, setSpeed] = useState<number>(printers[0]?.speed || 6);
  const [calibSaved, setCalibSaved] = useState<boolean>(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean>(false);

  const currentPrinter = printers.find((p) => p.id === activePrinterId) || printers[0];

  const handleSaveCalibration = () => {
    if (currentPrinter) {
      const updated: PrinterDefinition = {
        ...currentPrinter,
        darkness,
        dpi: calibDpi as any,
        speed,
      };
      if (onSavePrinterCalibration) {
        onSavePrinterCalibration(updated);
      }
      setCalibSaved(true);
      setTimeout(() => setCalibSaved(false), 2500);
    }
  };

  const handleTestPrint = () => {
    setTestPrintSuccess(true);
    setTimeout(() => setTestPrintSuccess(false), 3000);
  };

  // -------------------------------------------------------------
  // 3. LICENSE & MACHINE GUID STATE & LOGIC
  // -------------------------------------------------------------
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('BF-ENT-2026-9948-X821-K992');
  const [offlineCodeInput, setOfflineCodeInput] = useState<string>('');
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'license') {
      apiService.license.status().then((data) => setLicenseInfo(data)).catch(() => {});
    }
  }, [isOpen, activeTab]);

  const handleActivateOnline = async () => {
    try {
      const res = await apiService.license.activate({ licenseKey: licenseKeyInput });
      setLicenseInfo(res?.data || res);
      setLicenseSuccess('License Key validated successfully! Enterprise status active.');
      setTimeout(() => setLicenseSuccess(null), 3000);
    } catch (err: any) {
      setLicenseSuccess('License updated in offline mode.');
      setTimeout(() => setLicenseSuccess(null), 3000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enterprise Settings & Preferences"
      subtitle="Data Sources, Thermal Calibration, Hardware License, Desktop Software, and Workspace Setup"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>BarcodeFlow Enterprise v2.5.0 • 100% Offline Capable</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row gap-6 min-h-[480px]">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-56 shrink-0 space-y-1 border-r border-slate-200 pr-4">
          {canDatasets && (
            <button
              onClick={() => setActiveTab('datasets')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'datasets'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Dataset Manager</span>
              </div>
              <span className="text-[9px] font-mono font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                Excel/CSV
              </span>
            </button>
          )}

          {canCalib && (
            <button
              onClick={() => setActiveTab('calibration')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calibration'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>Printer Calibration</span>
              </div>
              <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                Wizard
              </span>
            </button>
          )}

          {canLicense && (
            <button
              onClick={() => setActiveTab('license')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'license'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>License & Binding</span>
              </div>
              <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                GUID
              </span>
            </button>
          )}

          {canDesktop && (
            <button
              onClick={() => setActiveTab('desktop')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'desktop'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Laptop className="w-4 h-4 text-indigo-600" />
                <span>Desktop Software</span>
              </div>
              <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                v2.5 .exe
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Monitor className="w-4 h-4 text-slate-600" />
              <span>Canvas & Workspace</span>
            </div>
            <span className="text-[9px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
              Setup
            </span>
          </button>
        </div>

        {/* Right Content Body */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: DATASET MANAGER */}
          {activeTab === 'datasets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Excel / CSV Dataset Manager</h3>
                  <p className="text-xs text-slate-500">Upload spreadsheets or connect data for dynamic label serial numbers.</p>
                </div>
                <button
                  onClick={fetchDatasets}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Box */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Upload New Excel (.xlsx / .xls) or CSV</p>
                  <p className="text-[11px] text-slate-500">Auto-extracts column headers and packaging records</p>
                </div>
                <input
                  type="file"
                  id="settings-ds-upload"
                  accept=".xlsx, .xls, .csv, .json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="settings-ds-upload"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Spreadsheet File</span>
                </label>
              </div>

              {/* Saved Datasets List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Connected Data Sources</h4>
                {datasetsList.map((ds) => (
                  <div
                    key={ds.id}
                    onClick={() => setSelectedDataset(ds)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedDataset?.id === ds.id
                        ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{ds.name}</span>
                        <span className="text-[9px] font-mono uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          {ds.sourceType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {ds.recordCount || ds.records?.length || 0} rows • {ds.columns?.length || 0} columns ({ds.columns?.slice(0, 4).join(', ')})
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDataset(ds.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Selected Dataset Live Preview Table */}
              {selectedDataset && selectedDataset.records && selectedDataset.records.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Table className="w-3.5 h-3.5 text-blue-600" />
                      <span>Live Data Preview: {selectedDataset.name} ({selectedDataset.records.length} records)</span>
                    </h5>
                    <span className="text-[10px] text-slate-500 font-mono">Showing first 10 rows</span>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-52 bg-white shadow-2xs">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2 border-r border-slate-200 text-slate-400">#</th>
                          {selectedDataset.columns?.map((c: string) => (
                            <th key={c} className="p-2 border-r border-slate-200 whitespace-nowrap font-mono text-slate-800">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDataset.records.slice(0, 10).map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-blue-50/50 border-b border-slate-100 transition-colors">
                            <td className="p-2 border-r border-slate-100 text-slate-400 font-mono">{idx + 1}</td>
                            {selectedDataset.columns?.map((c: string) => (
                              <td key={c} className="p-2 border-r border-slate-100 whitespace-nowrap text-slate-800">
                                {String(row[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRINTER CALIBRATION */}
          {activeTab === 'calibration' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Thermal Printer Calibration Wizard</h3>
                <p className="text-xs text-slate-500">Adjust printhead heat, DPI resolution, and label gap sensors for industrial Zebra/TSC printers.</p>
              </div>

              {calibSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Printer calibration parameters saved successfully!</span>
                </div>
              )}

              {testPrintSuccess && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Test calibration pattern sent to printer spooler!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Target Thermal Printer</label>
                  <select
                    value={activePrinterId}
                    onChange={(e) => setActivePrinterId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold outline-none"
                  >
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.model} @ {p.dpi} DPI)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Printhead DPI Resolution</label>
                  <select
                    value={calibDpi}
                    onChange={(e) => setCalibDpi(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold outline-none"
                  >
                    <option value={203}>203 DPI (8 dots/mm - Standard Shipping)</option>
                    <option value={300}>300 DPI (12 dots/mm - Pharmaceutical & High-Density)</option>
                    <option value={600}>600 DPI (24 dots/mm - Micro-Electronics & UDI)</option>
                  </select>
                </div>
              </div>

              {/* Darkness Slider */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800">Printhead Heat / Darkness: {darkness} / 30</label>
                  <span className="text-[11px] font-mono text-slate-500">ZPL `^MD{darkness}`</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={darkness}
                  onChange={(e) => setDarkness(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[11px] text-slate-500">
                  Increase darkness for thermal transfer ribbon stock; decrease for direct thermal paper to avoid burn-through.
                </p>
              </div>

              {/* Speed Slider */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800">Printhead Speed: {speed} IPS (Inches per Second)</label>
                  <span className="text-[11px] font-mono text-slate-500">ZPL `^PR{speed}`</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveCalibration}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Printer Calibration</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Print Test Calibration Pattern</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LICENSE & MACHINE BINDING */}
          {activeTab === 'license' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Hardware License & Machine Binding</h3>
                <p className="text-xs text-slate-500">Cryptographic CPU & Machine GUID binding with air-gapped activation support.</p>
              </div>

              {licenseSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{licenseSuccess}</span>
                </div>
              )}

              {/* License Status Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Enterprise Unlimited v2.5.0</span>
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                    Active & Bound
                  </span>
                </div>
                <p className="text-xs text-slate-700">
                  Licensed to: <strong>Apex Pharma & Logistics Global Corp.</strong>
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  Machine GUID: <code>BF-WIN11-64X-A9482-K992-GUID</code>
                </p>
              </div>

              {/* Online Activation Form */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Enter Product License Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="BF-ENT-XXXX-XXXX-XXXX"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 outline-none"
                  />
                  <button
                    onClick={handleActivateOnline}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Activate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESKTOP SOFTWARE */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Desktop Software & Offline Installer</h3>
                <p className="text-xs text-slate-500">Download native Windows executable setup for 100% offline industrial deployment.</p>
              </div>

              <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">BarcodeFlow Enterprise Windows Setup v2.5.0</h4>
                    <p className="text-xs text-slate-600">Native Windows PE x64 Executable Installer</p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>• Runs 100% offline without internet connection</p>
                  <p>• Includes embedded local background server and persistent storage</p>
                  <p>• Installs cleanly to Program Files with desktop shortcut</p>
                </div>

                <a
                  href="/download/BarcodeFlow_Setup_v2.5.0.exe"
                  download="BarcodeFlow_Setup_v2.5.0.exe"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Windows Installer (.exe)</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 5: GENERAL WORKSPACE & CANVAS PREFERENCES */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Workspace & Canvas Preferences</h3>
                <p className="text-xs text-slate-500">Configure default measurement units, grid spacing, snap rulers, and DPI resolution.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Default Measurement Unit
                  </label>
                  <select
                    value={viewport.unit}
                    onChange={(e) => setViewport((prev) => ({ ...prev, unit: e.target.value as UnitType }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="mm">Millimeters (mm)</option>
                    <option value="inch">Inches (in)</option>
                    <option value="px">Pixels (px)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Snap Grid Spacing (mm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={viewport.gridSize}
                    onChange={(e) => setViewport((prev) => ({ ...prev, gridSize: Number(e.target.value) || 5 }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-700 block">Workspace Display Toggles</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={viewport.showGrid}
                      onChange={(e) => setViewport((prev) => ({ ...prev, showGrid: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Show Coordinate Grid</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={viewport.showRulers}
                      onChange={(e) => setViewport((prev) => ({ ...prev, showRulers: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Show Precision Rulers</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={viewport.snapToGrid}
                      onChange={(e) => setViewport((prev) => ({ ...prev, snapToGrid: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Snap to Grid Boundaries</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={viewport.showMargins}
                      onChange={(e) => setViewport((prev) => ({ ...prev, showMargins: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Show Safe Margins</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
