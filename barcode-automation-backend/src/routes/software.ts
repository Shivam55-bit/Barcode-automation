import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';
import fs from 'fs';
import path from 'path';

export const softwareRouter = Router();

const storage = StorageService.getInstance();

export interface SoftwareRelease {
  version: string;
  buildNumber: number;
  releaseName: string;
  releaseNotes: string[];
  downloadURL: string;
  fileSize: string;
  releaseDate: string;
  status: 'active' | 'deprecated' | 'beta';
  channel: 'stable' | 'beta' | 'enterprise';
  sha256?: string;
  systemRequirements: {
    os: string;
    ram: string;
    disk: string;
    dotnet: string;
    architecture: string;
  };
}

const DEFAULT_RELEASES: SoftwareRelease[] = [
  {
    version: '2.5.0',
    buildNumber: 25010,
    releaseName: 'BarcodeFlow Enterprise Suite v2.5 (BarTender Parity)',
    releaseNotes: [
      'Industrial 3-Step Workflow: Designer -> Approver 1 (e-Sign) -> Production Print Station',
      'Air-Gapped Hardware GUID binding and 21 CFR Part 11 Audit Trail',
      'Dual Thermal Generation: Native ZPL II & EPL2 with speed/darkness calibration',
      'Live Local Printer Detection via Windows spooler and PowerShell scanner',
      'Dataset Manager: Drag & Drop Excel (.xlsx) & CSV import with dynamic variable binding',
      'Offline Local Storage & 100% Zero-Latency Desktop Runtime'
    ],
    downloadURL: '/api/software/download?target=win-x64',
    fileSize: '78.4 MB',
    releaseDate: '2026-08-21',
    status: 'active',
    channel: 'stable',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    systemRequirements: {
      os: 'Windows 10 / 11 (64-bit) or Windows Server 2019+',
      ram: '4 GB Minimum (8 GB Recommended for 100k+ batch print queues)',
      disk: '250 MB free disk space',
      dotnet: '.NET Framework 4.8 or Windows Desktop Runtime',
      architecture: 'x64 / ARM64 Compatible'
    }
  },
  {
    version: '2.4.0',
    buildNumber: 24005,
    releaseName: 'BarcodeFlow GS1 & Direct Spooler Update',
    releaseNotes: [
      'Added GS1-128 AI (Application Identifier) barcode validation engine',
      'Direct LPT / COM / TCP Raw socket thermal printer communications',
      'Full Vector SVG and high-DPI raster image imports'
    ],
    downloadURL: '/api/software/download?target=win-x64&v=2.4.0',
    fileSize: '74.2 MB',
    releaseDate: '2026-07-15',
    status: 'active',
    channel: 'stable',
    systemRequirements: {
      os: 'Windows 10 / 11 (64-bit)',
      ram: '4 GB Minimum',
      disk: '200 MB free space',
      dotnet: '.NET Framework 4.8',
      architecture: 'x64'
    }
  },
  {
    version: '2.0.0',
    buildNumber: 20001,
    releaseName: 'BarcodeFlow Initial Desktop Engine',
    releaseNotes: [
      'Konva-powered real-time WYSIWYG canvas editor',
      'Multi-format barcode generator (Code 128, EAN-13, QR Code, Data Matrix)',
      'Basic approval workflows and print job queues'
    ],
    downloadURL: '/api/software/download?target=win-x64&v=2.0.0',
    fileSize: '68.0 MB',
    releaseDate: '2026-05-10',
    status: 'deprecated',
    channel: 'stable',
    systemRequirements: {
      os: 'Windows 10 / 11 (64-bit)',
      ram: '4 GB',
      disk: '200 MB',
      dotnet: '.NET Framework 4.8',
      architecture: 'x64'
    }
  }
];

// GET /api/software/latest-version
softwareRouter.get('/latest-version', (req: Request, res: Response) => {
  try {
    const releases = storage.read<SoftwareRelease>('software_releases', DEFAULT_RELEASES);
    const latest = releases.find((r) => r.status === 'active') || releases[0] || DEFAULT_RELEASES[0];
    res.json({
      success: true,
      data: latest,
      isLatest: true,
      updateAvailable: false
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/software/version-history
softwareRouter.get('/version-history', (req: Request, res: Response) => {
  try {
    const releases = storage.read<SoftwareRelease>('software_releases', DEFAULT_RELEASES);
    res.json({
      success: true,
      totalReleases: releases.length,
      data: releases
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/software/check-update
softwareRouter.post('/check-update', (req: Request, res: Response) => {
  try {
    const { clientVersion } = req.body;
    const releases = storage.read<SoftwareRelease>('software_releases', DEFAULT_RELEASES);
    const latest = releases[0] || DEFAULT_RELEASES[0];

    const hasUpdate = clientVersion && clientVersion !== latest.version;
    res.json({
      updateAvailable: hasUpdate,
      currentClientVersion: clientVersion || 'unknown',
      latestVersion: latest.version,
      releaseDetails: hasUpdate ? latest : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/software/download
softwareRouter.get('/download', (req: Request, res: Response) => {
  try {
    const target = (req.query.target as string) || 'win-x64';
    const version = (req.query.v as string) || '2.5.0';

    logBackendAudit(
      'System',
      'Operator',
      'DESKTOP_APP_DOWNLOAD',
      `User requested download for Desktop App v${version} (${target})`
    );

    // Check if an actual compiled exe/installer exists in dist-electron-build/ or dist/
    const possiblePaths = [
      path.join(process.cwd(), 'dist-electron-build', 'BarcodeFlow_Setup.exe'),
      path.join(process.cwd(), 'dist-electron-build', `BarcodeFlow-${version}-Setup.exe`),
      path.join(process.cwd(), 'dist-electron', 'BarcodeFlow_Setup.exe'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', `attachment; filename="BarcodeFlow_Setup_v${version}.exe"`);
        res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
        return res.sendFile(p);
      }
    }

    // If binary not pre-compiled on host, stream dynamic GitHub release / source package download
    const githubReleaseZip = 'https://github.com/Shivam55-bit/Barcode-automation/archive/refs/heads/main.zip';
    return res.redirect(githubReleaseZip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/software/upload-version
softwareRouter.post('/upload-version', (req: Request, res: Response) => {
  try {
    const { version, releaseName, releaseNotes, fileSize, channel } = req.body;
    if (!version || !releaseName) {
      return res.status(400).json({ error: 'version and releaseName are required' });
    }

    const releases = storage.read<SoftwareRelease>('software_releases', DEFAULT_RELEASES);
    const newRelease: SoftwareRelease = {
      version,
      buildNumber: Date.now(),
      releaseName,
      releaseNotes: Array.isArray(releaseNotes) ? releaseNotes : [releaseNotes],
      downloadURL: `/api/software/download?v=${version}`,
      fileSize: fileSize || '78 MB',
      releaseDate: new Date().toISOString().split('T')[0],
      status: 'active',
      channel: channel || 'stable',
      systemRequirements: {
        os: 'Windows 10 / 11 (64-bit)',
        ram: '4 GB Minimum',
        disk: '250 MB',
        dotnet: '.NET 4.8',
        architecture: 'x64'
      }
    };

    const updated = [newRelease, ...releases];
    storage.write('software_releases', updated);
    logBackendAudit(
      'Admin',
      'Administrator',
      'SOFTWARE_RELEASE_PUBLISHED',
      `Published Desktop App Version v${version} (${releaseName})`
    );

    res.status(201).json({
      success: true,
      message: `Version v${version} published successfully`,
      data: newRelease
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
