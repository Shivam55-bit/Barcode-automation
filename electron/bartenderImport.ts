import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { importBarTenderObservation } from '../src/services/barTenderObservationImporter';

const execute = promisify(execFile);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export class BarTenderExtractionError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

async function readSource(sourcePath: string) {
  if (path.extname(sourcePath).toLowerCase() !== '.btw') {
    throw new BarTenderExtractionError('UNSUPPORTED_SOURCE', 'Select a BarTender BTW working copy.');
  }
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024) {
    throw new BarTenderExtractionError('UNSUPPORTED_SOURCE', 'Select a regular BTW file smaller than 64 MB.');
  }
  const bytes = await fs.readFile(sourcePath);
  if (!isSupportedBtwSignature(bytes)) {
    throw new BarTenderExtractionError('UNSUPPORTED_SOURCE', 'Invalid or unsupported BTW signature. No BarTender extraction was started.');
  }
  return bytes;
}

export async function openBarTenderWithConsent(options: Parameters<typeof extractBarTenderWorkingCopy>[0] & {
  confirm: () => Promise<boolean>;
}) {
  try {
    await readSource(path.resolve(options.sourcePath));
    options.onProgress?.('AWAITING_CONSENT');
    if (!await options.confirm()) return { success: false as const, canceled: true };
    const result = await extractBarTenderWorkingCopy(options);
    return { success: true as const, document: result.observation };
  } catch (error) {
    return { success: false as const, canceled: false,
      errorCode: error instanceof BarTenderExtractionError ? error.code : 'EXTRACTION_FAILED',
      error: error instanceof Error ? error.message : 'BarTender extraction failed. No document was created.' };
  }
}

export function isSupportedBtwSignature(bytes: Buffer): boolean {
  return /^\s*Bar Tender Format File(?:\s|$)/.test(bytes.subarray(0, 128).toString('latin1')) ||
    bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

export async function extractBarTenderWorkingCopy(options: {
  sourcePath: string;
  workingRoot: string;
  scriptPath: string;
  run?: (scriptPath: string, copyPath: string, outputPath: string) => Promise<void>;
  onProgress?: (phase: 'AWAITING_CONSENT' | 'EXTRACTING' | 'VERIFYING') => void;
}) {
  const sourcePath = path.resolve(options.sourcePath);
  const sourceBytes = await readSource(sourcePath);
  const sourceHash = digest(sourceBytes);
  try { await fs.access(options.scriptPath); } catch {
    throw new BarTenderExtractionError('HELPER_UNAVAILABLE', 'The BarTender extraction component is missing. Rebuild or reinstall BarcodeFlow.');
  }
  await fs.mkdir(options.workingRoot, { recursive: true });
  const workingDirectory = await fs.mkdtemp(path.join(options.workingRoot, 'import-'));
  const copyPath = path.join(workingDirectory, path.basename(sourcePath));
  const observationPath = path.join(workingDirectory, 'observation.json');
  const statusPath = path.join(workingDirectory, 'automation-status.json');
  const run = options.run ?? (async (scriptPath: string, templateCopy: string, outputPath: string) => {
    if (process.platform !== 'win32') throw new BarTenderExtractionError('BARTENDER_UNAVAILABLE', 'BarTender-assisted extraction requires Windows and licensed BarTender.');
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    try {
      await execute(executable, ['-NoProfile', '-NonInteractive', '-File', scriptPath,
        '-TemplateCopy', templateCopy, '-OutputPath', outputPath, '-StatusPath', statusPath], {
        windowsHide: true, timeout: 120000, maxBuffer: 256 * 1024,
      });
    } catch (error: any) {
      let status: { errorCode?: string } = {};
      try { status = JSON.parse((await fs.readFile(statusPath, 'utf8')).replace(/^\uFEFF/, '')); } catch {}
      await execute(executable, ['-NoProfile', '-NonInteractive', '-File', scriptPath,
        '-CleanupOwnedApplication', '-StatusPath', statusPath], { windowsHide: true, timeout: 10000 }).catch(() => {});
      if (error.killed) throw new BarTenderExtractionError('EXTRACTION_TIMEOUT', 'BarTender extraction exceeded two minutes. Check BarTender for a licensing or document-open prompt before retrying.');
      if (status.errorCode === 'BARTENDER_UNAVAILABLE') throw new BarTenderExtractionError('BARTENDER_UNAVAILABLE', 'Install and activate a BarTender Automation/Enterprise Automation edition with ActiveX support, then retry.');
      if (status.errorCode === 'OWNERSHIP_UNVERIFIED') throw new BarTenderExtractionError('OWNERSHIP_UNVERIFIED', 'BarTender did not provide a separate automation instance. Your existing BarTender session was left untouched.');
      throw new BarTenderExtractionError('EXTRACTION_FAILED', 'BarTender could not extract this copy. Check its licensing, document-open prompts and PowerShell script policy; no native document was created.');
    }
  });
  try {
    await fs.writeFile(copyPath, sourceBytes, { flag: 'wx' });
    options.onProgress?.('EXTRACTING');
    await run(path.resolve(options.scriptPath), copyPath, observationPath);
    options.onProgress?.('VERIFYING');
    let snapshot: any;
    try { snapshot = JSON.parse((await fs.readFile(observationPath, 'utf8')).replace(/^\uFEFF/, '')); } catch {
      throw new BarTenderExtractionError('INVALID_OBSERVATION', 'BarTender returned missing or invalid observation JSON. No native document was created.');
    }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new BarTenderExtractionError('INVALID_OBSERVATION', 'BarTender returned a non-object observation. No native document was created.');
    }
    if (typeof snapshot.sourceSha256 !== 'string' || snapshot.sourceSha256.toLowerCase() !== sourceHash) {
      throw new BarTenderExtractionError('SOURCE_CHANGED', 'Extracted source identity does not match the selected BTW copy.');
    }
    try { importBarTenderObservation(snapshot); } catch (error) {
      throw new BarTenderExtractionError('INVALID_OBSERVATION', `Observation validation failed: ${error instanceof Error ? error.message : 'unsupported properties'}`);
    }
    return { observation: snapshot, sourceSha256: sourceHash };
  } finally {
    try {
      if (digest(await fs.readFile(sourcePath)) !== sourceHash || digest(await fs.readFile(copyPath)) !== sourceHash) {
        throw new BarTenderExtractionError('SOURCE_CHANGED', 'Source or extraction copy changed unexpectedly; conversion was rejected.');
      }
    } finally {
      await fs.rm(workingDirectory, { recursive: true, force: true });
    }
  }
}