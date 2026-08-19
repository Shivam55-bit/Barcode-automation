import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_TEMPLATES } from '../../../src/services/initialTemplates';
import {
  INITIAL_PRINTERS,
  INITIAL_PRINT_JOBS,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS,
  INITIAL_BATCH_JOBS,
} from '../../../src/services/mockDataService';

const DATA_DIR = path.resolve(process.cwd(), 'barcode-automation-backend/data');

export class StorageService {
  private static instance: StorageService;

  private constructor() {
    this.ensureDataDir();
    this.seedDefaultsIfEmpty();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getFilePath(collection: string): string {
    return path.join(DATA_DIR, `${collection}.json`);
  }

  private seedDefaultsIfEmpty(): void {
    const seedMap: Record<string, any[]> = {
      templates: INITIAL_TEMPLATES,
      printers: INITIAL_PRINTERS,
      printJobs: INITIAL_PRINT_JOBS,
      auditLogs: INITIAL_AUDIT_LOGS,
      users: INITIAL_USERS,
      batchJobs: INITIAL_BATCH_JOBS || [],
    };

    for (const [key, defaultData] of Object.entries(seedMap)) {
      const filePath = this.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
          console.log(`[StorageService] Initialized database file: ${key}.json`);
        } catch (err) {
          console.error(`[StorageService] Failed to seed ${key}:`, err);
        }
      }
    }
  }

  public read<T>(collection: string, fallback: T[] = []): T[] {
    const filePath = this.getFilePath(collection);
    try {
      if (!fs.existsSync(filePath)) {
        this.write(collection, fallback);
        return fallback;
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T[];
    } catch (err) {
      console.error(`[StorageService] Error reading collection "${collection}":`, err);
      return fallback;
    }
  }

  public write<T>(collection: string, data: T[]): boolean {
    const filePath = this.getFilePath(collection);
    try {
      this.ensureDataDir();
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (err) {
      console.error(`[StorageService] Error writing collection "${collection}":`, err);
      return false;
    }
  }
}
