import crypto from 'crypto';
import { StorageService } from './storageService';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  details: string;
  entityId?: string;
  entityName?: string;
  ipAddress?: string;
  previousHash: string; // Cryptographic SHA-256 link to previous entry
  recordHash: string;   // SHA-256 seal of this log entry
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalRecords: number;
  compromisedRecordId: string | null;
  compromisedIndex: number | null;
  message: string;
  verifiedAt: string;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeSha256(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function logBackendAudit(
  user: string,
  userRole: string,
  action: string,
  details: string,
  entityId?: string,
  entityName?: string,
  ipAddress: string = '127.0.0.1'
): AuditLogItem {
  const storage = StorageService.getInstance();
  const logs = storage.read<AuditLogItem>('auditLogs', []);

  // Find the most recent record that has a recordHash
  const lastHashedRecord = logs.find((l) => Boolean(l.recordHash));
  const previousHash = lastHashedRecord ? lastHashedRecord.recordHash : GENESIS_HASH;
  const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const timestamp = new Date().toISOString();

  const hashPayload = `${previousHash}|${id}|${timestamp}|${user || 'System'}|${userRole || 'Operator'}|${action}|${details}|${entityId || ''}`;
  const recordHash = computeSha256(hashPayload);

  const entry: AuditLogItem = {
    id,
    timestamp,
    user: user || 'System User',
    userRole: userRole || 'Operator',
    action,
    details,
    entityId,
    entityName,
    ipAddress,
    previousHash,
    recordHash,
  };

  logs.unshift(entry);
  storage.write('auditLogs', logs);
  return entry;
}

/**
 * Validates the cryptographic SHA-256 chain of all audit log records (FDA 21 CFR Part 11)
 */
export function verifyAuditTrailIntegrity(): AuditVerificationResult {
  const storage = StorageService.getInstance();
  const logs = storage.read<AuditLogItem>('auditLogs', []);

  if (logs.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      compromisedRecordId: null,
      compromisedIndex: null,
      message: 'Audit trail is empty. No records to verify.',
      verifiedAt: new Date().toISOString(),
    };
  }

  // Iterate in chronological order: from oldest to newest
  const chronological = [...logs].reverse();
  let previousHashInChain = GENESIS_HASH;
  let verifiedCount = 0;

  for (let i = 0; i < chronological.length; i++) {
    const entry = chronological[i];

    // Skip unhashed legacy entries from pre-cryptographic versions
    if (!entry.recordHash) {
      continue;
    }

    // Verify cryptographic link to previous hash
    const expectedPreviousHash = previousHashInChain;
    if (entry.previousHash !== expectedPreviousHash) {
      return {
        isValid: false,
        totalRecords: logs.length,
        compromisedRecordId: entry.id,
        compromisedIndex: i,
        message: `Tampering detected at record ${entry.id}: previous hash mismatch. Expected ${expectedPreviousHash.substring(0, 12)}..., found ${entry.previousHash.substring(0, 12)}...`,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Verify data integrity seal (recompute record SHA-256)
    const hashPayload = `${entry.previousHash}|${entry.id}|${entry.timestamp}|${entry.user}|${entry.userRole}|${entry.action}|${entry.details}|${entry.entityId || ''}`;
    const recomputed = computeSha256(hashPayload);
    if (recomputed !== entry.recordHash) {
      return {
        isValid: false,
        totalRecords: logs.length,
        compromisedRecordId: entry.id,
        compromisedIndex: i,
        message: `Tampering detected at record ${entry.id}: data integrity signature failed.`,
        verifiedAt: new Date().toISOString(),
      };
    }

    previousHashInChain = entry.recordHash;
    verifiedCount++;
  }

  return {
    isValid: true,
    totalRecords: logs.length,
    compromisedRecordId: null,
    compromisedIndex: null,
    message: `All ${logs.length} audit records analyzed (${verifiedCount} cryptographically sealed records verified). SHA-256 chain is 100% intact.`,
    verifiedAt: new Date().toISOString(),
  };
}

export class AuditService {
  private static instance: AuditService;

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public log(action: string, details: string, user: string = 'System Admin', userRole: string = 'Admin'): AuditLogItem {
    return logBackendAudit(user, userRole, action, details);
  }

  public verifyIntegrity(): AuditVerificationResult {
    return verifyAuditTrailIntegrity();
  }
}
