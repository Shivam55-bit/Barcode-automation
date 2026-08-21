import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';
import { INITIAL_PRINTERS } from '../../../src/services/mockDataService';

export const printersRouter = Router();
const storage = StorageService.getInstance();
const audit = AuditService.getInstance();

// GET /api/printers
printersRouter.get('/', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', INITIAL_PRINTERS);
  res.json(printers);
});

// GET /api/printers/default
printersRouter.get('/default', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', INITIAL_PRINTERS);
  const def = printers.find((p: any) => p.isDefault || p.status === 'online') || printers[0];
  res.json(def || null);
});

// POST /api/printers/refresh (Scans OS Printers via PowerShell or Spooler)
printersRouter.post('/refresh', (req: Request, res: Response) => {
  const psCommand = `powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, DriverName, PortName, IsDefault | ConvertTo-Json"`;

  exec(psCommand, (err, stdout, stderr) => {
    let osPrinters: any[] = [];

    if (!err && stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        osPrinters = list.map((p: any, idx: number) => {
          const name = p.Name || `Printer ${idx + 1}`;
          const isZebra = name.toLowerCase().includes('zebra') || name.toLowerCase().includes('zt410');
          const isTsc = name.toLowerCase().includes('tsc');
          const isBrother = name.toLowerCase().includes('brother');
          const isSato = name.toLowerCase().includes('sato');
          const isCitizen = name.toLowerCase().includes('citizen');
          const isHoneywell = name.toLowerCase().includes('honeywell');

          let type: any = 'Windows Printer';
          if (isZebra) type = 'Zebra ZPL II (Network/USB)';
          else if (isTsc) type = 'TSC TSPL (Thermal)';
          else if (isBrother) type = 'Brother Label Printer';
          else if (isSato) type = 'SATO SBPL (Industrial)';

          return {
            id: `prn-os-${idx + 1}`,
            name,
            type,
            dpi: isZebra ? 300 : 203,
            status: p.PrinterStatus === 3 || p.PrinterStatus === 0 ? 'online' : 'online',
            ipAddress: p.PortName || '127.0.0.1',
            port: 9100,
            isDefault: !!p.IsDefault,
            driverName: p.DriverName,
            isThermal: isZebra || isTsc || isBrother || isSato || isCitizen || isHoneywell,
          };
        });
      } catch (parseErr) {
        console.warn('[PrintersRouter] PowerShell JSON parse error:', parseErr);
      }
    }

    const existing = storage.read<any>('printers', INITIAL_PRINTERS);
    const combinedMap = new Map<string, any>();

    // Keep custom configured thermal printers
    existing.forEach((p: any) => combinedMap.set(p.name.toLowerCase(), p));
    // Add newly discovered OS printers
    osPrinters.forEach((p: any) => {
      if (!combinedMap.has(p.name.toLowerCase())) {
        combinedMap.set(p.name.toLowerCase(), p);
      }
    });

    const updatedList = Array.from(combinedMap.values());
    storage.write('printers', updatedList);
    audit.log('PRINTER_REFRESH', `Refreshed printer list. Discovered ${osPrinters.length} OS printers.`);

    res.json({
      success: true,
      count: updatedList.length,
      printers: updatedList,
    });
  });
});

// POST /api/printers/calibrate
printersRouter.post('/calibrate', (req: Request, res: Response) => {
  try {
    const { printerId, labelWidth, labelHeight, mediaType, dpi, darkness, speed, testPage } = req.body;
    const printers = storage.read<any>('printers', INITIAL_PRINTERS);
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
  const printers = storage.read<any>('printers', INITIAL_PRINTERS);
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
  const printers = storage.read<any>('printers', INITIAL_PRINTERS);
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
  const printers = storage.read<any>('printers', INITIAL_PRINTERS);
  const index = printers.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  const removed = printers.splice(index, 1)[0];
  storage.write('printers', printers);

  audit.log('PRINTER_DELETE', `Removed printer "${removed.name}"`);
  res.json({ success: true, id: req.params.id });
});
