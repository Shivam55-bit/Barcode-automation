import React, { useState } from 'react';
import {
  ShieldCheck,
  Shield,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  Mail,
  UserPlus,
  LogIn
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { INITIAL_USERS } from '../../services/mockDataService';
import { apiService } from '../../services/apiService';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  initialUsers?: UserProfile[];
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  initialUsers = INITIAL_USERS,
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [email, setEmail] = useState<string>('shivam@gmail.com');
  const [password, setPassword] = useState<string>('123456');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Register State
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [regDept, setRegDept] = useState<string>('Packaging Engineering');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const DEPARTMENT_PRESETS = [
    'Packaging Engineering',
    'Quality Assurance',
    'Serialization Lab',
    'Cleanroom Operations',
  ];

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Check Super Admin Direct Credentials
      if (
        cleanEmail === 'superadmin@gmail.com' &&
        cleanPassword === 'superadmin@gmail.com'
      ) {
        const superAdminUser = INITIAL_USERS.find(
          (u) => u.email?.toLowerCase() === 'superadmin@gmail.com'
        ) || {
          id: 'usr-super-admin',
          name: 'Super Administrator',
          email: 'superadmin@gmail.com',
          role: 'Super Admin',
          department: 'Enterprise Security & Governance',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
          status: 'approved',
          isApproved: true,
        };

        apiService.auth.login({ email: cleanEmail, password: cleanPassword }).catch(() => { });
        onLoginSuccess(superAdminUser as UserProfile);
        return;
      }

      // 2. Check local pending/approved users (instant client-side resolution)
      try {
        const savedPendingStr = localStorage.getItem('barcodeflow_pending_users');
        if (savedPendingStr) {
          const localPending: UserProfile[] = JSON.parse(savedPendingStr);
          const found = localPending.find(
            (u) => u.email?.toLowerCase() === cleanEmail
          );
          if (found) {
            if (found.status === 'pending_approval' || found.isApproved === false) {
              setErrorMessage(
                'Your Admin registration is pending approval by the Super Admin. Please contact superadmin@gmail.com for activation.'
              );
              setIsSubmitting(false);
              return;
            }
            if (found.status === 'suspended') {
              setErrorMessage('Your Admin account has been suspended by the Super Administrator.');
              setIsSubmitting(false);
              return;
            }
            // Approved user -> log in as Admin!
            apiService.auth.login({ email: cleanEmail, password: cleanPassword }).catch(() => { });
            onLoginSuccess(found);
            return;
          }
        }
      } catch {}

      // 3. Check INITIAL_USERS presets (shivam@gmail.com, sarah, etc.)
      const localApproved = INITIAL_USERS.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );
      if (localApproved) {
        if (localApproved.status === 'pending_approval' || localApproved.isApproved === false) {
          setErrorMessage('Your Admin registration is pending approval by the Super Admin.');
          setIsSubmitting(false);
          return;
        }
        if (localApproved.status === 'suspended') {
          setErrorMessage('Your Admin account has been suspended.');
          setIsSubmitting(false);
          return;
        }
        apiService.auth.login({ email: cleanEmail, password: cleanPassword }).catch(() => { });
        onLoginSuccess(localApproved);
        return;
      }

      // 4. Call Backend API
      try {
        const res = await apiService.auth.login({ email: cleanEmail, password: cleanPassword });
        if (res && res.success && res.user) {
          onLoginSuccess(res.user);
          return;
        } else {
          setErrorMessage(res?.message || 'Login failed. Please check your credentials.');
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'Login failed. If your Admin registration is pending, please contact superadmin@gmail.com.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRegSuccess(null);
    setIsSubmitting(true);

    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage('Please fill in all registration fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await apiService.auth.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        department: regDept.trim(),
        role: 'Admin',
      });

      if (res && res.success) {
        setRegSuccess(
          res.message ||
          'Admin registration submitted successfully! Your account is now pending approval by the Super Admin (superadmin@gmail.com).'
        );
        // Switch to sign in tab prefilled
        setEmail(regEmail.trim());
        setPassword(regPassword.trim());
      } else {
        setErrorMessage(res?.message || 'Registration failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col items-center justify-center p-4 select-none font-sans relative">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 z-10">

        {/* Left Side: Brand & Role Presets */}
        <div className="md:col-span-5 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 flex flex-col justify-between text-white border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/30">
                B
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white leading-none">
                  BarcodeFlow Enterprise
                </h1>
                <p className="text-[10px] text-blue-400 font-mono tracking-wider uppercase mt-1">
                  21 CFR Part 11 Platform
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <h2 className="text-sm font-bold text-slate-100">Enterprise Access Gateway</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with your approved Administrator account to manage label templates, serializations, and print center workflows.
              </p>
            </div>

            {/* Quick Demo Presets */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Quick Role Presets (Click to Fill)
              </span>

              {/* Administrator Preset */}
              <button
                type="button"
                onClick={() => handleQuickPreset('shivam@gmail.com', 'password123')}
                className="w-full p-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                    👤
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-white">
                      Administrator (Shivam)
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">shivam@gmail.com</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-lg uppercase border border-emerald-800 tracking-wider font-mono">
                  Admin
                </span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>BarcodeFlow Enterprise v2.5.0</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          </div>
        </div>

        {/* Right Side: Sign In / Register Form */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div>
            {/* Tab Selector */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register New Admin</span>
              </button>
            </div>

            {/* Alert Messages */}
            {errorMessage && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-start gap-2.5 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start gap-2.5 mb-4">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{regSuccess}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN FORM */}
            {activeTab === 'signin' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="shivam@gmail.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Verifying Account...' : 'Sign In to Workspace'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER NEW ADMIN FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    New Admin accounts require approval before login is enabled.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Vikram Patel"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="vikram@pharma-corp.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Department</label>
                    <input
                      type="text"
                      required
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      placeholder="Packaging / Cleanroom"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Submitting Registration...' : 'Submit for Approval'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="text-[11px] text-slate-400 text-center mt-6">
            Protected by FDA 21 CFR Part 11 Compliant Cryptographic Access Controls
          </div>
        </div>
      </div>
    </div>
  );
};
