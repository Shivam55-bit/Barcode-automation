import { UserProfile, AdminFeaturePermissions } from '../types';

export const ALL_PERMISSIONS_GRANTED: AdminFeaturePermissions = {
  canDesignTemplates: true,
  canCreateTemplates: true,
  canDeleteTemplates: true,
  canApproveWorkflow: true,
  canPrintAndSpool: true,
  canManageDatasets: true,
  canCalibratePrinters: true,
  canManageLicense: true,
  canDownloadDesktopApp: true,
  canViewAuditLogs: true,
};

export const DEFAULT_ADMIN_PERMISSIONS: AdminFeaturePermissions = {
  canDesignTemplates: true,
  canCreateTemplates: true,
  canDeleteTemplates: false,
  canApproveWorkflow: true,
  canPrintAndSpool: true,
  canManageDatasets: true,
  canCalibratePrinters: false,
  canManageLicense: false,
  canDownloadDesktopApp: true,
  canViewAuditLogs: true,
};

export interface FeatureDefinition {
  key: keyof AdminFeaturePermissions;
  title: string;
  category: 'Studio' | 'Printing' | 'Data & Settings' | 'Governance';
  description: string;
  iconName: string;
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: 'canDesignTemplates',
    title: 'Template Studio & Canvas Designer',
    category: 'Studio',
    description: 'Access visual WYSIWYG barcode canvas, element toolbox, and geometry transformations.',
    iconName: 'PenTool',
  },
  {
    key: 'canCreateTemplates',
    title: 'Create & Duplicate Templates',
    category: 'Studio',
    description: 'Create new label designs, duplicate existing templates, and import JSON template files.',
    iconName: 'Plus',
  },
  {
    key: 'canDeleteTemplates',
    title: 'Delete Templates',
    category: 'Studio',
    description: 'Permanently remove label templates from the enterprise catalog.',
    iconName: 'Trash2',
  },
  {
    key: 'canApproveWorkflow',
    title: '21 CFR Part 11 Approval Workflow',
    category: 'Governance',
    description: 'Submit, review, e-sign, approve, and reject label versions with audit annotations.',
    iconName: 'ShieldCheck',
  },
  {
    key: 'canPrintAndSpool',
    title: 'Print Center & Batch Thermal Spooler',
    category: 'Printing',
    description: 'Dispatch ZPL batch print jobs, monitor printer queues, and re-spool failed jobs.',
    iconName: 'Printer',
  },
  {
    key: 'canManageDatasets',
    title: 'Excel / CSV Dataset Manager',
    category: 'Data & Settings',
    description: 'Upload Excel (.xlsx/.xls) spreadsheets, parse schemas, and bind serial numbers.',
    iconName: 'FileSpreadsheet',
  },
  {
    key: 'canCalibratePrinters',
    title: 'Thermal Printer Calibration Wizard',
    category: 'Printing',
    description: 'Adjust thermal printhead heat/darkness (1-30), DPI (203/300/600), and speed.',
    iconName: 'Sliders',
  },
  {
    key: 'canManageLicense',
    title: 'Hardware Machine GUID & Licensing',
    category: 'Governance',
    description: 'View cryptographic Machine GUID, activate product keys, and air-gapped activation.',
    iconName: 'KeyRound',
  },
  {
    key: 'canDownloadDesktopApp',
    title: 'Desktop Software .exe Installer',
    category: 'Data & Settings',
    description: 'Download native Windows executable setup for offline industrial cleanroom deployment.',
    iconName: 'Laptop',
  },
  {
    key: 'canViewAuditLogs',
    title: '21 CFR Part 11 Audit Trail Logs',
    category: 'Governance',
    description: 'Inspect tamper-evident system logs, user action timestamps, and differential state payloads.',
    iconName: 'FileText',
  },
];

/**
 * Checks if a given user profile has permission for a specific feature.
 * Super Admin always has full unrestricted access.
 */
export function hasFeaturePermission(
  user: UserProfile | null | undefined,
  permission: keyof AdminFeaturePermissions
): boolean {
  if (!user) return false;

  // Super Admin has master unrestricted permission
  if (
    user.role === 'Super Admin' ||
    user.email?.toLowerCase() === 'superadmin@gmail.com'
  ) {
    return true;
  }

  // If user has specific permissions object configured
  if (user.permissions && typeof user.permissions[permission] === 'boolean') {
    return user.permissions[permission];
  }

  // Default fallback for legacy admin roles
  if (user.role === 'Admin') {
    return DEFAULT_ADMIN_PERMISSIONS[permission] ?? true;
  }

  // Role-specific defaults
  if (user.role === 'Designer') {
    return ['canDesignTemplates', 'canCreateTemplates', 'canDownloadDesktopApp'].includes(permission);
  }

  if (user.role === 'Approver Level 1' || user.role === 'Approver Level 2') {
    return ['canApproveWorkflow', 'canViewAuditLogs'].includes(permission);
  }

  if (user.role === 'Viewer / Print Operator') {
    return ['canPrintAndSpool'].includes(permission);
  }

  return false;
}
