import { Router, Request, Response } from 'express';
import { folderWatcherService } from '../services/folderWatcherService';
import fs from 'fs';
import path from 'path';

export const automationsRouter = Router();

/**
 * GET /api/automations/status
 * Get current folder watcher state, file counts, and recent automated print jobs
 */
automationsRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = folderWatcherService.getStatus();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/automations/start
 * Start background watching daemon
 */
automationsRouter.post('/start', (req: Request, res: Response) => {
  try {
    const pollIntervalMs = req.body.pollIntervalMs ? parseInt(req.body.pollIntervalMs, 10) : 3000;
    folderWatcherService.start(pollIntervalMs);
    res.json({ success: true, message: 'Folder Watcher daemon started', status: folderWatcherService.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/automations/stop
 * Stop background watching daemon
 */
automationsRouter.post('/stop', (req: Request, res: Response) => {
  try {
    folderWatcherService.stop();
    res.json({ success: true, message: 'Folder Watcher daemon stopped', status: folderWatcherService.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/automations/scan
 * Force an immediate directory sweep
 */
automationsRouter.post('/scan', async (req: Request, res: Response) => {
  try {
    const result = await folderWatcherService.scanIncomingDirectory();
    res.json({
      success: true,
      message: `Scan completed: ${result.processed} processed, ${result.errors} errors.`,
      result,
      status: folderWatcherService.getStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/automations/simulate-drop
 * Drops a sample CSV or JSON file into the incoming folder to simulate an external ERP integration
 */
automationsRouter.post('/simulate-drop', (req: Request, res: Response) => {
  try {
    const { format = 'csv', records } = req.body;
    const status = folderWatcherService.getStatus();
    const incomingDir = path.join(status.watchDirectory, 'incoming');

    if (!fs.existsSync(incomingDir)) {
      fs.mkdirSync(incomingDir, { recursive: true });
    }

    const timestamp = Date.now();
    let fileName = '';
    let fileContent = '';

    if (format === 'json') {
      fileName = `erp_order_${timestamp}.json`;
      const data = records || [
        { SKU: 'MED-AUTO-101', LOT: 'BATCH-2026-A', EXP: '2027-06-30', QTY: '500', OPERATOR: 'ERP_BOT' },
        { SKU: 'MED-AUTO-102', LOT: 'BATCH-2026-B', EXP: '2027-07-15', QTY: '250', OPERATOR: 'ERP_BOT' },
      ];
      fileContent = JSON.stringify(data, null, 2);
    } else {
      fileName = `erp_production_${timestamp}.csv`;
      fileContent =
        records ||
        'SKU,Batch_Lot,Expiry_Date,Product_Name,Net_Weight\n' +
        'AUTO-5501,LOT-8812,2027-01-31,Industrial Solvent 5L,4.85 kg\n' +
        'AUTO-5502,LOT-8812,2027-01-31,Industrial Solvent 5L,4.87 kg\n' +
        'AUTO-5503,LOT-8813,2027-02-15,Industrial Solvent 10L,9.80 kg\n';
    }

    const targetFile = path.join(incomingDir, fileName);
    fs.writeFileSync(targetFile, fileContent, 'utf-8');

    res.json({
      success: true,
      message: `Sample ERP file "${fileName}" dropped into incoming hot folder.`,
      targetFile,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
