/**
 * 360Barcode Document Event Dispatcher
 * Centralized, recursion-safe lifecycle event execution engine.
 * Dispatches real BarTender-compatible document and print events:
 * OnOpen, OnSave, OnClose, OnPrintJobStart, OnNewRecord, OnSerialize,
 * OnIdenticalCopies, OnPrePrint, OnPostPrint, OnPrintJobEnd, OnPrintJobCancel.
 */

import { EvaluationContext, LabelTemplate } from '../types';
import { executeDocumentEventScript, ScriptExecutionResult } from './vbscriptEngine';

export type DocumentLifecycleEvent =
  | 'OnOpen'
  | 'OnSave'
  | 'OnClose'
  | 'OnPrintJobStart'
  | 'OnStartJob'
  | 'OnNewRecord'
  | 'OnSerialize'
  | 'OnIdenticalCopies'
  | 'OnPrePrint'
  | 'OnPostPrint'
  | 'OnPrintJobEnd'
  | 'OnEndJob'
  | 'OnPrintJobCancel';

class DocumentEventDispatcherService {
  private static instance: DocumentEventDispatcherService;
  private activeEvents = new Set<string>();
  private lastExecutedRecordIndex: number | null = null;
  private lastExecutedDocumentId: string | null = null;

  private constructor() {}

  public static getInstance(): DocumentEventDispatcherService {
    if (!DocumentEventDispatcherService.instance) {
      DocumentEventDispatcherService.instance = new DocumentEventDispatcherService();
    }
    return DocumentEventDispatcherService.instance;
  }

  /**
   * Dispatches a document lifecycle event with loop and recursion protection.
   */
  public dispatch(
    eventName: DocumentLifecycleEvent,
    template: LabelTemplate,
    ctx: EvaluationContext = {}
  ): ScriptExecutionResult {
    const eventKey = `${template.id || 'doc'}:${eventName}`;

    // 1. Recursion protection: prevent event loops
    if (this.activeEvents.has(eventKey)) {
      console.warn(`[DocumentEventDispatcher] Prevented recursive event execution for "${eventKey}"`);
      return {
        success: false,
        value: '',
        logs: [`[Recursion Guard] Event "${eventName}" is already executing`],
        error: `Circular or recursive event invocation detected for "${eventName}"`,
        executionTimeMs: 0,
      };
    }

    // 2. OnNewRecord deduplication: only fire when record genuinely changes
    if (eventName === 'OnNewRecord') {
      const recIdx = ctx.currentRecordIndex ?? 0;
      if (this.lastExecutedRecordIndex === recIdx && this.lastExecutedDocumentId === template.id) {
        return {
          success: true,
          value: '',
          logs: [],
          record: ctx.record,
          executionTimeMs: 0,
        };
      }
      this.lastExecutedRecordIndex = recIdx;
      this.lastExecutedDocumentId = template.id;
    }

    const eventScripts = template.eventScripts || {};
    this.activeEvents.add(eventKey);

    try {
      const res = executeDocumentEventScript(eventName, eventScripts, {
        ...ctx,
        scriptLibraries: template.scriptLibraries,
      } as any);

      // If event updated record fields, mutate current record in context if present
      if (res.success && res.record && ctx.record) {
        Object.assign(ctx.record, res.record);
      }

      return {
        ...res,
        result: res.value,
      };
    } finally {
      this.activeEvents.delete(eventKey);
    }
  }

  /**
   * Resets active record tracking (e.g. when switching documents or closing).
   */
  public resetRecordTracking(): void {
    this.lastExecutedRecordIndex = null;
    this.lastExecutedDocumentId = null;
  }
}

export const documentEventDispatcher = DocumentEventDispatcherService.getInstance();
