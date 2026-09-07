import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Lock,
  Unlock,
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
  ArrowRight,
  GitCompare,
  Pin,
  Maximize2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Hash,
  Fingerprint
} from 'lucide-react';
import { LabelTemplate, TemplateStatus, UserProfile, BarcodeBatchJob, CanvasAnnotation } from '../../types';
import { GenerateBarcodeModal } from '../dialogs/GenerateBarcodeModal';
import { VersionCompareModal } from '../dialogs/VersionCompareModal';
import { UnifiedLabelCanvas } from '../canvas/UnifiedLabelCanvas';
import { calculateSha256, calculateShortChecksum } from '../../services/snapshotService';

interface WorkflowViewProps {
  templates: LabelTemplate[];
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onNavigateToDashboard?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  onLogout?: () => void;
  onOpenTemplateInDesigner: (templateId: string) => void;
  onUpdateTemplateStatus: (templateId: string, status: TemplateStatus, comment: string, eSignature?: string, annotations?: CanvasAnnotation[]) => void;
  onGenerateBatchJob: (job: BarcodeBatchJob) => void;
  onNavigateToViewer: () => void;
  onRollbackTemplate?: (template: LabelTemplate) => void;
}

export const WorkflowView: React.FC<WorkflowViewProps> = ({
  templates,
  currentUser,
  allUsers,
  onNavigateToDashboard,
  onSwitchUser,
  onLogout,
  onOpenTemplateInDesigner,
  onUpdateTemplateStatus,
  onGenerateBatchJob,
  onNavigateToViewer,
  onRollbackTemplate,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [commentText, setCommentText] = useState('');
  const [signatureName, setSignatureName] = useState(currentUser.name);
  const [signaturePassword, setSignaturePassword] = useState('21cfr-sign-token');
  const [error, setError] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Preview & Annotation State
  const [zoom, setZoom] = useState<number>(1.0);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState<string>('');
  const [pendingAnnotationCoord, setPendingAnnotationCoord] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'objects' | 'history' | 'annotations'>('details');
  const [checksum, setChecksum] = useState<string>('');

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  useEffect(() => {
    if (selectedTemplate) {
      setChecksum(calculateShortChecksum(selectedTemplate));
      // Load any existing annotations
      setAnnotations([]);
    }
  }, [selectedTemplate?.id, selectedTemplate?.version]);

  useEffect(() => {
    setSignatureName(currentUser.name);
  }, [currentUser.name]);

  const filteredTemplates = templates.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'pending_level_1') return t.status === 'pending_level_1' || t.status === 'submitted';
    if (statusFilter === 'pending_level_2') return t.status === 'pending_level_2';
    if (statusFilter === 'approved') return t.status === 'approved' || t.status === 'published';
    if (statusFilter === 'draft') return t.status === 'draft';
    if (statusFilter === 'rejected') return t.status === 'rejected';
    return t.status === statusFilter;
  });

  // Allow approval in demo/workflow mode
  const isDesigner = true;
  const isApprover1 = true;

  const handleAction = (status: TemplateStatus, isChangeRequest: boolean = false) => {
    setError(null);
    if (!selectedTemplate) return;

    // Require e-signature for approvals
    if ((status === 'pending_level_2' || status === 'approved') && (!signatureName.trim() || !signaturePassword.trim())) {
      setError('21 CFR Part 11 Electronic Signature (Full Legal Name & Authorization Passcode) is strictly required.');
      return;
    }

    const defaultComment = isChangeRequest
      ? `Change Requested with ${annotations.length} visual annotations.`
      : `Status transitioned to ${status.toUpperCase()} by ${currentUser.name} (${currentUser.role})`;

    onUpdateTemplateStatus(
      selectedTemplate.id,
      status,
      commentText || defaultComment,
      signatureName ? `${signatureName} (${currentUser.role})` : undefined,
      annotations
    );

    setCommentText('');
    setSignaturePassword('');
    setIsAnnotating(false);
  };

  const handleAddAnnotation = (xMm: number, yMm: number) => {
    setPendingAnnotationCoord({ x: xMm, y: yMm });
  };

  const handleConfirmAnnotation = () => {
    if (!pendingAnnotationCoord || !newAnnotationText.trim()) return;
    const newAnn: CanvasAnnotation = {
      id: `ann-${Date.now()}`,
      x: pendingAnnotationCoord.x,
      y: pendingAnnotationCoord.y,
      text: newAnnotationText.trim(),
      author: currentUser.name,
      authorRole: currentUser.role,
      createdAt: new Date().toISOString(),
    };
    setAnnotations((prev) => [...prev, newAnn]);
    setNewAnnotationText('');
    setPendingAnnotationCoord(null);
    setActiveTab('annotations');
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
      case 'pending_level_1': return 'Pending L1 Approval (Frozen v' + (selectedTemplate?.version || '1.0') + ')';
      case 'pending_level_2': return 'Pending L2 Approval';
      case 'approved':
      case 'published': return 'Approved (Production Ready)';
      case 'rejected': return 'Rejected / Changes Requested';
      case 'barcode_generated': return 'Barcode Generated';
      case 'sent_to_viewer': return 'Sent to Viewer';
      case 'printed': return 'Printed';
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen w-screen overflow-hidden bg-slate-100 select-none text-slate-800">
      {/* Dedicated Top App Bar for Workflow */}
      <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-white text-xs select-none shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow-xs transition-colors"
            >
              <span>← Dashboard</span>
            </button>
          )}
          <button
            onClick={() => onOpenTemplateInDesigner(selectedTemplate.id)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition-colors"
          >
            <span>✏️ Template Builder (Studio)</span>
          </button>
          <button
            onClick={onNavigateToViewer}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold shadow-xs transition-colors"
          >
            <span>👁️ Viewer Station (Step 3)</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10.5px]">Role:</span>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const target = allUsers?.find((u) => u.id === e.target.value);
                if (target && onSwitchUser) onSwitchUser(target);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-white outline-none font-bold"
            >
              {allUsers?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.role} ({u.name})
                </option>
              ))}
            </select>
          </div>

          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-semibold text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </span>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10.5px] font-bold transition-all shadow-xs"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Workflow Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 1. Step Banner & Workflow Pipeline Overview */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Enterprise Regulatory Approval & Version Freeze Lifecycle</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Multi-Tier Approval & Immutable Snapshot Review Station</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                21 CFR Part 11 Compliant
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Streamlined 3-Step Lifecycle: 
              <span className="font-semibold text-slate-700"> Designer Save Draft → Approver 1 (Review & e-Sign) → Production Print (Viewer Station)</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Role: <strong className="text-blue-900">{currentUser.role}</strong></span>
            </span>
          </div>
        </div>

        {/* Visual 3-Step Pipeline Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-center">
          <div className={`p-3.5 rounded-xl border text-xs flex flex-col items-center justify-center transition-all ${
            selectedTemplate?.status === 'draft' ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400/50' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80 mb-0.5">Step 1</span>
            <span className="text-sm font-bold">1. Designer Draft</span>
            <span className="text-[10px] opacity-80 mt-0.5">Create, Edit & Submit for Approval</span>
          </div>

          <div className={`p-3.5 rounded-xl border text-xs flex flex-col items-center justify-center transition-all ${
            selectedTemplate?.status === 'pending_level_1' || selectedTemplate?.status === 'submitted' ? 'bg-amber-500 text-white font-bold shadow-md ring-2 ring-amber-400/50' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80 mb-0.5">Step 2</span>
            <span className="text-sm font-bold">2. Approver 1 (e-Sign)</span>
            <span className="text-[10px] opacity-80 mt-0.5">Inspect, Annotate & e-Sign Approval</span>
          </div>

          <div className={`p-3.5 rounded-xl border text-xs flex flex-col items-center justify-center transition-all ${
            selectedTemplate?.status === 'approved' || selectedTemplate?.status === 'published' || selectedTemplate?.status === 'barcode_generated' || selectedTemplate?.status === 'sent_to_viewer' || selectedTemplate?.status === 'printed' ? 'bg-emerald-600 text-white font-bold shadow-md ring-2 ring-emerald-400/50' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold opacity-80 mb-0.5">Step 3</span>
            <span className="text-sm font-bold">3. Production Print</span>
            <span className="text-[10px] opacity-80 mt-0.5">Viewer Station & 10-Pack Thermal Spooling</span>
          </div>
        </div>
      </div>

      {/* 2. Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template List with Statuses (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
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
              <option value="rejected">Rejected ({templates.filter((t) => t.status === 'rejected').length})</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto space-y-1">
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
                  <span className="text-[10px] font-mono font-bold text-blue-900 bg-blue-100/70 px-1.5 py-0.2 rounded">
                    v{t.version}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${getStatusBadge(t.status)}`}>
                    {t.status}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 line-clamp-1">{t.name}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{t.dimensions.width}×{t.dimensions.height} mm</span>
                  <span>{t.elements.length} objects</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle & Right Columns: Visual Frozen Preview + Enterprise Review Panel (9 cols) */}
        {selectedTemplate && (
          <div className="lg:col-span-9 space-y-6">
            {/* Template Header & Action Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      v{selectedTemplate.version}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${getStatusBadge(selectedTemplate.status)}`}>
                      {getStatusDisplayLabel(selectedTemplate.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                    <span><strong>Designer:</strong> {selectedTemplate.createdBy || 'Designer'}</span>
                    <span><strong>Submitted:</strong> {new Date(selectedTemplate.updatedAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Hash className="w-3 h-3 text-slate-500" />
                      <span>{checksum || 'CRC32-7E4A10B9'}</span>
                    </span>
                  </div>
                </div>

                {/* Compare & Designer Navigation Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCompareModalOpen(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Compare Versions</span>
                  </button>

                  <button
                    onClick={() => onOpenTemplateInDesigner(selectedTemplate.id)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open in Designer</span>
                  </button>
                </div>
              </div>

              {/* Frozen Visual Canvas Preview & Annotation Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Frozen Label Canvas with Annotations (7 cols) */}
                <div className="lg:col-span-7 bg-slate-900/5 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[420px] relative overflow-hidden">
                  {/* Canvas Toolbar overlay */}
                  <div className="absolute top-2 left-2 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-xs border border-slate-200 p-1 rounded-lg shadow-xs">
                    <button
                      onClick={() => setIsAnnotating(!isAnnotating)}
                      className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-colors ${
                        isAnnotating ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Click on the canvas to pin a review annotation"
                    >
                      <Pin className="w-3 h-3" />
                      <span>{isAnnotating ? 'Click Canvas to Pin' : 'Add Annotation'}</span>
                    </button>

                    <div className="h-4 w-px bg-slate-200 mx-1" />

                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-[10px] font-bold text-slate-600 w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Frozen Snapshot Label */}
                  <div className="absolute top-2 right-2 z-30">
                    <span className="text-[10px] bg-slate-800 text-amber-300 font-mono font-bold px-2 py-1 rounded shadow-xs border border-slate-700 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>FROZEN SNAPSHOT (IMMUTABLE)</span>
                    </span>
                  </div>

                  {/* Unified Canvas (Frozen Approval Mode) */}
                  <div className="p-4 overflow-auto max-w-full max-h-[380px] flex items-center justify-center">
                    <UnifiedLabelCanvas
                      template={selectedTemplate}
                      mode="approval"
                      zoom={zoom}
                      showGrid={false}
                      showMargins={true}
                      annotations={annotations}
                      isAnnotating={isAnnotating}
                      onAddAnnotation={handleAddAnnotation}
                      onSelectAnnotation={(ann) => {
                        setSelectedAnnotationId(ann.id);
                        setActiveTab('annotations');
                      }}
                    />
                  </div>

                  {/* Pending Annotation Modal Input */}
                  {pendingAnnotationCoord && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 w-80 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Pin className="w-4 h-4 text-amber-500" />
                          <span>Add Visual Annotation at ({pendingAnnotationCoord.x}, {pendingAnnotationCoord.y}) mm</span>
                        </div>
                        <textarea
                          value={newAnnotationText}
                          onChange={(e) => setNewAnnotationText(e.target.value)}
                          placeholder="e.g., Increase barcode quiet zone to 2mm..."
                          className="w-full h-20 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPendingAnnotationCoord(null)}
                            className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleConfirmAnnotation}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded shadow-xs"
                          >
                            Pin Annotation
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Inspection Tabs (Objects List / History / Annotations) (5 cols) */}
                <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 py-2.5 text-center transition-colors ${
                        activeTab === 'details' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setActiveTab('objects')}
                      className={`flex-1 py-2.5 text-center transition-colors ${
                        activeTab === 'objects' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Object Tree ({selectedTemplate.elements.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('annotations')}
                      className={`flex-1 py-2.5 text-center transition-colors ${
                        activeTab === 'annotations' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pins ({annotations.length})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4 flex-1 overflow-y-auto max-h-[340px] text-xs space-y-3">
                    {activeTab === 'details' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                          <div className="text-[10px] uppercase font-bold text-slate-500">Document Specification</div>
                          <div className="grid grid-cols-2 gap-2 text-slate-700">
                            <div><strong>Dimensions:</strong> {selectedTemplate.dimensions.width}×{selectedTemplate.dimensions.height} mm</div>
                            <div><strong>Resolution:</strong> {selectedTemplate.dimensions.dpi || 300} DPI</div>
                            <div><strong>Category:</strong> {selectedTemplate.category || 'General'}</div>
                            <div><strong>Compliance:</strong> {selectedTemplate.complianceStandard || 'GS1-128'}</div>
                          </div>
                        </div>

                        {/* e-Signature Status Card */}
                        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                          <div className="text-[10px] uppercase font-bold text-blue-900 flex items-center justify-between">
                            <span>Regulatory Sign-off Status</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="text-slate-700 text-xs">
                            {selectedTemplate.approvedBy ? (
                              <div className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>e-Signed by {selectedTemplate.approvedBy}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">Pending required electronic signatures under 21 CFR Part 11.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Object Tree breakdown (Locked vs Editable) */}
                    {activeTab === 'objects' && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Canvas Object Properties & Lock Status
                        </div>
                        {selectedTemplate.elements.map((el) => {
                          const isLocked = !!el.locked;
                          return (
                            <div
                              key={el.id}
                              className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-bold text-slate-800">{el.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono uppercase">[{el.type}]</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isLocked ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>LOCKED</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <Unlock className="w-2.5 h-2.5" />
                                    <span>EDITABLE</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Visual Annotations Tab */}
                    {activeTab === 'annotations' && (
                      <div className="space-y-2">
                        {annotations.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <Pin className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                            <div>No annotations pinned yet</div>
                            <div className="text-[10px]">Click "Add Annotation" on preview to place pin.</div>
                          </div>
                        ) : (
                          annotations.map((ann, idx) => (
                            <div
                              key={ann.id}
                              className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                                selectedAnnotationId === ann.id
                                  ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-800 flex items-center gap-1">
                                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px]">
                                    {idx + 1}
                                  </span>
                                  <span>{ann.author} ({ann.authorRole})</span>
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  ({ann.x}, {ann.y}) mm
                                </span>
                              </div>
                              <p className="text-slate-700 bg-white p-1.5 rounded border border-slate-200">{ann.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Electronic Signature & Approval Action Execution Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* e-Signature Inputs */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                      <span>21 CFR Part 11 Electronic Signature Verification</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Legal Full Name</label>
                        <input
                          type="text"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Approval Passcode</label>
                        <input
                          type="password"
                          placeholder="Authorization token..."
                          value={signaturePassword}
                          onChange={(e) => setSignaturePassword(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Audit Comments Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-semibold block">Audit Review Comments & Change Request Notes</label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add regulatory approval rationale or change requirements..."
                      className="w-full h-14 bg-white border border-slate-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Workflow Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Active Step: <strong>{getStatusDisplayLabel(selectedTemplate.status)}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Draft State -> Submit */}
                    {selectedTemplate.status === 'draft' && isDesigner && (
                      <button
                        onClick={() => handleAction('pending_level_1')}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>SUBMIT FOR APPROVAL (FREEZE VERSION)</span>
                      </button>
                    )}

                    {/* Approver 1 Approval State */}
                    {(selectedTemplate.status === 'pending_level_1' || selectedTemplate.status === 'submitted') && isApprover1 && (
                      <>
                        <button
                          onClick={() => handleAction('rejected', true)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>REQUEST CHANGES / REJECT</span>
                        </button>
                        <button
                          onClick={() => handleAction('approved')}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>e-SIGN & APPROVE (SEND TO PRODUCTION PRINT)</span>
                        </button>
                      </>
                    )}

                    {/* Approved State -> Generate Barcodes & Send to Viewer */}
                    {(selectedTemplate.status === 'approved' || selectedTemplate.status === 'published') && (
                      <>
                        <button
                          onClick={() => setIsGenerateModalOpen(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                          <span>GENERATE 10-PAGE SERIALIZED BARCODES</span>
                        </button>
                        <button
                          onClick={onNavigateToViewer}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>OPEN IN VIEWER STATION</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barcode Batch Generation Modal */}
      {isGenerateModalOpen && selectedTemplate && (
        <GenerateBarcodeModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          template={selectedTemplate}
          currentUserName={currentUser.name}
          onGenerateAndSend={(batchJob) => {
            onGenerateBatchJob(batchJob);
            setIsGenerateModalOpen(false);
            onNavigateToViewer();
          }}
          onGenerateSuccess={(batchJob) => {
            onGenerateBatchJob(batchJob);
            setIsGenerateModalOpen(false);
            onNavigateToViewer();
          }}
        />
      )}

      {/* Version Comparison Modal */}
      {isCompareModalOpen && selectedTemplate && (
        <VersionCompareModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          currentTemplate={selectedTemplate}
          versionList={
            selectedTemplate.versions && selectedTemplate.versions.length > 0
              ? selectedTemplate.versions.map((v) => ({
                  version: v.version,
                  template: v.templateSnapshot || selectedTemplate,
                  timestamp: v.timestamp,
                  author: v.author,
                }))
              : [
                  {
                    version: selectedTemplate.version,
                    template: selectedTemplate,
                    timestamp: selectedTemplate.updatedAt,
                    author: selectedTemplate.createdBy || 'Designer',
                  },
                ]
          }
          onRollback={onRollbackTemplate}
        />
      )}
      </div>
    </div>
  );
};
