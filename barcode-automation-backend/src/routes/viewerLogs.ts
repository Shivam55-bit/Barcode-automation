import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const viewerLogsRouter = Router();
const storage = StorageService.getInstance();

// GET /api/viewer/logs
viewerLogsRouter.get('/', (req: Request, res: Response) => {
  const { templateId, jobId } = req.query;
  let logs = storage.read<any>('viewerLogs', []);

  if (templateId) {
    logs = logs.filter((l) => l.templateId === templateId);
  }
  if (jobId) {
    logs = logs.filter((l) => l.jobId === jobId);
  }

  res.json(logs);
});

// POST /api/viewer/log
viewerLogsRouter.post('/', (req: Request, res: Response) => {
  const logs = storage.read<any>('viewerLogs', []);
  const entry = {
    id: `vlog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...req.body,
  };

  logs.unshift(entry);
  if (logs.length > 500) logs.pop();
  storage.write('viewerLogs', logs);

  const actionMap: Record<string, string> = {
    VIEW: 'VIEW_TEMPLATE',
    DOWNLOAD_PDF: 'DOWNLOAD_PDF',
    DOWNLOAD_PNG: 'DOWNLOAD_PNG',
    PRINT_DISPATCH: 'PRINT_JOB_DISPATCH',
  };

  logBackendAudit(
    entry.userName || 'Viewer / Print Operator',
    entry.userRole || 'Viewer / Print Operator',
    (actionMap[entry.action] as any) || 'VIEW_TEMPLATE',
    `Viewer station action: ${entry.action} for template "${entry.templateId}" (${entry.details || 'N/A'})`,
    entry.templateId,
    entry.templateVersion
  );

  res.status(201).json(entry);
});
