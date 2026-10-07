import React, { useState, useEffect, useMemo } from 'react';
import { DataSourceItem, DatabaseConnectionConfig } from '../../types';
import { apiService } from '../../services/apiService';
import { Database, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface DatabaseFieldSourceConfigProps {
  dataSource: DataSourceItem;
  onUpdate: (updates: Partial<DataSourceItem>) => void;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  currentConnection?: DatabaseConnectionConfig;
  onConnectDatasetToTemplate?: (dataset: any) => void;
}

export const DatabaseFieldSourceConfig: React.FC<DatabaseFieldSourceConfigProps> = ({
  dataSource,
  onUpdate,
  datasets: propDatasets,
  currentRecord,
  currentConnection,
  onConnectDatasetToTemplate,
}) => {
  const [internalDatasets, setInternalDatasets] = useState<any[]>(propDatasets || []);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(false);

  // Sync prop datasets or fetch from API if not yet loaded
  useEffect(() => {
    if (propDatasets && propDatasets.length > 0) {
      setInternalDatasets(propDatasets);
    } else {
      setIsLoadingDatasets(true);
      apiService.datasets
        .list()
        .then((list) => {
          if (Array.isArray(list)) {
            setInternalDatasets(list);
          }
        })
        .catch((err) => console.warn('Failed to load datasets for DatabaseFieldSourceConfig:', err))
        .finally(() => setIsLoadingDatasets(false));
    }
  }, [propDatasets]);

  // Combine propDatasets/API datasets with the template's current active connection
  const effectiveDatasets = useMemo(() => {
    const list = [...internalDatasets];
    if (currentConnection && currentConnection.records && currentConnection.records.length > 0) {
      const connObj = {
        id: currentConnection.id || 'current-active-conn',
        name: currentConnection.name,
        sourceType: currentConnection.type === 'excel' ? 'excel' : currentConnection.type === 'csv' ? 'csv' : 'sql',
        sheetName: currentConnection.sheetName || 'Sheet1',
        availableSheets: currentConnection.sheetName ? [currentConnection.sheetName] : ['Sheet1'],
        columns: currentConnection.fields || (currentConnection.records?.[0] ? Object.keys(currentConnection.records[0] || {}) : []),
        fields: currentConnection.fields || (currentConnection.records?.[0] ? Object.keys(currentConnection.records[0] || {}) : []),
        records: currentConnection.records,
        recordCount: currentConnection.records.length,
      };

      const existingIdx = list.findIndex((d) => d.id === connObj.id || d.name === connObj.name);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...connObj };
      } else {
        list.unshift(connObj);
      }
    }
    return list;
  }, [internalDatasets, currentConnection]);

  // Current selected dataset
  const activeDataset = useMemo(() => {
    if (dataSource.datasetId) {
      const found = effectiveDatasets.find((d) => d.id === dataSource.datasetId || d.name === dataSource.datasetId);
      if (found) return found;
    }
    if (dataSource.datasetName) {
      const found = effectiveDatasets.find((d) => d.name === dataSource.datasetName);
      if (found) return found;
    }
    // If template has an active connection, default to it
    if (currentConnection) {
      const found = effectiveDatasets.find(
        (d) => d.name === currentConnection.name || d.id === currentConnection.id || d.id === 'current-active-conn'
      );
      if (found) return found;
    }
    return effectiveDatasets[0] || null;
  }, [dataSource.datasetId, dataSource.datasetName, effectiveDatasets, currentConnection]);

  // Detected sheets (for Excel workbooks)
  const availableSheets = useMemo(() => {
    if (!activeDataset) return ['Sheet1'];
    if (Array.isArray(activeDataset.availableSheets) && activeDataset.availableSheets.length > 0) {
      return activeDataset.availableSheets;
    }
    if (activeDataset.sheetName) {
      return [activeDataset.sheetName];
    }
    return ['Sheet1'];
  }, [activeDataset]);

  const currentSheet = dataSource.sheetName || activeDataset?.sheetName || availableSheets[0] || 'Sheet1';

  // Detected column fields from dataset schema and current record (Source of truth)
  const availableColumns = useMemo(() => {
    const set = new Set<string>();
    if (activeDataset) {
      if (Array.isArray(activeDataset.columns)) {
        activeDataset.columns.forEach((c: any) => set.add(typeof c === 'string' ? c : c.name || ''));
      }
      if (Array.isArray(activeDataset.fields)) {
        activeDataset.fields.forEach((f: any) => set.add(typeof f === 'string' ? f : f.name || ''));
      }
      if (Array.isArray(activeDataset.records) && activeDataset.records.length > 0) {
        Object.keys(activeDataset.records[0] || {}).forEach((k) => set.add(k));
      }
    }
    if (currentConnection) {
      if (Array.isArray(currentConnection.fields)) {
        currentConnection.fields.forEach((f) => set.add(f));
      }
      if (Array.isArray(currentConnection.records) && currentConnection.records.length > 0) {
        Object.keys(currentConnection.records[0] || {}).forEach((k) => set.add(k));
      }
    }
    if (currentRecord) {
      Object.keys(currentRecord || {}).forEach((k) => set.add(k));
    }
    return Array.from(set).filter(Boolean);
  }, [activeDataset, currentConnection, currentRecord]);

  const activeField = dataSource.field || dataSource.databaseField || '';

  // Validation checks
  const isDatasetMissing = Boolean(dataSource.datasetId && !activeDataset && !isLoadingDatasets);
  const isFieldMissing = Boolean(
    activeDataset &&
      activeField &&
      availableColumns.length > 0 &&
      !availableColumns.some((c) => c.toLowerCase() === activeField.toLowerCase())
  );

  // Sample value for selected field
  const sampleValue = useMemo(() => {
    if (!activeField) return '';
    if (currentRecord && currentRecord[activeField] !== undefined) {
      return String(currentRecord[activeField]);
    }
    // Case-insensitive lookup in currentRecord
    if (currentRecord) {
      const match = Object.keys(currentRecord || {}).find((k) => k.toLowerCase() === activeField.toLowerCase());
      if (match && currentRecord[match] !== undefined) return String(currentRecord[match]);
    }
    if (activeDataset?.records && activeDataset.records.length > 0) {
      const rec = activeDataset.records[0];
      if (rec && rec[activeField] !== undefined) {
        return String(rec[activeField]);
      }
    }
    return '';
  }, [activeField, currentRecord, activeDataset]);

  // Handle Dataset selection change
  const handleDatasetChange = (datasetId: string) => {
    const ds = effectiveDatasets.find((d) => d.id === datasetId || d.name === datasetId);
    if (!ds) return;

    const cols: string[] = ds.columns || (ds.fields ? ds.fields.map((f: any) => typeof f === 'string' ? f : f.name) : []);
    const defSheet = ds.sheetName || (ds.availableSheets && ds.availableSheets[0]) || 'Sheet1';

    // Check if current field exists in new dataset
    const stillValidField = cols.find((c) => c.toLowerCase() === activeField.toLowerCase()) || '';

    onUpdate({
      type: 'database',
      datasetId: ds.id,
      datasetName: ds.name,
      sheetName: defSheet,
      field: stillValidField,
      databaseField: stillValidField,
      value: stillValidField ? `{{${stillValidField}}}` : '',
    });

    if (onConnectDatasetToTemplate) {
      onConnectDatasetToTemplate(ds);
    }
  };

  // Handle Sheet selection change
  const handleSheetChange = (sheetName: string) => {
    onUpdate({
      sheetName,
    });
  };

  // Handle Field selection change
  const handleFieldChange = (fieldName: string) => {
    const targetDataset = activeDataset || (effectiveDatasets.length > 0 ? effectiveDatasets[0] : null);
    const dsId = targetDataset ? targetDataset.id : dataSource.datasetId || 'current-active-conn';
    const dsName = targetDataset ? targetDataset.name : dataSource.datasetName || currentConnection?.name || 'Active Database';

    onUpdate({
      type: 'database',
      datasetId: dsId,
      datasetName: dsName,
      sheetName: currentSheet,
      field: fieldName,
      databaseField: fieldName,
      value: fieldName ? `{{${fieldName}}}` : '',
    });

    if (targetDataset && onConnectDatasetToTemplate) {
      onConnectDatasetToTemplate(targetDataset);
    }
  };

  return (
    <div className="space-y-3 pt-2 bg-slate-50 border border-slate-200 p-3 rounded text-[12px] text-slate-800">
      {/* 1. Connection Selector */}
      <div className="flex items-center gap-3">
        <label className="w-24 text-slate-700 font-semibold flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>Connection:</span>
        </label>
        <select
          value={activeDataset?.id || dataSource.datasetId || (effectiveDatasets[0]?.id || '')}
          onChange={(e) => handleDatasetChange(e.target.value)}
          className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium cursor-pointer focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Select Data Connection --</option>
          {effectiveDatasets.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name} ({ds.recordCount || ds.records?.length || 0} records
              {ds.sourceType === 'excel' ? ' • Microsoft Excel' : ds.sourceType === 'csv' ? ' • CSV' : ''})
            </option>
          ))}
        </select>
      </div>

      {/* 2. Sheet Selector (if Excel / multiple sheets available) */}
      {availableSheets.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="w-24 text-slate-700 font-semibold flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sheet:</span>
          </label>
          <select
            value={currentSheet}
            onChange={(e) => handleSheetChange(e.target.value)}
            className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium cursor-pointer focus:ring-1 focus:ring-blue-500"
          >
            {availableSheets.map((sh) => (
              <option key={sh} value={sh}>
                {sh.endsWith('$') ? sh : `${sh}$`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Field Selector */}
      <div className="flex items-center gap-3">
        <label className="w-24 text-slate-700 font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Field:</span>
        </label>
        <select
          value={activeField}
          onChange={(e) => handleFieldChange(e.target.value)}
          className={`flex-1 bg-white border rounded px-2.5 py-1 font-medium cursor-pointer focus:ring-1 focus:ring-blue-500 ${
            isFieldMissing ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-[#94a3b8] text-slate-900'
          }`}
        >
          <option value="">-- Select Column Field --</option>
          {availableColumns.map((col) => {
            let sample = '';
            if (currentRecord && currentRecord[col] !== undefined) {
              sample = String(currentRecord[col]);
            } else if (activeDataset?.records && activeDataset.records[0] && activeDataset.records[0][col] !== undefined) {
              sample = String(activeDataset.records[0][col]);
            }
            return (
              <option key={col} value={col}>
                {col} {sample ? `(e.g. "${sample}")` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* 4. Alerts & Notifications */}
      {isDatasetMissing && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <div>
            <strong>Dataset unavailable</strong>
            <p className="text-[10.5px] text-red-600">The bound dataset was deleted or is not currently loaded.</p>
          </div>
        </div>
      )}

      {isFieldMissing && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Field '{activeField}' is missing from the connected dataset.</span>
        </div>
      )}

      {/* 5. Live Value Preview */}
      {activeField && !isDatasetMissing && !isFieldMissing && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-blue-950 font-mono">
          <span className="font-semibold text-blue-800 font-sans">Resolved Value (Active Record):</span>
          <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-900 shadow-2xs">
            {sampleValue ? sampleValue : <em className="text-slate-400 font-normal">[Empty Value]</em>}
          </span>
        </div>
      )}
    </div>
  );
};
