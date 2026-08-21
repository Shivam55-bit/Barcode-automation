import {
  LabelTemplate,
  PrinterDefinition,
  PrintJob,
  AuditLogEntry,
  UserProfile,
  TemplateStatus,
  BarcodeBatchJob,
} from '../types';

const API_BASE = '/api';

/**
 * Robust JSON fetch wrapper with error handling
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status} (${response.statusText})`;
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const apiService = {
  // --- Templates API ---
  templates: {
    list: async (params?: { category?: string; status?: string; search?: string }): Promise<LabelTemplate[]> => {
      const query = new URLSearchParams();
      if (params?.category) query.set('category', params.category);
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);

      const qs = query.toString();
      return request<LabelTemplate[]>(`/templates${qs ? `?${qs}` : ''}`);
    },

    get: async (id: string): Promise<LabelTemplate> => {
      return request<LabelTemplate>(`/templates/${id}`);
    },

    save: async (template: Partial<LabelTemplate>): Promise<LabelTemplate> => {
      if (template.id) {
        return request<LabelTemplate>(`/templates/${template.id}`, {
          method: 'PUT',
          body: JSON.stringify(template),
        });
      }
      return request<LabelTemplate>('/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    },

    create: async (template: Partial<LabelTemplate>): Promise<LabelTemplate> => {
      return request<LabelTemplate>('/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    },

    duplicate: async (id: string): Promise<LabelTemplate> => {
      return request<LabelTemplate>(`/templates/${id}/duplicate`, {
        method: 'POST',
      });
    },

    delete: async (id: string): Promise<{ success: boolean; id: string }> => {
      return request<{ success: boolean; id: string }>(`/templates/${id}`, {
        method: 'DELETE',
      });
    },

    submit: async (payload: {
      templateId: string;
      submittedBy: string;
      comments?: string;
      snapshot?: any;
    }): Promise<{ success: boolean; version: string; snapshot: any; template: LabelTemplate }> => {
      return request<{ success: boolean; version: string; snapshot: any; template: LabelTemplate }>('/templates/submit', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    approve: async (payload: {
      templateId: string;
      version?: string;
      level?: number;
      reviewerName: string;
      reviewerEmail?: string;
      digitalSignature?: string;
      comment?: string;
      isFinal?: boolean;
    }): Promise<{ success: boolean; status: TemplateStatus; snapshot: any; template: LabelTemplate }> => {
      return request<{ success: boolean; status: TemplateStatus; snapshot: any; template: LabelTemplate }>('/templates/approve', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    reject: async (payload: {
      templateId: string;
      version?: string;
      reviewerName: string;
      reason: string;
    }): Promise<{ success: boolean; status: string; snapshot: any }> => {
      return request<{ success: boolean; status: string; snapshot: any }>('/templates/reject', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    requestChange: async (payload: {
      templateId: string;
      version?: string;
      reviewerName: string;
      comment: string;
      annotations?: any[];
    }): Promise<{ success: boolean; status: string; template: LabelTemplate; snapshot: any }> => {
      return request<{ success: boolean; status: string; template: LabelTemplate; snapshot: any }>('/templates/request-change', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getVersion: async (idOrTemplateId: string): Promise<any> => {
      return request<any>(`/templates/version/${idOrTemplateId}`);
    },

    getPreview: async (idOrTemplateId: string): Promise<any> => {
      return request<any>(`/templates/preview/${idOrTemplateId}`);
    },

    getHistory: async (templateId: string): Promise<{ templateId: string; templateName: string; currentVersion: string; currentStatus: TemplateStatus; versions: any[]; approvals: any[] }> => {
      return request<{ templateId: string; templateName: string; currentVersion: string; currentStatus: TemplateStatus; versions: any[]; approvals: any[] }>(`/templates/history/${templateId}`);
    },

    updateStatus: async (
      id: string,
      status: TemplateStatus,
      comment?: string,
      reviewerName?: string,
      eSignature?: string
    ): Promise<LabelTemplate> => {
      return request<LabelTemplate>(`/templates/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, comment, reviewerName, eSignature }),
      });
    },
  },

  // --- Viewer Logs API ---
  viewer: {
    log: async (entry: {
      templateId: string;
      templateVersion: string;
      jobId?: string;
      action: 'VIEW' | 'ZOOM' | 'DOWNLOAD_PDF' | 'DOWNLOAD_PNG' | 'PRINT_DISPATCH';
      userName: string;
      userRole: string;
      details: string;
      pagesViewedOrPrinted?: string;
      printerName?: string;
    }) => {
      return request<any>('/viewer', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },

    getLogs: async (params?: { templateId?: string; jobId?: string }) => {
      const query = new URLSearchParams();
      if (params?.templateId) query.set('templateId', params.templateId);
      if (params?.jobId) query.set('jobId', params.jobId);
      const qs = query.toString();
      return request<any[]>(`/viewer${qs ? `?${qs}` : ''}`);
    },
  },

  // --- Print Spooler Jobs API ---
  printJobs: {
    list: async (): Promise<PrintJob[]> => {
      return request<PrintJob[]>('/print-jobs');
    },

    dispatch: async (payload: {
      templateId?: string;
      printerId?: string;
      copies?: number;
      records?: Record<string, string>[];
      format?: 'zpl' | 'tspl' | 'epl' | 'pdf';
      submittedBy?: string;
      template?: LabelTemplate;
    }): Promise<PrintJob> => {
      return request<PrintJob>('/print-jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    pause: async (id: string): Promise<{ success: boolean; job: PrintJob }> => {
      return request<{ success: boolean; job: PrintJob }>(`/print-jobs/${id}/pause`, {
        method: 'POST',
      });
    },

    resume: async (id: string): Promise<{ success: boolean; job: PrintJob }> => {
      return request<{ success: boolean; job: PrintJob }>(`/print-jobs/${id}/resume`, {
        method: 'POST',
      });
    },

    cancel: async (id: string): Promise<{ success: boolean; job: PrintJob }> => {
      return request<{ success: boolean; job: PrintJob }>(`/print-jobs/${id}/cancel`, {
        method: 'POST',
      });
    },
  },

  // --- Serialized Batches API ---
  batchJobs: {
    list: async (): Promise<BarcodeBatchJob[]> => {
      return request<BarcodeBatchJob[]>('/batch-jobs');
    },

    create: async (batch: Partial<BarcodeBatchJob>): Promise<BarcodeBatchJob> => {
      return request<BarcodeBatchJob>('/batch-jobs', {
        method: 'POST',
        body: JSON.stringify(batch),
      });
    },

    updateStatus: async (
      id: string,
      status: 'ready' | 'printed' | 'archived',
      printedBy?: string,
      printerName?: string
    ): Promise<BarcodeBatchJob> => {
      return request<BarcodeBatchJob>(`/batch-jobs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, printedBy, printerName }),
      });
    },
  },

  // --- Printers API ---
  printers: {
    list: async (): Promise<PrinterDefinition[]> => {
      return request<PrinterDefinition[]>('/printers');
    },

    create: async (printer: Partial<PrinterDefinition>): Promise<PrinterDefinition> => {
      return request<PrinterDefinition>('/printers', {
        method: 'POST',
        body: JSON.stringify(printer),
      });
    },

    update: async (id: string, printer: Partial<PrinterDefinition>): Promise<PrinterDefinition> => {
      return request<PrinterDefinition>(`/printers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(printer),
      });
    },

    delete: async (id: string): Promise<{ success: boolean; id: string }> => {
      return request<{ success: boolean; id: string }>(`/printers/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // --- Audit Logs API ---
  auditLogs: {
    list: async (): Promise<AuditLogEntry[]> => {
      return request<AuditLogEntry[]>('/audit-logs');
    },

    log: async (entry: Partial<AuditLogEntry>): Promise<AuditLogEntry> => {
      return request<AuditLogEntry>('/audit-logs', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },

    exportUrl: (): string => {
      return `${API_BASE}/audit-logs/export`;
    },
  },

  // --- Datasets API ---
  datasets: {
    list: async () => {
      return request<any[]>('/datasets');
    },
    get: async (id: string) => {
      return request<any>(`/datasets/${id}`);
    },
    create: async (dataset: any) => {
      return request<any>('/datasets', {
        method: 'POST',
        body: JSON.stringify(dataset),
      });
    },
    update: async (id: string, dataset: any) => {
      return request<any>(`/datasets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dataset),
      });
    },
    delete: async (id: string) => {
      return request<{ success: boolean; message: string }>(`/datasets/${id}`, {
        method: 'DELETE',
      });
    },
    uploadExcel: async (payload: { name?: string; fileName?: string; records: any[]; columns?: string[]; createdBy?: string }) => {
      return request<any>('/datasets/upload-excel', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    uploadCsv: async (payload: { name?: string; fileName?: string; csvText?: string; records?: any[]; columns?: string[]; createdBy?: string }) => {
      return request<any>('/datasets/upload-csv', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    preview: async (datasetId: string, limit: number = 10, offset: number = 0) => {
      return request<any>('/datasets/preview', {
        method: 'POST',
        body: JSON.stringify({ datasetId, limit, offset }),
      });
    },
  },

  // --- Enterprise Licensing API ---
  license: {
    status: async () => {
      return request<any>('/license/status');
    },
    generate: async (payload: { organization?: string; tier?: string; maxPrinters?: number; maxUsers?: number }) => {
      return request<any>('/license/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    activate: async (payload: { licenseKey: string; registeredTo?: string; organization?: string }) => {
      return request<any>('/license/activate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    offlineActivate: async (payload: { activationCode: string; licenseKey?: string }) => {
      return request<any>('/license/offline-activate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // --- Export API ---
  export: {
    zpl: async (template: LabelTemplate, record?: Record<string, any>) => {
      return request<{ format: string; zpl: string; templateName: string; dimensions: any }>('/export/zpl', {
        method: 'POST',
        body: JSON.stringify({ template, record }),
      });
    },
    epl: async (template: LabelTemplate, record?: Record<string, any>) => {
      return request<{ format: string; epl: string; templateName: string; dimensions: any }>('/export/epl', {
        method: 'POST',
        body: JSON.stringify({ template, record }),
      });
    },
    pdf: async (payload: { templateId?: string; templateName?: string; pagesCount?: number; pdfDataUrl?: string }) => {
      return request<any>('/export/pdf', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    png: async (payload: { templateName?: string; pageNumber?: number; pngDataUrl?: string }) => {
      return request<any>('/export/png', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // --- Expanded Printers API ---
  printersExt: {
    getDefault: async () => {
      return request<PrinterDefinition>('/printers/default');
    },
    refresh: async () => {
      return request<{ success: boolean; count: number; printers: PrinterDefinition[] }>('/printers/refresh', {
        method: 'POST',
      });
    },
    calibrate: async (payload: {
      printerId: string;
      labelWidth?: number;
      labelHeight?: number;
      mediaType?: string;
      dpi?: number;
      darkness?: number;
      speed?: number;
      testPage?: boolean;
    }) => {
      return request<{ success: boolean; message: string; printer: any }>('/printers/calibrate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // --- Users & Auth API ---
  users: {
    list: async (): Promise<UserProfile[]> => {
      return request<UserProfile[]>('/users');
    },

    login: async (
      email: string,
      password?: string
    ): Promise<{ success: boolean; user: UserProfile; token: string }> => {
      return request<{ success: boolean; user: UserProfile; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
  },

  // --- Direct GS1, ZPL & AI APIs ---
  gs1: {
    parse: async (input: string) => {
      return request<{
        valid: boolean;
        parsedElements: Array<{ ai: string; label: string; value: string; raw: string }>;
        errors: string[];
      }>('/gs1/parse', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
    },

    checkDigit: async (digits: string) => {
      return request<{ digits: string; checkDigit: string; isValidWithCurrentCheckDigit: boolean }>(
        '/gs1/check-digit',
        {
          method: 'POST',
          body: JSON.stringify({ digits }),
        }
      );
    },
  },

  zpl: {
    generate: async (template: LabelTemplate, record?: Record<string, string>, format: string = 'zpl') => {
      return request<{ zpl?: string; tspl?: string; epl?: string; code: string }>('/zpl/generate', {
        method: 'POST',
        body: JSON.stringify({ template, record, format }),
      });
    },
  },

  ai: {
    suggest: async (prompt: string, labelType?: string, standard?: string) => {
      return request<{ advice: string }>('/ai/suggest', {
        method: 'POST',
        body: JSON.stringify({ prompt, labelType, standard }),
      });
    },
  },

  // --- Enterprise Software Release & Desktop App Downloads ---
  software: {
    getLatestVersion: async () => {
      return request<{
        success: boolean;
        data: any;
        isLatest: boolean;
        updateAvailable: boolean;
      }>('/software/latest-version');
    },

    getVersionHistory: async () => {
      return request<{
        success: boolean;
        totalReleases: number;
        data: any[];
      }>('/software/version-history');
    },

    checkUpdate: async (clientVersion: string) => {
      return request<{
        updateAvailable: boolean;
        currentClientVersion: string;
        latestVersion: string;
        releaseDetails: any;
      }>('/software/check-update', {
        method: 'POST',
        body: JSON.stringify({ clientVersion }),
      });
    },

    uploadVersion: async (payload: {
      version: string;
      releaseName: string;
      releaseNotes: string[];
      fileSize?: string;
      channel?: string;
    }) => {
      return request<{ success: boolean; message: string; data: any }>('/admin/software/upload-version', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getDownloadUrl: (target: string = 'win-x64', version: string = '2.5.0') => {
      return `/api/software/download?target=${target}&v=${version}`;
    },
  },
};
