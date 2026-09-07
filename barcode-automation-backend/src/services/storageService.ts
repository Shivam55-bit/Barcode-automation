import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../db/databaseService';
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
  private db: DatabaseService;

  private constructor() {
    this.ensureDataDir();
    this.seedDefaultsIfEmpty();
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getDatabase(): DatabaseService {
    return this.db;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public getFilePath(collection: string): string {
    return path.join(DATA_DIR, `${collection}.json`);
  }

  private seedDefaultsIfEmpty(): void {
    const seedMap: Record<string, any[]> = {
      templates: INITIAL_TEMPLATES,
      templateVersions: [],
      approvals: [],
      approvalComments: [],
      viewerLogs: [],
      printers: [],
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
    return this.db.read<T>(collection, fallback);
  }

  public write<T>(collection: string, data: T[]): boolean {
    return this.db.write<T>(collection, data);
  }

  public upsert<T extends { id: string }>(collection: string, item: T): boolean {
    return this.db.upsert<T>(collection, item);
  }

  public delete(collection: string, id: string): boolean {
    return this.db.delete(collection, id);
  }
}
