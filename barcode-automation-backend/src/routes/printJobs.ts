import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';
import { generateZPL, generateTSPL, generateEPL } from '../../../src/services/zplEngine';

export const printJobsRouter = Router();
const storage = StorageService.getInstance();

// GET /api/print-jobs
printJobsRouter.get('/', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  res.json(jobs);
});

// POST /api/print-jobs (Dispatch Print Job)
printJobsRouter.post('/', (req: Request, res: Response) => {
  const { templateId, printerId, copies = 1, records = [{}], format = 'zpl', submittedBy, template: providedTemplate } = req.body;
  const templates = storage.read<any>('templates', []);
  const printers = storage.read<any>('printers', []);

  const template = providedTemplate || templates.find((t) => t.id === templateId) || templates[0];
  const printer = printers.find((p) => p.id === printerId) || printers[0];

  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  let rawOutput = '';
  try {
    if (format === 'zpl') rawOutput = generateZPL(template, records[0] || {});
    else if (format === 'tspl') rawOutput = generateTSPL(template, records[0] || {});
    else if (format === 'epl') rawOutput = generateEPL(template, records[0] || {});
  } catch (err) {
    console.error('Error generating raw printer output:', err);
  }

  const printJobs = storage.read<any>('printJobs', []);

  const newJob: any = {
    id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
    templateId: template.id,
    templateName: template.name,
    printerId: printer?.id || 'p-default',
    printerName: printer?.name || 'Default Industrial Printer',
    copies: Number(copies),
    recordCount: records.length,
    status: 'printing',
    format,
    submittedBy: submittedBy || 'David Chen (Print Operator)',
    submittedAt: new Date().toISOString(),
    progressPercent: 15,
    zplOutput: format === 'zpl' ? rawOutput : undefined,
    rawOutput,
  };

  printJobs.unshift(newJob);
  storage.write('printJobs', printJobs);

  logBackendAudit(
    newJob.submittedBy,
    'Print Operator',
    'PRINT_JOB_DISPATCH',
    `Dispatched print job #${newJob.id} (${copies} copies, ${records.length} records) to ${newJob.printerName} via ${format.toUpperCase()}`,
    newJob.id,
    template.name
  );

  // Auto-complete simulation in background
  setTimeout(() => {
    const currentJobs = storage.read<any>('printJobs', []);
    const target = currentJobs.find((j) => j.id === newJob.id);
    if (target && target.status === 'printing') {
      target.progressPercent = 100;
      target.status = 'completed';
      target.completedAt = new Date().toISOString();
      storage.write('printJobs', currentJobs);
    }
  }, 3500);

  res.status(201).json(newJob);
});

// POST /api/print-jobs/:id/pause
printJobsRouter.post('/:id/pause', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = 'paused';
    storage.write('printJobs', jobs);
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: 'Print job not found' });
});

// POST /api/print-jobs/:id/resume
printJobsRouter.post('/:id/resume', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = 'printing';
    storage.write('printJobs', jobs);
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: 'Print job not found' });
});

// POST /api/print-jobs/:id/cancel
printJobsRouter.post('/:id/cancel', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = 'failed';
    job.errorMessage = 'Cancelled by operator';
    storage.write('printJobs', jobs);
    logBackendAudit(
      'Operator',
      'Print Operator',
      'PRINT_JOB_CANCEL',
      `Cancelled print job #${job.id}`,
      job.id
    );
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: 'Print job not found' });
});
