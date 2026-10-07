import { SerializationConfig } from '../types';

/**
 * Utility to increment/decrement alphabetic sequence:
 * A -> B ... Z -> AA -> AB
 * z -> aa -> ab
 */
export function stepAlphabetic(str: string, step: number, isLower = false): string {
  if (!str) return isLower ? 'a' : 'A';
  
  // Convert alphabetic string to base-26 numeric value (1-indexed)
  let val = 0;
  const baseCode = isLower ? 97 : 65;
  const upper = str.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    val = val * 26 + (upper.charCodeAt(i) - 64);
  }

  val += step;
  if (val < 1) val = 1;

  // Convert back to base-26 letters
  let res = '';
  while (val > 0) {
    const rem = (val - 1) % 26;
    res = String.fromCharCode(baseCode + rem) + res;
    val = Math.floor((val - 1) / 26);
  }

  return res;
}

/**
 * Bijective Alphabetic Stepping supporting custom letter sets (e.g. without I & O or without l)
 */
export function stepAlphabeticWithAlphabet(str: string, alphabet: string, step: number): string {
  if (!str) return alphabet[0] || 'A';
  const N = alphabet.length;
  let val = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i]);
    const charVal = idx >= 0 ? idx + 1 : 1;
    val = val * N + charVal;
  }
  val += step;
  if (val < 1) val = 1;
  let res = '';
  while (val > 0) {
    const rem = (val - 1) % N;
    res = alphabet[rem] + res;
    val = Math.floor((val - 1) / N);
  }
  return res;
}

/**
 * Increment/decrement Hexadecimal string (0-9, A-F) with length preservation
 */
export function stepHexadecimal(str: string, step: number, isLower = false, preserveLength = true): string {
  if (!str) return '0';
  const hexMatch = str.match(/^(.*?)([0-9a-fA-F]+)$/);
  if (!hexMatch) {
    const num = parseInt(str, 16) || 0;
    const nextNum = Math.max(0, num + step);
    let hexStr = nextNum.toString(16);
    return isLower ? hexStr.toLowerCase() : hexStr.toUpperCase();
  }

  const prefix = hexMatch[1];
  const digits = hexMatch[2];
  const origLen = digits.length;
  const num = parseInt(digits, 16);
  const nextNum = Math.max(0, num + step);
  let hexStr = nextNum.toString(16);
  if (isLower) {
    hexStr = hexStr.toLowerCase();
  } else {
    hexStr = hexStr.toUpperCase();
  }
  if (preserveLength && hexStr.length < origLen) {
    hexStr = hexStr.padStart(origLen, '0');
  }
  return `${prefix}${hexStr}`;
}

/**
 * Base-N / Positional Custom Sequence Stepping (e.g. alphanumeric base-36, custom tokens)
 */
export function stepCustomSequence(str: string, alphabet: string, step: number, preserveLength = true): string {
  if (!alphabet || alphabet.length < 2) return str;
  if (!str) return alphabet[0];

  const N = BigInt(alphabet.length);
  let val = 0n;
  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i]);
    const charVal = BigInt(idx >= 0 ? idx : 0);
    val = val * N + charVal;
  }
  val += BigInt(step);
  if (val < 0n) val = 0n;
  let res = '';
  let temp = val;
  while (temp > 0n) {
    const rem = Number(temp % N);
    res = alphabet[rem] + res;
    temp = temp / N;
  }
  if (!res) res = alphabet[0];
  if (preserveLength && res.length < str.length) {
    res = res.padStart(str.length, alphabet[0]);
  }
  return res;
}

/**
 * Increment/decrement numeric string with padding preservation
 */
export function stepNumeric(str: string, step: number, preserveLength = false): string {
  const match = str.match(/^([+-]?\d+)$/);
  if (!match) {
    // If string has trailing digits (e.g. "ITEM-001"), increment only the numeric suffix
    const trailingMatch = str.match(/^(.*?)(\d+)$/);
    if (trailingMatch) {
      const pfx = trailingMatch[1];
      const digits = trailingMatch[2];
      return `${pfx}${stepNumeric(digits, step, preserveLength)}`;
    }
    const num = parseInt(str, 10) || 0;
    const resNum = Math.max(0, num + step);
    return String(resNum);
  }

  const rawDigits = match[1];
  const originalLen = rawDigits.length;
  const isPadded = rawDigits.startsWith('0') && originalLen > 1;
  const num = parseInt(rawDigits, 10);
  const nextNum = Math.max(0, num + step);

  if (preserveLength || isPadded) {
    const nextStr = String(nextNum);
    if (nextStr.length < originalLen) {
      return nextStr.padStart(originalLen, '0');
    }
    return nextStr;
  }

  return String(nextNum);
}

/**
 * Increment/decrement alphanumeric string (e.g. A009 -> A010, SN-001 -> SN-002, A999 -> B000)
 */
export function stepAlphanumeric(str: string, step: number, preserveLength = true): string {
  if (!str) return stepNumeric('1', step - 1, preserveLength);

  // Match trailing digits if any: e.g. "A009" => prefix "A", digits "009"
  const trailingDigitsMatch = str.match(/^(.*?)(\d+)$/);
  if (trailingDigitsMatch) {
    const prefix = trailingDigitsMatch[1];
    const digits = trailingDigitsMatch[2];
    const digitLen = digits.length;
    const num = parseInt(digits, 10);
    const maxVal = Math.pow(10, digitLen);
    const nextNum = num + step;

    if (nextNum >= 0 && nextNum < maxVal) {
      // Normal within-digit range
      const isOriginalPadded = digits.startsWith('0') && digitLen > 1;
      const nextDigits = (preserveLength || isOriginalPadded)
        ? String(nextNum).padStart(digitLen, '0')
        : String(nextNum);
      return `${prefix}${nextDigits}`;
    }

    // Rollover into alphabetic prefix only if prefix consists of pure letters without hyphens/symbols (e.g. A999 -> B000, Z999 -> AA000)
    const isPureAlphaPrefix = /^[a-zA-Z]{1,2}$/.test(prefix);
    if (nextNum >= maxVal && isPureAlphaPrefix) {
      // Overflow into alphabetic prefix
      const overflowCount = Math.floor(nextNum / maxVal);
      const remainderNum = nextNum % maxVal;
      const nextPrefix = stepAlphabetic(prefix, overflowCount, prefix === prefix.toLowerCase());
      const padded = String(remainderNum).padStart(digitLen, '0');
      return `${nextPrefix}${padded}`;
    }

    if (nextNum < 0 && isPureAlphaPrefix) {
      // Underflow into alphabetic prefix: e.g. B000 - 1 -> A999, AA000 - 1 -> Z999
      const underflowCount = Math.ceil(Math.abs(nextNum) / maxVal);
      const remainderNum = (nextNum % maxVal + maxVal) % maxVal;
      const nextPrefix = stepAlphabetic(prefix, -underflowCount, prefix === prefix.toLowerCase());
      const padded = String(remainderNum).padStart(digitLen, '0');
      return `${nextPrefix}${padded}`;
    }

    // For word/hyphenated prefixes like "BOX-" or "SN-", expand digits or preserve floor
    const isOriginalPadded = digits.startsWith('0') && digitLen > 1;
    const nextDigits = (preserveLength || isOriginalPadded)
      ? String(Math.max(0, nextNum)).padStart(digitLen, '0')
      : String(Math.max(0, nextNum));
    return `${prefix}${nextDigits}`;
  }

  // Pure letters: e.g. "ABC"
  const isAllLetters = /^[a-zA-Z]+$/.test(str);
  if (isAllLetters) {
    return stepAlphabetic(str, step, str === str.toLowerCase());
  }

  // Fallback to numeric
  return stepNumeric(str, step, preserveLength);
}

/**
 * Evaluates serialized value based on config and item/record/copy indices
 */
export function evaluateSerializedValue(
  initialValue: string,
  config?: SerializationConfig,
  context?: {
    printIndex?: number;
    recordIndex?: number;
    copyIndex?: number;
    copiesPerRecord?: number;
    record?: Record<string, any>;
    namedSources?: Record<string, any>;
  }
): string {
  if (!config || config.action === 'none') {
    return initialValue || '';
  }

  const action = config.action;
  const method = config.method || 'alphanumeric';

  let incrementBy = config.incrementBy !== undefined ? config.incrementBy : (config as any).step;
  if (incrementBy === undefined || incrementBy === 0) incrementBy = 1;
  if (config.incrementBySource) {
    if (config.incrementBySource.sourceType === 'database' && config.incrementBySource.databaseField && context?.record) {
      const val = parseInt(context.record[config.incrementBySource.databaseField], 10);
      if (!isNaN(val) && val > 0) incrementBy = val;
    } else if (config.incrementBySource.sourceType === 'named_source' && config.incrementBySource.namedSource && context?.namedSources) {
      const val = parseInt(context.namedSources[config.incrementBySource.namedSource], 10);
      if (!isNaN(val) && val > 0) incrementBy = val;
    } else if (config.incrementBySource.value) {
      incrementBy = config.incrementBySource.value;
    }
  }

  let interval = Math.max(1, config.eventInterval || (config as any).interval || 1);
  if (config.eventIntervalSource) {
    if (config.eventIntervalSource.sourceType === 'database' && config.eventIntervalSource.databaseField && context?.record) {
      const val = parseInt(context.record[config.eventIntervalSource.databaseField], 10);
      if (!isNaN(val) && val > 0) interval = val;
    } else if (config.eventIntervalSource.sourceType === 'named_source' && config.eventIntervalSource.namedSource && context?.namedSources) {
      const val = parseInt(context.namedSources[config.eventIntervalSource.namedSource], 10);
      if (!isNaN(val) && val > 0) interval = val;
    } else if (config.eventIntervalSource.value) {
      interval = config.eventIntervalSource.value;
    }
  }

  let copiesPerSerial = Math.max(1, config.copies || (config as any).copiesPerValue || 1);
  if (config.copiesSource) {
    if (config.copiesSource.sourceType === 'database' && config.copiesSource.databaseField && context?.record) {
      const val = parseInt(context.record[config.copiesSource.databaseField], 10);
      if (!isNaN(val) && val > 0) copiesPerSerial = val;
    } else if (config.copiesSource.sourceType === 'named_source' && config.copiesSource.namedSource && context?.namedSources) {
      const val = parseInt(context.namedSources[config.copiesSource.namedSource], 10);
      if (!isNaN(val) && val > 0) copiesPerSerial = val;
    } else if (config.copiesSource.value) {
      copiesPerSerial = config.copiesSource.value;
    }
  }

  const preserveLength = config.preserveCharacters !== false && (config as any).preserveLength !== false;
  const rawEvent = (config.event as string) || 'standard';

  const printIndex = context?.printIndex ?? 0;
  const recordIndex = context?.recordIndex ?? 0;
  const copyIndex = context?.copyIndex ?? 0;

  // Calculate effective step multiplier based on BarTender Event rules
  let stepMultiplier = 0;
  if (rawEvent === 'standard') {
    // Standard: the "Serial Numbers" and "Copies per Serial Number" settings set event frequency
    stepMultiplier = Math.floor(printIndex / (interval * copiesPerSerial));
  } else if (rawEvent === 'record') {
    // Every record
    stepMultiplier = Math.floor(recordIndex / interval);
  } else if (rawEvent === 'page') {
    // Every page
    const pageIndex = (context as any)?.pageIndex ?? recordIndex;
    stepMultiplier = Math.floor(pageIndex / interval);
  } else if (rawEvent === 'job') {
    // Every print job
    const jobIndex = (context as any)?.jobIndex ?? 0;
    stepMultiplier = Math.floor(jobIndex / interval);
  } else if (rawEvent === 'data_change') {
    // When data changes
    const changeIndex = (context as any)?.dataItemChangeIndex ?? recordIndex;
    stepMultiplier = Math.floor(changeIndex / interval);
  } else if (rawEvent === 'copy' || rawEvent === 'item') {
    // Every copy (increments per physical label)
    stepMultiplier = Math.floor(printIndex / interval);
  } else if (rawEvent === 'interval') {
    stepMultiplier = Math.floor(printIndex / (interval * copiesPerSerial));
  } else {
    stepMultiplier = Math.floor(printIndex / (interval * copiesPerSerial));
  }

  const effectiveStep = (action === 'decrement' ? -1 : 1) * incrementBy * stepMultiplier;
  let result = initialValue;

  if (effectiveStep !== 0) {
    if (method === 'numeric') {
      result = stepNumeric(initialValue, effectiveStep, preserveLength);
    } else if (method === 'hexadecimal') {
      const isLower = config.letterCase === 'lowercase_hex' || config.letterCase === 'lowercase';
      result = stepHexadecimal(initialValue, effectiveStep, isLower, preserveLength);
    } else if (method === 'alphabetic') {
      let alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (config.letterCase === 'uppercase_no_io') {
        alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      } else if (config.letterCase === 'lowercase_no_l') {
        alpha = 'abcdefghijkmnopqrstuvwxyz';
      } else if (config.letterCase === 'lowercase' || initialValue === initialValue.toLowerCase()) {
        alpha = 'abcdefghijklmnopqrstuvwxyz';
      }
      result = stepAlphabeticWithAlphabet(initialValue, alpha, effectiveStep);
    } else if (method === 'custom') {
      const alphabet = config.customSequence || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      result = stepCustomSequence(initialValue, alphabet, effectiveStep, preserveLength);
    } else {
      // Both 'alphabetic_and_numeric' (BarTender default) and 'alphanumeric'
      result = stepAlphanumeric(initialValue, effectiveStep, preserveLength);
    }
  }

  if (config.prefix) result = `${config.prefix}${result}`;
  if (config.suffix) result = `${result}${config.suffix}`;

  return result;
}

export interface PreviewSequenceItem {
  printIndex: number;
  recordIndex: number;
  copyIndex: number;
  serializedValue: string;
  finalValue: string;
}

/**
 * Non-destructive preview sequence generator
 */
export function generatePreviewSequence(
  initialValue: string,
  config: SerializationConfig,
  options: {
    recordCount?: number;
    copies?: number;
    serialNumbers?: number;
    prefix?: string;
    suffix?: string;
    maxItems?: number;
    record?: Record<string, any>;
    namedSources?: Record<string, any>;
  } = {}
): PreviewSequenceItem[] {
  const maxItems = Math.min(200, Math.max(1, options.maxItems ?? 50));
  let copies = Math.max(1, options.copies ?? config.copies ?? 1);
  if (config.copiesSource?.sourceType === 'database' && config.copiesSource.databaseField && options.record) {
    const val = parseInt(options.record[config.copiesSource.databaseField], 10);
    if (!isNaN(val) && val > 0) copies = val;
  } else if (config.copiesSource?.sourceType === 'named_source' && config.copiesSource.namedSource && options.namedSources) {
    const val = parseInt(options.namedSources[config.copiesSource.namedSource], 10);
    if (!isNaN(val) && val > 0) copies = val;
  }

  let serialNumbers = Math.max(1, options.serialNumbers ?? config.serialNumbers ?? 1);
  if (config.serialNumbersSource?.sourceType === 'database' && config.serialNumbersSource.databaseField && options.record) {
    const val = parseInt(options.record[config.serialNumbersSource.databaseField], 10);
    if (!isNaN(val) && val > 0) serialNumbers = val;
  } else if (config.serialNumbersSource?.sourceType === 'named_source' && config.serialNumbersSource.namedSource && options.namedSources) {
    const val = parseInt(options.namedSources[config.serialNumbersSource.namedSource], 10);
    if (!isNaN(val) && val > 0) serialNumbers = val;
  }

  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';

  const hasConfiguredTotal =
    options.serialNumbers !== undefined ||
    config.serialNumbers !== undefined ||
    config.serialNumbersSource !== undefined ||
    config.copiesSource !== undefined ||
    options.recordCount !== undefined;
  let targetCount = 10;
  if (config.action === 'none') {
    const totalCopies = (options.recordCount && options.recordCount > 1 ? options.recordCount : 1) * copies;
    targetCount = options.maxItems !== undefined ? Math.min(maxItems, options.maxItems) : Math.min(maxItems, totalCopies);
  } else if (options.maxItems !== undefined) {
    targetCount = Math.min(maxItems, options.maxItems);
  } else if (hasConfiguredTotal) {
    const calculatedTotal = (options.recordCount && options.recordCount > 1 ? options.recordCount : 1) * copies * serialNumbers;
    targetCount = Math.min(maxItems, calculatedTotal);
  } else {
    targetCount = Math.min(maxItems, Math.max(serialNumbers * copies, 10));
  }

  const sequence: PreviewSequenceItem[] = [];

  for (let printIdx = 0; printIdx < targetCount; printIdx++) {
    const r = Math.floor(printIdx / copies);
    const c = printIdx % copies;

    const serializedVal = evaluateSerializedValue(initialValue, config, {
      printIndex: printIdx,
      recordIndex: r,
      copyIndex: c,
      copiesPerRecord: copies,
      record: options.record,
      namedSources: options.namedSources,
    });

    const finalVal = `${prefix}${serializedVal}${suffix}`;
    sequence.push({
      printIndex: printIdx + 1,
      recordIndex: r + 1,
      copyIndex: c + 1,
      serializedValue: serializedVal,
      finalValue: finalVal,
    });
  }

  return sequence;
}

import { SerialReservation, SerialReservationStatus, SerialJournalEntry, SerializationState } from '../types';

const RESERVATION_STORAGE_KEY = 'barcodeflow_serial_reservations';
const JOURNAL_STORAGE_KEY = 'barcodeflow_serial_journal';
const SOURCES_STORAGE_KEY = 'barcodeflow_serial_sources';

export class AtomicSerialReservationService {
  private static localReservations: SerialReservation[] = [];
  private static localJournal: SerialJournalEntry[] = [];
  private static localSources: Record<string, SerializationState> = {};

  private static getLocalReservations(): SerialReservation[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(RESERVATION_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return this.localReservations;
  }

  private static saveLocalReservations(list: SerialReservation[]): void {
    this.localReservations = list;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(list));
      }
    } catch (err) {
      console.warn('Failed to persist local reservations:', err);
    }
  }

  private static getLocalJournal(): SerialJournalEntry[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return this.localJournal;
  }

  private static appendLocalJournal(entry: SerialJournalEntry): void {
    const journal = this.getLocalJournal();
    journal.unshift(entry);
    this.localJournal = journal.slice(0, 500);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(this.localJournal));
      }
    } catch (err) {
      console.warn('Failed to persist serial journal:', err);
    }
  }

  /**
   * Reserves an exact serial range atomically
   */
  public static async reserve(
    documentId: string,
    sourceId: string,
    startValue: string,
    config: SerializationConfig,
    count: number,
    options: {
      jobId?: string;
      clientRequestId?: string;
      expectedVersion?: number;
    } = {}
  ): Promise<SerialReservation> {
    const endValue = evaluateSerializedValue(startValue, config, { printIndex: Math.max(0, count - 1) });
    const jobId = options.jobId || `PJ-${Date.now()}`;
    const reservationId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const reservation: SerialReservation = {
      id: reservationId,
      sourceId,
      documentId,
      jobId,
      startValue,
      endValue,
      count,
      status: 'RESERVED',
      printedCount: 0,
      remainingCount: count,
      clientRequestId: options.clientRequestId,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Try backend API for ACID SQLite database persistence
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/serials/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId,
            documentId,
            jobId,
            startValue,
            endValue,
            count,
            clientRequestId: options.clientRequestId,
            expectedVersion: options.expectedVersion,
            definition: config,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reservation) {
            const list = this.getLocalReservations();
            list.push(data.reservation);
            this.saveLocalReservations(list);
            return data.reservation;
          }
        }
      } catch {
        // Fallback to local durable lock
      }
    }

    // 2. Local Fallback Persistence
    const list = this.getLocalReservations();
    list.push(reservation);
    this.saveLocalReservations(list);

    this.appendLocalJournal({
      id: `jnl-${Date.now()}`,
      sourceId,
      oldValue: startValue,
      newValue: endValue,
      jobId,
      reservationId,
      timestamp: now,
      reason: `Range reserved: ${startValue} -> ${endValue} (${count} items)`,
      status: 'committed',
    });

    return reservation;
  }

  /**
   * Commits printed serial numbers, updating the authoritative sequence and journal
   */
  public static async commit(
    reservationId: string,
    sourceId: string,
    finalValue: string,
    printedCount: number = 1,
    jobId?: string,
    reason: string = 'Confirmed print dispatch'
  ): Promise<boolean> {
    const now = new Date().toISOString();

    // 1. Try Backend API
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/serials/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            sourceId,
            finalValue,
            printedCount,
            jobId,
            reason,
          }),
        });
        if (res.ok) {
          // Sync local state
          const list = this.getLocalReservations();
          const target = list.find((r) => r.id === reservationId);
          if (target) {
            target.status = 'COMMITTED';
            target.printedCount = printedCount;
            target.remainingCount = 0;
            target.updatedAt = now;
            this.saveLocalReservations(list);
          }
          return true;
        }
      } catch {
        // Fallback
      }
    }

    // 2. Local Fallback Commit
    const list = this.getLocalReservations();
    const target = list.find((r) => r.id === reservationId);
    if (target) {
      target.status = 'COMMITTED';
      target.printedCount = printedCount;
      target.remainingCount = 0;
      target.updatedAt = now;
      this.saveLocalReservations(list);
    }

    this.appendLocalJournal({
      id: `jnl-${Date.now()}`,
      sourceId,
      oldValue: target?.startValue || '',
      newValue: finalValue,
      jobId,
      reservationId,
      timestamp: now,
      reason,
      status: 'committed',
    });

    return true;
  }

  /**
   * Rolls back an unprinted reservation
   */
  public static async rollback(
    reservationId: string,
    reason: string = 'Print cancelled or aborted',
    sourceId?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();

    // 1. Backend API
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/serials/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, reason, sourceId }),
        });
        if (res.ok) {
          const list = this.getLocalReservations();
          const target = list.find((r) => r.id === reservationId);
          if (target) {
            target.status = 'ROLLED_BACK';
            target.error = reason;
            target.updatedAt = now;
            this.saveLocalReservations(list);
          }
          return true;
        }
      } catch {
        // Fallback
      }
    }

    // 2. Local Fallback
    const list = this.getLocalReservations();
    const target = list.find((r) => r.id === reservationId);
    if (target) {
      target.status = 'ROLLED_BACK';
      target.error = reason;
      target.updatedAt = now;
      this.saveLocalReservations(list);
    }

    this.appendLocalJournal({
      id: `jnl-${Date.now()}`,
      sourceId: sourceId || target?.sourceId || 'unknown',
      oldValue: target?.startValue || '',
      newValue: target?.endValue || '',
      reservationId,
      timestamp: now,
      reason: `Rollback: ${reason}`,
      status: 'rolled_back',
    });

    return true;
  }

  /**
   * Records a partial print job interruption
   */
  public static async markPartial(
    reservationId: string,
    sourceId: string,
    confirmedValue: string,
    printedCount: number,
    remainingCount: number,
    lastBatchIndex: number = 0,
    error: string = 'Partial print job interrupted'
  ): Promise<boolean> {
    const now = new Date().toISOString();

    if (typeof fetch !== 'undefined') {
      try {
        await fetch('/api/serials/partial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            sourceId,
            confirmedValue,
            printedCount,
            remainingCount,
            lastBatchIndex,
            error,
          }),
        });
      } catch {
        // Fallback
      }
    }

    const list = this.getLocalReservations();
    const target = list.find((r) => r.id === reservationId);
    if (target) {
      target.status = 'PARTIALLY_PRINTED';
      target.printedCount = printedCount;
      target.remainingCount = remainingCount;
      target.lastBatchIndex = lastBatchIndex;
      target.error = error;
      target.updatedAt = now;
      this.saveLocalReservations(list);
    }

    this.appendLocalJournal({
      id: `jnl-${Date.now()}`,
      sourceId,
      oldValue: target?.startValue || '',
      newValue: confirmedValue,
      reservationId,
      timestamp: now,
      reason: `Partial Print: ${printedCount} printed, ${remainingCount} remaining. ${error}`,
      status: 'partial' as any,
    });

    return true;
  }

  /**
   * Scans for unresolved / orphan reservations on startup or recovery check
   */
  public static async getPendingOrphanReservations(): Promise<SerialReservation[]> {
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/serials/orphans');
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) return rows;
        }
      } catch {
        // Fallback
      }
    }

    const list = this.getLocalReservations();
    return list.filter((r) =>
      ['RESERVED', 'SUBMITTED', 'UNKNOWN', 'PRINTED_OR_SUBMITTED_BUT_COMMIT_FAILED'].includes(r.status)
    );
  }

  /**
   * Resolves an orphan reservation
   */
  public static async resolveOrphan(
    reservationId: string,
    action: 'resume' | 'rollback' | 'mark_printed',
    reason: string = 'Manual operator resolution'
  ): Promise<boolean> {
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/serials/resolve-orphan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, action, resolutionReason: reason }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback
      }
    }

    const list = this.getLocalReservations();
    const target = list.find((r) => r.id === reservationId);
    if (target) {
      target.status = action === 'rollback' ? 'ROLLED_BACK' : 'COMMITTED';
      target.updatedAt = new Date().toISOString();
      target.error = reason;
      this.saveLocalReservations(list);
    }
    return true;
  }

  /**
   * Checks if an active reservation is currently pending on a source
   */
  public static hasActiveReservation(sourceId: string): boolean {
    const list = this.getLocalReservations();
    return list.some(
      (r) => r.sourceId === sourceId && ['RESERVED', 'SUBMITTED', 'PRINTING'].includes(r.status as any)
    );
  }

  /**
   * Retrieves audit journal entries
   */
  public static async getJournal(sourceId?: string): Promise<SerialJournalEntry[]> {
    if (typeof fetch !== 'undefined') {
      try {
        const url = sourceId ? `/api/serials/journal?sourceId=${encodeURIComponent(sourceId)}` : '/api/serials/journal';
        const res = await fetch(url);
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows)) return rows;
        }
      } catch {
        // Fallback
      }
    }
    const local = this.getLocalJournal();
    if (sourceId) {
      return local.filter((e) => e.sourceId === sourceId);
    }
    return local;
  }
}

/**
 * Computes what the next value will be after printing `count` items
 */
export function computeNextSerialValue(
  startValue: string,
  config?: SerializationConfig,
  count: number = 1
): string {
  if (!config || config.action === 'none' || count <= 0) return startValue;
  return evaluateSerializedValue(startValue, config, { printIndex: count });
}

/**
 * Commits a completed print job by advancing serial counter states on template elements.
 * This is only called after a successful confirmed print job dispatch.
 */
export function advanceTemplateSerialState(template: any, printedCount: number): any {
  if (printedCount <= 0 || !template?.elements) return template;

  const updatedElements = template.elements.map((el: any) => {
    let hasChanged = false;
    let updatedDsList: any[] | undefined = undefined;

    if (el.dataSources && el.dataSources.length > 0) {
      updatedDsList = el.dataSources.map((ds: any) => {
        const serialConfig = ds.serialization || ds.transformConfig?.serialization;
        if (serialConfig && serialConfig.action !== 'none') {
          const currentBase = serialConfig.currentValue || ds.value || '000001';
          const nextVal = computeNextSerialValue(currentBase, serialConfig, printedCount);
          hasChanged = true;
          return {
            ...ds,
            value: nextVal,
            serialization: {
              ...serialConfig,
              currentValue: nextVal,
            },
            ...(ds.transformConfig
              ? {
                  transformConfig: {
                    ...ds.transformConfig,
                    serialization: {
                      ...serialConfig,
                      currentValue: nextVal,
                    },
                  },
                }
              : {}),
          };
        }
        return ds;
      });
    }

    if (hasChanged && updatedDsList) {
      return {
        ...el,
        dataSources: updatedDsList,
        ...(el.type === 'barcode' ? { value: updatedDsList[0]?.value || el.value } : {}),
        ...(el.type === 'text' ? { text: updatedDsList[0]?.value || el.text } : {}),
      };
    }

    return el;
  });

  return {
    ...template,
    elements: updatedElements,
    updatedAt: new Date().toISOString(),
  };
}


