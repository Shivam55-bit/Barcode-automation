import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  PenTool,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ShieldCheck,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  LogOut,
  Sparkles,
  BarChart3,
  Sliders,
  FileSpreadsheet,
  Eye,
  FileText,
  Tag,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Laptop
} from 'lucide-react';
import { LabelTemplate, PrinterDefinition, PrintJob, AuditLogEntry, UserProfile } from '../../types';

interface DashboardViewProps {
  templates: LabelTemplate[];
  printers: PrinterDefinition[];
  printJobs: PrintJob[];
  auditLogs: AuditLogEntry[];
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onOpenTemplate: (id: string) => void;
  onOpenDesigner: () => void;
  onOpenPrintCenter: () => void;
  onOpenAuditLogs?: () => void;
  onNavigateToWorkflow?: () => void;
  onNavigateToViewer?: () => void;
  onNavigateToDatasets?: () => void;
  onNavigateToLicense?: () => void;
  onNavigateToSoftwareDownload?: () => void;
  onOpenCalibrationModal?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onNavigateToSuperAdmin?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  onLogout?: () => void;
  onCreateNewTemplate?: () => void;
  onDuplicateTemplate?: (id: string) => void;
  onDeleteTemplate?: (id: string) => void;
}

type NavTab = 'dashboard' | 'templates' | 'drafts' | 'approved';

export const DashboardView: React.FC<DashboardViewProps> = ({
  templates,
  printers,
  printJobs,
  auditLogs,
  currentUser,
  allUsers,
  onOpenTemplate,
  onOpenDesigner,
  onOpenPrintCenter,
  onOpenAuditLogs,
  onNavigateToWorkflow,
  onNavigateToViewer,
  onNavigateToDatasets,
  onOpenCalibrationModal,
  onOpenSettings,
  onNavigateToSuperAdmin,
  onNavigateToLicense,
  onNavigateToSoftwareDownload,
  onSwitchUser,
  onLogout,
  onCreateNewTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [scopeTab, setScopeTab] = useState<'my_workspace' | 'enterprise_library' | 'all'>('my_workspace');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Helper: Check if a template belongs to the currently logged in user
  const isCurrentUserTemplate = (tmpl: LabelTemplate): boolean => {
    if (tmpl.authorEmail && currentUser?.email && tmpl.authorEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      return true;
    }
    if (tmpl.createdBy && (tmpl.createdBy === currentUser?.id || tmpl.createdBy === currentUser?.name)) {
      return true;
    }
    // Default legacy assignment for original shivam@gmail.com
    if (currentUser?.email?.toLowerCase() === 'shivam@gmail.com' && (!tmpl.authorEmail || tmpl.createdBy === 'Administrator')) {
      return true;
    }
    return false;
  };

  // User-scoped template collections
  const myTemplates = templates.filter(isCurrentUserTemplate);
  const enterpriseLibraryTemplates = templates.filter(
    (t) => !isCurrentUserTemplate(t) || t.createdBy?.includes('System') || t.tags?.includes('Industrial')
  );

  // Calculate statistics scoped to current user
  const draftsList = templates.filter(
    (t) =>
      (t.status === 'draft' || t.tags?.includes('Draft') || t.tags?.includes('Printed')) &&
      isCurrentUserTemplate(t)
  );
  const pendingList = templates.filter(
    (t) =>
      (t.status === 'submitted' || t.status === 'pending_level_1' || t.status === 'pending_level_2') &&
      isCurrentUserTemplate(t)
  );
  const approvedList = templates.filter(
    (t) =>
      (t.status === 'approved' || t.status === 'published') &&
      (scopeTab === 'my_workspace' ? isCurrentUserTemplate(t) : true)
  );
  const rejectedList = templates.filter(
    (t) => t.status === 'rejected' && isCurrentUserTemplate(t)
  );

  const draftCount = draftsList.length;
  const pendingCount = pendingList.length;
  const approvedCount = approvedList.length;
  const rejectedCount = rejectedList.length;

  // Filter templates based on active tab, scope, category and search
  const filteredTemplates = templates.filter((tmpl) => {
    // 1. Workspace scope filter
    if (scopeTab === 'my_workspace' && !isCurrentUserTemplate(tmpl)) {
      return false;
    }
    if (scopeTab === 'enterprise_library' && isCurrentUserTemplate(tmpl) && !tmpl.createdBy?.includes('System')) {
      return false;
    }

    // 2. Tab filter
    if (activeTab === 'drafts') {
      const isDraftOrPrinted =
        tmpl.status === 'draft' || tmpl.tags?.includes('Draft') || tmpl.tags?.includes('Printed');
      if (!isDraftOrPrinted) return false;
      if (!isCurrentUserTemplate(tmpl)) return false;
    }
    if (activeTab === 'approved' && tmpl.status !== 'approved' && tmpl.status !== 'published') return false;
    if (selectedCategory !== 'all' && tmpl.category !== selectedCategory) return false;

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tmpl.name.toLowerCase().includes(q) ||
        tmpl.description.toLowerCase().includes(q) ||
        tmpl.category.toLowerCase().includes(q) ||
        (tmpl.tags && tmpl.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  const categories = Array.from(new Set(templates.map((t) => t.category))).filter(Boolean);

  // User avatar initial
  const avatarLetter = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'S';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-800 font-sans select-none">
      {/* 1. Left Sidebar Navigation (Matching exact BarcodeFlow styling) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-2xs">
        <div>
          {/* Top Brand Logo */}
          <div className="p-5 flex items-center gap-3 border-b border-slate-100">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-sm">
              B
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm tracking-tight leading-tight">BarcodeFlow</h2>
              <p className="text-[11px] text-slate-400 font-medium">Label Management</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1.5 mt-2">
            {/* Dashboard Button */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'dashboard'
                  ? 'bg-blue-50/80 text-blue-600 border border-blue-200/80 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            {/* Templates Button */}
            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'templates'
                  ? 'bg-blue-50/80 text-blue-600 border border-blue-200/80 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Templates</span>
            </button>

            {/* Template Builder Button (Directly launches Barcode Automation Studio) */}
            <button
              onClick={onOpenDesigner}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <PenTool className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-800 group-hover:text-blue-600">Template Builder</span>
              </div>
              <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">
                Studio
              </span>
            </button>

            {/* Approval Workflow Button */}
            <button
              onClick={onNavigateToWorkflow}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-amber-800 hover:bg-amber-50/80 transition-all group"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-800 group-hover:text-amber-700">Approval Workflow</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pendingCount > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                }`}>
                {pendingCount} Pending
              </span>
            </button>


            {/* Super Admin Governance Console (Exclusively for Super Administrator) */}
            {(currentUser.role === 'Super Admin' || currentUser.email?.toLowerCase() === 'superadmin@gmail.com') && (
              <button
                onClick={onNavigateToSuperAdmin}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/90 shadow-2xs transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    👑
                  </div>
                  <span className="font-bold text-blue-950 group-hover:text-blue-700">Super Admin Portal</span>
                </div>
                <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase font-mono shadow-2xs">
                  Master
                </span>
              </button>
            )}

            {/* Enterprise Settings Hub Button (Contains Datasets, Printer Calibration, License GUID, and Desktop Software) */}
            <button
              onClick={() => {
                if (onOpenSettings) onOpenSettings('datasets');
                else if (onOpenCalibrationModal) onOpenCalibrationModal();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/80 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-800 group-hover:text-blue-600">Enterprise Settings</span>
              </div>
              <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-mono">
                Setup
              </span>
            </button>

            {/* My Drafts */}
            <button
              onClick={() => setActiveTab('drafts')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'drafts'
                  ? 'bg-blue-50/80 text-blue-600 border border-blue-200/80 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <FileEdit className="w-4 h-4 shrink-0" />
                <span>My Drafts</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {draftCount}
              </span>
            </button>

            {/* Approved Templates */}
            <button
              onClick={() => setActiveTab('approved')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'approved'
                  ? 'bg-blue-50/80 text-blue-600 border border-blue-200/80 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Approved Templates</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {approvedCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer / Studio Fast Launcher */}
        <div className="p-3 border-t border-slate-100">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Barcode Studio</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-slate-300 mb-3 leading-tight">
              Design industrial GS1, UDI & 2D barcodes with pixel precision.
            </p>
            <button
              onClick={onOpenDesigner}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Launch Studio</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          {/* Left Title / Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-800">BarcodeFlow</span>
            <span>/</span>
            <span className="text-slate-600 font-medium capitalize">{activeTab}</span>
          </div>

          {/* Right: User Profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs ring-2 ring-blue-100 shadow-xs">
                {avatarLetter}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || 'Shivam'}
                </div>
                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                  <span>{currentUser?.email || 'admin@company.com'}</span>
                  <span>•</span>
                  <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded">{currentUser?.role || 'Admin'}</span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Log Out"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Main Content Body */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'dashboard'
                  ? 'Dashboard'
                  : activeTab === 'templates'
                    ? 'Production Label Templates'
                    : activeTab === 'drafts'
                      ? 'My Drafts'
                      : 'Approved Templates'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Workspace of <span className="font-semibold text-slate-800">{currentUser?.name || 'Shivam'}</span> ({currentUser?.email || 'admin@company.com'}) · {currentUser?.department || 'Packaging Operations'}
              </p>
            </div>

            {/* Scope Switcher Buttons */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setScopeTab('my_workspace')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  scopeTab === 'my_workspace'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👤 My Workspace</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${scopeTab === 'my_workspace' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  {myTemplates.length}
                </span>
              </button>

              <button
                onClick={() => setScopeTab('enterprise_library')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  scopeTab === 'enterprise_library'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏢 Sample Library</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${scopeTab === 'enterprise_library' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  {enterpriseLibraryTemplates.length}
                </span>
              </button>

              <button
                onClick={() => setScopeTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  scopeTab === 'all'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🌐 All</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${scopeTab === 'all' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  {templates.length}
                </span>
              </button>
            </div>
          </div>

          {/* 4 Pastel Statistic Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: My Drafts (Pastel Lavender Blue) */}
            <div
              onClick={() => { setScopeTab('my_workspace'); setActiveTab('drafts'); }}
              className="bg-[#f1f3fd] border border-[#dce3fc] rounded-2xl p-6 transition-all hover:shadow-md cursor-pointer group"
            >
              <div className="text-xs font-semibold text-slate-600 group-hover:text-blue-700">My Drafts</div>
              <div className="text-4xl font-bold text-[#5569f7] mt-3">{draftCount}</div>
              <div className="text-[10px] text-blue-600 mt-2 font-medium">Click to view drafts →</div>
            </div>

            {/* Card 2: Pending Approvals (Pastel Mint Green) */}
            <div
              onClick={() => onNavigateToWorkflow ? onNavigateToWorkflow() : setActiveTab('templates')}
              className="bg-[#eefbf4] border border-[#cbf5de] rounded-2xl p-6 transition-all hover:shadow-md cursor-pointer group hover:border-emerald-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-800">Pending Approvals</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-4xl font-bold text-[#22c55e] mt-3">{pendingCount}</div>
              <div className="text-[10px] text-emerald-700 mt-2 font-bold flex items-center gap-1">
                <span>Open Approval Workflow →</span>
              </div>
            </div>

            {/* Card 3: Approved Templates (Pastel Warm Yellow) */}
            <div
              onClick={() => onNavigateToViewer ? onNavigateToViewer() : setActiveTab('approved')}
              className="bg-[#fef8e7] border border-[#fce7ad] rounded-2xl p-6 transition-all hover:shadow-md cursor-pointer group hover:border-amber-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 group-hover:text-amber-800">Approved Templates</span>
                <Eye className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-4xl font-bold text-[#eab308] mt-3">{approvedCount}</div>
              <div className="text-[10px] text-amber-700 mt-2 font-bold flex items-center gap-1">
                <span>Open Viewer Station →</span>
              </div>
            </div>

            {/* Card 4: Rejected Templates (Pastel Rose Pink) */}
            <div
              onClick={() => onNavigateToWorkflow ? onNavigateToWorkflow() : setActiveTab('templates')}
              className="bg-[#fdf0f2] border border-[#fad3da] rounded-2xl p-6 transition-all hover:shadow-md cursor-pointer group"
            >
              <div className="text-xs font-semibold text-slate-600 group-hover:text-rose-700">Rejected Templates</div>
              <div className="text-4xl font-bold text-[#f43f5e] mt-3">{rejectedCount}</div>
              <div className="text-[10px] text-rose-600 mt-2 font-medium">Review change requests →</div>
            </div>
          </div>

          {/* Top Quick Navigation Pills for Workflow & Viewer */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Enterprise Lifecycle Navigation</h3>
                <p className="text-[11px] text-slate-300">Fast switch between Studio Designer, Approval Station, and Viewer Print Spooler.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onOpenDesigner}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Open Studio</span>
              </button>
              <button
                onClick={onNavigateToWorkflow}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                <span>Approval Workflow</span>
              </button>

            </div>
          </div>

          {/* Quick Action & Search Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search templates or barcodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenDesigner}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Open Template Builder</span>
              </button>

              {onCreateNewTemplate && (
                <button
                  onClick={onCreateNewTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>New Template</span>
                </button>
              )}
            </div>
          </div>

          {/* Templates Grid Catalog */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">
                {scopeTab === 'my_workspace'
                  ? `My Templates (${filteredTemplates.length})`
                  : scopeTab === 'enterprise_library'
                    ? `Enterprise Sample Templates (${filteredTemplates.length})`
                    : `All Organization Templates (${filteredTemplates.length})`}
              </h3>
              <span className="text-xs text-slate-400">
                Showing {filteredTemplates.length} of {templates.length} templates
              </span>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-blue-200 p-10 text-center shadow-xs">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Welcome to your Personal Workspace, {currentUser?.name || 'Administrator'}!
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                  You are logged in as <span className="font-semibold text-slate-700">{currentUser?.email}</span>. Since this is a new Admin account, you currently have 0 personal drafts.
                </p>
                <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                  <button
                    onClick={onCreateNewTemplate || onOpenDesigner}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Template in Studio</span>
                  </button>
                  <button
                    onClick={() => setScopeTab('enterprise_library')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>🏢 Browse Sample Library ({enterpriseLibraryTemplates.length})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-2xl p-5 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {tmpl.dimensions.width}×{tmpl.dimensions.height} mm ({tmpl.dimensions.dpi} DPI)
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {tmpl.tags?.includes('Printed') && (
                            <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Printer className="w-2.5 h-2.5" />
                              PRINTED
                            </span>
                          )}
                          <span
                            className={`text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full ${tmpl.status === 'published' || tmpl.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tmpl.status === 'submitted' || tmpl.status === 'pending_level_1'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                          >
                            {tmpl.status}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {tmpl.name}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{tmpl.description}</p>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        <span>{tmpl.category}</span> • <span className="font-medium text-slate-600">{tmpl.elements.length} elements</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onDuplicateTemplate && (
                          <button
                            onClick={() => onDuplicateTemplate(tmpl.id)}
                            title="Clone Template"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTemplate && (
                          <button
                            onClick={() => onDeleteTemplate(tmpl.id)}
                            title="Delete Template"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenTemplate(tmpl.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Edit in Studio</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Fleet & Activity Row (shown on dashboard tab) */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Thermal Fleet Monitor */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Thermal Printer Fleet</h3>
                  </div>
                  <button
                    onClick={onOpenPrintCenter}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Manage Fleet
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {printers.slice(0, 4).map((prn) => (
                    <div key={prn.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${prn.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                        />
                        <div>
                          <div className="font-bold text-slate-800 text-xs">{prn.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {prn.ipAddress} • {prn.protocol.toUpperCase()} • {prn.dpi} DPI
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-50 rounded">
                        {prn.location}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Audit Log */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Audit & Compliance Trail</h3>
                  </div>
                  <button
                    onClick={onOpenAuditLogs}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2.5">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className="font-bold text-slate-700">{log.user}</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1">{log.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
