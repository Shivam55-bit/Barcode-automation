import React, { useState } from 'react';
import { History, ShieldCheck, Download, Search, Filter, Calendar, User, Clock, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { AuditLogEntry } from '../../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityName && log.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const exportAuditCSV = () => {
    const headers = 'ID,Timestamp,User,UserRole,Action,EntityName,Details,IPAddress\n';
    const rows = filteredLogs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.user}","${l.userRole}","${l.action}","${l.entityName || ''}","${l.details.replace(/"/g, '""')}","${l.ipAddress}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE_TEMPLATE':
      case 'PUBLISH_TEMPLATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REJECT_TEMPLATE':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'PRINT_JOB_DISPATCH':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SUBMIT_APPROVAL':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CREATE_TEMPLATE':
      case 'EDIT_TEMPLATE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="System Security & 21 CFR Part 11 Audit Trail"
      subtitle="Immutable event logs of template revisions, electronic approvals, and print spool dispatches"
      maxWidth="6xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital Signatures & Audit Trail Integrity Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAuditCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by user, entity, or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
            >
              <option value="ALL">All Actions ({logs.length})</option>
              <option value="APPROVE_TEMPLATE">Approve Template</option>
              <option value="REJECT_TEMPLATE">Reject Template</option>
              <option value="SUBMIT_APPROVAL">Submit Approval</option>
              <option value="CREATE_TEMPLATE">Create Template</option>
              <option value="EDIT_TEMPLATE">Edit Template</option>
              <option value="PRINT_JOB_DISPATCH">Print Job Dispatch</option>
              <option value="VARIABLE_UPDATE">Variable Update</option>
              <option value="IMPORT_DATA">Import Data</option>
            </select>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">User / Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Audit Details & SHA Hash</th>
                  <th className="py-2.5 px-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{log.user}</div>
                      <div className="text-[10px] text-slate-400">{log.userRole}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-700">{log.entityName || 'System'}</span>
                    </td>
                    <td className="py-2.5 px-3 max-w-md">
                      <div className="text-slate-800 leading-snug">{log.details}</div>
                      <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
                        ID: {log.id}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-[11px] text-slate-500">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
