import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const batchJobsRouter = Router();
const storage = StorageService.getInstance();

// GET /api/batch-jobs
batchJobsRouter.get('/', (req: Request, res: Response) => {
  const batchJobs = storage.read<any>('batchJobs', []);
  res.json(batchJobs);
});

// POST /api/batch-jobs (Create 10-page serialized batch)
batchJobsRouter.post('/', (req: Request, res: Response) => {
  const batchJobs = storage.read<any>('batchJobs', []);
  const newBatch = req.body;

  if (!newBatch.id) {
    newBatch.id = `batch-${Date.now()}`;
  }
  newBatch.createdAt = newBatch.createdAt || new Date().toISOString();
  newBatch.status = newBatch.status || 'ready';

  batchJobs.unshift(newBatch);
  storage.write('batchJobs', batchJobs);

  logBackendAudit(
    newBatch.generatedBy || 'Operator',
    'Label Designer',
    'BATCH_GENERATE',
    `Generated serialized ${newBatch.totalPages || 10}-page barcode job ${newBatch.jobCode || newBatch.id} for template "${newBatch.templateName}"`,
    newBatch.id,
    newBatch.templateName
  );

  res.status(201).json(newBatch);
});

// PATCH /api/batch-jobs/:id/status
batchJobsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, printedBy, printerName } = req.body;
  const batchJobs = storage.read<any>('batchJobs', []);
  const batch = batchJobs.find((b) => b.id === req.params.id);

  if (!batch) {
    return res.status(404).json({ error: 'Batch job not found' });
  }

  batch.status = status;
  if (status === 'printed') {
    batch.printedAt = new Date().toLocaleString();
    batch.printedBy = printedBy || 'Print Operator';
  }

  storage.write('batchJobs', batchJobs);

  logBackendAudit(
    printedBy || 'Print Operator',
    'Print Operator',
    'PRINT_JOB_DISPATCH',
    `Marked batch job ${batch.jobCode || batch.id} as ${status.toUpperCase()} on printer "${printerName || 'Industrial Thermal'}"`,
    batch.id,
    batch.templateName
  );

  res.json(batch);
});
