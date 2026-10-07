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

// GET /api/serials/orphans - Scan for unresolved reservations
serialsRouter.get('/orphans', (req: Request, res: Response) => {
  try {
    const rows = dbService.query<any>(
      `SELECT * FROM serialization_reservations 
       WHERE status IN ('RESERVED', 'SUBMITTED', 'UNKNOWN', 'PRINTED_OR_SUBMITTED_BUT_COMMIT_FAILED')
       ORDER BY created_at DESC`
    );
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch orphan reservations', details: err?.message });
  }
});

// GET /api/serials/journal - Audit trail
serialsRouter.get('/journal', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    let sql = 'SELECT * FROM serialization_journal ';
    const params: any[] = [];
    if (sourceId) {
      sql += 'WHERE source_id = ? ';
      params.push(sourceId);
    }
    sql += 'ORDER BY timestamp DESC LIMIT 200';
    const rows = dbService.query<any>(sql, params);
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch serialization journal', details: err?.message });
  }
});

// POST /api/serials/resolve-orphan - Resolve orphan reservation
serialsRouter.post('/resolve-orphan', (req: Request, res: Response) => {
  try {
    const { reservationId, action, resolutionReason = 'Operator manual resolution' } = req.body;
    if (!reservationId || !action) {
      return res.status(400).json({ error: 'Missing reservationId or action' });
    }

    const resRecord = dbService.queryOne<any>(
      'SELECT * FROM serialization_reservations WHERE id = ?',
      [reservationId]
    );

    if (!resRecord) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const now = new Date().toISOString();

    if (action === 'rollback') {
      dbService.execute(
        `UPDATE serialization_reservations SET status = 'ROLLED_BACK', error = ?, updated_at = ? WHERE id = ?`,
        [resolutionReason, now, reservationId]
      );
    } else if (action === 'mark_printed') {
      dbService.execute(
        `UPDATE serialization_reservations SET status = 'COMMITTED', printed_count = count, remaining_count = 0, updated_at = ? WHERE id = ?`,
        [now, reservationId]
      );
      dbService.execute(
        `UPDATE serialization_sources SET current_committed_value = ?, version = version + 1, last_committed_at = ?, updated_at = ? WHERE id = ?`,
        [resRecord.end_value, now, now, resRecord.source_id]
      );
    }

    const journalId = `jnl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dbService.execute(
      `INSERT INTO serialization_journal (id, source_id, old_value, new_value, reservation_id, timestamp, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [journalId, resRecord.source_id, resRecord.start_value, resRecord.end_value, reservationId, now, `Orphan Resolved (${action}): ${resolutionReason}`, action === 'rollback' ? 'rolled_back' : 'committed']
    );

    res.json({ success: true, reservationId, action, message: `Reservation resolved as ${action}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resolve orphan reservation', details: err?.message });
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

// ==========================================================
// ENTERPRISE ATOMIC SERIAL RESERVATION & PERSISTENCE APIS
// ==========================================================

// POST /api/serials/reserve - Atomic range reservation
serialsRouter.post('/reserve', (req: Request, res: Response) => {
  try {
    const {
      sourceId,
      documentId = 'doc-current',
      jobId = `PJ-${Date.now()}`,
      startValue,
      endValue,
      count = 1,
      clientRequestId,
      expectedVersion,
      definition = {},
    } = req.body;

    if (!sourceId || startValue === undefined || endValue === undefined) {
      return res.status(400).json({ error: 'Missing required reservation parameters (sourceId, startValue, endValue)' });
    }

    const now = new Date().toISOString();

    // 1. Idempotency Check: if identical clientRequestId is active, return existing reservation
    if (clientRequestId) {
      const existing = dbService.queryOne<any>(
        'SELECT * FROM serialization_reservations WHERE client_request_id = ? AND status IN ("RESERVED", "SUBMITTED", "COMMITTED")',
        [clientRequestId]
      );
      if (existing) {
        return res.json({ success: true, reservation: existing, idempotent: true });
      }
    }

    // 2. Fetch or initialize serialization source record
    let source = dbService.queryOne<any>(
      'SELECT * FROM serialization_sources WHERE id = ?',
      [sourceId]
    );

    if (!source) {
      dbService.execute(
        `INSERT INTO serialization_sources (id, name, current_committed_value, version, definition_json, last_committed_at, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
        [sourceId, definition.name || sourceId, String(startValue), JSON.stringify(definition), now, now, now]
      );
      source = { id: sourceId, version: 1, current_committed_value: String(startValue) };
    } else if (expectedVersion !== undefined && source.version !== expectedVersion) {
      return res.status(409).json({
        error: 'SERIAL_RESERVATION_CONFLICT',
        message: `Version conflict for serial source "${sourceId}". Expected v${expectedVersion}, found v${source.version}.`,
        currentVersion: source.version,
        currentCommittedValue: source.current_committed_value,
      });
    }

    // 3. Create Reservation
    const reservationId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dbService.execute(
      `INSERT INTO serialization_reservations 
       (id, source_id, document_id, job_id, start_value, end_value, count, status, printed_count, remaining_count, client_request_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RESERVED', 0, ?, ?, ?, ?)`,
      [
        reservationId,
        sourceId,
        documentId,
        jobId,
        String(startValue),
        String(endValue),
        Number(count),
        Number(count),
        clientRequestId || null,
        now,
        now,
      ]
    );

    const savedReservation = dbService.queryOne<any>(
      'SELECT * FROM serialization_reservations WHERE id = ?',
      [reservationId]
    );

    logBackendAudit(
      req.body.user || 'Print Operator',
      'Operator',
      'SERIAL_RESERVED',
      `Reserved serial range ${startValue} -> ${endValue} (${count} items) for Job ${jobId}`,
      sourceId,
      sourceId
    );

    res.status(201).json({
      success: true,
      reservation: savedReservation,
      sourceVersion: source.version,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reserve serial range', details: err?.message });
  }
});

// POST /api/serials/commit - Atomic commit of printed serials
serialsRouter.post('/commit', (req: Request, res: Response) => {
  try {
    const {
      reservationId,
      sourceId,
      finalValue,
      printedCount = 1,
      jobId,
      reason = 'Confirmed print dispatch',
    } = req.body;

    if (!reservationId || !sourceId || finalValue === undefined) {
      return res.status(400).json({ error: 'Missing required commit parameters (reservationId, sourceId, finalValue)' });
    }

    const now = new Date().toISOString();

    const reservation = dbService.queryOne<any>(
      'SELECT * FROM serialization_reservations WHERE id = ?',
      [reservationId]
    );

    const source = dbService.queryOne<any>(
      'SELECT * FROM serialization_sources WHERE id = ?',
      [sourceId]
    );

    const oldValue = source?.current_committed_value || reservation?.start_value || '000001';

    // 1. Update reservation status
    dbService.execute(
      `UPDATE serialization_reservations 
       SET status = 'COMMITTED', printed_count = ?, remaining_count = 0, updated_at = ?
       WHERE id = ?`,
      [Number(printedCount), now, reservationId]
    );

    // 2. Update source current committed value & increment optimistic version
    const newVersion = (source?.version || 1) + 1;
    if (source) {
      dbService.execute(
        `UPDATE serialization_sources 
         SET current_committed_value = ?, version = ?, last_committed_at = ?, updated_at = ?
         WHERE id = ?`,
        [String(finalValue), newVersion, now, now, sourceId]
      );
    } else {
      dbService.execute(
        `INSERT INTO serialization_sources (id, name, current_committed_value, version, definition_json, last_committed_at, created_at, updated_at)
         VALUES (?, ?, ?, 1, '{}', ?, ?, ?)`,
        [sourceId, sourceId, String(finalValue), now, now, now]
      );
    }

    // 3. Record in Journal
    const journalId = `jnl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dbService.execute(
      `INSERT INTO serialization_journal (id, source_id, old_value, new_value, job_id, reservation_id, timestamp, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'committed')`,
      [journalId, sourceId, String(oldValue), String(finalValue), jobId || reservation?.job_id || null, reservationId, now, reason]
    );

    logBackendAudit(
      req.body.user || 'Print Operator',
      'Operator',
      'SERIAL_COMMITTED',
      `Committed serial ${oldValue} -> ${finalValue} (${printedCount} labels printed)`,
      sourceId,
      sourceId
    );

    res.json({
      success: true,
      sourceId,
      committedValue: String(finalValue),
      newVersion,
      reservationId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SERIAL_COMMIT_FAILED', details: err?.message });
  }
});

// POST /api/serials/rollback - Rollback unprinted reservation
serialsRouter.post('/rollback', (req: Request, res: Response) => {
  try {
    const { reservationId, reason = 'Print job cancelled or aborted', sourceId } = req.body;
    if (!reservationId) {
      return res.status(400).json({ error: 'Missing reservationId' });
    }

    const now = new Date().toISOString();
    const reservation = dbService.queryOne<any>(
      'SELECT * FROM serialization_reservations WHERE id = ?',
      [reservationId]
    );

    dbService.execute(
      `UPDATE serialization_reservations 
       SET status = 'ROLLED_BACK', error = ?, updated_at = ?
       WHERE id = ?`,
      [reason, now, reservationId]
    );

    // Record rollback in Journal
    const effectiveSourceId = sourceId || reservation?.source_id || 'unknown';
    const journalId = `jnl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dbService.execute(
      `INSERT INTO serialization_journal (id, source_id, old_value, new_value, job_id, reservation_id, timestamp, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rolled_back')`,
      [
        journalId,
        effectiveSourceId,
        reservation?.start_value || '',
        reservation?.end_value || '',
        reservation?.job_id || null,
        reservationId,
        now,
        reason,
      ]
    );

    logBackendAudit(
      req.body.user || 'Print Operator',
      'Operator',
      'SERIAL_ROLLBACK',
      `Rolled back reservation ${reservationId}. Reason: ${reason}`,
      effectiveSourceId,
      effectiveSourceId
    );

    res.json({ success: true, message: `Reservation ${reservationId} rolled back successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to rollback reservation', details: err?.message });
  }
});

// POST /api/serials/partial - Mark partial print
serialsRouter.post('/partial', (req: Request, res: Response) => {
  try {
    const {
      reservationId,
      sourceId,
      confirmedValue,
      printedCount = 0,
      remainingCount = 0,
      lastBatchIndex = 0,
      error = 'Partial print interruption',
    } = req.body;

    const now = new Date().toISOString();

    dbService.execute(
      `UPDATE serialization_reservations 
       SET status = 'PARTIALLY_PRINTED', printed_count = ?, remaining_count = ?, error = ?, updated_at = ?
       WHERE id = ?`,
      [Number(printedCount), Number(remainingCount), error, now, reservationId]
    );

    if (sourceId && confirmedValue) {
      dbService.execute(
        `UPDATE serialization_sources 
         SET current_committed_value = ?, version = version + 1, last_committed_at = ?, updated_at = ?
         WHERE id = ?`,
        [String(confirmedValue), now, now, sourceId]
      );
    }

    const journalId = `jnl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dbService.execute(
      `INSERT INTO serialization_journal (id, source_id, old_value, new_value, reservation_id, timestamp, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'partial')`,
      [journalId, sourceId || 'unknown', '', String(confirmedValue || ''), reservationId, now, `Partial: ${printedCount} printed, ${remainingCount} remaining. ${error}`]
    );

    res.json({ success: true, reservationId, printedCount, remainingCount, confirmedValue });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record partial print', details: err?.message });
  }
});

