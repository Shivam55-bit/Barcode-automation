import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  KeyRound,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Edit,
  Edit3,
  Building,
  Mail,
  Lock,
  Unlock,
  Check,
  X,
  Layers,
  FileSpreadsheet,
  Printer,
  PenTool,
  Download,
  FileText,
  Laptop,
  Sparkles,
  ChevronRight,
  Shield,
  ArrowLeft,
  LogOut,
  LayoutDashboard,
  Settings,
  UserPlus,
  Eye,
  User as UserIcon,
  Calendar,
  Key
} from 'lucide-react';
import { UserProfile, AdminFeaturePermissions, UserRole, UserStatus } from '../../types';
import { apiService } from '../../services/apiService';
import { FEATURE_CATALOG, ALL_PERMISSIONS_GRANTED, DEFAULT_ADMIN_PERMISSIONS } from '../../utils/permissionUtils';
import { Modal } from '../common/Modal';

interface SuperAdminConsoleViewProps {
  currentUser: UserProfile;
  onBackToDashboard: () => void;
  onOpenDesigner?: () => void;
  onOpenTemplates?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenAuditLogs?: () => void;
  onLogout?: () => void;
  onRefreshSession?: () => void;
}

export const SuperAdminConsoleView: React.FC<SuperAdminConsoleViewProps> = ({
  currentUser,
  onBackToDashboard,
  onOpenDesigner,
  onOpenTemplates,
  onOpenSettings,
  onOpenAuditLogs,
  onLogout,
  onRefreshSession,
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_approval' | 'approved' | 'suspended'>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Permissions Modal State
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserProfile | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<AdminFeaturePermissions>(DEFAULT_ADMIN_PERMISSIONS);
  const [isPermsModalOpen, setIsPermsModalOpen] = useState<boolean>(false);
  const [savingPerms, setSavingPerms] = useState<boolean>(false);

  // View User Modal State
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [isViewUserModalOpen, setIsViewUserModalOpen] = useState<boolean>(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('Admin');
  const [editDept, setEditDept] = useState<string>('');
  const [editStatus, setEditStatus] = useState<UserStatus>('approved');
  const [editPassword, setEditPassword] = useState<string>('');
  const [savingUserEdit, setSavingUserEdit] = useState<boolean>(false);

  // Add Admin Modal State
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState<boolean>(false);
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [newAdminDept, setNewAdminDept] = useState<string>('Packaging Engineering');
  const [creatingAdmin, setCreatingAdmin] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiService.users.list();
      setUsersList(data || []);
    } catch (err: any) {
      showToast(`Failed loading users: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
  const filteredUsers = usersList.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingUsers = usersList.filter((u) => u.status === 'pending_approval' || u.isApproved === false);
  const approvedUsers = usersList.filter((u) => u.status === 'approved' && u.email?.toLowerCase() !== 'superadmin@gmail.com');
  const suspendedUsers = usersList.filter((u) => u.status === 'suspended');

  // Open View User Modal
  const handleOpenViewUser = (user: UserProfile) => {
    setViewingUser(user);
    setIsViewUserModalOpen(true);
  };

  // Open Edit User Modal
  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role || 'Admin');
    setEditDept(user.department || 'Label Management');
    setEditStatus((user.status as UserStatus) || (user.isApproved ? 'approved' : 'pending_approval'));
    setEditPassword('');
    setIsEditUserModalOpen(true);
  };

  // Save Edit User Changes
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }

    try {
      setSavingUserEdit(true);
      const payload: any = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        department: editDept.trim(),
        status: editStatus,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      await apiService.users.update(editingUser.id, payload);

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: editName.trim(),
                email: editEmail.trim(),
                role: editRole,
                department: editDept.trim(),
                status: editStatus,
                isApproved: editStatus === 'approved',
              }
            : u
        )
      );

      showToast(`Account details updated for ${editName.trim()}!`, 'success');
      setIsEditUserModalOpen(false);
      if (onRefreshSession) onRefreshSession();
    } catch (err: any) {
      showToast(`Failed updating account: ${err.message}`, 'error');
    } finally {
      setSavingUserEdit(false);
    }
  };

  // Approve Admin
  const handleApproveUser = async (user: UserProfile) => {
    try {
      await apiService.users.updateStatus(user.id, {
        status: 'approved',
        approvedBy: currentUser.name || 'Super Administrator',
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: 'approved', isApproved: true } : u))
      );
      showToast(`Admin ${user.name} approved successfully! They can now log in.`, 'success');
      if (onRefreshSession) onRefreshSession();
    } catch (err: any) {
      showToast(`Approval failed: ${err.message}`, 'error');
    }
  };

  // Reject / Suspend Admin
  const handleSetStatus = async (user: UserProfile, newStatus: 'suspended' | 'approved' | 'rejected') => {
    try {
      await apiService.users.updateStatus(user.id, {
        status: newStatus,
        approvedBy: currentUser.name || 'Super Administrator',
      });
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, status: newStatus, isApproved: newStatus === 'approved' } : u
        )
      );
      showToast(`Admin ${user.name} status updated to ${newStatus.toUpperCase()}`, 'info');
    } catch (err: any) {
      showToast(`Status update failed: ${err.message}`, 'error');
    }
  };

  // Delete Admin
  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to permanently delete Admin ${user.name} (${user.email})?`)) {
      return;
    }
    try {
      await apiService.users.delete(user.id);
      setUsersList((prev) => prev.filter((u) => u.id !== user.id));
      showToast(`Admin ${user.name} removed from system.`, 'info');
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Open Permissions Modal
  const handleOpenPermissions = (user: UserProfile) => {
    setSelectedUserForPerms(user);
    setEditingPermissions(
      user.permissions || {
        ...DEFAULT_ADMIN_PERMISSIONS,
      }
    );
    setIsPermsModalOpen(true);
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedUserForPerms) return;
    try {
      setSavingPerms(true);
      await apiService.users.updatePermissions(selectedUserForPerms.id, {
        permissions: editingPermissions,
        updatedBy: currentUser.name || 'Super Administrator',
      });
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === selectedUserForPerms.id ? { ...u, permissions: editingPermissions } : u
        )
      );
      showToast(`Permissions updated for ${selectedUserForPerms.name}!`, 'success');
      setIsPermsModalOpen(false);
    } catch (err: any) {
      showToast(`Failed saving permissions: ${err.message}`, 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  // Create New Pre-Approved Admin
  const handleCreateDirectAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) {
      showToast('Please fill all fields', 'error');
      return;
    }

    try {
      setCreatingAdmin(true);
      const res = await apiService.auth.register({
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
        password: newAdminPassword.trim(),
        department: newAdminDept.trim(),
        role: 'Admin',
      });

      if (res && res.user) {
        // Auto-approve since Super Admin created it directly
        await apiService.users.updateStatus(res.user.id, {
          status: 'approved',
          approvedBy: currentUser.name || 'Super Administrator',
        });
        showToast(`Admin ${newAdminName} created and pre-approved!`, 'success');
        setIsAddAdminModalOpen(false);
        setNewAdminName('');
        setNewAdminEmail('');
        setNewAdminPassword('');
        fetchUsers();
      }
    } catch (err: any) {
      showToast(`Failed creating admin: ${err.message}`, 'error');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col select-none font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : toastMessage.type === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Super Admin Header & Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Brand & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black text-sm">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  Super Administrator Control Center
                </h1>
                <span className="text-[9px] font-mono font-bold bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase">
                  Root Governance
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Admin Approvals, User Profile Management, and Granular Feature Permissions
              </p>
            </div>
          </div>
        </div>

        {/* Global Navigation Shortcuts */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <div className="px-3.5 py-1.5 rounded-xl bg-white text-blue-700 shadow-2xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Admin Approvals & RBAC</span>
          </div>

          {onOpenAuditLogs && (
            <button
              onClick={onOpenAuditLogs}
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Audit Logs</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings('datasets')}
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>Settings</span>
            </button>
          )}
        </div>

        {/* User & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-blue-50 border border-blue-200/80 rounded-xl text-xs">
            <img
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100'}
              alt="Super Admin"
              className="w-5 h-5 rounded-full object-cover"
            />
            <div className="hidden sm:block text-left leading-tight">
              <span className="font-bold text-blue-950 text-[11px] block">Super Admin</span>
              <span className="text-[10px] text-blue-700 font-mono">superadmin@gmail.com</span>
            </div>
          </div>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Refresh Users List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Sign Out of Super Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-2 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>Super Administrator Governance Active</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Administrator Access & Profile Management
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              Review, approve, edit account details, reset passwords, and configure granular feature permissions for all administrators.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsAddAdminModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all w-full md:w-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Admin Directly</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Administrators</span>
              <Building className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{usersList.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Registered across all departments</p>
          </div>

          <div className="p-5 bg-white border border-amber-200/90 rounded-2xl shadow-2xs bg-gradient-to-br from-white to-amber-50/40">
            <div className="flex items-center justify-between text-amber-700 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Approvals</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700 font-mono flex items-center gap-2">
              <span>{pendingUsers.length}</span>
              {pendingUsers.length > 0 && (
                <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase animate-pulse">
                  Action Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-600/80 mt-1">Awaiting Super Admin authorization</p>
          </div>

          <div className="p-5 bg-white border border-emerald-200/90 rounded-2xl shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Active Authorized Admins</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono">{approvedUsers.length}</div>
            <p className="text-[11px] text-emerald-600/80 mt-1">Verified with feature permissions</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Suspended Accounts</span>
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-700 font-mono">{suspendedUsers.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Access revoked by Super Admin</p>
          </div>
        </div>

        {/* Priority Section: Pending Admin Requests */}
        {pendingUsers.length > 0 && (
          <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-amber-900">
                    Pending Admin Registration Requests ({pendingUsers.length})
                  </h2>
                  <p className="text-xs text-amber-700">
                    These admins cannot log in until you review and grant permission.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingUsers.map((pUser) => (
                <div
                  key={pUser.id}
                  className="p-4 bg-white border border-amber-200/80 rounded-2xl shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{pUser.name}</span>
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">
                          Pending Approval
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">{pUser.email}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Department: {pUser.department || 'Operations'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleApproveUser(pUser)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Approve & Grant Login</span>
                    </button>
                    <button
                      onClick={() => handleOpenPermissions(pUser)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 cursor-pointer transition-all flex items-center gap-1"
                      title="Set specific permissions before approving"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Permissions</span>
                    </button>
                    <button
                      onClick={() => handleSetStatus(pUser, 'rejected')}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Reject Registration"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Master Registered Admins Table Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search administrators by name, email, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  All ({usersList.length})
                </button>
                <button
                  onClick={() => setStatusFilter('approved')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'approved' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setStatusFilter('pending_approval')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'pending_approval' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Pending ({pendingUsers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('suspended')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'suspended' ? 'bg-white text-red-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Suspended
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAddAdminModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Admin</span>
              </button>
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4">Granted Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No administrators matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSuper = user.email?.toLowerCase() === 'superadmin@gmail.com';
                    const perms = user.permissions || DEFAULT_ADMIN_PERMISSIONS;
                    const grantedCount = isSuper ? 10 : Object.values(perms).filter(Boolean).length;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100'}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isSuper && (
                                  <span className="text-[9px] font-mono font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase">
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                <span>{user.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{user.department || 'Operations'}</div>
                          <div className="text-[11px] text-slate-500">{user.role || 'Admin'}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          {user.status === 'approved' || isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved & Active</span>
                            </span>
                          ) : user.status === 'pending_approval' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>Pending Approval</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              <Lock className="w-3 h-3" />
                              <span>Suspended / Inactive</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-800">
                              {grantedCount} of 10 Features
                            </span>
                            {!isSuper && (
                              <button
                                onClick={() => handleOpenPermissions(user)}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                            {isSuper
                              ? 'Master All Access Granted'
                              : Object.entries(perms)
                                  .filter(([_, v]) => v)
                                  .map(([k]) => k.replace(/^can/, ''))
                                  .slice(0, 3)
                                  .join(', ') + '...'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isSuper ? (
                            <span className="text-[11px] text-slate-400 italic">Protected Root</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. View Details Button */}
                              <button
                                onClick={() => handleOpenViewUser(user)}
                                className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="View Account Profile Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* 2. Edit Profile Button */}
                              <button
                                onClick={() => handleOpenEditUser(user)}
                                className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="Edit Account Details & Reset Password"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* 3. Configure Feature Permissions Button */}
                              <button
                                onClick={() => handleOpenPermissions(user)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="Configure Feature Permissions"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                              </button>

                              {/* 4. Approve / Suspend Toggle */}
                              {user.status === 'pending_approval' ? (
                                <button
                                  onClick={() => handleApproveUser(user)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              ) : user.status === 'approved' ? (
                                <button
                                  onClick={() => handleSetStatus(user, 'suspended')}
                                  className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-lg text-xs transition-all cursor-pointer"
                                  title="Suspend Admin Account"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSetStatus(user, 'approved')}
                                  className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 rounded-lg text-xs transition-all cursor-pointer"
                                  title="Re-activate Admin Account"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 5. Delete Button */}
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-700 rounded-lg text-xs transition-all cursor-pointer"
                                title="Delete Admin Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 1. VIEW USER DETAILS MODAL */}
      {viewingUser && (
        <Modal
          isOpen={isViewUserModalOpen}
          onClose={() => setIsViewUserModalOpen(false)}
          title={`Administrator Account: ${viewingUser.name}`}
          subtitle={`View complete profile information and granted permissions.`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setIsViewUserModalOpen(false);
                  handleOpenEditUser(viewingUser);
                }}
                className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Account Details</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewUserModalOpen(false);
                    handleOpenPermissions(viewingUser);
                  }}
                  className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Configure Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Header Profile Summary */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
              <img
                src={viewingUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100'}
                alt={viewingUser.name}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-300 shadow-xs"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{viewingUser.name}</h3>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase">
                    {viewingUser.role || 'Admin'}
                  </span>
                  {viewingUser.status === 'approved' ? (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : viewingUser.status === 'pending_approval' ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Pending Approval
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Suspended
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{viewingUser.email}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Department: {viewingUser.department || 'General Operations'}</span>
                </div>
              </div>
            </div>

            {/* Account Metadata Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account ID</span>
                <p className="font-mono text-slate-800 font-semibold">{viewingUser.id}</p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered On</span>
                <p className="font-mono text-slate-800 font-semibold">
                  {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleString() : 'Pre-seeded System Account'}
                </p>
              </div>
            </div>

            {/* Granted Feature Permissions Grid */}
            <div>
              <span className="text-xs font-bold text-slate-800 block mb-2">
                Active Feature Permissions (
                {Object.values(viewingUser.permissions || DEFAULT_ADMIN_PERMISSIONS).filter(Boolean).length} of 10)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_CATALOG.map((feat) => {
                  const isGranted = (viewingUser.permissions || DEFAULT_ADMIN_PERMISSIONS)[feat.key];
                  return (
                    <div
                      key={feat.key}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isGranted
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span className="truncate pr-2">{feat.title}</span>
                      {isGranted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. EDIT USER DETAILS MODAL */}
      {editingUser && (
        <Modal
          isOpen={isEditUserModalOpen}
          onClose={() => setIsEditUserModalOpen(false)}
          title={`Edit Administrator: ${editingUser.name}`}
          subtitle="Modify account information, role, department, status, or reset password."
          maxWidth="md"
        >
          <form onSubmit={handleSaveUserEdit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Work Email</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                >
                  <option value="Admin">Admin</option>
                  <option value="Designer">Designer</option>
                  <option value="Approver Level 1">Approver Level 1</option>
                  <option value="Approver Level 2">Approver Level 2</option>
                  <option value="Viewer / Print Operator">Print Operator</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Approval Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                >
                  <option value="approved">Approved & Active</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="suspended">Suspended / Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Department</label>
              <input
                type="text"
                required
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Reset Password <span className="text-slate-400 font-normal">(Leave blank to keep unchanged)</span>
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Enter new password to reset"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditUserModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingUserEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingUserEdit ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. PERMISSIONS CONFIGURATION MODAL */}
      {selectedUserForPerms && (
        <Modal
          isOpen={isPermsModalOpen}
          onClose={() => setIsPermsModalOpen(false)}
          title={`Configure Feature Permissions: ${selectedUserForPerms.name}`}
          subtitle={`Control which features and modules Admin ${selectedUserForPerms.email} is allowed to access.`}
          maxWidth="3xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPermissions(ALL_PERMISSIONS_GRANTED)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl cursor-pointer"
                >
                  Grant All (10)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditingPermissions({
                      canDesignTemplates: false,
                      canCreateTemplates: false,
                      canDeleteTemplates: false,
                      canApproveWorkflow: false,
                      canPrintAndSpool: false,
                      canManageDatasets: false,
                      canCalibratePrinters: false,
                      canManageLicense: false,
                      canDownloadDesktopApp: false,
                      canViewAuditLogs: false,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Revoke All
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPermsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPerms}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingPerms ? 'Saving...' : 'Save Permissions'}</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-xs text-blue-900">
                <span className="font-bold">Super Admin Policy: </span>
                Any disabled feature below will be completely hidden or restricted for this Admin during their login sessions.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURE_CATALOG.map((feat) => {
                const isEnabled = !!editingPermissions[feat.key];

                return (
                  <div
                    key={feat.key}
                    onClick={() =>
                      setEditingPermissions((prev) => ({
                        ...prev,
                        [feat.key]: !prev[feat.key],
                      }))
                    }
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isEnabled
                        ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isEnabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{feat.title}</span>
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                          {feat.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* 4. ADD DIRECT ADMIN MODAL */}
      <Modal
        isOpen={isAddAdminModalOpen}
        onClose={() => setIsAddAdminModalOpen(false)}
        title="Create Pre-Approved Administrator"
        subtitle="Add a new administrator account directly with instant pre-approved access."
        maxWidth="md"
      >
        <form onSubmit={handleCreateDirectAdmin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="e.g. Anand Sharma"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">Work Email</label>
            <input
              type="email"
              required
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="anand@company.com"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">Password</label>
            <input
              type="password"
              required
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">Department</label>
            <input
              type="text"
              required
              value={newAdminDept}
              onChange={(e) => setNewAdminDept(e.target.value)}
              placeholder="Packaging / Cleanroom"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddAdminModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingAdmin}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{creatingAdmin ? 'Creating...' : 'Create & Pre-Approve'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
