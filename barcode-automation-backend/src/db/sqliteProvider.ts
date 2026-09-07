/**
 * SQLite Database Provider using Node.js Native DatabaseSync
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { IDatabaseProvider } from './interfaces';
import { runMigrations } from './migrations';

export class SqliteDatabaseProvider implements IDatabaseProvider {
  private db!: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    const dataDir = path.resolve(process.cwd(), 'barcode-automation-backend/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = customPath || path.join(dataDir, 'barcodeflow.sqlite');
  }

  public initialize(): void {
    try {
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');

      runMigrations(this.db);
      console.log(`[SqliteDatabaseProvider] Connected and initialized SQLite database at: ${this.dbPath}`);
    } catch (err) {
      console.error('[SqliteDatabaseProvider] Initialization error:', err);
      throw err;
    }
  }

  public execute(sql: string, params: any[] = []): void {
    if (params.length === 0) {
      this.db.exec(sql);
    } else {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    }
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public readCollection<T = any>(collectionName: string, fallback: T[] = []): T[] {
    try {
      // Check dedicated tables first
      if (collectionName === 'templates') {
        const rows = this.query<{ data: string }>('SELECT data FROM templates ORDER BY updated_at DESC');
        if (rows.length > 0) return rows.map((r) => JSON.parse(r.data));
      } else if (collectionName === 'users') {
        const rows = this.query<{ data: string }>('SELECT data FROM users ORDER BY created_at ASC');
        if (rows.length > 0) return rows.map((r) => JSON.parse(r.data));
      } else if (collectionName === 'datasets') {
        const rows = this.query<{ data: string }>('SELECT data FROM datasets ORDER BY updated_at DESC');
        if (rows.length > 0) return rows.map((r) => JSON.parse(r.data));
      } else if (collectionName === 'printers') {
        const rows = this.query<{ data: string }>('SELECT data FROM printers ORDER BY is_default DESC, name ASC');
        if (rows.length > 0) return rows.map((r) => JSON.parse(r.data));
      } else if (collectionName === 'printJobs') {
        const rows = this.query<{ data: string }>('SELECT data FROM print_jobs ORDER BY submitted_at DESC');
        if (rows.length > 0) return rows.map((r) => JSON.parse(r.data));
      }

      // Check key_value_store
      const rows = this.query<{ data: string }>('SELECT data FROM key_value_store WHERE collection = ?', [collectionName]);
      if (rows.length > 0) {
        return rows.map((r) => JSON.parse(r.data));
      }
      return fallback;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error reading collection "${collectionName}":`, err);
      return fallback;
    }
  }

  public writeCollection<T = any>(collectionName: string, items: T[]): boolean {
    try {
      this.db.exec('BEGIN TRANSACTION;');

      if (collectionName === 'templates') {
        this.db.exec('DELETE FROM templates;');
        const insert = this.db.prepare(
          'INSERT INTO templates (id, name, author_email, category, status, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items as any[]) {
          insert.run(
            item.id,
            item.name || 'Untitled Template',
            item.authorEmail || item.author || '',
            item.category || 'General',
            item.status || 'draft',
            item.version || '1.0.0',
            JSON.stringify(item),
            item.createdAt || new Date().toISOString(),
            item.updatedAt || new Date().toISOString()
          );
        }
      } else if (collectionName === 'users') {
        this.db.exec('DELETE FROM users;');
        const insert = this.db.prepare(
          'INSERT INTO users (id, email, name, role, status, department, permissions, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items as any[]) {
          insert.run(
            item.id,
            item.email,
            item.name,
            item.role,
            item.status || 'approved',
            item.department || '',
            JSON.stringify(item.permissions || {}),
            JSON.stringify(item),
            item.createdAt || new Date().toISOString(),
            item.updatedAt || new Date().toISOString()
          );
        }
      } else if (collectionName === 'datasets') {
        this.db.exec('DELETE FROM datasets;');
        const insert = this.db.prepare(
          'INSERT INTO datasets (id, name, source_type, file_name, row_count, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items as any[]) {
          insert.run(
            item.id,
            item.name,
            item.sourceType || 'csv',
            item.fileName || '',
            item.rowCount || item.records?.length || 0,
            JSON.stringify(item),
            item.createdAt || new Date().toISOString(),
            item.updatedAt || new Date().toISOString()
          );
        }
      } else if (collectionName === 'printers') {
        this.db.exec('DELETE FROM printers;');
        const insert = this.db.prepare(
          'INSERT INTO printers (id, name, type, ip_address, port, dpi, status, is_default, driver_name, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items as any[]) {
          insert.run(
            item.id,
            item.name,
            item.type || 'Thermal',
            item.ipAddress || '',
            item.port || 9100,
            item.dpi || 300,
            item.status || 'online',
            item.isDefault ? 1 : 0,
            item.driverName || '',
            JSON.stringify(item),
            new Date().toISOString()
          );
        }
      } else if (collectionName === 'printJobs') {
        this.db.exec('DELETE FROM print_jobs;');
        const insert = this.db.prepare(
          'INSERT INTO print_jobs (id, template_id, template_name, printer_id, printer_name, copies, record_count, status, format, submitted_by, submitted_at, completed_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items as any[]) {
          insert.run(
            item.id,
            item.templateId || '',
            item.templateName || '',
            item.printerId || '',
            item.printerName || '',
            item.copies || 1,
            item.recordCount || 1,
            item.status || 'completed',
            item.format || 'zpl',
            item.submittedBy || '',
            item.submittedAt || new Date().toISOString(),
            item.completedAt || null,
            JSON.stringify(item)
          );
        }
      }

      // Always maintain key_value_store copy
      const deleteKvs = this.db.prepare('DELETE FROM key_value_store WHERE collection = ?');
      deleteKvs.run(collectionName);

      const insertKvs = this.db.prepare(
        'INSERT OR REPLACE INTO key_value_store (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      );
      const now = new Date().toISOString();
      let itemIdx = 0;
      for (const item of items as any[]) {
        const id = item.id || item.jobCode || item._id || `item-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`;
        insertKvs.run(collectionName, String(id), JSON.stringify(item), item.createdAt || now, now);
        itemIdx++;
      }

      this.db.exec('COMMIT;');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error(`[SqliteDatabaseProvider] Error writing collection "${collectionName}":`, err);
      return false;
    }
  }

  public upsertItem<T extends { id: string }>(collectionName: string, item: T): boolean {
    try {
      const now = new Date().toISOString();
      const insertKvs = this.db.prepare(
        'INSERT OR REPLACE INTO key_value_store (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      );
      insertKvs.run(collectionName, item.id, JSON.stringify(item), (item as any).createdAt || now, now);

      // Dedicated table upsert
      if (collectionName === 'templates') {
        const t = item as any;
        const insert = this.db.prepare(
          `INSERT OR REPLACE INTO templates 
           (id, name, author_email, category, status, version, data, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        insert.run(
          t.id,
          t.name,
          t.authorEmail || t.author || '',
          t.category || 'General',
          t.status || 'draft',
          t.version || '1.0.0',
          JSON.stringify(t),
          t.createdAt || now,
          now
        );
      } else if (collectionName === 'users') {
        const u = item as any;
        const insert = this.db.prepare(
          `INSERT OR REPLACE INTO users 
           (id, email, name, role, status, department, permissions, data, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        insert.run(
          u.id,
          u.email,
          u.name,
          u.role,
          u.status || 'approved',
          u.department || '',
          JSON.stringify(u.permissions || {}),
          JSON.stringify(u),
          u.createdAt || now,
          now
        );
      }
      return true;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error upserting item in "${collectionName}":`, err);
      return false;
    }
  }

  public deleteItem(collectionName: string, id: string): boolean {
    try {
      const delKvs = this.db.prepare('DELETE FROM key_value_store WHERE collection = ? AND id = ?');
      delKvs.run(collectionName, id);

      if (collectionName === 'templates') {
        this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
      } else if (collectionName === 'users') {
        this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
      } else if (collectionName === 'datasets') {
        this.db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
      } else if (collectionName === 'printers') {
        this.db.prepare('DELETE FROM printers WHERE id = ?').run(id);
      } else if (collectionName === 'printJobs') {
        this.db.prepare('DELETE FROM print_jobs WHERE id = ?').run(id);
      }
      return true;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error deleting item "${id}" in "${collectionName}":`, err);
      return false;
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
