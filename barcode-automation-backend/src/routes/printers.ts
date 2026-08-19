import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const printersRouter = Router();
const storage = StorageService.getInstance();

// GET /api/printers
printersRouter.get('/', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  res.json(printers);
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

  logBackendAudit(
    'Admin',
    'Admin',
    'SYSTEM_CONFIG',
    `Added thermal printer "${newPrinter.name}" (${newPrinter.ipAddress}:${newPrinter.port})`
  );

  res.status(201).json(newPrinter);
});

// PUT /api/printers/:id
printersRouter.put('/:id', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const index = printers.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  printers[index] = { ...printers[index], ...req.body };
  storage.write('printers', printers);

  logBackendAudit(
    'Admin',
    'Admin',
    'SYSTEM_CONFIG',
    `Updated configuration for printer "${printers[index].name}"`
  );

  res.json(printers[index]);
});

// DELETE /api/printers/:id
printersRouter.delete('/:id', (req: Request, res: Response) => {
  const printers = storage.read<any>('printers', []);
  const index = printers.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  const removed = printers.splice(index, 1)[0];
  storage.write('printers', printers);

  logBackendAudit(
    'Admin',
    'Admin',
    'SYSTEM_CONFIG',
    `Removed printer "${removed.name}"`
  );

  res.json({ success: true, id: req.params.id });
});
