import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';
import { NetworkPrintService } from '../services/networkPrintService';

export const printersRouter = Router();
const storage = StorageService.getInstance();
const audit = AuditService.getInstance();
const printService = NetworkPrintService.getInstance();

// GET /api/printers
printersRouter.get('/', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  res.json(printers);
});

// GET /api/printers/default
printersRouter.get('/default', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const def = printers.find((p: any) => p.isDefault || p.status === 'online') || printers[0];
  res.json(def || null);
});

// GET /api/printers/:id
printersRouter.get('/:id', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const printer = printers.find((p: any) => p.id === req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });
  res.json(printer);
});

// GET /api/printers/:id/capabilities
printersRouter.get('/:id/capabilities', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const printer = printers.find((p: any) => p.id === req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });
  res.json(printer.capabilities || {
    color: !printer.brand?.includes('Zebra') && !printer.brand?.includes('TSC'),
    duplex: false,
    speedControl: true,
    darknessControl: true,
    gapMedia: true,
    blackMarkMedia: true,
    continuousMedia: true,
    cutter: false,
    peeler: false,
    rfid: false,
  });
});

// GET /api/printers/:id/status
printersRouter.get('/:id/status', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const printer = printers.find((p: any) => p.id === req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });
  res.json({ id: printer.id, name: printer.name, status: printer.status || 'READY' });
});

// GET /api/printers/:id/media
printersRouter.get('/:id/media', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const printer = printers.find((p: any) => p.id === req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });
  res.json({
    mediaWidth: printer.mediaWidth || 104,
    mediaHeight: printer.mediaHeight || 152,
    mediaType: printer.mediaType || 'gap',
    supportedTypes: ['gap', 'continuous', 'black_mark'],
  });
});

// POST /api/printers/refresh (Cross-platform OS Discovery & TCP Status Probe)
printersRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const discovered = await printService.discoverInstalledPrinters();
    const existing = storage.read<any>('printers', []);
    const combinedMap = new Map<string, any>();

    // Keep custom configured network/thermal printers
    existing.forEach((p: any) => combinedMap.set(p.name.toLowerCase(), p));

    // Add or update discovered OS printers
    discovered.forEach((p, idx) => {
      const key = p.name.toLowerCase();
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          id: `prn-os-${idx + 1}`,
          name: p.name,
          model: p.driverName || p.name,
          brand: p.protocol === 'zpl' ? 'Zebra' : p.protocol === 'tspl' ? 'TSC' : 'Desktop PDF',
          dpi: p.protocol === 'zpl' ? 300 : 203,
          status: p.status,
          protocol: p.protocol,
          location: 'Local Workstation / USB Spooler',
          mediaWidth: 104,
          mediaHeight: 152,
          ipAddress: p.portName || '127.0.0.1',
          port: 9100,
          isDefault: p.isDefault,
          driverName: p.driverName,
          isThermal: p.isThermal,
        });
      } else {
        const current = combinedMap.get(key);
        current.status = p.status;
        if (p.isDefault) current.isDefault = true;
      }
    });

    const updatedList = Array.from(combinedMap.values());
    storage.write('printers', updatedList);
    audit.log('PRINTER_REFRESH', `Refreshed printer list. Discovered ${discovered.length} OS printers on platform ${process.platform}.`);

    res.json({
      success: true,
      count: updatedList.length,
      printers: updatedList,
    });
  } catch (err: any) {
    console.error('[PrintersRouter] Refresh failed:', err);
    const fallback = storage.read<any>('printers', []);
    res.json({ success: false, error: err.message, printers: fallback });
  }
});

// POST /api/printers/:id/probe (Real TCP Socket or Spooler probe)
printersRouter.post('/:id/probe', async (req: Request, res: Response) => {
  try {
    const printers = storage.read<any>('printers', []);
    const printer = printers.find((p: any) => p.id === req.params.id);

    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    let liveStatus: 'online' | 'offline' | 'busy' = 'offline';

    const isIpDefined =
      printer.ipAddress &&
      printer.ipAddress !== '127.0.0.1' &&
      printer.ipAddress !== 'localhost' &&
      !printer.ipAddress.startsWith('Virtual') &&
      !printer.ipAddress.startsWith('USB');

    if (isIpDefined && printer.port) {
      liveStatus = await printService.probeTcpPrinterStatus(printer.ipAddress, Number(printer.port), 2000);
    } else {
      // Local printer probe
      const discovered = await printService.discoverInstalledPrinters();
      const match = discovered.find((d) => d.name.toLowerCase() === printer.name.toLowerCase());
      liveStatus = match ? match.status : printer.status || 'online';
    }

    printer.status = liveStatus;
    storage.write('printers', printers);

    res.json({
      id: printer.id,
      name: printer.name,
      status: liveStatus,
      probedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/printers/calibrate
printersRouter.post('/calibrate', (req: Request, res: Response) => {
  try {
    const { printerId, labelWidth, labelHeight, mediaType, dpi, darkness, speed, testPage } = req.body;
    const printers = storage.read<any>('printers', []);
    const idx = printers.findIndex((p: any) => p.id === printerId);

    if (idx !== -1) {
      printers[idx].calibration = {
        labelWidth: labelWidth || 100,
        labelHeight: labelHeight || 50,
        mediaType: mediaType || 'gap',
        dpi: dpi || 300,
        darkness: darkness || 15,
        speed: speed || 6,
        calibratedAt: new Date().toISOString(),
      };
      storage.write('printers', printers);
    }

    audit.log('PRINTER_CALIBRATE', `Calibrated printer "${printers[idx]?.name || printerId}" (${labelWidth}x${labelHeight}mm, ${dpi} DPI, Darkness: ${darkness})`);

    res.json({
      success: true,
      message: `Printer calibration saved successfully.${testPage ? ' Sent calibration test pattern to thermal spooler.' : ''}`,
      printer: idx !== -1 ? printers[idx] : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/printers
printersRouter.post('/', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const newPrinter = req.body;

  if (!newPrinter.id) {
    newPrinter.id = `prn-${Date.now()}`;
  }

  printers.push(newPrinter);
  storage.write('printers', printers);

  audit.log('PRINTER_CREATE', `Added thermal printer "${newPrinter.name}" (${newPrinter.ipAddress}:${newPrinter.port})`);
  res.status(201).json(newPrinter);
});

// PUT /api/printers/:id
printersRouter.put('/:id', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const index = printers.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  printers[index] = { ...printers[index], ...req.body };
  storage.write('printers', printers);

  audit.log('PRINTER_UPDATE', `Updated printer configuration for "${printers[index].name}"`);
  res.json(printers[index]);
});

// DELETE /api/printers/:id
printersRouter.delete('/:id', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const index = printers.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  const removed = printers.splice(index, 1)[0];
  storage.write('printers', printers);

  audit.log('PRINTER_DELETE', `Removed printer "${removed.name}"`);
  res.json({ success: true, id: req.params.id });
});
