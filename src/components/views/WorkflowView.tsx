import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Lock,
  FileCheck,
  AlertTriangle,
  MessageSquare,
  Search,
  Filter,
  Eye,
  FileText,
  UserCheck,
  Barcode,
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { LabelTemplate, TemplateStatus, UserProfile, BarcodeBatchJob } from '../../types';
import { GenerateBarcodeModal } from '../dialogs/GenerateBarcodeModal';

interface WorkflowViewProps {
  templates: LabelTemplate[];
  currentUser: UserProfile;
  onOpenTemplateInDesigner: (templateId: string) => void;
  onUpdateTemplateStatus: (templateId: string, status: TemplateStatus, comment: string, eSignature?: string) => void;
  onGenerateBatchJob: (job: BarcodeBatchJob) => void;
  onNavigateToViewer: () => void;
}

export const WorkflowView: React.FC<WorkflowViewProps> = ({
  templates,
  currentUser,
  onOpenTemplateInDesigner,
  onUpdateTemplateStatus,
  onGenerateBatchJob,
  onNavigateToViewer,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [commentText, setCommentText] = useState('');
  const [signatureName, setSignatureName] = useState(currentUser.name);
  const [signaturePassword, setSignaturePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const filteredTemplates = templates.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'pending_level_1') return t.status === 'pending_level_1' || t.status === 'submitted';
    if (statusFilter === 'pending_level_2') return t.status === 'pending_level_2';
    if (statusFilter === 'approved') return t.status === 'approved' || t.status === 'published';
    if (statusFilter === 'draft') return t.status === 'draft';
    return t.status === statusFilter;
  });

  // Role permissions
  const role = currentUser.role;
  const isDesigner = role === 'Designer' || role === 'Label Designer' || role === 'Admin';
  const isApprover1 = role === 'Approver Level 1' || role === 'Quality Reviewer' || role === 'Admin';
  const isApprover2 = role === 'Approver Level 2' || role === 'Admin';
  const isAdmin = role === 'Admin';

  const handleAction = (status: TemplateStatus) => {
    setError(null);
    if (!selectedTemplate) return;

    // Require e-signature for approvals
    if ((status === 'pending_level_2' || status === 'approved') && (!signatureName.trim() || !signaturePassword.trim())) {
      setError('21 CFR Part 11 Electronic Signature (Full Legal Name & Authorization Passcode) is required.');
      return;
    }

    onUpdateTemplateStatus(
      selectedTemplate.id,
      status,
      commentText || `Status transitioned to ${status.toUpperCase()} by ${currentUser.name} (${currentUser.role})`,
      signatureName ? `${signatureName} (${currentUser.role})` : undefined
    );
    setCommentText('');
    setSignaturePassword('');
  };

  const getStatusBadge = (status: TemplateStatus) => {
    switch (status) {
      case 'approved':
      case 'published':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'pending_level_2':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'pending_level_1':
      case 'submitted':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'barcode_generated':
      case 'sent_to_viewer':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusDisplayLabel = (status: TemplateStatus) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'submitted':
      case 'pending_level_1': return 'Pending L1 Approval';
      case 'pending_level_2': return 'Pending L2 Approval';
      case 'approved':
      case 'published': return 'Approved (Ready for Barcode Generation)';
      case 'rejected': return 'Rejected';
      case 'barcode_generated': return 'Barcode Generated';
      case 'sent_to_viewer': return 'Sent to Viewer';
      case 'printed': return 'Printed';
      default: return status;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6 select-none text-slate-800 space-y-6">
      {/* Step Banner & Workflow Pipeline Overview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Document-Driven 6-Step Regulatory Approval Lifecycle</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Multi-Tier Approval & Serialized Barcode Dispatch Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict 6-step sequential pipeline: 
              <span className="font-semibold text-slate-700"> Designer Create → Submit L1 → Approve L2 → Admin Generate Barcodes (10-Pages) → Send to Viewer → Print</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Current Role: <strong className="text-blue-900">{currentUser.role}</strong></span>
            </span>
          </div>
        </div>

        {/* Visual 6-Step Pipeline Card */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'draft' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 1</span>
            <span className="text-[11px]">Designer Create</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'pending_level_1' || selectedTemplate?.status === 'submitted' ? 'bg-amber-500 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 2</span>
            <span className="text-[11px]">Approver L1</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'pending_level_2' ? 'bg-purple-600 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 3</span>
            <span className="text-[11px]">Approver L2</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'approved' || selectedTemplate?.status === 'published' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 4</span>
            <span className="text-[11px]">Admin Gen Barcodes</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'barcode_generated' || selectedTemplate?.status === 'sent_to_viewer' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 5</span>
            <span className="text-[11px]">Send to Viewer</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center ${
            selectedTemplate?.status === 'printed' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Step 6</span>
            <span className="text-[11px]">Print (10-Pages)</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template List with Statuses */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Document Templates</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none font-medium"
            >
              <option value="ALL">All ({templates.length})</option>
              <option value="draft">Drafts ({templates.filter((t) => t.status === 'draft').length})</option>
              <option value="pending_level_1">Pending L1 ({templates.filter((t) => t.status === 'pending_level_1' || t.status === 'submitted').length})</option>
              <option value="pending_level_2">Pending L2 ({templates.filter((t) => t.status === 'pending_level_2').length})</option>
              <option value="approved">Approved ({templates.filter((t) => t.status === 'approved' || t.status === 'published').length})</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto space-y-1">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  selectedTemplate?.id === t.id
                    ? 'bg-blue-50/80 border border-blue-300 ring-2 ring-blue-400/20'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-slate-500">v{t.version}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${getStatusBadge(t.status)}`}>
                    {getStatusDisplayLabel(t.status)}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 line-clamp-1">{t.name}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{t.dimensions.width}×{t.dimensions.height} mm</span>
                  <span>{t.elements.length} elements</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Columns: Detailed Review & Role Action Execution Panel */}
        {selectedTemplate && (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
              {/* Header Info */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      v{selectedTemplate.version}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(selectedTemplate.status)}`}>
                      {getStatusDisplayLabel(selectedTemplate.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => onOpenTemplateInDesigner(selectedTemplate.id)}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect in Canvas</span>
                </button>
              </div>

              {/* ACTION PANEL: ROLE-BASED CONTROLS */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="font-bold text-xs text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Workflow Step Action Controls (Active: {currentUser.role})</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Logged in as: <strong>{currentUser.name}</strong>
                  </span>
                </h4>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* STEP 1: DESIGNER SUBMISSION */}
                {selectedTemplate.status === 'draft' && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">1</span>
                      <span>Designer Action: Submit for Level 1 Approval</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      You have designed this template. Submit it to Quality Assurance (Approver Level 1) for initial compliance verification.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleAction('pending_level_1')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit for Level 1 Approval</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: APPROVER LEVEL 1 */}
                {(selectedTemplate.status === 'pending_level_1' || selectedTemplate.status === 'submitted') && (
                  <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px]">2</span>
                      <span>Approver Level 1 Review: QA Verification</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Verify label layout, barcode quiet zones, and symbology parameters. Approving advances the template to Approver Level 2.
                    </p>

                    {/* e-Signature Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Legal Signee Name</label>
                        <input
                          type="text"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Authorization Passcode</label>
                        <input
                          type="password"
                          placeholder="Enter PIN / password..."
                          value={signaturePassword}
                          onChange={(e) => setSignaturePassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleAction('rejected')}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleAction('pending_level_2')}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve L1 (Forward to L2)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: APPROVER LEVEL 2 */}
                {selectedTemplate.status === 'pending_level_2' && (
                  <div className="bg-white p-4 rounded-xl border border-purple-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px]">3</span>
                      <span>Approver Level 2 Review: Final Executive Sign-off</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Level 1 QA verification complete. Provide final regulatory sign-off to unlock Admin Barcode Generation.
                    </p>

                    {/* e-Signature Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Legal Signee Name</label>
                        <input
                          type="text"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Authorization Passcode</label>
                        <input
                          type="password"
                          placeholder="Enter PIN / password..."
                          value={signaturePassword}
                          onChange={(e) => setSignaturePassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleAction('rejected')}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleAction('approved')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Final Approval (Approve L2)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4 & 5: ADMIN GENERATE BARCODES (10-PAGES) & SEND TO VIEWER */}
                {(selectedTemplate.status === 'approved' || selectedTemplate.status === 'published') && (
                  <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-5 rounded-xl border border-emerald-300 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
                        <span>Step 4: Admin Generates Serialized Barcodes (10 Pages)</span>
                      </div>
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                        Fully Approved
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">
                      This template has completed all regulatory approvals (L1 & L2). As an <strong>Admin</strong>, you can now input
                      batch metadata (Product Name, Batch No, Lot No, Expiry) and generate a <strong>10-Page Multi-Pack document (Pack 1 to Pack 10)</strong>, 
                      then dispatch directly to the <strong>Viewer / Print Operator</strong> station for printing.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all transform active:scale-95"
                      >
                        <Barcode className="w-4 h-4" />
                        <span>Generate Barcodes & 10-Page Document</span>
                      </button>

                      <button
                        onClick={onNavigateToViewer}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <span>Open Viewer / Print Station</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5 & 6: SENT TO VIEWER / PRINTED */}
                {(selectedTemplate.status === 'sent_to_viewer' || selectedTemplate.status === 'barcode_generated' || selectedTemplate.status === 'printed') && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">5</span>
                        <span>Step 5 & 6: Sent to Viewer / Ready for Print Execution</span>
                      </div>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        In Viewer Queue
                      </span>
                    </div>
                    <p className="text-xs text-indigo-800">
                      10-Page Serialized Barcode Document has been generated and dispatched to the Viewer station. Switch to the <strong>Viewer / Print Operator</strong> view to inspect each page and send raw ZPL to thermal printers.
                    </p>
                    <div className="pt-1">
                      <button
                        onClick={onNavigateToViewer}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                      >
                        <span>Launch Viewer / Print Station</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Audit Trail & History Comments */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Regulatory Lifecycle History & Signatures</span>
                </h4>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50 max-h-48 overflow-y-auto">
                  {selectedTemplate.comments && selectedTemplate.comments.length > 0 ? (
                    selectedTemplate.comments.map((c) => (
                      <div key={c.id} className="p-3 text-xs flex flex-col gap-1 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{c.author}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.createdAt}</span>
                        </div>
                        <p className="text-slate-600">{c.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No signature actions recorded yet for this version.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Admin Barcode Generation */}
      {isGenerateModalOpen && selectedTemplate && (
        <GenerateBarcodeModal
          template={selectedTemplate}
          currentUserName={currentUser.name}
          onClose={() => setIsGenerateModalOpen(false)}
          onGenerateAndSend={(job) => {
            onGenerateBatchJob(job);
            setIsGenerateModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
