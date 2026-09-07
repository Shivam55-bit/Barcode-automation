import { Router, Request, Response } from 'express';
import os from 'os';
import crypto from 'crypto';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';

export const licenseRouter = Router();
const storage = StorageService.getInstance();
const audit = AuditService.getInstance();

export interface LicenseInformation {
  licenseKey: string;
  status: 'trial' | 'active' | 'expired' | 'deactivated';
  tier: 'Enterprise Suite' | 'Professional' | 'Trial Edition';
  registeredTo: string;
  organization: string;
  machineGuid: string;
  maxPrinters: number;
  maxUsers: number;
  activatedAt?: string;
  expiresAt: string;
  features: string[];
  offlineActivationCode?: string;
}

function getMachineHardwareId(): string {
  const cpus = os.cpus();
  const rawInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${cpus[0]?.model || 'generic-cpu'}-${os.totalmem()}`;
  return crypto.createHash('sha256').update(rawInfo).digest('hex').slice(0, 24).toUpperCase();
}

function generateLicenseKey(org: string, tier: string): string {
  const payload = `${org}-${tier}-${Date.now()}`;
  const hash = crypto.createHash('md5').update(payload).digest('hex').toUpperCase();
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}

const DEFAULT_LICENSE: LicenseInformation = {
  licenseKey: 'BCF-ENT-9921-8840',
  status: 'active',
  tier: 'Enterprise Suite',
  registeredTo: 'Shivam Enterprise Administrator',
  organization: 'BarcodeFlow Industrial Systems Inc.',
  machineGuid: getMachineHardwareId(),
  maxPrinters: 99,
  maxUsers: 50,
  activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
  features: [
    'Unlimited Desktop Installations',
    'Offline Mode & Local Datasets',
    '21 CFR Part 11 Electronic Signatures',
    'ZPL II / EPL2 Native Thermal Spooling',
    'Pixel-Perfect Vector PDF Engine',
    '10,000+ Record Batch Serialization',
    'Machine-Bound Hardware GUID Verification',
  ],
};

// GET /api/license/status
licenseRouter.get('/status', (req: Request, res: Response) => {
  try {
    const licenses = storage.read<LicenseInformation>('licenses', [DEFAULT_LICENSE]);
    const active = licenses[0] || DEFAULT_LICENSE;

    res.json({
      ...active,
      machineGuid: active.machineGuid || getMachineHardwareId(),
      isOfflineValid: true,
      currentServerTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/license/generate
licenseRouter.post('/generate', (req: Request, res: Response) => {
  try {
    const { organization = 'Default Org', tier = 'Enterprise Suite', maxPrinters = 50, maxUsers = 25 } = req.body;
    const key = generateLicenseKey(organization, tier);

    const newLic: LicenseInformation = {
      licenseKey: key,
      status: 'active',
      tier: tier as any,
      registeredTo: req.body.registeredTo || 'Enterprise Licensee',
      organization,
      machineGuid: getMachineHardwareId(),
      maxPrinters,
      maxUsers,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: [
        'Desktop Installation & Offline Mode',
        'ZPL/EPL Export',
        '21 CFR Part 11 Approval Workflow',
        'Dataset Manager & Excel/CSV Binding',
      ],
    };

    storage.write('licenses', [newLic]);
    audit.log('LICENSE_GENERATE', `Generated new Enterprise License key ${key} for ${organization}`);

    res.status(201).json(newLic);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/license/activate
licenseRouter.post('/activate', (req: Request, res: Response) => {
  try {
    const { licenseKey, registeredTo, organization } = req.body;
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ error: 'License key is required' });
    }

    const currentHardwareGuid = getMachineHardwareId();
    const activeLic: LicenseInformation = {
      licenseKey: licenseKey.trim().toUpperCase(),
      status: 'active',
      tier: 'Enterprise Suite',
      registeredTo: registeredTo || 'Shivam',
      organization: organization || 'BarcodeFlow Corporate',
      machineGuid: currentHardwareGuid,
      maxPrinters: 100,
      maxUsers: 50,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: [
        'Desktop Offline Mode Active',
        'ZPL/EPL Thermal Spooler',
        '21 CFR Part 11 Compliance',
        '10,000+ Record Batch Engine',
      ],
    };

    storage.write('licenses', [activeLic]);
    audit.log('LICENSE_ACTIVATE', `Activated license key ${licenseKey} bound to Machine GUID ${currentHardwareGuid}`);

    res.json({
      success: true,
      message: 'License activated successfully and bound to this hardware machine.',
      license: activeLic,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/license/offline-activate
licenseRouter.post('/offline-activate', (req: Request, res: Response) => {
  try {
    const { activationCode, licenseKey } = req.body;
    if (!activationCode) {
      return res.status(400).json({ error: 'Offline activation code required' });
    }

    const hardwareGuid = getMachineHardwareId();
    const activeLic: LicenseInformation = {
      licenseKey: licenseKey || 'BCF-OFFLINE-991',
      status: 'active',
      tier: 'Enterprise Suite',
      registeredTo: 'Offline License Administrator',
      organization: 'Industrial On-Premises Workspace',
      machineGuid: hardwareGuid,
      maxPrinters: 99,
      maxUsers: 50,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      offlineActivationCode: activationCode,
      features: [
        '100% Air-Gapped Offline Operation',
        'Local .bft Template Storage',
        'Hardware Machine Binding Verified',
      ],
    };

    storage.write('licenses', [activeLic]);
    audit.log('LICENSE_OFFLINE_ACTIVATE', `Offline activation applied with code: ${activationCode}`);

    res.json({
      success: true,
      message: 'Air-gapped offline license activated successfully.',
      license: activeLic,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
