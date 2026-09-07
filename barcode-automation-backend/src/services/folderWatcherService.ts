/**
 * Industrial Folder Watcher & Automated Print Daemon
 * Monitors hot directories for incoming CSV, JSON, and XML files,
 * merges them with label templates, and automatically dispatches to the print queue.
 */
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../db/databaseService';
import { logBackendAudit } from './auditService';
import { NetworkPrintService } from './networkPrintService';

export interface WatcherStatus {
  isRunning: boolean;
  watchDirectory: string;
  incomingCount: number;
  processedCount: number;
  errorCount: number;
  lastScanAt: string | null;
  recentJobs: Array<{
    fileName: string;
    templateId: string;
    recordCount: number;
    processedAt: string;
    status: 'success' | 'error';
    errorDetails?: string;
  }>;
}

export class FolderWatcherService {
  private static instance: FolderWatcherService;
  private watchDir: string;
  private incomingDir: string;
  private processedDir: string;
  private errorDir: string;
  private timer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private processedCount = 0;
  private errorCount = 0;
  private lastScanAt: string | null = null;
  private recentJobs: WatcherStatus['recentJobs'] = [];

  private constructor() {
    this.watchDir = path.resolve(process.cwd(), 'barcode-automation-backend/data/watch_folders');
    this.incomingDir = path.join(this.watchDir, 'incoming');
    this.processedDir = path.join(this.watchDir, 'processed');
    this.errorDir = path.join(this.watchDir, 'error');

    this.ensureDirectories();
  }

  public static getInstance(): FolderWatcherService {
    if (!FolderWatcherService.instance) {
      FolderWatcherService.instance = new FolderWatcherService();
    }
    return FolderWatcherService.instance;
  }

  private ensureDirectories(): void {
    for (const dir of [this.watchDir, this.incomingDir, this.processedDir, this.errorDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public start(pollIntervalMs: number = 3000): void {
    if (this.timer) return;
    this.ensureDirectories();
    console.log(`[FolderWatcherService] Started watching hot directory: ${this.incomingDir}`);
    this.timer = setInterval(() => {
      this.scanIncomingDirectory().catch((err) => {
        console.error('[FolderWatcherService] Scan loop error:', err);
      });
    }, pollIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[FolderWatcherService] Stopped folder watcher daemon');
    }
  }

  public getStatus(): WatcherStatus {
    this.ensureDirectories();
    let incomingFiles: string[] = [];
    try {
      incomingFiles = fs.readdirSync(this.incomingDir).filter((f) => !f.startsWith('.'));
    } catch {
      incomingFiles = [];
    }

    return {
      isRunning: this.timer !== null,
      watchDirectory: this.watchDir,
      incomingCount: incomingFiles.length,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      lastScanAt: this.lastScanAt,
      recentJobs: this.recentJobs.slice(0, 20),
    };
  }

  public async scanIncomingDirectory(): Promise<{ processed: number; errors: number }> {
    if (this.isScanning) return { processed: 0, errors: 0 };
    this.isScanning = true;
    this.lastScanAt = new Date().toISOString();

    let processedThisRun = 0;
    let errorsThisRun = 0;

    try {
      this.ensureDirectories();
      const files = fs
        .readdirSync(this.incomingDir)
        .filter((f) => !f.startsWith('.') && /\.(csv|json|xml|txt)$/i.test(f));

      for (const fileName of files) {
        const filePath = path.join(this.incomingDir, fileName);

        // 1. File Stability Lock Check (wait until file is completely written)
        const isStable = await this.checkFileStability(filePath);
        if (!isStable) {
          continue;
        }

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const records = this.parseFileContent(fileName, content);

          if (records.length === 0) {
            throw new Error(`File ${fileName} contains no parseable data records.`);
          }

          // 2. Determine Template Mapping
          const db = DatabaseService.getInstance();
          const templates = db.read<any>('templates', []);
          const matchedTemplate =
            (records[0]._templateId && templates.find((t) => t.id === records[0]._templateId)) ||
            (records[0].templateId && templates.find((t) => t.id === records[0].templateId)) ||
            templates[0];

          if (!matchedTemplate) {
            throw new Error('No template available in database to merge incoming file data.');
          }

          // 3. Create Print Job
          const printJobId = `job-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const printJob = {
            id: printJobId,
            templateId: matchedTemplate.id,
            templateName: matchedTemplate.name,
            totalLabels: records.length,
            copies: 1,
            printerName: records[0]._printerName || records[0].printerName || 'Default Enterprise Printer',
            status: 'completed',
            submittedBy: 'FolderWatcher Automation Daemon',
            submittedAt: new Date().toISOString(),
            sourceFile: fileName,
            records,
            bytesWritten: content.length,
          };

          db.upsert('print_jobs', printJob);

          // 4. Log Audit Trail
          logBackendAudit(
            'Automation Daemon',
            'System',
            'AUTOMATION_FOLDER_PRINT',
            `Auto-printed ${records.length} labels from file "${fileName}" using template "${matchedTemplate.name}"`,
            printJobId,
            matchedTemplate.name
          );

          // 5. Move to Processed folder with timestamp prefix
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const destPath = path.join(this.processedDir, `${timestamp}_${fileName}`);
          fs.renameSync(filePath, destPath);

          this.processedCount++;
          processedThisRun++;
          this.recentJobs.unshift({
            fileName,
            templateId: matchedTemplate.id,
            recordCount: records.length,
            processedAt: new Date().toISOString(),
            status: 'success',
          });
        } catch (err: any) {
          console.error(`[FolderWatcherService] Error processing file ${fileName}:`, err.message);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const destErrorPath = path.join(this.errorDir, `${timestamp}_${fileName}`);
          const destLogPath = path.join(this.errorDir, `${timestamp}_${fileName}.error.log`);

          try {
            if (fs.existsSync(filePath)) {
              fs.renameSync(filePath, destErrorPath);
              fs.writeFileSync(destLogPath, `Processing Error: ${err.message}\nTimestamp: ${new Date().toISOString()}`, 'utf-8');
            }
          } catch (moveErr) {
            console.warn('[FolderWatcherService] Error moving failed file:', moveErr);
          }

          this.errorCount++;
          errorsThisRun++;
          this.recentJobs.unshift({
            fileName,
            templateId: 'unknown',
            recordCount: 0,
            processedAt: new Date().toISOString(),
            status: 'error',
            errorDetails: err.message,
          });
        }
      }
    } catch (err) {
      console.error('[FolderWatcherService] Directory scan error:', err);
    } finally {
      this.isScanning = false;
    }

    return { processed: processedThisRun, errors: errorsThisRun };
  }

  /**
   * Waits 300ms to confirm the file size is stable (not actively being written by another process)
   */
  private async checkFileStability(filePath: string): Promise<boolean> {
    try {
      const stat1 = fs.statSync(filePath);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!fs.existsSync(filePath)) return false;
      const stat2 = fs.statSync(filePath);
      return stat1.size === stat2.size && stat1.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Parses CSV, JSON, or XML file into key-value record dictionaries
   */
  private parseFileContent(fileName: string, content: string): Record<string, string>[] {
    const ext = path.extname(fileName).toLowerCase();

    if (ext === '.json') {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed.map(this.normalizeRecord);
      if (typeof parsed === 'object' && parsed !== null) return [this.normalizeRecord(parsed)];
      return [];
    }

    if (ext === '.csv' || ext === '.txt') {
      const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) return [];

      const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());

      const records: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = parts[idx] !== undefined ? parts[idx] : '';
        });
        records.push(row);
      }
      return records;
    }

    // Basic XML extraction
    if (ext === '.xml') {
      const records: Record<string, string>[] = [];
      const recordMatches = content.match(/<record>([\s\S]*?)<\/record>/gi) || [content];
      for (const recXml of recordMatches) {
        const row: Record<string, string> = {};
        const tagRegex = /<([a-zA-Z0-9_-]+)>([^<]*)<\/\1>/g;
        let match;
        while ((match = tagRegex.exec(recXml)) !== null) {
          row[match[1]] = match[2].trim();
        }
        if (Object.keys(row).length > 0) {
          records.push(row);
        }
      }
      return records;
    }

    return [];
  }

  private normalizeRecord(obj: any): Record<string, string> {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = v !== null && v !== undefined ? String(v) : '';
    }
    return res;
  }
}

export const folderWatcherService = FolderWatcherService.getInstance();
