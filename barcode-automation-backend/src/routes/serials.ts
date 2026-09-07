import { Router, Request, Response } from 'express';
import { DatabaseService } from '../db/databaseService';
import { logBackendAudit } from '../services/auditService';

export const serialsRouter = Router();
const dbService = DatabaseService.getInstance();

export interface SerialSequenceRecord {
  id: string;
  name: string;
  current_value: number;
  start_value: number;
  increment_by: number;
  min_digits: number;
  prefix: string;
  suffix: string;
  reset_policy: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'manual';
  last_reset_date: string | null;
  copies_per_serial: number;
  updated_at: string;
}

// Helper to format numeric serial with padding and affixes
function formatSerial(val: number, seq: SerialSequenceRecord): string {
  const pad = seq.min_digits || 6;
  const padded = String(val).padStart(pad, '0');
  const pfx = seq.prefix || '';
  const sfx = seq.suffix || '';
  return `${pfx}${padded}${sfx}`;
}

// GET /api/serials - List all serial sequences
serialsRouter.get('/', (req: Request, res: Response) => {
  try {
    const rows = dbService.query<SerialSequenceRecord>(
      'SELECT * FROM serial_sequences ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch serial sequences', details: err?.message });
  }
});

// GET /api/serials/:id - Get specific sequence
serialsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const row = dbService.queryOne<SerialSequenceRecord>(
      'SELECT * FROM serial_sequences WHERE id = ?',
      [req.params.id]
    );
    if (!row) {
      return res.status(404).json({ error: 'Sequence not found' });
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sequence', details: err?.message });
  }
});

// POST /api/serials - Create or update sequence
serialsRouter.post('/', (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      current_value = 1,
      start_value = 1,
      increment_by = 1,
      min_digits = 6,
      prefix = '',
      suffix = '',
      reset_policy = 'never',
      copies_per_serial = 1,
    } = req.body;

    const seqId = id || `seq-${Date.now()}`;
    const now = new Date().toISOString();

    dbService.execute(
      `INSERT OR REPLACE INTO serial_sequences 
       (id, name, current_value, start_value, increment_by, min_digits, prefix, suffix, reset_policy, last_reset_date, copies_per_serial, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seqId,
        name || 'Standard Sequence',
        Number(current_value),
        Number(start_value),
        Number(increment_by),
        Number(min_digits),
        prefix,
        suffix,
        reset_policy,
        now,
        Number(copies_per_serial),
        now,
      ]
    );

    const saved = dbService.queryOne<SerialSequenceRecord>(
      'SELECT * FROM serial_sequences WHERE id = ?',
      [seqId]
    );

    logBackendAudit(
      req.body.user || 'System',
      'Administrator',
      'SERIAL_SEQUENCE_SAVED',
      `Configured sequence "${name}" (Start: ${start_value}, Current: ${current_value}, Policy: ${reset_policy})`,
      seqId,
      name
    );

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save serial sequence', details: err?.message });
  }
});

// POST /api/serials/:id/next - Atomically allocate N serial numbers
serialsRouter.post('/:id/next', (req: Request, res: Response) => {
  try {
    const { count = 1, requestedBy = 'Print Operator' } = req.body;
    const allocationCount = Math.max(1, parseInt(String(count), 10));

    const seq = dbService.queryOne<SerialSequenceRecord>(
      'SELECT * FROM serial_sequences WHERE id = ?',
      [req.params.id]
    );

    if (!seq) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    const startVal = seq.current_value;
    const step = seq.increment_by || 1;
    const endVal = startVal + step * (allocationCount - 1);
    const nextCurrentVal = endVal + step;

    // Generate formatted list
    const formattedList: string[] = [];
    for (let i = 0; i < allocationCount; i++) {
      const val = startVal + step * i;
      formattedList.push(formatSerial(val, seq));
    }

    const now = new Date().toISOString();
    // Update current_value atomically in database
    dbService.execute(
      'UPDATE serial_sequences SET current_value = ?, updated_at = ? WHERE id = ?',
      [nextCurrentVal, now, seq.id]
    );

    logBackendAudit(
      requestedBy,
      'Print Operator',
      'SERIAL_ALLOCATION',
      `Allocated ${allocationCount} serials from sequence "${seq.name}": ${formattedList[0]} -> ${formattedList[formattedList.length - 1]}`,
      seq.id,
      seq.name
    );

    res.json({
      sequenceId: seq.id,
      sequenceName: seq.name,
      startValue: startVal,
      endValue: endVal,
      nextValue: nextCurrentVal,
      count: allocationCount,
      serials: formattedList,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to allocate serial numbers', details: err?.message });
  }
});

// POST /api/serials/:id/reset - Reset sequence to start value
serialsRouter.post('/:id/reset', (req: Request, res: Response) => {
  try {
    const { resetBy = 'Administrator', reason = 'Manual Reset' } = req.body;

    const seq = dbService.queryOne<SerialSequenceRecord>(
      'SELECT * FROM serial_sequences WHERE id = ?',
      [req.params.id]
    );

    if (!seq) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    const now = new Date().toISOString();
    dbService.execute(
      'UPDATE serial_sequences SET current_value = start_value, last_reset_date = ?, updated_at = ? WHERE id = ?',
      [now, now, seq.id]
    );

    logBackendAudit(
      resetBy,
      'Administrator',
      'SERIAL_SEQUENCE_RESET',
      `Reset sequence "${seq.name}" to start value ${seq.start_value}. Reason: ${reason}`,
      seq.id,
      seq.name
    );

    res.json({
      success: true,
      message: `Sequence "${seq.name}" reset to ${seq.start_value}`,
      sequence: { ...seq, current_value: seq.start_value, last_reset_date: now },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset sequence', details: err?.message });
  }
});

// DELETE /api/serials/:id
serialsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    dbService.execute('DELETE FROM serial_sequences WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sequence deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete sequence', details: err?.message });
  }
});
