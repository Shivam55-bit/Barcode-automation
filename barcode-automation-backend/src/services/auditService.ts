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
