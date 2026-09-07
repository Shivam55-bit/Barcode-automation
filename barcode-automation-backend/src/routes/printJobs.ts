import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';
import { NetworkPrintService } from '../services/networkPrintService';
import { generatePrintStream } from '../../../src/services/printerAdapters';

export const printJobsRouter = Router();
const storage = StorageService.getInstance();
const printService = NetworkPrintService.getInstance();

// GET /api/print-jobs
printJobsRouter.get('/', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  res.json(jobs);
});

// GET /api/print-history
printJobsRouter.get('/history', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  res.json(jobs);
});

// GET /api/print-jobs/:id
printJobsRouter.get('/:id', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const job = jobs.find((j: any) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Print job not found' });
  res.json(job);
});

// POST /api/print-jobs (Dispatch Print Job to Real Hardware / Spooler with Idempotency)
printJobsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      clientRequestId,
      templateId,
      printerId,
      copies = 1,
      records = [{}],
      format = 'zpl',
      submittedBy,
      template: providedTemplate,
      darkness,
      speed,
    } = req.body;

    const printJobs = storage.read<any>('printJobs', []);

    // Idempotency check (prevent duplicate prints from network retries)
    if (clientRequestId) {
      const existing = printJobs.find((j: any) => j.clientRequestId === clientRequestId);
      if (existing) {
        return res.json(existing);
      }
    }

    const templates = storage.read<any>('templates', []);
    const printers = storage.read<any>('printers', []);

    const template = providedTemplate || templates.find((t: any) => t.id === templateId) || templates[0];
    const printer = printers.find((p: any) => p.id === printerId) || printers[0];

    if (!template) {
      return res.status(400).json({ error: 'Template not found' });
    }

    // Generate real protocol instructions using polymorphic PrinterAdapters
    let rawOutput: string | Uint8Array = '';
    try {
      rawOutput = generatePrintStream(format, template, records, {
        copies: Number(copies),
        darkness: darkness !== undefined ? Number(darkness) : printer?.darkness,
        speed: speed !== undefined ? Number(speed) : printer?.speed,
        dpi: printer?.dpi || template.dimensions?.dpi || 203,
      });
    } catch (err: any) {
      console.error('[PrintJobsRouter] Error generating raw stream:', err);
      rawOutput = `/* Error generating ${format} stream: ${err.message} */`;
    }

    const rawString = typeof rawOutput === 'string' ? rawOutput : Buffer.from(rawOutput).toString('binary');

    const newJob: any = {
      id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
      clientRequestId,
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
      progressPercent: 20,
      zplOutput: format === 'zpl' ? rawString : undefined,
      rawOutput: rawString,
      dataSnapshot: records.map((r: any) => ({ ...r })),
    };

    printJobs.unshift(newJob);
    storage.write('printJobs', printJobs);

    // Dispatch to real hardware over TCP socket or OS print spooler
    const transmitResult = await printService.dispatchJob(printer || {}, rawString);

    // Update job record with real hardware transmission result
    const currentJobs = storage.read<any>('printJobs', []);
    const target = currentJobs.find((j: any) => j.id === newJob.id);

    if (target) {
      if (transmitResult.success) {
        target.status = 'completed';
        target.progressPercent = 100;
        target.completedAt = new Date().toISOString();
        target.bytesWritten = transmitResult.bytesWritten;
      } else {
        target.status = 'failed';
        target.progressPercent = 0;
        target.errorMessage = transmitResult.error || transmitResult.message;
      }
      storage.write('printJobs', currentJobs);
    }

    logBackendAudit(
      newJob.submittedBy,
      'Print Operator',
      'PRINT_JOB_DISPATCH',
      `${transmitResult.success ? 'Successfully transmitted' : 'Failed transmitting'} print job #${newJob.id} (${copies} copies, ${records.length} records) to ${newJob.printerName} via ${format.toUpperCase()}: ${transmitResult.message}`,
      newJob.id,
      template.name
    );

    res.status(201).json(target || newJob);
  } catch (err: any) {
    console.error('[PrintJobsRouter] Dispatch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/print-jobs/:id/pause
printJobsRouter.post('/:id/pause', (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const job = jobs.find((j: any) => j.id === req.params.id);
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
  const job = jobs.find((j: any) => j.id === req.params.id);
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
  const job = jobs.find((j: any) => j.id === req.params.id);
  if (job) {
    job.status = 'failed';
    job.errorMessage = 'Cancelled by operator';
    storage.write('printJobs', jobs);
    logBackendAudit(
      'Operator',
      'Print Operator',
      'PRINT_JOB_CANCEL',
      `Cancelled print job #${job.id}`,
      job.id,
      job.templateName
    );
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: 'Print job not found' });
});

// POST /api/print-jobs/:id/reprint
printJobsRouter.post('/:id/reprint', async (req: Request, res: Response) => {
  const jobs = storage.read<any>('printJobs', []);
  const originalJob = jobs.find((j: any) => j.id === req.params.id);
  if (!originalJob) return res.status(404).json({ error: 'Print job not found' });

  const templates = storage.read<any>('templates', []);
  const printers = storage.read<any>('printers', []);

  const template = templates.find((t: any) => t.id === originalJob.templateId) || {
    id: originalJob.templateId,
    name: originalJob.templateName,
    dimensions: { width: 100, height: 50, dpi: 203, orientation: 'landscape', unit: 'mm' },
    elements: [],
  };

  const printer = printers.find((p: any) => p.id === originalJob.printerId) || printers[0];
  const reprintRecords = (originalJob.dataSnapshot && originalJob.dataSnapshot.length > 0)
    ? originalJob.dataSnapshot
    : [{ SERIAL: 'REPRINT-DATA' }];

  const reprintJob: any = {
    id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
    templateId: originalJob.templateId,
    templateName: originalJob.templateName,
    printerId: originalJob.printerId,
    printerName: originalJob.printerName,
    copies: originalJob.copies || 1,
    recordCount: reprintRecords.length,
    status: 'printing',
    format: originalJob.format,
    submittedBy: `${originalJob.submittedBy || 'Operator'} (Reprint)`,
    submittedAt: new Date().toISOString(),
    progressPercent: 30,
    rawOutput: originalJob.rawOutput,
    dataSnapshot: reprintRecords,
    isReprint: true,
    reprintOriginalJobId: originalJob.id,
  };

  jobs.unshift(reprintJob);
  storage.write('printJobs', jobs);

  if (printer) {
    printService.dispatchJob(printer, originalJob.rawOutput || '').then((res) => {
      const current = storage.read<any>('printJobs', []);
      const match = current.find((j: any) => j.id === reprintJob.id);
      if (match) {
        match.status = res.success ? 'completed' : 'failed';
        match.progressPercent = 100;
        match.completedAt = new Date().toISOString();
        storage.write('printJobs', current);
      }
    });
  }

  res.status(201).json(reprintJob);
});
