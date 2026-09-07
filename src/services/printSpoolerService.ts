import { PrintJob, PrinterDefinition, LabelTemplate } from '../types';
import { generatePrintStream } from './printerAdapters';
import { apiService } from './apiService';

export interface DispatchPrintJobRequest {
  template: LabelTemplate;
  printer: PrinterDefinition;
  copies: number;
  records: Record<string, string>[];
  format?: 'zpl' | 'tspl' | 'epl' | 'cpcl' | 'sbpl' | 'pdf' | 'escpos';
  submittedBy?: string;
  darkness?: number;
  speed?: number;
}

export class EnterprisePrintSpooler {
  private static instance: EnterprisePrintSpooler;
  private jobs: PrintJob[] = [];
  private listeners: Array<(jobs: PrintJob[]) => void> = [];

  public static getInstance(): EnterprisePrintSpooler {
    if (!EnterprisePrintSpooler.instance) {
      EnterprisePrintSpooler.instance = new EnterprisePrintSpooler();
    }
    return EnterprisePrintSpooler.instance;
  }

  public subscribe(listener: (jobs: PrintJob[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.jobs]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.jobs]));
  }

  public dispatchJob(req: DispatchPrintJobRequest): PrintJob {
    const {
      template,
      printer,
      copies,
      records,
      format = (printer.protocol as any) || 'zpl',
      submittedBy = 'Print Operator',
      darkness,
      speed,
    } = req;

    // Generate real raw stream using polymorphic PrinterAdapters
    const streamOutput = generatePrintStream(format, template, records, {
      copies: Number(copies),
      dpi: printer.dpi || template.dimensions.dpi || 203,
      darkness: darkness !== undefined ? darkness : printer.darkness,
      speed: speed !== undefined ? speed : printer.speed,
    });

    const rawCode = typeof streamOutput === 'string'
      ? streamOutput
      : new TextDecoder().decode(streamOutput);

    const newJob: PrintJob = {
      id: `PJ-${Math.floor(10000 + Math.random() * 90000)}`,
      templateId: template.id,
      templateName: template.name,
      printerId: printer.id,
      printerName: printer.name,
      copies: Number(copies),
      recordCount: records.length,
      status: 'printing',
      format,
      submittedBy,
      submittedAt: new Date().toISOString(),
      progressPercent: 30,
      zplOutput: format === 'zpl' ? rawCode : undefined,
      rawOutput: rawCode,
      dataSnapshot: records.map((r) => ({ ...r })),
      totalLabelsPrinted: Number(copies) * records.length,
      datasetName: template.databaseConnection?.name,
      excelFilePath: template.databaseConnection?.filePath,
      excelSheetName: template.databaseConnection?.sheetName,
    };

    this.jobs.unshift(newJob);
    this.notify();

    // Dispatch to real backend network/spooler service
    apiService.printJobs
      .dispatch({
        templateId: template.id,
        printerId: printer.id,
        copies: Number(copies),
        records,
        format: format as any,
        submittedBy,
        template,
      })
      .then((serverJob) => {
        const target = this.jobs.find(j => j.id === newJob.id);
        if (target) {
          target.status = serverJob.status;
          target.progressPercent = serverJob.progressPercent || 100;
          target.completedAt = serverJob.completedAt || new Date().toISOString();
          target.errorMessage = serverJob.errorMessage;
          this.notify();
        }
      })
      .catch((err) => {
        const target = this.jobs.find(j => j.id === newJob.id);
        if (target) {
          // If network backend is offline, check if printer is local or virtual
          if (printer.brand === 'Desktop PDF') {
            target.status = 'completed';
            target.progressPercent = 100;
            target.completedAt = new Date().toISOString();
          } else {
            target.status = 'failed';
            target.progressPercent = 0;
            target.errorMessage = `Transmission failed: ${err.message || 'Printer service offline'}`;
          }
          this.notify();
        }
      });

    return newJob;
  }

  public pauseJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job && job.status === 'printing') {
      job.status = 'paused';
      this.notify();
      apiService.printJobs.pause(jobId).catch(() => {});
      return true;
    }
    return false;
  }

  public resumeJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job && job.status === 'paused') {
      job.status = 'printing';
      this.notify();
      apiService.printJobs.resume(jobId).catch(() => {});
      return true;
    }
    return false;
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job && (job.status === 'queued' || job.status === 'printing' || job.status === 'paused')) {
      job.status = 'failed';
      job.errorMessage = 'Canceled by user';
      this.notify();
      apiService.printJobs.cancel(jobId).catch(() => {});
      return true;
    }
    return false;
  }

  public reprintJob(
    jobId: string,
    printers: PrinterDefinition[],
    templates: LabelTemplate[],
    mode: 'original_snapshot' | 'current_data' = 'original_snapshot'
  ): PrintJob | null {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return null;

    const printer = printers.find((p) => p.id === job.printerId) || printers[0];
    const template = templates.find((t) => t.id === job.templateId) || {
      id: job.templateId,
      name: job.templateName,
      dimensions: { width: 100, height: 150, dpi: 203, orientation: 'portrait', unit: 'mm' },
      elements: [],
      tags: [],
    } as LabelTemplate;

    let records: Record<string, any>[] = [];
    if (mode === 'current_data') {
      if (template.databaseConnection?.records && template.databaseConnection.records.length > 0) {
        records = template.databaseConnection.records;
      } else if (template.sampleRecords && template.sampleRecords.length > 0) {
        records = template.sampleRecords;
      } else if (job.dataSnapshot && job.dataSnapshot.length > 0) {
        records = job.dataSnapshot;
      } else {
        records = [{ CODE_VAL: 'REPRINT-DEFAULT' }];
      }
    } else {
      records = (job.dataSnapshot && job.dataSnapshot.length > 0)
        ? job.dataSnapshot
        : (template.sampleRecords && template.sampleRecords.length > 0)
        ? template.sampleRecords
        : [{ CODE_VAL: 'REPRINT-DEFAULT' }];
    }

    return this.dispatchJob({
      template,
      printer,
      copies: job.copies || 1,
      records: records as any,
      format: job.format as any,
      submittedBy: `${job.submittedBy || 'Operator'} (Reprint: ${mode === 'current_data' ? 'Live Data' : 'Snapshot'})`,
    });
  }

  public getJobs(): PrintJob[] {
    return [...this.jobs];
  }
}
