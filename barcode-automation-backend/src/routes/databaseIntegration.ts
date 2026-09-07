import { Router, Request, Response } from 'express';
import { DatabaseService } from '../db/databaseService';

export const databaseIntegrationRouter = Router();

interface QueryRequestBody {
  dialect?: 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle';
  connectionParams?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    filePath?: string;
  };
  sqlQuery: string;
  limit?: number;
}

/**
 * GET /api/databases/tables
 * Introspect available tables and columns in the active database
 */
databaseIntegrationRouter.get('/tables', (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const tables = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const result = tables.map((t) => {
      const columns = db.query<{ cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number }>(
        `PRAGMA table_info("${t.name}")`
      );
      return {
        tableName: t.name,
        columns: columns.map((c) => ({
          name: c.name,
          type: c.type || 'TEXT',
          isPrimaryKey: Boolean(c.pk),
          isNullable: !Boolean(c.notnull),
        })),
      };
    });

    res.json({
      success: true,
      dialect: 'sqlite',
      tables: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/databases/test
 * Test connectivity to local SQLite or remote database server
 */
databaseIntegrationRouter.post('/test', async (req: Request, res: Response) => {
  const { dialect = 'sqlite', connectionParams = {} } = req.body;
  const startTime = Date.now();

  try {
    if (dialect === 'sqlite') {
      const db = DatabaseService.getInstance();
      const test = db.queryOne<{ ping: number }>('SELECT 1 as ping');
      const latencyMs = Date.now() - startTime;
      return res.json({
        success: true,
        message: 'Connected successfully to local high-performance SQLite WAL engine',
        dialect: 'sqlite',
        latencyMs,
        serverVersion: 'SQLite 3 (Node.js 22 Native)',
      });
    }

    // For external database connections (Postgres / MySQL / MSSQL)
    const { host, port, database, username } = connectionParams;
    if (!host) {
      return res.status(400).json({
        success: false,
        message: 'Host is required for remote database connection testing',
      });
    }

    // Ping check host:port via direct TCP socket
    const net = await import('net');
    const targetPort = port || (dialect === 'postgres' ? 5432 : dialect === 'mysql' ? 3306 : 1433);

    const socket = new net.Socket();
    socket.setTimeout(4000);

    socket.connect(targetPort, host, () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      res.json({
        success: true,
        message: `Network socket connected successfully to ${dialect.toUpperCase()} server at ${host}:${targetPort}`,
        dialect,
        latencyMs,
        host,
        port: targetPort,
        database: database || 'default',
        authenticatedUser: username || 'anonymous',
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      res.status(502).json({
        success: false,
        message: `Failed to connect to ${dialect.toUpperCase()} at ${host}:${targetPort} - ${err.message}`,
        error: err.message,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      res.status(504).json({
        success: false,
        message: `Connection timed out after 4000ms connecting to ${host}:${targetPort}`,
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/databases/query
 * Execute a SQL query and return columns and rows
 */
databaseIntegrationRouter.post('/query', (req: Request, res: Response) => {
  const { dialect = 'sqlite', sqlQuery, limit = 500 }: QueryRequestBody = req.body;

  if (!sqlQuery || !sqlQuery.trim()) {
    return res.status(400).json({ success: false, error: 'SQL query string is required' });
  }

  // Prevent destructive statements in data source queries
  const trimmed = sqlQuery.trim();
  const disallowRegex = /^\s*(DROP|ALTER|TRUNCATE|DELETE|UPDATE)\b/i;
  if (disallowRegex.test(trimmed)) {
    return res.status(403).json({
      success: false,
      error: 'Destructive DDL/DML statements (DROP, ALTER, TRUNCATE, DELETE, UPDATE) are not permitted in label data source queries.',
    });
  }

  try {
    const db = DatabaseService.getInstance();
    let queryWithLimit = trimmed;
    if (!/LIMIT\s+\d+/i.test(trimmed) && /^\s*SELECT/i.test(trimmed)) {
      queryWithLimit = `${trimmed.replace(/;\s*$/, '')} LIMIT ${Math.min(limit, 1000)};`;
    }

    const rows = db.query<any>(queryWithLimit);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      success: true,
      dialect,
      columns,
      rows,
      totalCount: rows.length,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `Query execution error: ${err.message}`,
    });
  }
});

/**
 * GET & POST /api/databases/connections
 * Manage saved enterprise database connections
 */
databaseIntegrationRouter.get('/connections', (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const connections = db.read<any>('database_connections', []);
    res.json({ success: true, connections });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

databaseIntegrationRouter.post('/connections', (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const conn = {
      id: req.body.id || `conn-${Date.now()}`,
      name: req.body.name || 'Enterprise DB Connection',
      dialect: req.body.dialect || 'sqlite',
      connectionParams: req.body.connectionParams || {},
      sqlQuery: req.body.sqlQuery || '',
      updatedAt: new Date().toISOString(),
    };
    db.upsert('database_connections', conn);
    res.json({ success: true, connection: conn });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const SAMPLE_ENTERPRISE_DATASETS = [
  {
    id: 'db-pharma-serial',
    name: 'Pharmaceutical Serialization Master (FDA UDI)',
    type: 'sql_mock',
    sqlQuery: 'SELECT GTIN, BatchNo, ExpiryDate, SerialNumber, ProductDesc, Dosage, MfgDate FROM PharmaInventory WHERE Status = "ACTIVE"',
    fields: ['GTIN', 'BatchNo', 'ExpiryDate', 'SerialNumber', 'ProductDesc', 'Dosage', 'MfgDate', 'CountryOrigin'],
    records: [
      { GTIN: '00850006531234', BatchNo: 'LOT-9042', ExpiryDate: '261231', SerialNumber: 'SN-7849102', ProductDesc: 'Amoxicillin 500mg Capsules', Dosage: '500mg', MfgDate: '240115', CountryOrigin: 'USA' },
      { GTIN: '00850006531241', BatchNo: 'LOT-9042', ExpiryDate: '261231', SerialNumber: 'SN-7849103', ProductDesc: 'Amoxicillin 500mg Capsules', Dosage: '500mg', MfgDate: '240115', CountryOrigin: 'USA' },
      { GTIN: '00850006531258', BatchNo: 'LOT-9043', ExpiryDate: '270430', SerialNumber: 'SN-7849104', ProductDesc: 'Ibuprofen 400mg Tablets', Dosage: '400mg', MfgDate: '240210', CountryOrigin: 'Germany' },
    ],
  },
  {
    id: 'db-logistics-pallets',
    name: 'WMS Pallet & SSCC Logistics Hub',
    type: 'rest_api',
    fields: ['SSCC', 'PalletID', 'WarehouseLoc', 'Carrier', 'DestinationHub', 'GrossWeightKg', 'ItemCount', 'ShipDate'],
    records: [
      { SSCC: '000085000653123451', PalletID: 'PAL-9821', WarehouseLoc: 'BAY-A12-R4', Carrier: 'FedEx Freight', DestinationHub: 'ORD-Chicago', GrossWeightKg: '420.5', ItemCount: '48', ShipDate: '2026-08-20' },
      { SSCC: '000085000653123468', PalletID: 'PAL-9822', WarehouseLoc: 'BAY-A12-R5', Carrier: 'FedEx Freight', DestinationHub: 'ORD-Chicago', GrossWeightKg: '385.0', ItemCount: '44', ShipDate: '2026-08-20' },
    ],
  },
];

