import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit,
  Upload,
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Table,
  Sparkles,
  Link,
  FolderOpen,
  Eye,
  AlertTriangle,
  FileCheck,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { UserProfile, DatabaseConnectionConfig, ExcelDataSourceMode } from '../../types';
import { ExcelConnectWizardModal } from '../dialogs/ExcelConnectWizardModal';
import { RecordBrowserModal } from '../dialogs/RecordBrowserModal';

interface DatasetItem {
  id: string;
  name: string;
  description?: string;
  sourceType: 'manual' | 'excel' | 'csv' | 'json' | 'api';
  mode?: 'import' | 'link' | 'imported' | 'linked';
  fileName?: string;
  filePath?: string;
  sheetName?: string;
  headerRow?: number;
  status?: string;
  statusMessage?: string;
  lastModified?: string;
  columns: string[];
  records: Record<string, any>[];
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface DatasetManagerViewProps {
  currentUser: UserProfile;
  onNavigateToDashboard: () => void;
  onNavigateToDesigner?: () => void;
  onSelectDatasetForDesigner?: (dataset: DatabaseConnectionConfig) => void;
}

export const DatasetManagerView: React.FC<DatasetManagerViewProps> = ({
  currentUser,
  onNavigateToDashboard,
  onNavigateToDesigner,
  onSelectDatasetForDesigner,
}) => {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  // Excel Connect Wizard state
  const [isExcelWizardOpen, setIsExcelWizardOpen] = useState<boolean>(false);
  const [excelWizardMode, setExcelWizardMode] = useState<ExcelDataSourceMode>('linked');
  const [wizardEditConfig, setWizardEditConfig] = useState<DatabaseConnectionConfig | null>(null);

  // Record Browser Modal
  const [isRecordBrowserOpen, setIsRecordBrowserOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeBrowserRecordIndex, setActiveBrowserRecordIndex] = useState<number>(0);
  const [selectedBrowserIndices, setSelectedBrowserIndices] = useState<number[]>([]);

  // File Change Banner state
  const [fileChangedAlert, setFileChangedAlert] = useState<{
    datasetId: string;
    filePath: string;
    datasetName: string;
  } | null>(null);

  // Test Connection result dialog
  const [testConnectionData, setTestConnectionData] = useState<{
    isOpen: boolean;
    datasetName: string;
    filePath: string;
    success: boolean;
    sheetCount?: number;
    sheets?: string[];
    totalRecords?: number;
    error?: string;
  } | null>(null);

  // New Dataset Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newDsName, setNewDsName] = useState<string>('');
  const [newDsDescription, setNewDsDescription] = useState<string>('');

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  useEffect(() => {
    fetchDatasets();

    // Register Electron file change listener
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onExcelFileChanged) {
      const unsubscribe = electronAPI.onExcelFileChanged((data: { filePath: string; datasetId: string }) => {
        setFileChangedAlert({
          datasetId: data.datasetId,
          filePath: data.filePath,
          datasetName: 'Linked Excel File',
        });
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  const fetchDatasets = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.datasets.list();
      setDatasets(data);
      if (data.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(data[0].id);
      }
    } catch (err) {
      console.warn('Failed to fetch datasets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Complete Excel Connect Wizard
  const handleExcelWizardComplete = async (config: {
    mode: ExcelDataSourceMode;
    datasetName: string;
    filePath?: string;
    sheetName: string;
    headerRow: number;
    columns: any[];
    records: Record<string, any>[];
    autoRefresh: boolean;
    quantityColumn?: string;
  }) => {
    try {
      const columnNames = config.columns.map((c) => c.name);
      const res = await apiService.datasets.linkExcel({
        name: config.datasetName,
        mode: config.mode,
        filePath: config.filePath,
        sheetName: config.sheetName,
        headerRow: config.headerRow,
        columns: columnNames,
        records: config.records,
        autoRefresh: config.autoRefresh,
        quantityColumn: config.quantityColumn,
        createdBy: currentUser.name,
      });

      if (res && res.dataset) {
        await fetchDatasets();
        setSelectedDatasetId(res.dataset.id);
        showToast(
          config.mode === 'linked'
            ? `Linked "${config.datasetName}" to Excel file!`
            : `Imported "${config.datasetName}" from Excel snapshot!`
        );

        // Register Electron watcher if available
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.watchExcelFile && config.filePath) {
          await electronAPI.watchExcelFile(config.filePath, res.dataset.id);
        }
      }
    } catch (err: any) {
      alert(`Failed to save Excel connection: ${err.message}`);
    }
  };

  // 1. REFRESH: Re-read the ORIGINAL Excel file from its saved path
  const handleRefreshDataset = async (id: string) => {
    setIsRefreshing(true);
    try {
      const res = await apiService.datasets.refresh(id);
      if (res.success) {
        await fetchDatasets();
        showToast(`Refreshed dataset "${res.dataset.name}" (${res.dataset.recordCount} records loaded directly from disk)`);
      } else {
        alert(`Refresh warning: ${res.message || res.error}`);
      }
    } catch (err: any) {
      alert(`Failed to refresh dataset: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 2. TEST CONNECTION: Diagnostic validation
  const handleTestConnection = async (ds: DatasetItem) => {
    if (!ds.filePath) {
      alert('This dataset is an imported snapshot without a linked file path.');
      return;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      let res: any = null;

      if (electronAPI?.testExcelConnection) {
        res = await electronAPI.testExcelConnection(ds.filePath, ds.sheetName);
      } else {
        res = await apiService.datasets.testConnection({
          filePath: ds.filePath,
          sheetName: ds.sheetName,
        });
      }

      if (res && res.success) {
        setTestConnectionData({
          isOpen: true,
          datasetName: ds.name,
          filePath: ds.filePath,
          success: true,
          sheetCount: res.sheetCount || res.sheets?.length || 1,
          sheets: res.sheets || [ds.sheetName || 'Sheet1'],
          totalRecords: res.totalRecords ?? ds.recordCount,
        });
      } else {
        setTestConnectionData({
          isOpen: true,
          datasetName: ds.name,
          filePath: ds.filePath,
          success: false,
          error: res?.error || 'Could not access the Excel file at this location.',
        });
      }
    } catch (err: any) {
      setTestConnectionData({
        isOpen: true,
        datasetName: ds.name,
        filePath: ds.filePath,
        success: false,
        error: err.message || 'Connection test failed.',
      });
    }
  };

  // 3. OPEN FILE: Open in Microsoft Excel or show in folder
  const handleOpenExcelFile = async (filePath?: string) => {
    if (!filePath) {
      showToast('No file path stored for this dataset.');
      return;
    }
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExcelFile) {
      const ok = await electronAPI.openExcelFile(filePath);
      if (!ok && electronAPI.openExcelLocation) {
        await electronAPI.openExcelLocation(filePath);
      }
      showToast(`Opened: ${filePath}`);
    } else if (electronAPI?.openExcelLocation) {
      await electronAPI.openExcelLocation(filePath);
      showToast(`Showing in folder: ${filePath}`);
    } else {
      showToast(`Local path: ${filePath}`);
    }
  };

  // 4. CHANGE FILE / LOCATE FILE: Relink missing or moved file
  const handleLocateFile = async (ds: DatasetItem) => {
    const electronAPI = (window as any).electronAPI;
    let newPath: string | undefined;

    if (electronAPI?.locateExcelFile) {
      const res = await electronAPI.locateExcelFile(ds.filePath);
      if (!res.canceled && res.filePath) {
        newPath = res.filePath;
      }
    } else {
      const promptRes = window.prompt('Enter new path for Excel file:', ds.filePath || '');
      if (promptRes && promptRes.trim()) {
        newPath = promptRes.trim();
      }
    }

    if (newPath) {
      try {
        const res = await apiService.datasets.relink(ds.id, {
          newFilePath: newPath,
          newSheetName: ds.sheetName,
        });
        if (res.success) {
          await fetchDatasets();
          showToast(`Successfully relinked "${ds.name}" to: ${newPath}`);
        } else {
          alert(`Relink warning: ${res.error || 'Failed to relink file'}`);
        }
      } catch (err: any) {
        alert(`Failed to relink file: ${err.message}`);
      }
    }
  };

  // 5. EDIT CONNECTION: Open wizard with current dataset
  const handleEditConnection = (ds: DatasetItem) => {
    const editCfg: DatabaseConnectionConfig = {
      id: ds.id,
      name: ds.name,
      type: 'excel',
      mode: (ds.mode === 'import' ? 'imported' : 'linked'),
      filePath: ds.filePath,
      fileName: ds.fileName,
      sheetName: ds.sheetName,
      headerRow: ds.headerRow || 1,
      fields: ds.columns,
      records: ds.records,
    };
    setWizardEditConfig(editCfg);
    setExcelWizardMode((ds.mode === 'import' ? 'imported' : 'linked'));
    setIsExcelWizardOpen(true);
  };

  // 6. REMOVE CONNECTION: Delete from system
  const handleDeleteDataset = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this data source?')) return;
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.unwatchExcelFile) {
        await electronAPI.unwatchExcelFile(id);
      }
      await apiService.datasets.delete(id);
      fetchDatasets();
      showToast('Data source connection removed');
    } catch (err: any) {
      alert(`Error deleting dataset: ${err.message}`);
    }
  };

  // Apply to Studio Designer
  const handleApplyToDesigner = (ds: DatasetItem) => {
    if (onSelectDatasetForDesigner) {
      onSelectDatasetForDesigner({
        id: ds.id,
        name: ds.name,
        type: ds.sourceType === 'excel' ? 'excel' : ds.sourceType === 'csv' ? 'csv' : 'sample',
        filePath: ds.filePath,
        sheetName: ds.sheetName,
        headerRow: ds.headerRow,
        fields: ds.columns,
        records: ds.records,
        status: (ds.status as any) || 'READY',
        mode: (ds.mode === 'import' ? 'imported' : 'linked'),
      });
      showToast(`Loaded "${ds.name}" into Studio Designer!`);
    }
    if (onNavigateToDesigner) {
      onNavigateToDesigner();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'csv') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'excel') {
      setWizardEditConfig(null);
      setExcelWizardMode('imported');
      setIsExcelWizardOpen(true);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const res = await apiService.datasets.uploadCsv({
          name: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          csvText: text,
          createdBy: currentUser.name,
        });

        fetchDatasets();
        if (res?.id) setSelectedDatasetId(res.id);
        showToast(`Imported ${file.name} successfully!`);
      } catch (err: any) {
        alert(`Failed to import file: ${err.message}`);
      }
    };

    reader.readAsText(file);
  };

  const handleCreateDataset = async () => {
    if (!newDsName.trim()) return;
    try {
      const created = await apiService.datasets.create({
        name: newDsName,
        description: newDsDescription,
        sourceType: 'manual',
        columns: ['ITEM_CODE', 'PRODUCT_NAME', 'BATCH_NO', 'SERIAL_NO'],
        records: [
          { ITEM_CODE: 'ITEM-01', PRODUCT_NAME: 'Sample Manual Item', BATCH_NO: 'BAT-100', SERIAL_NO: 'SN-1001' }
        ],
        createdBy: currentUser.name,
      });

      fetchDatasets();
      setSelectedDatasetId(created.id);
      setIsNewModalOpen(false);
      setNewDsName('');
      setNewDsDescription('');
      showToast(`Created dataset "${created.name}"`);
    } catch (err: any) {
      alert(`Error creating dataset: ${err.message}`);
    }
  };

  const filteredDatasets = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen w-screen bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Application Bar */}
      <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 text-xs select-none shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all shadow-xs"
          >
            <span>← Dashboard</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <Database className="w-4 h-4 text-blue-400" />
            <span>BarcodeFlow Data Source Connection Manager</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToDesigner && (
            <button
              onClick={onNavigateToDesigner}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium"
            >
              ✏️ Studio Designer
            </button>
          )}
          <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
            LIVE FILE DATA CONNECTION
          </span>
        </div>
      </div>

      {/* File Change Detection Banner */}
      {fileChangedAlert && (
        <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md border-b border-amber-500 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 animate-pulse" />
            <span>
              <strong>Source file changed:</strong> <code className="bg-amber-700/60 px-1.5 py-0.5 rounded font-mono">{fileChangedAlert.filePath}</code>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleRefreshDataset(fileChangedAlert.datasetId);
                setFileChangedAlert(null);
              }}
              className="px-3 py-1 bg-white text-amber-900 font-bold rounded hover:bg-amber-50 shadow-xs transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Now
            </button>
            <button
              onClick={() => setFileChangedAlert(null)}
              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium transition-colors"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-xl text-xs font-bold animate-in fade-in">
          {notification}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Connection-Oriented Cards List (4 cols) */}
        <div className="col-span-4 bg-slate-950/80 border-r border-slate-800 flex flex-col justify-between p-4 space-y-4">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Header & Add Connection Action */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>Data Connections ({datasets.length})</span>
              </h2>

              <button
                type="button"
                onClick={() => {
                  setWizardEditConfig(null);
                  setExcelWizardMode('linked');
                  setIsExcelWizardOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-xs transition-colors"
                title="Add Data Source Connection (BarTender-style File Connection)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Data Source</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search data sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Connection Cards List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredDatasets.map((ds) => {
                const isSelected = selectedDatasetId === ds.id;
                const isLinked = ds.sourceType === 'excel' && ds.filePath;
                const isMissing = ds.status === 'FILE_MISSING';
                const isDrift = ds.status === 'FILE_CHANGED';

                return (
                  <div
                    key={ds.id}
                    onClick={() => setSelectedDatasetId(ds.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-400/40 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {/* Card Header: Title & Badges */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[190px]">{ds.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border flex items-center gap-1 ${
                          isLinked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        MICROSOFT EXCEL
                      </span>
                    </div>

                    {/* Card Body: File path & Sheet name */}
                    <div className="text-[11px] space-y-0.5">
                      <p className="text-slate-400 truncate font-mono text-[10.5px]">
                        <strong>File:</strong> {ds.filePath || ds.fileName || 'Snapshot'}
                      </p>
                      {ds.sheetName && (
                        <p className="text-emerald-400 font-mono text-[10.5px]">
                          <strong>Sheet:</strong> {ds.sheetName}$
                        </p>
                      )}
                    </div>

                    {/* Counts & Status */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/80">
                      <span>{ds.recordCount} rows • {ds.columns.length} columns</span>
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          isMissing
                            ? 'text-red-400'
                            : isDrift
                            ? 'text-amber-400 animate-pulse'
                            : 'text-emerald-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isMissing ? 'bg-red-400' : isDrift ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                        {isMissing ? 'FILE MISSING' : isDrift ? 'FILE CHANGED' : 'Connected'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Import Snapshot Footer */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-slate-300 flex items-center justify-between">
              <span>Import Mode (Static Snapshot)</span>
              <Upload className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded text-center cursor-pointer font-bold text-[11px] transition-colors">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'csv')}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setWizardEditConfig(null);
                  setExcelWizardMode('imported');
                  setIsExcelWizardOpen(true);
                }}
                className="py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded text-center font-bold text-[11px] transition-colors"
              >
                Import Excel
              </button>
            </div>
          </div>
        </div>

        {/* Right Main Panel: Connection Details & 6 Standard Action Buttons (8 cols) */}
        <div className="col-span-8 bg-slate-900 flex flex-col justify-between overflow-hidden p-6 space-y-4">
          {selectedDataset ? (
            <>
              {/* Connection Detail Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                      <Table className="w-4 h-4" />
                      <span>{selectedDataset.sourceType === 'excel' ? 'MICROSOFT EXCEL' : 'DATABASE'}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                        BARTENDER FILE CONNECTION
                      </span>
                    </div>

                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                      {selectedDataset.name}
                      {selectedDataset.status === 'FILE_CHANGED' && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-normal flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> External Edit Detected
                        </span>
                      )}
                      {selectedDataset.status === 'FILE_MISSING' && (
                        <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded font-normal flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> FILE MISSING
                        </span>
                      )}
                    </h1>

                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      <span><strong>File:</strong> {selectedDataset.filePath || 'None'}</span>
                      {selectedDataset.sheetName && (
                        <span className="ml-3 text-emerald-400">
                          <strong>Sheet:</strong> {selectedDataset.sheetName}$
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 6 REQUIRED BUTTONS: Refresh, Test Connection, Open File, Change File, Edit Connection, Remove */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Refresh Button */}
                    <button
                      type="button"
                      disabled={isRefreshing}
                      onClick={() => handleRefreshDataset(selectedDataset.id)}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Re-read the original Excel file from its saved disk path"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>

                    {/* 2. Test Connection Button */}
                    {selectedDataset.filePath && (
                      <button
                        type="button"
                        onClick={() => handleTestConnection(selectedDataset)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Validate file exists, readability, workbook integrity"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Test Connection</span>
                      </button>
                    )}

                    {/* 3. Open File Button */}
                    {selectedDataset.filePath && (
                      <button
                        type="button"
                        onClick={() => handleOpenExcelFile(selectedDataset.filePath)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Open Excel file in spreadsheet app or file location"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>Open File</span>
                      </button>
                    )}

                    {/* 4. Change File / Locate File Button */}
                    {selectedDataset.filePath && (
                      <button
                        type="button"
                        onClick={() => handleLocateFile(selectedDataset)}
                        className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          selectedDataset.status === 'FILE_MISSING'
                            ? 'bg-red-600 text-white border-red-500 hover:bg-red-500'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        }`}
                        title={selectedDataset.status === 'FILE_MISSING' ? 'Locate missing Excel file' : 'Change Excel file path'}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                        <span>{selectedDataset.status === 'FILE_MISSING' ? 'Locate File' : 'Change File'}</span>
                      </button>
                    )}

                    {/* 5. Edit Connection Button */}
                    <button
                      type="button"
                      onClick={() => handleEditConnection(selectedDataset)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Edit worksheet or connection parameters"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit Connection</span>
                    </button>

                    {/* 6. Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteDataset(selectedDataset.id)}
                      className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold transition-colors"
                      title="Remove connection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Connection Details Status Strip */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      Sheet: <strong className="text-white font-mono">{selectedDataset.sheetName || 'Sheet1'}$</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Rows: <strong className="text-white">{selectedDataset.recordCount}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Columns: <strong className="text-white">{selectedDataset.columns.length}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRecordBrowserOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Browse Records Grid
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleApplyToDesigner(selectedDataset)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Use In Designer
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Grid Matrix */}
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-inner">
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Dataset Records Preview (Showing up to 100 rows)
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    RAW VALUE STRING TOKENS PRESERVED
                  </span>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                      <tr>
                        <th className="p-2 w-12 text-center text-slate-600">#</th>
                        {selectedDataset.columns.map((col) => (
                          <th key={col} className="p-2.5 whitespace-nowrap text-slate-300 font-bold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {selectedDataset.records.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                          <td className="p-2 text-center text-slate-600 font-bold">{idx + 1}</td>
                          {selectedDataset.columns.map((col) => {
                            const val = row[col] !== undefined ? String(row[col]) : '-';
                            return (
                              <td key={col} className="p-2.5 text-slate-300 truncate max-w-xs">
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Variable Mapping & Designer Integration */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Link className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Template Field Variable Binding</span>
                    <span className="text-[11px] text-slate-400">
                      Available Fields: {selectedDataset.columns.map((c) => `{{${c}}}`).join(', ')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyToDesigner(selectedDataset)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs transition-colors shadow-xs"
                >
                  Load into Designer →
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select or connect an Excel data source to manage records
            </div>
          )}
        </div>
      </div>

      {/* Test Connection Diagnostic Modal */}
      {testConnectionData && testConnectionData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                {testConnectionData.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span>{testConnectionData.success ? '✓ Connection Successful' : 'Connection Failed'}</span>
              </h3>
              <button
                onClick={() => setTestConnectionData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {testConnectionData.success ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 text-xs text-slate-200">
                <p className="font-mono text-emerald-300">
                  <strong>File:</strong> {testConnectionData.filePath}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Worksheets:</span>
                    <span className="font-bold text-white text-sm">{testConnectionData.sheetCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Records:</span>
                    <span className="font-bold text-white text-sm">{testConnectionData.totalRecords}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2 text-xs text-red-200">
                <p><strong>Path Checked:</strong> {testConnectionData.filePath}</p>
                <p><strong>Error:</strong> {testConnectionData.error}</p>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setTestConnectionData(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Connect Wizard Modal */}
      <ExcelConnectWizardModal
        isOpen={isExcelWizardOpen}
        onClose={() => {
          setIsExcelWizardOpen(false);
          setWizardEditConfig(null);
        }}
        onComplete={handleExcelWizardComplete}
        initialMode={excelWizardMode}
        editConfig={wizardEditConfig}
      />

      {/* Record Browser Modal */}
      {selectedDataset && (
        <RecordBrowserModal
          isOpen={isRecordBrowserOpen}
          onClose={() => setIsRecordBrowserOpen(false)}
          dataset={{
            id: selectedDataset.id,
            name: selectedDataset.name,
            type: selectedDataset.sourceType === 'excel' ? 'excel' : 'sample',
            fields: selectedDataset.columns,
            records: selectedDataset.records,
          }}
          activeRecordIndex={activeBrowserRecordIndex}
          onSelectActiveRecord={(idx) => {
            setActiveBrowserRecordIndex(idx);
            showToast(`Selected record #${idx + 1} as active record`);
          }}
          selectedIndices={selectedBrowserIndices}
          onToggleRecordSelection={(idx) => {
            setSelectedBrowserIndices((prev) =>
              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
            );
          }}
          onSelectAll={(indices) => setSelectedBrowserIndices(indices)}
          onClearSelection={() => setSelectedBrowserIndices([])}
        />
      )}

      {/* New Manual Dataset Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-white shadow-2xl">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Create New Manual Dataset</span>
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Dataset Name</label>
                <input
                  type="text"
                  value={newDsName}
                  onChange={(e) => setNewDsName(e.target.value)}
                  placeholder="e.g. Master Production Lots"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  value={newDsDescription}
                  onChange={(e) => setNewDsDescription(e.target.value)}
                  placeholder="Dataset purpose and description..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 h-20"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDataset}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
              >
                Create Dataset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
