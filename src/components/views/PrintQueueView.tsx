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
} from 'lucide-react';
import { PrintJob, PrinterDefinition } from '../../types';
import { Modal } from '../common/Modal';

interface PrintQueueViewProps {
  printJobs: PrintJob[];
  printers: PrinterDefinition[];
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
  onClearCompleted: () => void;
}

export const PrintQueueView: React.FC<PrintQueueViewProps> = ({
  printJobs,
  printers,
  onCancelJob,
  onRetryJob,
  onClearCompleted,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [inspectingZplJob, setInspectingZplJob] = useState<PrintJob | null>(null);

  const filteredJobs = printJobs.filter((job) => {
    const matchesSearch =
      job.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.printerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.submittedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PrintJob['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'printing':
        return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
      case 'queued':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'paused':
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
            Monitor raw TCP 9100 sockets, Zebra ZPL / Eltron EPL queues, and serialized batch dispatches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearCompleted}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
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
            placeholder="Search print jobs by template, printer, or user..."
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
            <option value="queued">Queued</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="paused">Paused</option>
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
                <th className="py-3 px-4">Target Thermal Printer</th>
                <th className="py-3 px-4">Quantity / Records</th>
                <th className="py-3 px-4">Spool Status</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
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
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{job.copies * job.recordCount}</span>
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
                    <td className="py-3 px-4 whitespace-nowrap w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                              }`}
                            style={{ width: `${job.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{job.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
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
    </div>
  );
};
