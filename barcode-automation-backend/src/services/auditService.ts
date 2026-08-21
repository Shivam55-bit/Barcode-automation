import { StorageService } from './storageService';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  details: string;
  entityId?: string;
  entityName?: string;
  ipAddress?: string;
}

export function logBackendAudit(
  user: string,
  userRole: string,
  action: string,
  details: string,
  entityId?: string,
  entityName?: string,
  ipAddress: string = '127.0.0.1'
): AuditLogItem {
  const storage = StorageService.getInstance();
  const logs = storage.read<AuditLogItem>('auditLogs', []);
  const entry: AuditLogItem = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    user: user || 'System User',
    userRole: userRole || 'Operator',
    action,
    details,
    entityId,
    entityName,
    ipAddress,
  };
  logs.unshift(entry);
  storage.write('auditLogs', logs);
  return entry;
}

export class AuditService {
  private static instance: AuditService;

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public log(action: string, details: string, user: string = 'System Admin', userRole: string = 'Admin'): AuditLogItem {
    return logBackendAudit(user, userRole, action, details);
  }
}
