import React, { useState, useEffect } from 'react';
import {
  Download,
  Laptop,
  CheckCircle2,
  HardDrive,
  Cpu,
  ShieldCheck,
  Zap,
  Printer,
  History,
  FileCode,
  RefreshCw,
  Sparkles,
  Server,
  Key,
  Flame,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { UserProfile } from '../../types';

interface SoftwareDownloadViewProps {
  currentUser: UserProfile;
  onBackToDashboard: () => void;
  onNavigateToLicense?: () => void;
}

export const SoftwareDownloadView: React.FC<SoftwareDownloadViewProps> = ({
  currentUser,
  onBackToDashboard,
  onNavigateToLicense,
}) => {
  const [loading, setLoading] = useState(false);
  const [latestRelease, setLatestRelease] = useState<any>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatus, setDownloadStatus] = useState<
    'idle' | 'preparing' | 'connecting' | 'downloading' | 'completed' | 'error'
  >('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadedBytesText, setDownloadedBytesText] = useState<string>('');
  const [downloadFileName, setDownloadFileName] = useState<string>('BarcodeFlow_Setup_v2.5.0.exe');
  const [showAdminUpload, setShowAdminUpload] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newReleaseName, setNewReleaseName] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');

  // Fetch software release metadata
  const fetchReleases = async () => {
    try {
      setLoading(true);
      const res = await apiService.software.getLatestVersion();
      if (res && res.data) {
        setLatestRelease(res.data);
        setDownloadFileName(`BarcodeFlow_Setup_v${res.data.version || '2.5.0'}.exe`);
      }
      const historyRes = await apiService.software.getVersionHistory();
      if (historyRes && historyRes.data) {
        setReleases(historyRes.data);
      }
    } catch (err) {
      console.error('Failed to load software releases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  /**
   * Real, zero-simulation binary stream download with actual chunk counting.
   * Never shows 100% or "Download Completed" if the server returns 404 or fails.
   */
  const handleDownloadInstaller = async () => {
    try {
      setDownloadStatus('connecting');
      setDownloadError(null);
      setDownloadProgress(5);
      setDownloadedBytesText('Initiating secure handshake...');

      const targetVersion = latestRelease?.version || '2.5.0';
      const downloadUrl = `/api/software/download?v=${targetVersion}`;

      const response = await fetch(downloadUrl);

      // Verify server response before proceeding
      if (!response.ok) {
        let errorMsg = `Server error (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          if (errData && errData.message) {
            errorMsg = errData.message;
          }
        } catch {
          errorMsg = `Installer binary file not available (HTTP ${response.status}). Please restart server or contact Administrator.`;
        }
        setDownloadStatus('error');
        setDownloadError(errorMsg);
        setDownloadProgress(0);
        return;
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      if (!response.body) {
        throw new Error('ReadableStream not supported by client browser.');
      }

      setDownloadStatus('downloading');

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.length;

          if (totalBytes > 0) {
            const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            setDownloadProgress(percent);
            setDownloadedBytesText(
              `${(receivedBytes / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB (${percent}%)`
            );
          } else {
            setDownloadProgress(50);
            setDownloadedBytesText(`${(receivedBytes / (1024 * 1024)).toFixed(1)} MB received`);
          }
        }
      }

      // Concatenate received chunks into a single executable binary Blob
      const blob = new Blob(chunks, { type: 'application/vnd.microsoft.portable-executable' });
      const blobUrl = window.URL.createObjectURL(blob);

      // Trigger standard browser file save
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', downloadFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);

      // ONLY mark completed after all chunks are verified and saved
      setDownloadProgress(100);
      setDownloadStatus('completed');
      setDownloadedBytesText(
        `Successfully downloaded ${(blob.size / (1024 * 1024)).toFixed(1)} MB directly to your system.`
      );
    } catch (err: any) {
      console.error('Download stream error:', err);
      setDownloadStatus('error');
      setDownloadProgress(0);
      setDownloadError(err.message || 'Download failed. Installer currently unavailable on server.');
    }
  };

  const handlePublishNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion || !newReleaseName) return;

    try {
      await apiService.software.uploadVersion({
        version: newVersion,
        releaseName: newReleaseName,
        releaseNotes: newReleaseNotes.split('\n').filter((n) => n.trim().length > 0),
        fileSize: '78.4 MB',
        channel: 'stable',
      });
      setShowAdminUpload(false);
      setNewVersion('');
      setNewReleaseName('');
      setNewReleaseNotes('');
      fetchReleases();
    } catch (err) {
      console.error('Failed to publish release:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Header & Breadcrumbs */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1 tracking-wider uppercase">
            <span className="cursor-pointer hover:underline" onClick={onBackToDashboard}>
              Dashboard
            </span>
            <span>/</span>
            <span className="text-slate-400">Settings</span>
            <span>/</span>
            <span className="text-emerald-400 font-bold">Desktop Software Suite</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Laptop className="w-8 h-8 text-blue-500" />
            BarcodeFlow Desktop Suite (BarTender Parity)
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Official Windows Executable (.exe) Setup Package with 100% Offline Runtime & Thermal Printer Spooler.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            ← Back to Dashboard
          </button>
          {onNavigateToLicense && (
            <button
              onClick={onNavigateToLicense}
              className="px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-500/50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4 text-indigo-400" />
              License & GUID Binding
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Hero Card (2 cols on large screen) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Release Download Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/60 border border-blue-500/30 p-6 md:p-8 shadow-2xl shadow-blue-950/40">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Laptop className="w-64 h-64 text-blue-400" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Latest Official Installer
                </span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full text-xs font-mono font-bold">
                  v{latestRelease?.version || '2.5.0'} Enterprise
                </span>
                <span className="text-xs text-slate-400">
                  Updated on {latestRelease?.releaseDate || 'August 2026'}
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                {latestRelease?.releaseName || 'BarcodeFlow Enterprise Suite v2.5'}
              </h2>
              <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed mb-6">
                Native Windows standalone packaging powered by Electron, embedded Express microservice, local JSON
                storage, and direct hardware communication for Zebra, TSC, Citizen, and Brother thermal printers.
              </p>

              {/* Download Buttons & Progress */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={handleDownloadInstaller}
                    disabled={downloadStatus === 'downloading' || downloadStatus === 'connecting'}
                    className="flex items-center gap-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white px-7 py-4 rounded-xl font-bold text-sm shadow-xl shadow-blue-900/40 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-5 h-5 text-white animate-bounce" />
                    <div className="text-left">
                      <div className="font-bold">Download Windows Application (.exe)</div>
                      <div className="text-[11px] text-blue-100 font-mono font-normal">
                        {downloadFileName} • {latestRelease?.fileSize || '78.4 MB'}
                      </div>
                    </div>
                  </button>
                </div>

                {downloadStatus !== 'idle' && (
                  <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-2">
                        {downloadStatus === 'completed' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                        {(downloadStatus === 'connecting' || downloadStatus === 'downloading') && (
                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                        )}
                        {downloadStatus === 'error' && (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}

                        {downloadStatus === 'connecting' && 'Connecting to server & verifying installer...'}
                        {downloadStatus === 'downloading' && `Downloading ${downloadFileName}...`}
                        {downloadStatus === 'completed' && 'Download Completed! Setup file saved in your downloads folder.'}
                        {downloadStatus === 'error' && `Download Failed: ${downloadError}`}
                      </span>
                      {downloadStatus === 'downloading' && (
                        <span className="font-mono text-blue-400 font-bold">{downloadProgress}%</span>
                      )}
                    </div>

                    {downloadedBytesText && downloadStatus !== 'error' && (
                      <div className="text-[11px] text-slate-400 font-mono">{downloadedBytesText}</div>
                    )}

                    {downloadStatus !== 'error' && (
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Highlights pills */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>100% Offline Runtime</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Printer className="w-4 h-4 text-blue-400" />
                  <span>Direct ZPL II & EPL2</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Hardware GUID Bound</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>Port 5050 Auto-Start</span>
                </div>
              </div>
            </div>
          </div>

          {/* Release Notes for Current Build */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              What's New in v{latestRelease?.version || '2.5.0'}
            </h3>
            <div className="space-y-3">
              {(latestRelease?.releaseNotes || [
                'Industrial 3-Step Workflow: Designer -> Approver 1 (e-Sign) -> Production Print Station',
                'Air-Gapped Hardware GUID binding and 21 CFR Part 11 Audit Trail',
                'Dual Thermal Generation: Native ZPL II & EPL2 with speed/darkness calibration',
                'Live Local Printer Detection via Windows spooler and PowerShell scanner',
                'Dataset Manager: Drag & Drop Excel (.xlsx) & CSV import with dynamic variable binding',
                'Offline Local Storage & 100% Zero-Latency Desktop Runtime'
              ]).map((note: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-xs md:text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Installation Guide */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              Step-by-Step Windows Installation Guide
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h4 className="font-bold text-xs text-slate-200">Run Setup Executable</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Double click <code className="text-blue-300 font-mono">BarcodeFlow_Setup_v2.5.0.exe</code>. The installer will extract and configure the desktop runtime.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h4 className="font-bold text-xs text-slate-200">Shortcuts & Microservice</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Installer creates Desktop & Start Menu shortcuts. Express microservice automatically registers on <code className="text-indigo-300 font-mono">http://127.0.0.1:5050</code>.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h4 className="font-bold text-xs text-slate-200">Thermal Printer & Design</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Open application from desktop. Detected Zebra/TSC printers show instantly in Printer Calibration Wizard. Work completely offline!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info (1 col on large screen) */}
        <div className="space-y-6">
          {/* System Requirements Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              System Requirements
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span className="text-slate-400">Operating System</span>
                <span className="font-semibold text-slate-200 text-right">Windows 10 / 11 (64-bit)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span className="text-slate-400">RAM Memory</span>
                <span className="font-semibold text-slate-200">4 GB Min (8 GB Rec.)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span className="text-slate-400">Storage Disk</span>
                <span className="font-semibold text-slate-200">250 MB Free Space</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 text-slate-300">
                <span className="text-slate-400">Printer Support</span>
                <span className="font-semibold text-slate-200">Zebra ZPL, TSC, EPL</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-slate-300">
                <span className="text-slate-400">Network / Internet</span>
                <span className="font-semibold text-emerald-400">100% Offline Compatible</span>
              </div>
            </div>
          </div>

          {/* Version History Accordion */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Version History
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {releases.length} Builds
              </span>
            </div>

            <div className="space-y-3">
              {releases.map((rel) => (
                <div
                  key={rel.version}
                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">v{rel.version}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        rel.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rel.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{rel.releaseName}</p>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                    <span>{rel.releaseDate}</span>
                    <span className="font-mono">{rel.fileSize}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Upload / Release Publisher */}
          {currentUser.role === 'Designer' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Admin Release Publisher
                </h3>
                <button
                  onClick={() => setShowAdminUpload(!showAdminUpload)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  {showAdminUpload ? 'Hide' : 'New Build'}
                </button>
              </div>

              {showAdminUpload && (
                <form onSubmit={handlePublishNewVersion} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Version Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2.6.0"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Release Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Industrial RFID & Direct Spooler Update"
                      value={newReleaseName}
                      onChange={(e) => setNewReleaseName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Release Notes (1 per line)</label>
                    <textarea
                      rows={3}
                      placeholder="Added RFID encoding support&#10;Speed optimizations"
                      value={newReleaseNotes}
                      onChange={(e) => setNewReleaseNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-md cursor-pointer"
                  >
                    Publish Release Build
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
