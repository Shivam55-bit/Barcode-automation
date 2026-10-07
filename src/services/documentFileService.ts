import { LabelTemplate, OpenDocument, BarcodeFlowDocumentFile, RecentDocumentEntry } from '../types';
import { detectDocumentFormat, DocumentFormatCategory } from './documentFormatDetector';
import { parseBarTenderDocument } from './barTenderParser';
import { importBarTenderObservation } from './barTenderObservationImporter';

const RECENT_DOCS_KEY = 'barcodeflow_recent_documents_v2';
const MAX_RECENT_DOCS = 10;

function redactConnectionCredentials(value: any): any {
  if (Array.isArray(value)) return value.map(redactConnectionCredentials);
  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) return value;
      let changed = !!(url.username || url.password);
      url.username = '';
      url.password = '';
      for (const key of [...url.searchParams.keys()]) {
        if (/^(password|pwd|secret|token|accessToken|refreshToken|apiKey|key|authorization)$/i.test(key.replace(/[_-]/g, ''))) {
          url.searchParams.delete(key);
          changed = true;
        }
      }
      return changed ? url.toString() : value;
    } catch {
      return value;
    }
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(password|pwd|secret|token|accessToken|refreshToken|apiKey|authorization|headers|connectionString)$/i.test(key.replaceAll('_', '')))
    .map(([key, child]) => [key, redactConnectionCredentials(child)]));
}

function validateTemplate(template: LabelTemplate): LabelTemplate {
  if (!template.dimensions || !Number.isFinite(template.dimensions.width) || !Number.isFinite(template.dimensions.height) ||
      template.dimensions.width <= 0 || template.dimensions.height <= 0) {
    throw new Error('Invalid label dimensions: width and height must be positive finite numbers.');
  }
  if (!Array.isArray(template.elements)) throw new Error('Invalid document: elements must be an array.');
  const objectIds = new Set<string>();
  for (const element of template.elements) {
    if (!element || typeof element.id !== 'string' || !element.id || objectIds.has(element.id)) {
      throw new Error('Invalid document: each object must have a unique, nonempty ID.');
    }
    if (![element.x, element.y, element.width, element.height, element.rotation ?? 0].every(Number.isFinite) ||
        element.width < 0 || element.height < 0) {
      throw new Error(`Invalid geometry for object "${element.id}".`);
    }
    objectIds.add(element.id);
  }
  return structuredClone(template);
}

function validateDependencies(dependencies: any): BarcodeFlowDocumentFile['dependencies'] {
  if (dependencies === undefined) return undefined;
  if (!dependencies || !Array.isArray(dependencies.fonts) || !dependencies.fonts.every((font: any) => typeof font === 'string') ||
      !Array.isArray(dependencies.images) || !dependencies.images.every((image: any) => image && typeof image.objectId === 'string' && typeof image.embedded === 'boolean') ||
      !Array.isArray(dependencies.warnings) || !dependencies.warnings.every((warning: any) => typeof warning === 'string') ||
      dependencies.credentialsIncluded !== false || typeof dependencies.sampleDataIncluded !== 'boolean') {
    throw new Error('Invalid portable dependency manifest. Fonts, images, and warnings must have the supported schema.');
  }
  return structuredClone(dependencies);
}

function getElectronAPI(): any {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return undefined;
}

/**
 * Serializes an open document into the official BarcodeFlow Document format (.bfl).
 * Persists complete layout, elements, page setup, data bindings, printer metadata, and versioning.
 */
export function serializeBarcodeFlowDocument(doc: OpenDocument | LabelTemplate, currentUserName: string = 'Operator'): BarcodeFlowDocumentFile {
  const tpl = (doc as any).template ? (doc as OpenDocument).template : (doc as any).elements ? (doc as LabelTemplate) : undefined;
  const now = new Date().toISOString();
  const databaseConnection = tpl?.databaseConnection ? redactConnectionCredentials(tpl.databaseConnection) : undefined;

  return structuredClone({
    format: 'BarcodeFlowDocument',
    version: 1,
    documentId: (doc as any).documentId || tpl?.id || `doc-${Date.now()}`,
    name: (doc as any).name || tpl?.name || 'Untitled Document',
    type: (doc as any).type || 'template',
    template: tpl
      ? {
          ...tpl,
          ...(tpl.databaseConnection ? { databaseConnection } : {}),
          updatedAt: now,
          createdBy: tpl.createdBy || currentUserName,
        }
      : undefined,
    form: (doc as any).form,
    dataConnections: databaseConnection ? [databaseConnection] : [],
    dependencies: validateDependencies((doc as OpenDocument).dependencies),
    printerSettings: tpl?.printer || null,
    pageSetup: {
      dimensions: tpl?.dimensions,
      margins: tpl?.margins,
      shape: tpl?.shape,
      cornerRadius: tpl?.cornerRadius,
      sheetGrid: tpl?.sheetGrid,
      mediaType: tpl?.mediaType,
      background: tpl?.background,
      printOrder: tpl?.printOrder,
    },
    metadata: {
      createdAt: tpl?.createdAt || now,
      updatedAt: now,
      savedBy: currentUserName,
      appVersion: '2.5.0',
    },
  });
}

export function serializePortableBarcodeFlowDocument(
  doc: OpenDocument | LabelTemplate,
  options: { includeSampleData?: boolean } = {}
): BarcodeFlowDocumentFile {
  const payload = serializeBarcodeFlowDocument(doc);
  if (!payload.template) throw new Error('Portable template export requires a label document.');
  const template = payload.template;
  const fonts = new Set<string>();
  const images: Array<{ objectId: string; embedded: boolean }> = [];
  for (const element of template.elements) {
    if (element.type === 'text') fonts.add(element.fontFamily || 'Arial');
    if (element.type === 'barcode' && element.includeText) fonts.add(element.humanReadableFont || 'Arial');
    if (element.type === 'image') {
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|bmp);base64,/i.test(element.src || '')) {
        throw new Error(`Image "${element.name || element.id}" is linked, missing, or unsupported. Import it as an embedded bitmap before sharing.`);
      }
      images.push({ objectId: element.id, embedded: true });
    }
  }
  if (template.background?.imageUrl && !/^data:image\/(png|jpeg|jpg|gif|webp|bmp);base64,/i.test(template.background.imageUrl)) {
    throw new Error('The background image must be an embedded bitmap before sharing.');
  }
  if (!options.includeSampleData) {
    template.sampleRecords = [{}];
    if (template.databaseConnection) template.databaseConnection.records = [];
    for (const connection of payload.dataConnections || []) connection.records = [];
  }
  payload.dependencies = {
    fonts: [...fonts].sort(), images,
    credentialsIncluded: false, sampleDataIncluded: options.includeSampleData === true,
    warnings: [
      ...[...fonts].map(font => `Font "${font}" is referenced, not embedded; installation or substitution is required on the receiving computer.`),
      ...(template.databaseConnection ? ['Data source definitions are included without credentials. Reconnect locally before live-data printing.'] : []),
      'Connection credential fields are removed. Review scripts, sample records, and custom metadata for embedded secrets before sharing.',
    ],
  };
  return payload;
}

/**
 * Deserializes raw file content (.bfl, or JSON) into a standard OpenDocument model.
 * Handles both BarcodeFlowDocument format and legacy raw LabelTemplate JSON.
 * Genuinely blocks .btw binary files from JSON.parse.
 */
export function deserializeBarcodeFlowDocument(
  rawData: any,
  fallbackName: string = 'Opened Document',
  filePath?: string
): {
  template?: LabelTemplate;
  form?: any;
  type: 'template' | 'form';
  name: string;
  documentId: string;
  dependencies?: BarcodeFlowDocumentFile['dependencies'];
  imported?: boolean;
} {
  // Case 0: Already a parsed LabelTemplate object
  if (rawData && typeof rawData === 'object' && rawData.elements && rawData.dimensions) {
    const rawTemplate = validateTemplate(rawData as LabelTemplate);
    return {
      type: 'template',
      template: rawTemplate,
      name: rawTemplate.name || fallbackName,
      documentId: rawTemplate.id || `tmpl-${Date.now()}`,
    };
  }

  // Parse JSON string if rawData is string that might be BarcodeFlow JSON
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData.replace(/^\uFEFF/, ''));
      if (parsed && typeof parsed === 'object') {
        rawData = parsed;
      }
    } catch {}
  }

  if (rawData?.format === 'BarcodeFlowBarTenderObservation') {
    const template = validateTemplate(importBarTenderObservation(rawData));
    return { type: 'template', template, name: template.name, documentId: template.id, imported: true };
  }

  // Case 1: Native BarcodeFlow Document (.bfl or JSON object)
  if (rawData && typeof rawData === 'object' && (rawData.format === 'BarcodeFlowDocument' || rawData.format === 'BarTenderDocument')) {
    if (rawData.version !== 1) {
      throw new Error(`Unsupported document version ${String(rawData.version)}; this application supports version 1.`);
    }

    if (rawData.type === 'form' && rawData.form) {
      return {
        type: 'form',
        form: rawData.form,
        name: rawData.name || rawData.form.title || fallbackName,
        documentId: rawData.documentId || rawData.form.id || `form-${Date.now()}`,
      };
    }

    const tpl = rawData.template;
    if (!tpl || !Array.isArray(tpl.elements) || !(tpl.dimensions || rawData.pageSetup?.dimensions)) {
      throw new Error('Invalid or corrupted BarcodeFlow document: template, dimensions, and elements are required.');
    }
    const restoredTemplate: LabelTemplate = {
      ...tpl,
      id: rawData.documentId || tpl.id || `tmpl-${Date.now()}`,
      name: rawData.name || tpl.name || fallbackName,
      dimensions: tpl.dimensions || rawData.pageSetup?.dimensions,
    };
    for (const key of ['margins', 'shape', 'cornerRadius', 'sheetGrid', 'mediaType', 'background', 'printOrder'] as const) {
      if (restoredTemplate[key] === undefined && rawData.pageSetup?.[key] !== undefined) {
        (restoredTemplate as any)[key] = rawData.pageSetup[key];
      }
    }
    if (!restoredTemplate.databaseConnection && rawData.dataConnections?.[0]) restoredTemplate.databaseConnection = rawData.dataConnections[0];
    if (!restoredTemplate.printer && rawData.printerSettings) restoredTemplate.printer = rawData.printerSettings;

    return {
      type: 'template',
      template: validateTemplate(restoredTemplate),
      name: restoredTemplate.name,
      documentId: restoredTemplate.id,
      dependencies: validateDependencies(rawData.dependencies),
    };
  }

  // Case 2: Binary BarTender .BTW file or BarTender stream
  const formatCheck = detectDocumentFormat(filePath || fallbackName, rawData);
  if (formatCheck.format === 'BARTENDER_BTW' || formatCheck.isBinary) {
    const parsedTemplate = parseBarTenderDocument(rawData, filePath || fallbackName);
    return {
      type: 'template',
      template: parsedTemplate,
      name: parsedTemplate.name,
      documentId: parsedTemplate.id,
    };
  }

  if (typeof rawData === 'string') {
    if (rawData.includes('Bar Tender') || rawData.includes('BarTender') || rawData.includes('Seagull')) {
      const parsedTemplate = parseBarTenderDocument(rawData, filePath || fallbackName);
      return {
        type: 'template',
        template: parsedTemplate,
        name: parsedTemplate.name,
        documentId: parsedTemplate.id,
      };
    }
    throw new Error('BarcodeFlow document is invalid or corrupted.');
  }

  // Case 2: Legacy raw LabelTemplate JSON
  if (rawData && typeof rawData === 'object' && rawData.elements && Array.isArray(rawData.elements)) {
    const rawTemplate = rawData as LabelTemplate;
    const restoredTemplate: LabelTemplate = {
      ...rawTemplate,
      id: rawTemplate.id || `tmpl-${Date.now()}`,
      name: rawTemplate.name || fallbackName,
      description: rawTemplate.description || 'Legacy Template JSON',
      category: rawTemplate.category || 'Logistics',
      version: rawTemplate.version || '1.0',
      status: rawTemplate.status || 'draft',
      tags: rawTemplate.tags || ['Imported'],
      dimensions: rawTemplate.dimensions || { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: rawTemplate.margins || { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      shape: rawTemplate.shape || 'rectangle',
      cornerRadius: rawTemplate.cornerRadius || 0,
      sheetGrid: rawTemplate.sheetGrid,
      mediaType: rawTemplate.mediaType || 'gap',
      background: rawTemplate.background,
      printOrder: rawTemplate.printOrder,
      elements: rawTemplate.elements,
      variables: rawTemplate.variables || [],
      sampleRecords: rawTemplate.sampleRecords && rawTemplate.sampleRecords.length > 0 ? rawTemplate.sampleRecords : [{}],
      databaseConnection: rawTemplate.databaseConnection,
      printer: rawTemplate.printer,
      createdAt: rawTemplate.createdAt || new Date().toISOString(),
      updatedAt: rawTemplate.updatedAt || new Date().toISOString(),
      createdBy: rawTemplate.createdBy || 'Operator',
    };

    return {
      type: 'template',
      template: validateTemplate(restoredTemplate),
      name: restoredTemplate.name,
      documentId: restoredTemplate.id,
    };
  }

  throw new Error('Unrecognized document format: Missing elements or BarcodeFlow format descriptor');
}

/**
 * Opens native Windows Save As dialog (Electron showSaveDialog or Browser showSaveFilePicker).
 */
export async function promptNativeSaveAsDialog(defaultFileName: string = 'Document1.bfl'): Promise<{
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  fileHandle?: any;
}> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.showSaveDialog) {
    return await electronAPI.showSaveDialog(defaultFileName);
  }

  // Web Browser: File System Access API (Native Windows Explorer Save As Dialog)
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const suggested = defaultFileName.endsWith('.bfl') ? defaultFileName : `${defaultFileName}.bfl`;
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: suggested,
        types: [
          {
            description: 'BarcodeFlow Document (*.bfl)',
            accept: { 'application/json': ['.bfl', '.json'] },
          },
        ],
      });
      const file = await handle.getFile();
      return {
        canceled: false,
        filePath: file.name,
        fileName: file.name,
        fileHandle: handle,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { canceled: true };
      }
    }
  }

  // Web Browser fallback
  const fallbackName = defaultFileName.endsWith('.bfl') ? defaultFileName : `${defaultFileName}.bfl`;
  return { canceled: false, filePath: fallbackName, fileName: fallbackName };
}

/**
 * Saves document to disk (via Electron IPC, FileSystemAccessAPI, or browser download).
 */
export async function saveDocumentToDisk(
  filePath: string | undefined | null,
  doc: OpenDocument,
  currentUserName: string = 'Operator',
  fileHandle?: any,
  options: { portable?: boolean; includeSampleData?: boolean } = {}
): Promise<{
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}> {
  if ([filePath, fileHandle?.name].some(target => typeof target === 'string' && /\.btw[. ]*$/i.test(target))) {
    return { success: false, error: 'Native BarcodeFlow JSON cannot overwrite a BarTender .btw file. Save as .bfl instead.' };
  }
  const documentPayload = options.portable
    ? serializePortableBarcodeFlowDocument(doc, options)
    : serializeBarcodeFlowDocument(doc, currentUserName);
  const electronAPI = getElectronAPI();

  // 1. Electron Desktop Save
  if (electronAPI?.saveFile && filePath) {
    const result = await electronAPI.saveFile(filePath, documentPayload);
    if (result.success && result.filePath) {
      addRecentDocument({
        filePath: result.filePath,
        fileName: result.fileName || doc.name,
        lastOpenedAt: new Date().toISOString(),
        templateName: doc.name,
      });
    }
    return result;
  }

  // 2. Browser Native File System Handle Save
  if (fileHandle && typeof fileHandle.createWritable === 'function') {
    try {
      const writable = await fileHandle.createWritable();
      const jsonStr = JSON.stringify(documentPayload, null, 2);
      await writable.write(jsonStr);
      await writable.close();
      const name = fileHandle.name || doc.name;
      addRecentDocument({
        filePath: name,
        fileName: name,
        lastOpenedAt: new Date().toISOString(),
        templateName: doc.name,
      });
      return { success: true, filePath: name, fileName: name };
    } catch (err: any) {
      console.warn('File handle write failed, falling back to download:', err);
    }
  }

  // 3. Browser Download Fallback (.bfl file download to local PC)
  try {
    const jsonStr = JSON.stringify(documentPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (doc.name || 'Document1').endsWith('.bfl') ? doc.name : `${doc.name}.bfl`;
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addRecentDocument({
      filePath: safeName,
      fileName: safeName,
      lastOpenedAt: new Date().toISOString(),
      templateName: doc.name,
    });
    return { success: true, filePath: safeName, fileName: safeName };
  } catch (err: any) {
    return { success: false, error: err.message || 'Browser export failed' };
  }
}

/**
 * Opens native Windows Open dialog (Electron showOpenDialog, Browser showOpenFilePicker, or input picker).
 */
export async function promptNativeOpenDialog(): Promise<{
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  file?: File;
  content?: any;
}> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.showOpenDialog) {
    return await electronAPI.showOpenDialog();
  }

  // 1. Browser Native File System Access API
  if (typeof (window as any).showOpenFilePicker === 'function') {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'BarTender & BarcodeFlow Documents (*.btw, *.bfl, *.json)',
            accept: {
              'application/octet-stream': ['.btw', '.BTW'],
              'application/json': ['.bfl', '.BFL', '.json', '.JSON'],
            },
          },
          {
            description: 'BarTender Documents (*.btw, *.BTW)',
            accept: {
              'application/octet-stream': ['.btw', '.BTW'],
            },
          },
          {
            description: 'BarcodeFlow Documents (*.bfl, *.json)',
            accept: {
              'application/json': ['.bfl', '.BFL', '.json', '.JSON'],
            },
          },
          {
            description: 'All Files (*.*)',
            accept: {
              '*/*': ['.*'],
            },
          },
        ],
        multiple: false,
      });
      const file: File = await handle.getFile();
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let content: any;
      if (ext === 'btw') {
        const ab = await file.arrayBuffer();
        content = new Uint8Array(ab);
      } else {
        content = await file.text();
      }
      return {
        canceled: false,
        filePath: file.name,
        fileName: file.name,
        file,
        content,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') return { canceled: true };
      console.warn('[promptNativeOpenDialog] showOpenFilePicker threw error, falling back to input:', err);
    }
  }

  // 2. Standard HTML5 Input File Picker Fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.btw,.bfl,.json,.BTW,.BFL,.JSON';
    input.style.display = 'none';
    input.value = '';
    document.body.appendChild(input);

    const cleanup = () => {
      input.value = '';
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      try {
        if (!file) {
          cleanup();
          resolve({ canceled: true });
          return;
        }
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        let content: any;
        if (ext === 'btw') {
          const ab = await file.arrayBuffer();
          content = new Uint8Array(ab);
        } else {
          content = await file.text();
        }
        cleanup();
        resolve({
          canceled: false,
          filePath: file.name,
          fileName: file.name,
          file,
          content,
        });
      } catch (e) {
        console.error('[promptNativeOpenDialog] HTML5 input read error:', e);
        cleanup();
        resolve({ canceled: true });
      }
    };

    input.oncancel = () => {
      cleanup();
      resolve({ canceled: true });
    };

    input.click();
  });
}

/**
 * Reads document from disk by path (or direct memory content).
 */
export async function readDocumentFromDisk(filePath: string, onProgress?: (phase: 'AWAITING_CONSENT' | 'EXTRACTING' | 'VERIFYING') => void): Promise<{
  success: boolean;
  canceled?: boolean;
  format?: DocumentFormatCategory;
  data?: any;
  content?: any;
  filePath?: string;
  fileName?: string;
  error?: string;
  errorCode?: string;
}> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.readFile) {
    const unsubscribe = onProgress && electronAPI.onBarTenderImportProgress?.((data: { filePath: string; phase: 'AWAITING_CONSENT' | 'EXTRACTING' | 'VERIFYING' }) => {
      if (areWindowsPathsEqual(data.filePath, filePath)) onProgress(data.phase);
    });
    let result;
    try { result = await electronAPI.readFile(filePath); } finally { unsubscribe?.(); }
    if (result.canceled) return { success: false, canceled: true };
    if (result.success) {
      const detected = detectDocumentFormat(filePath, result.document);
      const effectiveFormat = result.format || detected.format;

      addRecentDocument({
        filePath: result.filePath || filePath,
        fileName: result.fileName || filePath.split(/[\\/]/).pop() || 'Document.bfl',
        lastOpenedAt: new Date().toISOString(),
      });

      return {
        success: true,
        format: effectiveFormat,
        data: result.document,
        content: result.document,
        filePath: result.filePath || filePath,
        fileName: result.fileName || filePath.split(/[\\/]/).pop() || 'Document.bfl',
      };
    }
    return { success: false, error: result.error || 'Failed to read file from disk', errorCode: result.errorCode };
  }

  return { success: false, error: 'Desktop file system API not available' };
}

/**
 * Checks if a file exists on disk.
 */
export async function checkFileExistsOnDisk(filePath: string): Promise<boolean> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.checkFileExists) {
    return await electronAPI.checkFileExists(filePath);
  }
  return true;
}

/**
 * Opens file location in Windows Explorer / OS file manager.
 */
export async function openFileLocationOnDisk(filePath: string): Promise<boolean> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.openDocumentLocation) {
    return await electronAPI.openDocumentLocation(filePath);
  }
  if (electronAPI?.openExcelLocation) {
    return await electronAPI.openExcelLocation(filePath);
  }
  return false;
}

/**
 * Exits the application cleanly.
 */
export async function exitDesktopApplication(): Promise<void> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.exitApp) {
    await electronAPI.exitApp();
  } else {
    window.close();
  }
}

/**
 * Normalizes Windows file paths for canonical comparison and presentation.
 * Resolves forward slashes to backslashes, trims, preserves Unicode and spaces, and lowercases for comparison.
 */
export function normalizeWindowsPath(p: string): string {
  if (!p) return '';
  return p.trim().replace(/\//g, '\\');
}

export function areWindowsPathsEqual(pathA?: string | null, pathB?: string | null): boolean {
  if (!pathA || !pathB) return false;
  return normalizeWindowsPath(pathA).toLowerCase() === normalizeWindowsPath(pathB).toLowerCase();
}

/**
 * Builds a standardized, canonical RecentDocumentEntry with all required metadata fields.
 */
export function buildRecentDocumentEntry(
  filePathOrEntry: string | RecentDocumentEntry,
  maybeFileName?: string
): RecentDocumentEntry {
  if (typeof filePathOrEntry === 'object' && filePathOrEntry !== null) {
    const rawPath = filePathOrEntry.absolutePath || filePathOrEntry.filePath || '';
    const norm = normalizeWindowsPath(rawPath);
    const disp = filePathOrEntry.displayName || filePathOrEntry.fileName || norm.split('\\').pop() || 'Document.bfl';
    const ext = disp.includes('.') ? disp.split('.').pop()?.toLowerCase() : 'bfl';
    return {
      id: filePathOrEntry.id || `mru-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      absolutePath: norm,
      displayName: disp,
      filePath: norm,
      fileName: disp,
      lastOpenedAt: filePathOrEntry.lastOpenedAt || new Date().toISOString(),
      lastModified: filePathOrEntry.lastModified,
      fileType: filePathOrEntry.fileType || ext,
      fileSize: filePathOrEntry.fileSize,
      templateName: filePathOrEntry.templateName || disp,
    };
  }

  const rawStr = typeof filePathOrEntry === 'string' ? filePathOrEntry : (filePathOrEntry as any)?.filePath || '';
  const norm = normalizeWindowsPath(rawStr);
  const disp = maybeFileName || norm.split('\\').pop() || 'Document.bfl';
  const ext = disp.includes('.') ? disp.split('.').pop()?.toLowerCase() : 'bfl';
  return {
    id: `mru-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    absolutePath: norm,
    displayName: disp,
    filePath: norm,
    fileName: disp,
    lastOpenedAt: new Date().toISOString(),
    fileType: ext,
    templateName: disp,
  };
}

/**
 * Manages Recent Documents with Dual Persistence:
 * - Electron persistent user-data file (survives app restart, window close, OS reboot)
 * - Synchronous localStorage cache (for instant hydration and browser fallback)
 */
export function getRecentDocuments(): RecentDocumentEntry[] {
  try {
    const saved = localStorage.getItem(RECENT_DOCS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => buildRecentDocumentEntry(item));
      }
    }
  } catch (err) {
    console.warn('[DocumentFileService] Error reading recent documents from local storage:', err);
  }
  return [];
}

/**
 * Asynchronously synchronizes recent documents from Electron persistent disk storage into local cache.
 */
export async function syncRecentDocumentsFromDisk(): Promise<RecentDocumentEntry[]> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.getRecentDocuments) {
    try {
      const diskRecent = await electronAPI.getRecentDocuments();
      if (Array.isArray(diskRecent)) {
        const canonicalList = diskRecent.map((item: any) => buildRecentDocumentEntry(item)).slice(0, MAX_RECENT_DOCS);
        localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(canonicalList));
        return canonicalList;
      }
    } catch (err) {
      console.warn('[DocumentFileService] Electron getRecentDocuments error:', err);
    }
  }
  return getRecentDocuments();
}

export function addRecentDocument(filePathOrEntry: string | RecentDocumentEntry, maybeFileName?: string): RecentDocumentEntry[] {
  try {
    const current = getRecentDocuments();
    const entry = buildRecentDocumentEntry(filePathOrEntry, maybeFileName);

    // Canonical path comparison: deduplicate existing entries regardless of case or slash format
    const filtered = current.filter((item) => !areWindowsPathsEqual(item.absolutePath || item.filePath, entry.absolutePath));
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_DOCS);

    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));

    // Persist to Electron UserData asynchronously if available
    const electronAPI = getElectronAPI();
    if (electronAPI?.addRecentDocument) {
      electronAPI.addRecentDocument(entry, entry.displayName).catch((err: any) => {
        console.warn('[DocumentFileService] Electron addRecentDocument IPC error:', err);
      });
    }

    return updated;
  } catch (err) {
    console.warn('[DocumentFileService] Error saving recent document:', err);
    return getRecentDocuments();
  }
}

export function removeRecentDocument(filePath: string): RecentDocumentEntry[] {
  try {
    const current = getRecentDocuments();
    const updated = current.filter((item) => !areWindowsPathsEqual(item.absolutePath || item.filePath, filePath));

    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));

    // Persist removal to Electron UserData
    const electronAPI = getElectronAPI();
    if (electronAPI?.removeRecentDocument) {
      electronAPI.removeRecentDocument(filePath).catch((err: any) => {
        console.warn('[DocumentFileService] Electron removeRecentDocument IPC error:', err);
      });
    }

    return updated;
  } catch (err) {
    console.warn('[DocumentFileService] Error removing recent document:', err);
    return getRecentDocuments();
  }
}

export function clearRecentDocuments(): void {
  try {
    localStorage.removeItem(RECENT_DOCS_KEY);
    const electronAPI = getElectronAPI();
    if (electronAPI?.clearRecentDocuments) {
      electronAPI.clearRecentDocuments().catch((err: any) => {
        console.warn('[DocumentFileService] Electron clearRecentDocuments IPC error:', err);
      });
    }
  } catch (err) {
    console.warn('[DocumentFileService] Error clearing recent documents:', err);
  }
}

/**
 * App Settings persistence for Welcome dialog and startup options.
 */
export async function getAppStartupSettings(): Promise<{ showWelcomeOnStartup: boolean }> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.getAppSettings) {
    try {
      const settings = await electronAPI.getAppSettings();
      if (settings && typeof settings.showWelcomeOnStartup === 'boolean') {
        localStorage.setItem('barcodeflow.showWelcomeOnStartup', String(settings.showWelcomeOnStartup));
        return { showWelcomeOnStartup: settings.showWelcomeOnStartup };
      }
    } catch { }
  }

  try {
    const val = localStorage.getItem('barcodeflow.showWelcomeOnStartup');
    return { showWelcomeOnStartup: val === null ? true : val === 'true' };
  } catch {
    return { showWelcomeOnStartup: true };
  }
}

export async function saveAppStartupSettings(settings: { showWelcomeOnStartup: boolean }): Promise<void> {
  try {
    localStorage.setItem('barcodeflow.showWelcomeOnStartup', String(settings.showWelcomeOnStartup));
  } catch { }

  const electronAPI = getElectronAPI();
  if (electronAPI?.saveAppSettings) {
    try {
      await electronAPI.saveAppSettings(settings);
    } catch (err) {
      console.warn('[DocumentFileService] Failed to save app settings via Electron:', err);
    }
  }
}

