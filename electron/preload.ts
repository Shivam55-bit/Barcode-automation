import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  rendererReady: (): Promise<string[]> =>
    ipcRenderer.invoke('app:renderer-ready'),
  onOpenDocumentRequest: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('document:open-request', listener);
    return () => ipcRenderer.removeListener('document:open-request', listener);
  },
  setDocumentDirty: (dirty: boolean): void => ipcRenderer.send('app:set-document-dirty', dirty),
  readRecoverySnapshot: (): Promise<any | null> => ipcRenderer.invoke('document:recovery-read'),
  writeRecoverySnapshot: (snapshot: any): Promise<boolean> => ipcRenderer.invoke('document:recovery-write', snapshot),
  clearRecoverySnapshot: (): Promise<boolean> => ipcRenderer.invoke('document:recovery-clear'),
  onCloseRequest: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:request-close', listener);
    return () => ipcRenderer.removeListener('app:request-close', listener);
  },
  confirmCloseWindow: (): Promise<boolean> => ipcRenderer.invoke('window:confirm-close'),
  cancelCloseRequest: (): Promise<boolean> => ipcRenderer.invoke('window:cancel-close'),
  listInitialPasswordAccounts: (): Promise<Array<{ email: string; name: string }>> =>
    ipcRenderer.invoke('auth:list-initial-password-accounts'),
  initializeLegacyPassword: (payload: { email: string; password: string }): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:initialize-legacy-password', payload),
  // Secure Linked Excel Desktop APIs
  selectExcelFile: (): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:select-file'),
  locateExcelFile: (oldPath?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:locate-file', oldPath),
  testExcelConnection: (filePath: string, sheetName?: string): Promise<{ success: boolean; filePath?: string; fileName?: string; sheets?: string[]; sheetCount?: number; selectedSheet?: string; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string; errorCode?: string; pathChecked?: string }> =>
    ipcRenderer.invoke('excel:test-connection', { filePath, sheetName }),
  readExcelWorkbook: (filePath: string, sheetName?: string, headerRow?: number): Promise<{ success: boolean; sheetNames?: string[]; selectedSheet?: string; columns?: string[]; records?: Record<string, any>[]; previewRows?: Record<string, any>[]; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string }> =>
    ipcRenderer.invoke('excel:read-workbook', { filePath, sheetName, headerRow }),
  openExcelLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-location', filePath),
  openExcelFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-file', filePath),
  watchExcelFile: (filePath: string, datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:watch-file', { filePath, datasetId }),
  unwatchExcelFile: (datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:unwatch-file', datasetId),
  onExcelFileChanged: (callback: (data: { filePath: string; datasetId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('excel:file-changed', listener);
    return () => {
      ipcRenderer.removeListener('excel:file-changed', listener);
    };
  },
  // Desktop Document File APIs
  showSaveDialog: (defaultFileName?: string, defaultDir?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string }> =>
    ipcRenderer.invoke('document:show-save-dialog', defaultFileName, defaultDir),
  showSavePdfDialog: (defaultFileName?: string, defaultDir?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string }> =>
    ipcRenderer.invoke('document:show-save-pdf-dialog', defaultFileName, defaultDir),
  showDirectoryDialog: (defaultDir?: string): Promise<{ canceled: boolean; folderPath?: string }> =>
    ipcRenderer.invoke('document:show-directory-dialog', defaultDir),
  saveFile: (filePath: string, documentData: any): Promise<{ success: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string; error?: string }> =>
    ipcRenderer.invoke('document:save-file', { filePath, documentData }),
  saveBinaryFile: (filePath: string, base64Data: string): Promise<{ success: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string; error?: string }> =>
    ipcRenderer.invoke('document:save-binary-file', { filePath, base64Data }),
  showOpenDialog: (defaultDir?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string }> =>
    ipcRenderer.invoke('document:show-open-dialog', defaultDir),
  readFile: (filePath: string): Promise<{ success: boolean; canceled?: boolean; document?: any; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string; error?: string; errorCode?: string }> =>
    ipcRenderer.invoke('document:read-file', filePath),
  onBarTenderImportProgress: (callback: (data: { filePath: string; phase: 'AWAITING_CONSENT' | 'EXTRACTING' | 'VERIFYING' }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; phase: 'AWAITING_CONSENT' | 'EXTRACTING' | 'VERIFYING' }) => callback(data);
    ipcRenderer.on('document:bartender-progress', listener);
    return () => ipcRenderer.removeListener('document:bartender-progress', listener);
  },
  checkFileExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('document:check-file-exists', filePath),
  openDocumentLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('document:open-location', filePath),
  openDocumentFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('document:open-file', filePath),
  getRecentDocuments: (): Promise<any[]> =>
    ipcRenderer.invoke('document:get-recent'),
  addRecentDocument: (filePathOrEntry: any, maybeName?: string): Promise<any[]> =>
    ipcRenderer.invoke('document:add-recent', filePathOrEntry, maybeName),
  removeRecentDocument: (filePath: string): Promise<any[]> =>
    ipcRenderer.invoke('document:remove-recent', filePath),
  clearRecentDocuments: (): Promise<any[]> =>
    ipcRenderer.invoke('document:clear-recent'),
  getAppSettings: (): Promise<Record<string, any>> =>
    ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (settings: Record<string, any>): Promise<Record<string, any>> =>
    ipcRenderer.invoke('app:save-settings', settings),
  getFonts: (): Promise<string[]> =>
    ipcRenderer.invoke('fonts:list'),
  exitApp: (): Promise<boolean> =>
    ipcRenderer.invoke('app:exit'),
  minimizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:maximize'),
  isWindowMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke('window:is-maximized'),
  closeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:close'),
});

contextBridge.exposeInMainWorld('barcodeFlow', {
  printers: {
    list: (): Promise<any[]> => ipcRenderer.invoke('printers:list'),
    getDefault: (): Promise<any | null> => ipcRenderer.invoke('printers:get-default'),
    getStatus: (printerName: string): Promise<any> => ipcRenderer.invoke('printers:get-status', printerName),
    printDriver: (req: {
      printerName: string;
      htmlContent: string;
      widthMm: number;
      heightMm: number;
      copies?: number;
      landscape?: boolean;
      jobTitle?: string;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-driver', req),
    printRaw: (req: {
      printerName: string;
      rawContent: string;
      format: string;
      jobTitle?: string;
    }): Promise<{ success: boolean; bytesWritten: number; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-raw', req),
    testPrint: (req: {
      printerName: string;
      mode: 'driver' | 'raw';
      payload: any;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:test-print', req),
    openProperties: (printerName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('printers:open-properties', printerName),
    cancelQueuedJobs: (printerName: string): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:cancel-queued-jobs', printerName),
    generatePdf: (req: {
      htmlContent: string;
      widthMm: number;
      heightMm: number;
      landscape?: boolean;
    }): Promise<{ success: boolean; base64Data?: string; sizeBytes?: number; error?: string }> =>
      ipcRenderer.invoke('printers:generate-pdf', req),
  },
  fonts: {
    list: (): Promise<string[]> => ipcRenderer.invoke('fonts:list'),
  },
  database: {
    detectDependencies: (providerType: string): Promise<any> =>
      ipcRenderer.invoke('database:detect-dependencies', providerType),
    testConnection: (config: any): Promise<any> =>
      ipcRenderer.invoke('database:test-connection', config),
    listDatabases: (config: any): Promise<any[]> =>
      ipcRenderer.invoke('database:list-databases', config),
    listTables: (config: any): Promise<any[]> =>
      ipcRenderer.invoke('database:list-tables', config),
    listColumns: (config: any, table?: string): Promise<any[]> =>
      ipcRenderer.invoke('database:list-columns', config, table),
    query: (config: any, query: any): Promise<any> =>
      ipcRenderer.invoke('database:query', config, query),
    enumerateOleDbProviders: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-oledb-providers'),
    enumerateOdbcDsns: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-odbc-dsns'),
    enumerateOdbcDrivers: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-odbc-drivers'),
    parseIdoc: (filePath: string, options?: any): Promise<any> =>
      ipcRenderer.invoke('database:parse-idoc', filePath, options),
    selectIdocFile: (): Promise<any> =>
      ipcRenderer.invoke('database:select-idoc-file'),
  },
  dataSources: {
    excel: {
      selectFile: (): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
        ipcRenderer.invoke('barcodeFlow:excel:select-file'),
      locateFile: (oldPath?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
        ipcRenderer.invoke('barcodeFlow:excel:locate-file', oldPath),
      inspectWorkbook: (payload: { filePath: string; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:inspect-workbook', payload),
      getSheets: (payload: { filePath: string; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-sheets', payload),
      getFields: (payload: { filePath: string; sheetName: string; headerRow?: number; hasHeaders?: boolean; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-fields', payload),
      getPreview: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        page?: number;
        pageSize?: number;
        projectDir?: string;
        sort?: any;
        filters?: any;
        search?: any;
      }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-preview', payload),
      getRecords: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        query?: any;
        projectDir?: string;
      }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-records', payload),
      watch: (payload: { filePath: string; connectionId: string; projectDir?: string }): Promise<boolean> =>
        ipcRenderer.invoke('barcodeFlow:excel:watch', payload),
      unwatch: (connectionId: string): Promise<boolean> =>
        ipcRenderer.invoke('barcodeFlow:excel:unwatch', connectionId),
      onFileChanged: (callback: (data: { filePath: string; connectionId: string }) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on('barcodeFlow:excel:file-changed', listener);
        return () => {
          ipcRenderer.removeListener('barcodeFlow:excel:file-changed', listener);
        };
      },
      openFile: (filePath: string): Promise<boolean> =>
        ipcRenderer.invoke('excel:open-file', filePath),
      openLocation: (filePath: string): Promise<boolean> =>
        ipcRenderer.invoke('excel:open-location', filePath),
    },
  },
});
