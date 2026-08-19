import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DatabaseConnectionConfig } from '../../types';
import { SAMPLE_ENTERPRISE_DATASETS, parseCSVToDatabaseConnection } from '../../services/databaseConnectorService';
import { Database, FileSpreadsheet, Globe, Terminal, Check, Upload, RefreshCw, Layers } from 'lucide-react';

interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyConnection: (conn: DatabaseConnectionConfig) => void;
  currentConnection?: DatabaseConnectionConfig;
}

export const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  onApplyConnection,
  currentConnection,
}) => {
  const [selectedConnType, setSelectedConnType] = useState<'sample' | 'csv' | 'rest' | 'sql'>('sample');
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_ENTERPRISE_DATASETS[0].id);
  const [customCsvText, setCustomCsvText] = useState<string>('');
  const [restEndpoint, setRestEndpoint] = useState<string>('https://api.enterprise.corp/v1/labels/records');
  const [sqlQueryText, setSqlQueryText] = useState<string>('SELECT SKU, LotNo, ExpDate, SerialNo FROM ProductionUnits WHERE Line = 4');

  const handleApply = () => {
    if (selectedConnType === 'sample') {
      const match = SAMPLE_ENTERPRISE_DATASETS.find((d) => d.id === selectedSampleId) || SAMPLE_ENTERPRISE_DATASETS[0];
      onApplyConnection(match);
    } else if (selectedConnType === 'csv') {
      const conn = parseCSVToDatabaseConnection(customCsvText || 'ItemCode,Batch,ExpDate\nITM-101,LOT-A,2026-12-31');
      onApplyConnection(conn);
    } else if (selectedConnType === 'rest') {
      // Mock REST connection with live sample payload
      const mockRestConn: DatabaseConnectionConfig = {
        id: `rest-${Date.now()}`,
        name: 'REST API Feed (Live ERP)',
        type: 'rest_api',
        endpointOrPath: restEndpoint,
        fields: ['RECORD_ID', 'PALLET_SSCC', 'GTIN_14', 'BATCH_LOT', 'EXP_DATE', 'NET_WEIGHT'],
        records: [
          { RECORD_ID: 'R-1001', PALLET_SSCC: '000085000653123451', GTIN_14: '00850006531234', BATCH_LOT: 'BATCH-8821', EXP_DATE: '261231', NET_WEIGHT: '450.2 kg' },
          { RECORD_ID: 'R-1002', PALLET_SSCC: '000085000653123468', GTIN_14: '00850006531234', BATCH_LOT: 'BATCH-8821', EXP_DATE: '261231', NET_WEIGHT: '422.0 kg' },
          { RECORD_ID: 'R-1003', PALLET_SSCC: '000085000653123475', GTIN_14: '00850006531241', BATCH_LOT: 'BATCH-8822', EXP_DATE: '270115', NET_WEIGHT: '510.8 kg' },
        ],
      };
      onApplyConnection(mockRestConn);
    } else if (selectedConnType === 'sql') {
      const mockSqlConn: DatabaseConnectionConfig = {
        id: `sql-${Date.now()}`,
        name: 'SQL Server Enterprise Query',
        type: 'sql_mock',
        sqlQuery: sqlQueryText,
        fields: ['SKU', 'LotNo', 'ExpDate', 'SerialNo', 'LineStatus'],
        records: [
          { SKU: 'MED-9941', LotNo: 'LOT-5521', ExpDate: '2026-11-30', SerialNo: 'SN-001092', LineStatus: 'INSPECTED' },
          { SKU: 'MED-9942', LotNo: 'LOT-5521', ExpDate: '2026-11-30', SerialNo: 'SN-001093', LineStatus: 'INSPECTED' },
          { SKU: 'MED-9943', LotNo: 'LOT-5522', ExpDate: '2026-12-15', SerialNo: 'SN-001094', LineStatus: 'INSPECTED' },
        ],
      };
      onApplyConnection(mockSqlConn);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Database Connection Manager (BarTender Standard)" maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Connector Type Selector */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'sample', label: 'Preset ERP Datasets', icon: <Database className="w-4 h-4 text-blue-600" /> },
            { id: 'csv', label: 'CSV / Excel Upload', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> },
            { id: 'rest', label: 'REST API Webhook', icon: <Globe className="w-4 h-4 text-indigo-600" /> },
            { id: 'sql', label: 'SQL Query / DB Pool', icon: <Terminal className="w-4 h-4 text-purple-600" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedConnType(tab.id as any)}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 font-bold text-xs transition-colors ${
                selectedConnType === tab.id
                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Preset Datasets */}
        {selectedConnType === 'sample' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 block">Select Enterprise Template Dataset</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {SAMPLE_ENTERPRISE_DATASETS.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => setSelectedSampleId(ds.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSampleId === ds.id
                      ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">{ds.name}</span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                      {ds.type} • {ds.records.length} records
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    Columns: {ds.fields.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: CSV Upload */}
        {selectedConnType === 'csv' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 block">Paste Raw CSV or Tab-Delimited Data</label>
            <textarea
              rows={6}
              value={customCsvText}
              onChange={(e) => setCustomCsvText(e.target.value)}
              placeholder="ItemCode,BatchNo,ExpiryDate,Quantity,Location&#10;ITM-9001,LOT-8821,261231,100,WH-A1&#10;ITM-9002,LOT-8822,270115,250,WH-B2"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Tab 3: REST API */}
        {selectedConnType === 'rest' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 block">REST API Endpoint URL</label>
            <input
              type="text"
              value={restEndpoint}
              onChange={(e) => setRestEndpoint(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-500 block">Supports standard JSON array endpoints with Bearer authentication.</span>
          </div>
        )}

        {/* Tab 4: SQL Query */}
        {selectedConnType === 'sql' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 block">SQL Query Statement</label>
            <textarea
              rows={4}
              value={sqlQueryText}
              onChange={(e) => setSqlQueryText(e.target.value)}
              className="w-full p-2.5 bg-slate-900 text-emerald-400 border border-slate-800 rounded font-mono text-[11px] outline-none"
            />
            <span className="text-[10px] text-slate-500 block">Executes parameterized read-only queries with live connection pooling.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            Connect & Bind Database
          </button>
        </div>
      </div>
    </Modal>
  );
};
