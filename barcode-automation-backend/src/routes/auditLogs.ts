import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit, verifyAuditTrailIntegrity } from '../services/auditService';

export const auditLogsRouter = Router();
const storage = StorageService.getInstance();

// GET /api/audit-logs/verify - Cryptographic SHA-256 chain verification (21 CFR Part 11)
auditLogsRouter.get('/verify', (req: Request, res: Response) => {
  const result = verifyAuditTrailIntegrity();
  res.json(result);
});

// GET /api/audit-logs
auditLogsRouter.get('/', (req: Request, res: Response) => {
  const logs = storage.read<any>('auditLogs', []);
  res.json(logs);
});

// POST /api/audit-logs
auditLogsRouter.post('/', (req: Request, res: Response) => {
  const { user, userRole, action, details, entityId, entityName } = req.body;
  const entry = logBackendAudit(
    user,
    userRole,
    action,
    details,
    entityId,
    entityName,
    req.ip || '127.0.0.1'
  );
  res.status(201).json(entry);
});

// GET /api/audit-logs/export
auditLogsRouter.get('/export', (req: Request, res: Response) => {
  const logs = storage.read<any>('auditLogs', []);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.json`);
  res.json(logs);
});
