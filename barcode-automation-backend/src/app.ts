import express from 'express';
import { templatesRouter } from './routes/templates';
import { printJobsRouter } from './routes/printJobs';
import { batchJobsRouter } from './routes/batchJobs';
import { printersRouter } from './routes/printers';
import { auditLogsRouter } from './routes/auditLogs';
import { usersRouter } from './routes/users';
import { gs1Router } from './routes/gs1';
import { zplRouter } from './routes/zpl';
import { aiRouter } from './routes/ai';
import { viewerLogsRouter } from './routes/viewerLogs';
import { datasetsRouter } from './routes/datasets';
import { licenseRouter } from './routes/license';
import { exportRouter } from './routes/export';
import { SAMPLE_ENTERPRISE_DATASETS } from '../../src/services/databaseConnectorService';

export function createBackendApp(): express.Application {
  const app = express();

  // CORS Middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      service: 'barcode-automation-backend',
      version: '2.5.0-enterprise',
      timestamp: new Date().toISOString(),
    });
  });

  // REST API Routes
  app.use('/api/templates', templatesRouter);
  app.use('/api/print-jobs', printJobsRouter);
  app.use('/api/print', printJobsRouter);
  app.use('/api/batch-jobs', batchJobsRouter);
  app.use('/api/printers', printersRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/auth', usersRouter);
  app.use('/api/gs1', gs1Router);
  app.use('/api/zpl', zplRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/viewer', viewerLogsRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/license', licenseRouter);
  app.use('/api/export', exportRouter);

  // Sample Enterprise Datasets
  app.get('/api/database/sample-datasets', (req, res) => {
    res.json(SAMPLE_ENTERPRISE_DATASETS);
  });

  return app;
}
