import React, { useState } from 'react';
import {
  Printer,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  FileCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Download,
  Copy,
  Terminal,
  FileSpreadsheet,
  History,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PrintJob, PrinterDefinition } from '../../types';
import { Modal } from '../common/Modal';

interface PrintQueueViewProps {
  printJobs: PrintJob[];
  printers: PrinterDefinition[];
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
  onClearCompleted: () => void;
  onReprintWithSnapshot?: (job: PrintJob) => void;
  onReprintWithCurrentData?: (job: PrintJob) => void;
  onReprintRemaining?: (job: PrintJob) => void;
}

export const PrintQueueView: React.FC<PrintQueueViewProps> = ({
  printJobs,
  printers,
  onCancelJob,
  onRetryJob,
  onClearCompleted,
  onReprintWithSnapshot,
  onReprintWithCurrentData,
  onReprintRemaining,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [inspectingZplJob, setInspectingZplJob] = useState<PrintJob | null>(null);
  const [snapshotModalJob, setSnapshotModalJob] = useState<PrintJob | null>(null);
  const [reprintModalJob, setReprintModalJob] = useState<PrintJob | null>(null);
  const [detailsModalJob, setDetailsModalJob] = useState<PrintJob | null>(null);
  const [reprintStatus, setReprintStatus] = useState<string | null>(null);

  const filteredJobs = printJobs.filter((job) => {
    const matchesSearch =
      job.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.printerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.submittedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.serialStart && job.serialStart.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.serialEnd && job.serialEnd.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PrintJob['status']) => {
    switch (status) {
      case 'completed':
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'printing':
      case 'PRINTING':
      case 'SPOOLING':
        return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
      case 'queued':
      case 'RESERVED':
      case 'CREATED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'failed':
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'PARTIAL':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
      case 'paused':
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6 select-none text-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Printer className="w-4 h-4" />
            <span>Industrial Print Spooler & Network Queue</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Live Thermal Print Spooler Monitor</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor raw TCP 9100 sockets, Zebra ZPL / TSPL queues, serialization reservations, and batch progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearCompleted}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear Completed Jobs
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search print jobs by template, printer, serial range, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none shadow-2xs"
          >
            <option value="ALL">All Statuses ({printJobs.length})</option>
            <option value="printing">Printing</option>
            <option value="completed">Completed</option>
            <option value="PARTIAL">Partial</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Job ID / Time</th>
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Printer & Protocol</th>
                <th className="py-3 px-4 font-mono">Serial Range</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No print jobs matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800 text-[11px]">{job.id}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(job.submittedAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div>{job.templateName}</div>
                      <div className="text-[10px] text-slate-400">By {job.submittedBy}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700">{job.printerName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{job.format} stream</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      {job.serialStart ? (
                        <div className="text-amber-900 font-bold text-[11px]">
                          {job.serialStart} → {job.serialEnd}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10.5px]">Static / None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{job.totalLabelsPrinted || job.copies * job.recordCount}</span>
                      <span className="text-slate-400 text-[10px] ml-1">
                        ({job.recordCount} rec × {job.copies} cp)
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                  ? 'bg-red-500'
                                  : job.status === 'PARTIAL'
                                  ? 'bg-purple-500'
                                  : 'bg-blue-500'
                              }`}
                            style={{ width: `${job.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{job.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      {/* Job Details Modal */}
                      <button
                        onClick={() => setDetailsModalJob(job)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer"
                        title="View Full Job & Serialization Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                      </button>

                      {/* Reprint Remaining (if partial) */}
                      {job.status === 'PARTIAL' && (
                        <button
                          onClick={() => {
                            if (onReprintRemaining) {
                              onReprintRemaining(job);
                            } else {
                              alert(`Reprint Remaining requested for Job ${job.id}`);
                            }
                          }}
                          className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded text-[10.5px] font-bold transition-colors cursor-pointer"
                          title="Reprint remaining unprinted labels in this sequence"
                        >
                          Reprint Remaining
                        </button>
                      )}

                      {/* View Immutable Print Data Snapshot */}
                      {job.dataSnapshot && job.dataSnapshot.length > 0 && (
                        <button
                          onClick={() => setSnapshotModalJob(job)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="View Immutable Print Data Snapshot"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* BarTender Reprint Option */}
                      <button
                        onClick={() => setReprintModalJob(job)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Reprint (Original Snapshot vs Live Excel)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {job.zplOutput && (
                        <button
                          onClick={() => setInspectingZplJob(job)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Inspect Raw ZPL/EPL Payload"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {job.status === 'failed' && (
                        <button
                          onClick={() => onRetryJob(job.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Retry Spool"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {job.status !== 'completed' && job.status !== 'failed' && (
                        <button
                          onClick={() => onCancelJob(job.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Cancel Job"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Payload Inspector Modal */}
      {inspectingZplJob && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingZplJob(null)}
          title={`Raw Thermal Payload: ${inspectingZplJob.id}`}
          subtitle={`Dispatched to ${inspectingZplJob.printerName} (${inspectingZplJob.format.toUpperCase()})`}
          maxWidth="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inspectingZplJob.zplOutput || '');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Thermal Stream</span>
              </button>
              <button
                onClick={() => setInspectingZplJob(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-96 whitespace-pre">
              {inspectingZplJob.zplOutput}
            </div>
          </div>
        </Modal>
      )}

      {/* Immutable Print Data Snapshot Modal */}
      {snapshotModalJob && (
        <Modal
          isOpen={true}
          onClose={() => setSnapshotModalJob(null)}
          title={`Print Data Snapshot: Job ${snapshotModalJob.id}`}
          subtitle={`Dataset: ${snapshotModalJob.datasetName || 'Active Template'} • Printed at: ${new Date(snapshotModalJob.submittedAt).toLocaleString()}`}
          maxWidth="5xl"
          footer={
            <div className="flex items-center justify-end w-full">
              <button
                onClick={() => setSnapshotModalJob(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-1">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
              <span>
                <strong>Immutable Audit Snapshot:</strong> Exactly {snapshotModalJob.dataSnapshot?.length || 0} records captured at print execution time.
              </span>
              {snapshotModalJob.excelFilePath && (
                <span className="font-mono text-[10px] text-emerald-900 truncate max-w-xs">
                  {snapshotModalJob.excelFilePath}
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-96 overflow-x-auto overflow-y-auto">
              {snapshotModalJob.dataSnapshot && snapshotModalJob.dataSnapshot.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 font-semibold text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center text-slate-400">#</th>
                      {Object.keys(snapshotModalJob.dataSnapshot[0] || {}).map((col) => (
                        <th key={col} className="py-2 px-3 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {snapshotModalJob.dataSnapshot.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                        {Object.keys(snapshotModalJob.dataSnapshot?.[0] || {}).map((col) => {
                          const val = String(row[col] ?? '');
                          const isLeadingZero = /^0[0-9]+$/.test(val);
                          return (
                            <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-800">
                              {isLeadingZero ? (
                                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1 py-0.5 rounded">
                                  {val}
                                </span>
                              ) : (
                                val
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No data snapshot recorded for this job.</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* BarTender Reprint Choice Modal */}
      {reprintModalJob && (
        <Modal
          isOpen={true}
          onClose={() => setReprintModalJob(null)}
          title={`Reprint Job: ${reprintModalJob.id}`}
          subtitle="Choose whether to reprint the historical frozen snapshot or read updated live Excel data"
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-end w-full">
              <button
                onClick={() => setReprintModalJob(null)}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            {reprintStatus && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{reprintStatus}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Reprint Original Snapshot */}
              <div
                onClick={() => {
                  if (onReprintWithSnapshot) {
                    onReprintWithSnapshot(reprintModalJob);
                  } else {
                    onRetryJob(reprintModalJob.id);
                  }
                  setReprintStatus('Reprint dispatched using original snapshot data!');
                  setTimeout(() => setReprintModalJob(null), 1200);
                }}
                className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/40 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>Reprint Original Data</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Uses the immutable frozen snapshot recorded when this print job was initially executed.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 text-[11px] font-semibold text-indigo-600">
                  Recommended for audit re-runs →
                </div>
              </div>

              {/* Option 2: Reprint Current Live Excel Data */}
              <div
                onClick={() => {
                  if (onReprintWithCurrentData) {
                    onReprintWithCurrentData(reprintModalJob);
                  } else {
                    onRetryJob(reprintModalJob.id);
                  }
                  setReprintStatus('Reprint dispatched using latest live Excel data!');
                  setTimeout(() => setReprintModalJob(null), 1200);
                }}
                className="p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Use Current Excel Data</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Re-reads the linked Excel spreadsheet on disk to pull freshly edited rows, quantities, or prices.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 text-[11px] font-semibold text-emerald-600">
                  Recommended if spreadsheet was modified →
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Full Job & Serialization Details Modal */}
      {detailsModalJob && (
        <Modal
          isOpen={true}
          onClose={() => setDetailsModalJob(null)}
          title={`Job Details: ${detailsModalJob.id}`}
          subtitle={`${detailsModalJob.templateName} • ${detailsModalJob.printerName} • Dispatched ${new Date(detailsModalJob.submittedAt).toLocaleString()}`}
          maxWidth="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500 font-mono">
                Reservation: {detailsModalJob.reservationId || 'N/A'}
              </div>
              <button
                onClick={() => setDetailsModalJob(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            {/* Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <span className="font-bold text-slate-800 text-[13px]">{detailsModalJob.status}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Labels</span>
                <span className="font-bold text-slate-800 text-[13px]">{detailsModalJob.totalLabelsPrinted || detailsModalJob.copies * detailsModalJob.recordCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Serial Range</span>
                <span className="font-bold text-amber-900 text-[12px]">
                  {detailsModalJob.serialStart ? `${detailsModalJob.serialStart} → ${detailsModalJob.serialEnd}` : 'Static'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Commit Policy</span>
                <span className="font-bold text-slate-800 text-[11px]">{detailsModalJob.commitPolicy || 'WHOLE_JOB_ON_DISPATCH'}</span>
              </div>
            </div>

            {/* Error banner if failed */}
            {detailsModalJob.errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{detailsModalJob.errorMessage}</span>
              </div>
            )}

            {/* Batches Table if available */}
            {detailsModalJob.batches && detailsModalJob.batches.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700">Dispatched Thermal Batches ({detailsModalJob.batches.length})</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 font-semibold text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2 border-r border-slate-200 text-center w-12">#</th>
                        <th className="p-2 border-r border-slate-200">Indices</th>
                        <th className="p-2 border-r border-slate-200 font-mono">Serial Range</th>
                        <th className="p-2 border-r border-slate-200 text-center">Count</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {detailsModalJob.batches.map((b) => (
                        <tr key={b.batchIndex} className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-200 text-center text-slate-400">{b.batchIndex}</td>
                          <td className="p-2 border-r border-slate-200 text-slate-600">
                            {b.startIndex + 1} - {b.endIndex + 1}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-amber-900 font-bold">
                            {b.startSerial || 'N/A'} → {b.endSerial || 'N/A'}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center">{b.count}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${b.status === 'printed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw Print Stream Preview */}
            {detailsModalJob.rawOutput && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">Raw Device Instruction Stream ({detailsModalJob.format.toUpperCase()})</h4>
                  <span className="text-[10.5px] text-slate-400 font-mono">{detailsModalJob.rawOutput.length} characters</span>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-tight select-text">
                  {detailsModalJob.rawOutput}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
