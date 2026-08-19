import { PrintJob, PrinterDefinition, LabelTemplate } from '../types';
import { generateZPL, generateTSPL, generateEPL } from './zplEngine';

export interface DispatchPrintJobRequest {
  template: LabelTemplate;
  printer: PrinterDefinition;
  copies: number;
  records: Record<string, string>[];
  format?: 'zpl' | 'tspl' | 'epl' | 'pdf' | 'escpos';
  submittedBy?: string;
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
    const { template, printer, copies, records, format = 'zpl', submittedBy = 'Print Operator' } = req;
    
    // Generate raw print stream according to printer protocol
    let rawCode = '';
    if (format === 'zpl') {
      rawCode = records.map(rec => generateZPL(template, rec)).join('\n');
    } else if (format === 'tspl') {
      rawCode = records.map(rec => generateTSPL(template, rec)).join('\n');
    } else if (format === 'epl') {
      rawCode = records.map(rec => generateEPL(template, rec)).join('\n');
    }

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
      progressPercent: 15,
      zplOutput: format === 'zpl' ? rawCode : undefined,
      rawOutput: rawCode,
    };

    this.jobs.unshift(newJob);
    this.notify();

    // Simulate progressive spooling completion
    let progress = 15;
    const interval = setInterval(() => {
      const job = this.jobs.find(j => j.id === newJob.id);
      if (!job || job.status === 'paused' || job.status === 'failed') {
        if (!job) clearInterval(interval);
        return;
      }

      progress += 25;
      if (progress >= 100) {
        job.progressPercent = 100;
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        clearInterval(interval);
      } else {
        job.progressPercent = progress;
      }
      this.notify();
    }, 800);

    return newJob;
  }

  public pauseJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job && job.status === 'printing') {
      job.status = 'paused';
      this.notify();
      return true;
    }
    return false;
  }

  public resumeJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job && job.status === 'paused') {
      job.status = 'printing';
      this.notify();
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
      return true;
    }
    return false;
  }

  public getJobs(): PrintJob[] {
    return [...this.jobs];
  }
}
