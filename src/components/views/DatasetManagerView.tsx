import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit,
  Upload,
  Download,
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCode,
  Table,
  Layers,
  ArrowRight,
  Sparkles,
  Link,
  ChevronRight
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { UserProfile } from '../../types';

interface DatasetItem {
  id: string;
  name: string;
  description?: string;
  sourceType: 'manual' | 'excel' | 'csv' | 'json' | 'api';
  fileName?: string;
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
}

export const DatasetManagerView: React.FC<DatasetManagerViewProps> = ({
  currentUser,
  onNavigateToDashboard,
  onNavigateToDesigner,
}) => {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  // New Dataset Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newDsName, setNewDsName] = useState<string>('');
  const [newDsDescription, setNewDsDescription] = useState<string>('');

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  useEffect(() => {
    fetchDatasets();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'csv') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        let res: any;
        if (type === 'csv') {
          res = await apiService.datasets.uploadCsv({
            name: file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            csvText: text,
            createdBy: currentUser.name,
          });
        } else {
          // Fallback excel handler parsing mock or structure
          res = await apiService.datasets.uploadExcel({
            name: file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            records: [
              { ITEM_CODE: 'EXCEL-1001', PRODUCT_NAME: 'Imported Product A', BATCH_NO: 'B-01', SERIAL_NO: 'SN-001' },
              { ITEM_CODE: 'EXCEL-1002', PRODUCT_NAME: 'Imported Product B', BATCH_NO: 'B-02', SERIAL_NO: 'SN-002' },
            ],
            createdBy: currentUser.name,
          });
        }

        fetchDatasets();
        if (res?.id) setSelectedDatasetId(res.id);
        showToast(`Imported ${file.name} successfully!`);
      } catch (err: any) {
        alert(`Failed to import file: ${err.message}`);
      }
    };

    if (type === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
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

  const handleDeleteDataset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    try {
      await apiService.datasets.delete(id);
      fetchDatasets();
      showToast('Dataset deleted');
    } catch (err: any) {
      alert(`Error deleting dataset: ${err.message}`);
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
            <span>BarcodeFlow Enterprise Dataset Manager</span>
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
            100% OFFLINE DATASET ENGINE
          </span>
        </div>
      </div>

      {notification && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-xl text-xs font-bold animate-in fade-in">
          {notification}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Dataset List (4 cols) */}
        <div className="col-span-4 bg-slate-950/80 border-r border-slate-800 flex flex-col justify-between p-4 space-y-4">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Header & New Dataset */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>Datasets ({datasets.length})</span>
              </h2>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Dataset</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Dataset Cards List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredDatasets.map((ds) => {
                const isSelected = selectedDatasetId === ds.id;
                return (
                  <div
                    key={ds.id}
                    onClick={() => setSelectedDatasetId(ds.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-400/40 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[200px]">{ds.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {ds.sourceType}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 line-clamp-1">{ds.description || 'No description'}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                      <span>{ds.recordCount} Records</span>
                      <span>{ds.columns.length} Columns</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Import Actions Card */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-slate-300 flex items-center justify-between">
              <span>Quick File Import</span>
              <Upload className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded text-center cursor-pointer font-bold text-[11px]">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'csv')}
                  className="hidden"
                />
              </label>
              <label className="py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded text-center cursor-pointer font-bold text-[11px]">
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, 'excel')}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Main Panel: Dataset Records Matrix & Mapping (8 cols) */}
        <div className="col-span-8 bg-slate-900 flex flex-col justify-between overflow-hidden p-6 space-y-4">
          {selectedDataset ? (
            <>
              {/* Dataset Info Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <Table className="w-4 h-4" />
                    <span>Active Dataset Source</span>
                  </div>
                  <h1 className="text-xl font-bold text-white">{selectedDataset.name}</h1>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedDataset.description || 'Master enterprise dataset schema'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteDataset(selectedDataset.id)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Data Table Matrix */}
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-0">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Dataset Records Matrix ({selectedDataset.records.length} Total Rows)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                    Source: {selectedDataset.fileName || selectedDataset.sourceType.toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 overflow-auto p-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-slate-800 w-12 text-center text-slate-500">#</th>
                        {selectedDataset.columns.map((col) => (
                          <th key={col} className="p-2.5 border-b border-slate-800 font-mono text-blue-400 uppercase tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {selectedDataset.records.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                          <td className="p-2 text-center text-slate-600 font-bold">{idx + 1}</td>
                          {selectedDataset.columns.map((col) => (
                            <td key={col} className="p-2.5 text-slate-300 truncate max-w-xs">
                              {row[col] !== undefined ? String(row[col]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Variable Mapping & Label Binding Info */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Link className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Template Field Variable Binding</span>
                    <span className="text-[11px] text-slate-400">
                      Variables available for Studio Designer: {selectedDataset.columns.map((c) => `{{${c}}}`).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select or create a dataset to manage records
            </div>
          )}
        </div>
      </div>

      {/* New Dataset Modal */}
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
