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
};
