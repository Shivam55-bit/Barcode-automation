/**
 * Unified Database Service with Automatic JSON Migration & Synchronization
 */
import path from 'path';
import fs from 'fs';
import { IDatabaseProvider } from './interfaces';
import { SqliteDatabaseProvider } from './sqliteProvider';

export class DatabaseService {
  private static instance: DatabaseService;
  private provider: IDatabaseProvider;
  private dataDir: string;
  private isInitialized = false;

  private constructor() {
    this.dataDir = path.resolve(process.cwd(), 'barcode-automation-backend/data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.provider = new SqliteDatabaseProvider();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
      DatabaseService.instance.initSync();
    }
    return DatabaseService.instance;
  }

  private initSync(): void {
    if (this.isInitialized) return;
    try {
      // Synchronously initialize the provider
      (this.provider as SqliteDatabaseProvider).initialize();
      this.migrateJsonFilesIfPresent();
      this.isInitialized = true;
    } catch (err) {
      console.error('[DatabaseService] Failed to initialize database provider:', err);
    }
  }

  /**
   * Automatically migrates legacy JSON data files into SQLite if SQLite collection is empty
   */
  private migrateJsonFilesIfPresent(): void {
    const knownCollections = [
      'templates',
      'users',
      'datasets',
      'printers',
      'printJobs',
      'auditLogs',
      'batchJobs',
      'license',
      'approvals',
      'approvalComments',
      'viewerLogs',
    ];

    for (const coll of knownCollections) {
      try {
        const jsonPath = path.join(this.dataDir, `${coll}.json`);
        if (fs.existsSync(jsonPath)) {
          const sqliteRows = this.provider.readCollection(coll, []);
          if (sqliteRows.length === 0) {
            const raw = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];
            if (items.length > 0) {
              console.log(`[DatabaseService] Migrating ${items.length} records from ${coll}.json into SQLite...`);
              this.provider.writeCollection(coll, items);
              console.log(`[DatabaseService] Successfully migrated ${coll}.json.`);
            }
          }
        }
      } catch (err) {
        console.warn(`[DatabaseService] Error migrating ${coll}.json:`, err);
      }
    }
  }

  public getProvider(): IDatabaseProvider {
    return this.provider;
  }

  public read<T = any>(collection: string, fallback: T[] = []): T[] {
    const items = this.provider.readCollection<T>(collection, fallback);
    return items;
  }

  public write<T = any>(collection: string, items: T[]): boolean {
    const success = this.provider.writeCollection<T>(collection, items);
    if (success) {
      // Keep JSON files in sync for backward compatibility & inspection
      this.syncToJsonFile(collection, items);
    }
    return success;
  }

  public upsert<T extends { id: string }>(collection: string, item: T): boolean {
    const success = this.provider.upsertItem<T>(collection, item);
    if (success) {
      const all = this.provider.readCollection<T>(collection, []);
      this.syncToJsonFile(collection, all);
    }
    return success;
  }

  public delete(collection: string, id: string): boolean {
    const success = this.provider.deleteItem(collection, id);
    if (success) {
      const all = this.provider.readCollection(collection, []);
      this.syncToJsonFile(collection, all);
    }
    return success;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    return this.provider.query<T>(sql, params);
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    return this.provider.queryOne<T>(sql, params);
  }

  public execute(sql: string, params: any[] = []): void {
    this.provider.execute(sql, params);
  }

  private syncToJsonFile(collection: string, items: any[]): void {
    try {
      const filePath = path.join(this.dataDir, `${collection}.json`);
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(items, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.warn(`[DatabaseService] Failed to sync ${collection}.json:`, err);
    }
  }
}
