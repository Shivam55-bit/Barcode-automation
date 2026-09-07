/**
 * Database Migrations for BarcodeFlow Enterprise
 */
import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_enterprise_schema',
    up: (db: DatabaseSync) => {
      // Schema migrations tracker
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // Generic Key-Value Document Store for backwards compatibility
      db.exec(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (collection, id)
        );
        CREATE INDEX IF NOT EXISTS idx_kvs_collection ON key_value_store(collection);
      `);

      // Templates Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          author_email TEXT,
          category TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          version TEXT NOT NULL DEFAULT '1.0.0',
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_templates_author ON templates(author_email);
        CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
      `);

      // Users Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'approved',
          department TEXT,
          permissions TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);

      // Datasets Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS datasets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          file_name TEXT,
          row_count INTEGER DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Printers Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS printers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          ip_address TEXT,
          port INTEGER DEFAULT 9100,
          dpi INTEGER DEFAULT 300,
          status TEXT NOT NULL DEFAULT 'online',
          is_default INTEGER DEFAULT 0,
          driver_name TEXT,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Print Jobs Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id TEXT PRIMARY KEY,
          template_id TEXT,
          template_name TEXT,
          printer_id TEXT,
          printer_name TEXT,
          copies INTEGER DEFAULT 1,
          record_count INTEGER DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'completed',
          format TEXT DEFAULT 'zpl',
          submitted_by TEXT,
          submitted_at TEXT NOT NULL,
          completed_at TEXT,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_print_jobs_template ON print_jobs(template_id);
        CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
      `);

      // Serial Sequences Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS serial_sequences (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          current_value INTEGER NOT NULL DEFAULT 1,
          start_value INTEGER NOT NULL DEFAULT 1,
          increment_by INTEGER NOT NULL DEFAULT 1,
          min_digits INTEGER NOT NULL DEFAULT 6,
          prefix TEXT DEFAULT '',
          suffix TEXT DEFAULT '',
          reset_policy TEXT NOT NULL DEFAULT 'never',
          last_reset_date TEXT,
          copies_per_serial INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
      `);

      // Counters Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS counters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'batch',
          current_value INTEGER NOT NULL DEFAULT 0,
          start_value INTEGER NOT NULL DEFAULT 0,
          step INTEGER NOT NULL DEFAULT 1,
          pad_length INTEGER NOT NULL DEFAULT 0,
          max_value INTEGER,
          reset_policy TEXT NOT NULL DEFAULT 'manual',
          last_reset_date TEXT,
          updated_at TEXT NOT NULL
        );
      `);

      // Audit Logs Table with Cryptographic Hash Chaining
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_role TEXT NOT NULL,
          action TEXT NOT NULL,
          details TEXT NOT NULL,
          entity_id TEXT,
          entity_name TEXT,
          ip_address TEXT,
          hash TEXT NOT NULL,
          prev_hash TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  // Ensure tracker exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  for (const mig of MIGRATIONS) {
    if (!appliedSet.has(mig.version)) {
      console.log(`[DatabaseSync] Applying migration v${mig.version}: ${mig.name}`);
      mig.up(db);
      const insert = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
      insert.run(mig.version, mig.name, new Date().toISOString());
      console.log(`[DatabaseSync] Successfully applied migration v${mig.version}`);
    }
  }
}
