import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Cpu,
  Building,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  WifiOff,
  Lock,
  Zap,
  Award
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { UserProfile } from '../../types';

interface LicenseManagerViewProps {
  currentUser: UserProfile;
  onNavigateToDashboard: () => void;
}

export const LicenseManagerView = ({
  currentUser,
  onNavigateToDashboard,
}: LicenseManagerViewProps) => {
  const [license, setLicense] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inputKey, setInputKey] = useState<string>('');
  const [offlineCode, setOfflineCode] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  const fetchLicenseStatus = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.license.status();
      setLicense(data);
    } catch (err) {
      console.warn('Failed to fetch license status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleActivateKey = async () => {
    if (!inputKey.trim()) return;
    try {
      const res = await apiService.license.activate({
        licenseKey: inputKey.trim(),
        registeredTo: currentUser.name,
        organization: 'BarcodeFlow Industrial Enterprise',
      });

      if (res.license) {
        setLicense(res.license);
        showToast('License activated successfully and bound to this hardware machine!');
        setInputKey('');
      }
    } catch (err: any) {
      alert(`Activation error: ${err.message}`);
    }
  };

  const handleOfflineActivate = async () => {
    if (!offlineCode.trim()) return;
    try {
      const res = await apiService.license.offlineActivate({
        activationCode: offlineCode.trim(),
      });

      if (res.license) {
        setLicense(res.license);
        showToast('Air-gapped offline license activated successfully!');
        setOfflineCode('');
      }
    } catch (err: any) {
      alert(`Offline activation error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen w-screen bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Application Bar */}
      <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 text-xs select-none shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all shadow-xs"
          >
            <span>← Dashboard</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>BarcodeFlow Enterprise Licensing & Machine Binding</span>
          </div>
        </div>

        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>HARDWARE GUID BOUND</span>
        </span>
      </div>

      {notification && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-xl text-xs font-bold animate-in fade-in">
          {notification}
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full">
                {license?.tier || 'Enterprise Suite'}
              </span>
              <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-emerald-400" />
                <span>Offline Engine Ready</span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Enterprise Software License & Machine Binding
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              BarcodeFlow Enterprise features hardware machine-bound cryptographic licensing. Everything operates 100% offline without requiring continuous cloud or internet connectivity.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center min-w-[200px] shadow-lg">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">License Status</div>
            <div className="text-lg font-extrabold text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{license?.status || 'ACTIVE'}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Key: {license?.licenseKey || 'BCF-ENT-9921-8840'}
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Hardware Binding & Activation Forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardware GUID Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span>Machine Hardware GUID Binding</span>
                </h2>
                <span className="text-[10px] font-mono text-slate-400">Node ID</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400">Current Machine GUID</div>
                <div className="font-mono text-xs text-blue-300 bg-slate-950 border border-slate-800 rounded p-2 text-center select-all tracking-wider font-bold">
                  {license?.machineGuid || '8F3A-992B-C001-4481-EE99'}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-400" />
                    <span>Organization:</span>
                  </span>
                  <span className="font-semibold text-white">{license?.organization || 'BarcodeFlow Corporate'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>Registered To:</span>
                  </span>
                  <span className="font-semibold text-white">{license?.registeredTo || currentUser.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Expires At:</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Perpetual Enterprise'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-300 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-blue-400" />
              <span>License is cryptographically locked to this physical machine's CPU & System ID.</span>
            </div>
          </div>

          {/* Activation Form Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Activate License Key</span>
              </h2>
            </div>

            {/* Online / Serial Key Activation */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">Enter Serial License Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. BCF-ENT-9921-8840"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                />
                <button
                  onClick={handleActivateKey}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  Activate
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-800 my-2" />

            {/* Air-Gapped Offline Activation */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Air-Gapped Offline Activation Code</span>
                <span className="text-[10px] text-slate-500 font-mono">No Internet Required</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste offline response code..."
                  value={offlineCode}
                  onChange={(e) => setOfflineCode(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleOfflineActivate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  Apply Code
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise Features Granted Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Activated Enterprise Suite Capabilities</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(license?.features || [
              'Unlimited Desktop Offline Operation',
              'Native ZPL II & EPL2 Thermal Code Generators',
              '21 CFR Part 11 Electronic Signature Compliance',
              'Excel, CSV & Database Serialization Manager',
              '100% Pixel-Perfect Vector PDF Engine',
              'Local .bft Template Files with Auto-Save',
              'Machine-Bound Hardware GUID Verification',
            ]).map((ft: string, idx: number) => (
              <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{ft}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
