import { Router, Request, Response } from 'express';
import { DatabaseService } from '../db/databaseService';
import { logBackendAudit } from '../services/auditService';

export const countersRouter = Router();
const dbService = DatabaseService.getInstance();

export interface CounterRecord {
  id: string;
  name: string;
  type: 'batch' | 'carton' | 'pallet' | 'print' | 'custom';
  current_value: number;
  start_value: number;
  step: number;
  pad_length: number;
  max_value: number | null;
  reset_policy: 'manual' | 'daily' | 'per_job' | 'max_reached';
  last_reset_date: string | null;
  updated_at: string;
}

// GET /api/counters - List all counters
countersRouter.get('/', (req: Request, res: Response) => {
  try {
    const rows = dbService.query<CounterRecord>('SELECT * FROM counters ORDER BY name ASC');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch counters', details: err?.message });
  }
});

// GET /api/counters/:id - Get counter
countersRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const row = dbService.queryOne<CounterRecord>('SELECT * FROM counters WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ error: 'Counter not found' });
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch counter', details: err?.message });
  }
});

// POST /api/counters - Create or update counter
countersRouter.post('/', (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      type = 'batch',
      current_value = 0,
      start_value = 0,
      step = 1,
      pad_length = 0,
      max_value = null,
      reset_policy = 'manual',
    } = req.body;

    const counterId = id || `cnt-${Date.now()}`;
    const now = new Date().toISOString();

    dbService.execute(
      `INSERT OR REPLACE INTO counters 
       (id, name, type, current_value, start_value, step, pad_length, max_value, reset_policy, last_reset_date, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        counterId,
        name || 'Standard Counter',
        type,
        Number(current_value),
        Number(start_value),
        Number(step),
        Number(pad_length),
        max_value !== null && max_value !== undefined ? Number(max_value) : null,
        reset_policy,
        now,
        now,
      ]
    );

    const saved = dbService.queryOne<CounterRecord>('SELECT * FROM counters WHERE id = ?', [counterId]);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save counter', details: err?.message });
  }
});

// POST /api/counters/:id/increment - Increment counter
countersRouter.post('/:id/increment', (req: Request, res: Response) => {
  try {
    const { amount, updatedBy = 'Operator' } = req.body;

    const counter = dbService.queryOne<CounterRecord>('SELECT * FROM counters WHERE id = ?', [req.params.id]);
    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    const delta = amount !== undefined ? Number(amount) : counter.step || 1;
    let nextVal = counter.current_value + delta;

    // Check max_value rollover
    if (counter.max_value !== null && counter.max_value !== undefined && nextVal > counter.max_value) {
      if (counter.reset_policy === 'max_reached') {
        nextVal = counter.start_value;
      }
    }

    const now = new Date().toISOString();
    dbService.execute('UPDATE counters SET current_value = ?, updated_at = ? WHERE id = ?', [
      nextVal,
      now,
      counter.id,
    ]);

    const formatted =
      counter.pad_length > 0 ? String(nextVal).padStart(counter.pad_length, '0') : String(nextVal);

    res.json({
      id: counter.id,
      name: counter.name,
      type: counter.type,
      previousValue: counter.current_value,
      currentValue: nextVal,
      formatted,
      updatedAt: now,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to increment counter', details: err?.message });
  }
});

// POST /api/counters/:id/reset - Reset counter to start value
countersRouter.post('/:id/reset', (req: Request, res: Response) => {
  try {
    const { resetBy = 'Supervisor', reason = 'Manual Reset' } = req.body;

    const counter = dbService.queryOne<CounterRecord>('SELECT * FROM counters WHERE id = ?', [req.params.id]);
    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    const now = new Date().toISOString();
    dbService.execute(
      'UPDATE counters SET current_value = start_value, last_reset_date = ?, updated_at = ? WHERE id = ?',
      [now, now, counter.id]
    );

    logBackendAudit(
      resetBy,
      'Supervisor',
      'COUNTER_RESET',
      `Reset counter "${counter.name}" (${counter.type}) to start value ${counter.start_value}. Reason: ${reason}`,
      counter.id,
      counter.name
    );

    res.json({
      success: true,
      message: `Counter "${counter.name}" reset to ${counter.start_value}`,
      counter: { ...counter, current_value: counter.start_value, last_reset_date: now },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset counter', details: err?.message });
  }
});

// DELETE /api/counters/:id
countersRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    dbService.execute('DELETE FROM counters WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Counter deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete counter', details: err?.message });
  }
});
