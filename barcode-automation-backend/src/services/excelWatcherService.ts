import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../db/databaseService';
import { logBackendAudit } from './auditService';

export type ExcelConnectionStatus =
  | 'CONNECTED'
  | 'FILE_CHANGED'
  | 'REFRESHING'
  | 'FILE_MISSING'
  | 'FILE_LOCKED'
  | 'INVALID_FILE'
  | 'SHEET_MISSING'
  | 'ERROR';

export interface WatchedExcelInfo {
  datasetId: string;
  datasetName: string;
  filePath: string;
  lastMtimeMs: number;
  lastSizeBytes: number;
  status: ExcelConnectionStatus;
  lastCheckedAt: string;
  lastRefreshedAt?: string;
}

export class ExcelWatcherService {
  private static instance: ExcelWatcherService;
  private watchedFiles: Map<string, WatchedExcelInfo> = new Map();
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;

  private constructor() {
    this.start(5000);
  }

  public static getInstance(): ExcelWatcherService {
    if (!ExcelWatcherService.instance) {
      ExcelWatcherService.instance = new ExcelWatcherService();
    }
    return ExcelWatcherService.instance;
  }

  public registerWatch(datasetId: string, datasetName: string, filePath: string): WatchedExcelInfo {
    const status = this.checkFileStatus(filePath);
    const info: WatchedExcelInfo = {
      datasetId,
      datasetName,
      filePath,
      lastMtimeMs: status.mtimeMs || 0,
      lastSizeBytes: status.sizeBytes || 0,
      status: status.status,
      lastCheckedAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    };

    this.watchedFiles.set(datasetId, info);
    return info;
  }

  public unregisterWatch(datasetId: string): void {
    this.watchedFiles.delete(datasetId);
  }

  public checkFileStatus(filePath: string): {
    status: ExcelConnectionStatus;
    mtimeMs?: number;
    sizeBytes?: number;
    error?: string;
  } {
    if (!filePath || !filePath.trim()) {
      return { status: 'INVALID_FILE', error: 'No file path specified' };
    }

    try {
      if (!fs.existsSync(filePath)) {
        return { status: 'FILE_MISSING', error: `File "${filePath}" does not exist on disk.` };
      }

      // Check file lock / openability
      try {
        const fd = fs.openSync(filePath, 'r');
        fs.closeSync(fd);
      } catch (err: any) {
        if (err.code === 'EBUSY' || err.code === 'EACCES') {
          return { status: 'FILE_LOCKED', error: 'File is currently locked or being saved by Excel.' };
        }
        return { status: 'ERROR', error: err.message };
      }

      const stat = fs.statSync(filePath);
      return {
        status: 'CONNECTED',
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      };
    } catch (err: any) {
      return { status: 'ERROR', error: err.message };
    }
  }

  public start(intervalMs: number = 5000): void {
    if (this.pollIntervalTimer) return;
    this.pollIntervalTimer = setInterval(() => {
      this.pollWatchedFiles().catch((err) => {
        console.error('[ExcelWatcherService] Poll error:', err);
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
  }

  private async pollWatchedFiles(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      for (const [dsId, info] of this.watchedFiles.entries()) {
        const check = this.checkFileStatus(info.filePath);

        if (check.status === 'FILE_MISSING' && info.status !== 'FILE_MISSING') {
          info.status = 'FILE_MISSING';
          this.updateDatasetStatusInDb(dsId, 'FILE_MISSING', 'File was moved or deleted from disk.');
          logBackendAudit('System', 'System', 'DATASET_FILE_MISSING', `Linked Excel file missing: ${info.filePath}`, dsId, info.datasetName);
        } else if (check.status === 'CONNECTED' && info.lastMtimeMs > 0 && check.mtimeMs && check.mtimeMs > info.lastMtimeMs) {
          // File changed! Wait 600ms to ensure file write stream is complete
          await new Promise((resolve) => setTimeout(resolve, 600));
          const recheck = this.checkFileStatus(info.filePath);

          if (recheck.status === 'CONNECTED' && recheck.mtimeMs) {
            info.status = 'FILE_CHANGED';
            info.lastMtimeMs = recheck.mtimeMs;
            info.lastSizeBytes = recheck.sizeBytes || 0;
            info.lastCheckedAt = new Date().toISOString();

            this.updateDatasetStatusInDb(dsId, 'FILE_CHANGED', 'Excel file has been modified on disk.');
            logBackendAudit('System', 'System', 'DATASET_FILE_CHANGED', `Detected modification in linked Excel file: ${info.filePath}`, dsId, info.datasetName);
          }
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  private updateDatasetStatusInDb(datasetId: string, status: ExcelConnectionStatus, statusMessage: string): void {
    try {
      const db = DatabaseService.getInstance();
      const datasets = db.read<any>('datasets', []);
      const idx = datasets.findIndex((d) => d.id === datasetId);
      if (idx !== -1) {
        datasets[idx].status = status;
        datasets[idx].statusMessage = statusMessage;
        datasets[idx].updatedAt = new Date().toISOString();
        db.write('datasets', datasets);
      }
    } catch (err) {
      console.warn('[ExcelWatcherService] Failed to update dataset status in DB:', err);
    }
  }
}

export const excelWatcherService = ExcelWatcherService.getInstance();
