import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { LabelTemplate, LabelElement, DataSourceItem, ScriptLibrary } from '../../types';
import { executeVBScript, executeDocumentEventScript, ScriptExecutionResult } from '../../services/vbscriptEngine';
import { evaluateSafeScript } from '../../services/dataSourceEngine';
import {
  buildDynamicAssistantCategories,
  ScriptAssistantItem,
  ScriptAssistantCategory,
} from '../../services/scriptAssistantRegistry';
import {
  X,
  Play,
  Search,
  Code2,
  BookOpen,
  ChevronRight,
  ChevronDown,
  FileCode,
  FolderCode,
  Layers,
  Database,
  Hash,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Terminal,
} from 'lucide-react';

export interface ScriptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  onUpdateTemplate: (updated: LabelTemplate) => void;
  currentRecord?: Record<string, any>;
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  selectedObjectId?: string;
  selectedDataSourceId?: string;
  databaseRecords?: Record<string, any>[];
  activeRecordIndex?: number;
}

// Tree Node Types
export type ScriptTargetType =
  | 'document_event'
  | 'object_data_source'
  | 'object_transform'
  | 'object_on_process_data'
  | 'script_library';

export interface ScriptTreeNode {
  id: string;
  label: string;
  type: ScriptTargetType;
  eventName?: string;
  objectId?: string;
  elementId?: string;
  elementName?: string;
  dataSourceId?: string;
  dataSourceIndex?: number;
  dataSourceName?: string;
  scriptMode?: 'expression' | 'multiline';
  transformIndex?: number;
  libraryId?: string;
  language?: 'javascript' | 'vbscript';
  code: string;
  description?: string;
  hasCode: boolean;
  children?: ScriptTreeNode[];
}

const DOCUMENT_EVENT_DEFINITIONS = [
  { id: 'OnOpen', label: 'OnOpen', description: 'Executed when the document is first opened in the designer or print station.' },
  { id: 'OnSave', label: 'OnSave', description: 'Executed immediately prior to saving the document to storage or cloud.' },
  { id: 'OnClose', label: 'OnClose', description: 'Executed when the document tab or window is closed.' },
  { id: 'OnPrintJobStart', label: 'OnPrintJobStart', description: 'Executed once when a print batch is initiated before any records are processed.' },
  { id: 'OnNewRecord', label: 'OnNewRecord', description: 'Executed each time a new database/Excel record is loaded for formatting.' },
  { id: 'OnSerialize', label: 'OnSerialize', description: 'Executed when serialization sequences and counters advance.' },
  { id: 'OnIdenticalCopies', label: 'OnIdenticalCopies', description: 'Executed for each identical copy within a label record.' },
  { id: 'OnPrintJobEnd', label: 'OnPrintJobEnd', description: 'Executed once after all records and copies in the print batch have finished successfully.' },
  { id: 'OnPrintJobCancel', label: 'OnPrintJobCancel', description: 'Executed if the print job is cancelled or aborted by user/system.' },
];

export const ScriptEditorModal: React.FC<ScriptEditorModalProps> = ({
  isOpen,
  onClose,
  template,
  onUpdateTemplate,
  currentRecord,
  currentRecordIndex = 0,
  totalRecords = 1,
  printerName = 'Default Zebra ZT410',
  jobId = 'JOB-001',
  selectedObjectId,
  selectedDataSourceId,
  databaseRecords,
  activeRecordIndex,
}) => {
  const effectiveRecordIndex = activeRecordIndex ?? currentRecordIndex;
  const effectiveRecord = currentRecord || (databaseRecords && databaseRecords[effectiveRecordIndex]) || {};

  // Working copies of document scripts and libraries
  const [eventScripts, setEventScripts] = useState<Record<string, string>>(() => template.eventScripts || {});
  const [eventLanguages, setEventLanguages] = useState<Record<string, 'vbscript' | 'javascript'>>(() => template.eventScriptLanguages || {});
  const [elements, setElements] = useState<LabelElement[]>(() => JSON.parse(JSON.stringify(template.elements || [])));
  const [libraries, setLibraries] = useState<ScriptLibrary[]>(() => JSON.parse(JSON.stringify(template.scriptLibraries || [])));

  // Navigation & Selection
  const [selectedNodeId, setSelectedNodeId] = useState<string>('doc-OnNewRecord');
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [assistantSearch, setAssistantSearch] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'cat-database-fields': true,
    'cat-functions': true,
    'cat-control-flow': true,
  });
  const [selectedAssistantItem, setSelectedAssistantItem] = useState<ScriptAssistantItem | null>(null);

  // Editor State
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Panel sizing
  const [leftWidth, setLeftWidth] = useState<number>(240);
  const [rightWidth, setRightWidth] = useState<number>(270);
  const [bottomHeight, setBottomHeight] = useState<number>(120);

  // Test Script Result
  const [testResult, setTestResult] = useState<ScriptExecutionResult | null>(null);
  const [testActiveRecordIndex, setTestActiveRecordIndex] = useState<number>(effectiveRecordIndex);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Sync state when template opens or changes
  useEffect(() => {
    if (isOpen) {
      setEventScripts(template.eventScripts || {});
      setEventLanguages(template.eventScriptLanguages || {});
      setElements(JSON.parse(JSON.stringify(template.elements || [])));
      setLibraries(JSON.parse(JSON.stringify(template.scriptLibraries || [])));
      setIsDirty(false);
      setTestResult(null);
      setTestActiveRecordIndex(effectiveRecordIndex);
      if (selectedObjectId && selectedDataSourceId) {
        setSelectedNodeId(`ds-script-${selectedObjectId}-${selectedDataSourceId}`);
      } else if (selectedObjectId) {
        setSelectedNodeId(`obj-ds-${selectedObjectId}-0`);
      }
    }
  }, [isOpen, selectedObjectId, selectedDataSourceId]);

  // Build the hierarchical tree from the real active document
  const treeNodes: ScriptTreeNode[] = useMemo(() => {
    const nodes: ScriptTreeNode[] = [];

    // 1. Script Libraries
    libraries.forEach((lib) => {
      nodes.push({
        id: `lib-${lib.id}`,
        label: lib.name,
        type: 'script_library',
        libraryId: lib.id,
        language: lib.language,
        code: lib.code || '',
        description: lib.description || `Reusable script library "${lib.name}".`,
        hasCode: Boolean(lib.code?.trim()),
      });
    });

    // 2. Document Events
    DOCUMENT_EVENT_DEFINITIONS.forEach((def) => {
      const code = eventScripts[def.id] || '';
      nodes.push({
        id: `doc-${def.id}`,
        label: def.label,
        type: 'document_event',
        eventName: def.id,
        language: eventLanguages[def.id] || 'vbscript',
        code,
        description: def.description,
        hasCode: Boolean(code.trim()),
      });
    });

    // 3. Template Objects -> Data Sources -> Scripts / Transforms
    elements.forEach((el) => {
      const elName = el.name || `${el.type}_${el.id.slice(0, 6)}`;
      (el.dataSources || []).forEach((ds, dsIdx) => {
        const dsName = ds.name || `Source ${dsIdx + 1}`;

        // Standalone Script Data Source
        if (ds.type === 'script') {
          nodes.push({
            id: `ds-script-${el.id}-${ds.id || dsIdx}`,
            label: `${elName} → ${dsName} (Script Source)`,
            type: 'object_data_source',
            elementId: el.id,
            elementName: elName,
            dataSourceId: ds.id,
            dataSourceName: dsName,
            language: ds.scriptLanguage || 'vbscript',
            scriptMode: ds.scriptMode || 'multiline',
            code: ds.scriptCode || '',
            description: `Standalone script providing the value for data source "${dsName}" on object "${elName}".`,
            hasCode: Boolean(ds.scriptCode?.trim()),
          });
        }

        // Script Transform
        const scriptTransform = (ds.transforms || []).find((t) => t.type === 'script');
        if (scriptTransform) {
          const code = (scriptTransform.params as any)?.scriptCode || (scriptTransform.params as any)?.code || '';
          const lang = (scriptTransform.params as any)?.scriptLanguage || (scriptTransform.params as any)?.language || 'vbscript';
          nodes.push({
            id: `ds-trans-${el.id}-${ds.id || dsIdx}`,
            label: `${elName} → ${dsName} (Script Transform)`,
            type: 'object_transform',
            elementId: el.id,
            elementName: elName,
            dataSourceId: ds.id,
            dataSourceName: dsName,
            language: lang,
            code,
            description: `Script transform applied to data source "${dsName}". Incoming value is available as "Value".`,
            hasCode: Boolean(code.trim()),
          });
        }

        // OnProcessData Hook
        nodes.push({
          id: `ds-onprocess-${el.id}-${ds.id || dsIdx}`,
          label: `${elName} → ${dsName} (OnProcessData)`,
          type: 'object_on_process_data',
          elementId: el.id,
          elementName: elName,
          dataSourceId: ds.id,
          dataSourceName: dsName,
          language: ds.onProcessDataLanguage || 'vbscript',
          code: ds.onProcessDataScript || '',
          description: `OnProcessData hook executed after data retrieval and transforms for "${dsName}".`,
          hasCode: Boolean(ds.onProcessDataScript?.trim()),
        });
      });
    });

    return nodes;
  }, [libraries, eventScripts, eventLanguages, elements]);

  // Filtered tree nodes
  const filteredTreeNodes = useMemo(() => {
    if (!treeSearch.trim()) return treeNodes;
    const q = treeSearch.toLowerCase();
    return treeNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.eventName?.toLowerCase().includes(q) ||
        n.elementName?.toLowerCase().includes(q) ||
        n.dataSourceName?.toLowerCase().includes(q)
    );
  }, [treeNodes, treeSearch]);

  // Currently active selected node
  const activeNode = useMemo(() => {
    return treeNodes.find((n) => n.id === selectedNodeId) || treeNodes[0];
  }, [treeNodes, selectedNodeId]);

  useEffect(() => {
    setTestResult(null);
  }, [selectedNodeId]);

  // Code editor text
  const currentCode = activeNode?.code || '';

  // Update active script code
  const handleCodeChange = (newCode: string) => {
    if (!activeNode) return;
    setTestResult(null);
    setIsDirty(true);

    if (activeNode.type === 'document_event' && activeNode.eventName) {
      setEventScripts((prev) => ({ ...prev, [activeNode.eventName!]: newCode }));
    } else if (activeNode.type === 'script_library' && activeNode.libraryId) {
      setLibraries((prev) =>
        prev.map((lib) => (lib.id === activeNode.libraryId ? { ...lib, code: newCode } : lib))
      );
    } else if (activeNode.elementId && activeNode.dataSourceId) {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== activeNode.elementId) return el;
          const nextDs = (el.dataSources || []).map((ds) => {
            if (ds.id !== activeNode.dataSourceId) return ds;
            if (activeNode.type === 'object_data_source') {
              return { ...ds, scriptCode: newCode };
            }
            if (activeNode.type === 'object_on_process_data') {
              return { ...ds, onProcessDataScript: newCode, onProcessDataEnabled: true };
            }
            if (activeNode.type === 'object_transform') {
              const updatedTransforms = (ds.transforms || []).map((t) => {
                if (t.type !== 'script') return t;
                return { ...t, params: { ...t.params, scriptCode: newCode, code: newCode } };
              });
              return { ...ds, transforms: updatedTransforms };
            }
            return ds;
          });
          return { ...el, dataSources: nextDs };
        })
      );
    }
  };

  const handleScriptModeChange = (newMode: 'expression' | 'multiline') => {
    if (!activeNode?.elementId || !activeNode.dataSourceId || activeNode.type !== 'object_data_source') return;
    setTestResult(null);
    setIsDirty(true);
    setElements((prev) =>
      prev.map((el) => el.id !== activeNode.elementId
        ? el
        : {
            ...el,
            dataSources: (el.dataSources || []).map((ds) =>
              ds.id === activeNode.dataSourceId ? { ...ds, scriptMode: newMode } : ds
            ),
          })
    );
  };

  // Update active script language
  const handleLanguageChange = (newLang: 'vbscript' | 'javascript') => {
    if (!activeNode) return;
    setTestResult(null);
    setIsDirty(true);

    if (activeNode.type === 'document_event' && activeNode.eventName) {
      setEventLanguages((prev) => ({ ...prev, [activeNode.eventName!]: newLang }));
    } else if (activeNode.type === 'script_library' && activeNode.libraryId) {
      setLibraries((prev) =>
        prev.map((lib) => (lib.id === activeNode.libraryId ? { ...lib, language: newLang } : lib))
      );
    } else if (activeNode.elementId && activeNode.dataSourceId) {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== activeNode.elementId) return el;
          const nextDs = (el.dataSources || []).map((ds) => {
            if (ds.id !== activeNode.dataSourceId) return ds;
            if (activeNode.type === 'object_data_source') {
              return { ...ds, scriptLanguage: newLang };
            }
            if (activeNode.type === 'object_on_process_data') {
              return { ...ds, onProcessDataLanguage: newLang };
            }
            if (activeNode.type === 'object_transform') {
              const updatedTransforms = (ds.transforms || []).map((t) => {
                if (t.type !== 'script') return t;
                return { ...t, params: { ...t.params, scriptLanguage: newLang, language: newLang } };
              });
              return { ...ds, transforms: updatedTransforms };
            }
            return ds;
          });
          return { ...el, dataSources: nextDs };
        })
      );
    }
  };

  // Insert text at cursor position
  const insertAtCursor = useCallback((textToInsert: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      handleCodeChange(currentCode + textToInsert);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = currentCode.substring(0, start);
    const after = currentCode.substring(end);
    const updated = before + textToInsert + after;
    handleCodeChange(updated);

    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + textToInsert.length;
      ta.setSelectionRange(caret, caret);
    });
  }, [currentCode]);

  // Handle Double-Click from Assistant (Section 6)
  const handleAssistantDoubleClick = (item: ScriptAssistantItem) => {
    const isVB = activeNode?.language === 'vbscript';
    const snippet = isVB ? item.snippetVb : item.snippetJs;
    insertAtCursor(snippet);
  };

  // Build dynamic assistant categories
  const assistantCategories = useMemo(() => {
    return buildDynamicAssistantCategories({
      elements: template.elements,
      databaseFields: template.databaseConnection?.fields || Object.keys(effectiveRecord || {}).filter((k) => !k.startsWith('__')),
      currentRecord: effectiveRecord || {},
      namedSources: template.namedDataSources?.map((n) => ({ name: n.name, defaultValue: n.defaultValue })),
      scriptLibraries: libraries.map((l) => ({ id: l.id, name: l.name, language: l.language, description: l.description })),
    });
  }, [template, effectiveRecord, libraries]);

  // Filter assistant categories by search query
  const filteredAssistantCategories = useMemo(() => {
    if (!assistantSearch.trim()) return assistantCategories;
    const q = assistantSearch.toLowerCase();

    return assistantCategories
      .map((cat) => {
        const matchingItems = cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.syntax.toLowerCase().includes(q) ||
            item.example.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
        );
        return { ...cat, items: matchingItems };
      })
      .filter((cat) => cat.items.length > 0);
  }, [assistantCategories, assistantSearch]);

  // Test Script Execution (Section 21 & 22)
  const handleTestScript = () => {
    if (!activeNode) return;
    const codeToTest = currentCode;

    // Build realistic evaluation context
    const testContext = {
      record: { ...effectiveRecord },
      system: {
        UserName: 'Administrator',
        PrinterName: printerName,
        JobId: jobId,
        RecordNumber: testActiveRecordIndex + 1,
        TotalRecords: totalRecords,
        PageNumber: 1,
        CopyNumber: 1,
      },
      namedDataSources: template.namedDataSources,
      scriptLibraries: libraries,
    };

    try {
      if (activeNode.language === 'vbscript') {
        const res = executeVBScript(codeToTest, {
          value: 'Sample Text',
          input: 'Sample Text',
          record: testContext.record,
          system: testContext.system,
          namedSubStrings: template.namedDataSources
            ? Object.fromEntries(template.namedDataSources.map((n) => [n.name, n.defaultValue]))
            : {},
          libraries,
        }, undefined, activeNode.type === 'object_data_source' ? activeNode.scriptMode || 'multiline' : 'multiline');
        setTestResult(res);
      } else {
        const startTime = performance.now();
        const resVal = evaluateSafeScript(codeToTest, {
          ...testContext,
          scriptLibraries: libraries,
          value: 'Sample Text',
          input: 'Sample Text',
        } as any, 'javascript', activeNode.type === 'object_data_source' ? activeNode.scriptMode || 'multiline' : 'multiline');
        const elapsed = Math.round(performance.now() - startTime);
        setTestResult({
          success: !resVal.startsWith('[Script Error:'),
          value: resVal,
          record: testContext.record,
          logs: [],
          error: resVal.startsWith('[Script Error:') ? resVal.replace('[Script Error: ', '').replace(']', '') : undefined,
          executionTimeMs: elapsed,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        value: `[Script Error: ${err.message}]`,
        logs: [],
        error: err.message,
        executionTimeMs: 0,
      });
    }
  };

  // Add a new Script Library
  const handleAddLibrary = () => {
    const newLib: ScriptLibrary = {
      id: `lib-${Date.now()}`,
      name: `Library${libraries.length + 1}`,
      language: 'vbscript',
      code: `' Reusable library functions\nFunction CalculateTax(amount)\n    CalculateTax = amount * 0.18\nEnd Function`,
      description: 'Custom user script library',
      enabled: true,
    };
    setLibraries([...libraries, newLib]);
    setSelectedNodeId(`lib-${newLib.id}`);
    setIsDirty(true);
  };

  // Delete a Script Library
  const handleDeleteLibrary = (libId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this script library?')) {
      setLibraries(libraries.filter((l) => l.id !== libId));
      if (selectedNodeId === `lib-${libId}`) {
        setSelectedNodeId('doc-OnNewRecord');
      }
      setIsDirty(true);
    }
  };

  // Save changes to working document
  const handleApply = () => {
    onUpdateTemplate({
      ...template,
      eventScripts,
      eventScriptLanguages: eventLanguages,
      elements,
      scriptLibraries: libraries,
    });
    setIsDirty(false);
  };

  // OK: Apply and close
  const handleOk = () => {
    handleApply();
    onClose();
  };

  // Cancel: Discard and close
  const handleCancel = () => {
    if (isDirty) {
      if (!confirm('You have unsaved script edits. Discard changes?')) return;
    }
    onClose();
  };

  // Cursor position tracking
  const handleTextareaSelect = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value.substring(0, ta.selectionStart);
    const lines = val.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Keyboard navigation & shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      insertAtCursor('    ');
      return;
    }
    // Ctrl+S: Save / Apply
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleApply();
      return;
    }
    // Ctrl+F: Find
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      setShowFindReplace(true);
      return;
    }
  };

  if (!isOpen) return null;

  const lineCount = Math.max(currentCode.split('\n').length, 14);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-2xs p-3 font-sans select-none animate-in fade-in duration-150">
      <div
        className={`bg-[#f0f4f9] border border-[#718096] rounded-md shadow-2xl flex flex-col overflow-hidden text-slate-800 text-[12px] transition-all ${
          isMaximized ? 'w-full h-full' : 'w-[1020px] max-w-[98vw] h-[680px] max-h-[96vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ------------------------------------------------------------- */}
        {/* WINDOW HEADER & TITLE BAR                                     */}
        {/* ------------------------------------------------------------- */}
        <div className="h-8 bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xs shadow-xs flex items-center justify-center text-white">
              <Code2 className="w-3 h-3" />
            </div>
            <span className="font-bold text-slate-900 text-[12px] tracking-tight">
              360Barcode Script Editor — [{template.name || 'Document1'}]
            </span>
            {isDirty && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-white rounded-xs font-bold uppercase tracking-wider">
                Unsaved Edits
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Test Script Button */}
            <button
              type="button"
              onClick={handleTestScript}
              title="Execute active script with test record context"
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-[11px] font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Test Script</span>
            </button>

            {/* Maximize & Close */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-slate-300 rounded-xs transition-colors cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MENU BAR (File, Edit, Search, View, Help)                     */}
        {/* ------------------------------------------------------------- */}
        <div className="h-6 bg-[#f8fafc] border-b border-[#cbd5e1] px-2 flex items-center justify-between text-[11px] text-slate-700 shrink-0">
          <div className="flex items-center gap-4 font-medium">
            <button onClick={handleApply} className="hover:text-blue-700 cursor-pointer">File (Save)</button>
            <button onClick={() => insertAtCursor('')} className="hover:text-blue-700 cursor-pointer">Edit</button>
            <button onClick={() => setShowFindReplace(!showFindReplace)} className="hover:text-blue-700 cursor-pointer">Search (Find)</button>
            <button onClick={() => setWordWrap(!wordWrap)} className="hover:text-blue-700 cursor-pointer">
              View ({wordWrap ? 'Wrap On' : 'Wrap Off'})
            </button>
            <button onClick={() => alert('BarTender Compatible Scripting Engine\nSupports VBScript (DateAdd, FormatDateTime, Record) and JavaScript.')} className="hover:text-blue-700 cursor-pointer">
              Help
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Engine:</span>
            <select
              value={activeNode?.language || 'vbscript'}
              onChange={(e) => handleLanguageChange(e.target.value as any)}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800 cursor-pointer"
            >
              <option value="vbscript">VBScript Emulator</option>
              <option value="javascript">JavaScript Engine</option>
            </select>
            {activeNode?.type === 'object_data_source' && (
              <>
                <span className="text-slate-500 font-medium">Mode:</span>
                <select
                  aria-label="Script mode"
                  value={activeNode.scriptMode || 'multiline'}
                  onChange={(e) => handleScriptModeChange(e.target.value as 'expression' | 'multiline')}
                  className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800"
                >
                  <option value="expression">Single-Line Expression</option>
                  <option value="multiline">Multi-Line Script</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MAIN WORKSPACE: TREE (LEFT) | EDITOR (CENTER) | ASSISTANT (RIGHT) */}
        {/* ------------------------------------------------------------- */}
        <div className="flex-1 flex overflow-hidden bg-white">
          {/* 1. SCRIPT TREE (LEFT PANEL) */}
          <div
            style={{ width: `${leftWidth}px` }}
            className="border-r border-slate-200 bg-[#f8fafc] flex flex-col shrink-0 overflow-hidden select-none"
          >
            {/* Tree Search Box */}
            <div className="p-1.5 border-b border-slate-200 flex items-center gap-1 bg-white">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="Search..."
                className="w-full text-[11px] outline-none bg-transparent"
              />
              {treeSearch && (
                <button onClick={() => setTreeSearch('')} className="text-slate-400 hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Tree Nodes List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-2 text-[11px]">
              {/* Section: Script Libraries */}
              <div>
                <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  <span>Script Libraries</span>
                  <button
                    type="button"
                    onClick={handleAddLibrary}
                    title="Add new Script Library"
                    className="p-0.5 hover:bg-slate-200 text-blue-600 rounded cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {libraries.length === 0 ? (
                  <div className="text-[10px] text-slate-400 italic px-2 py-0.5">No libraries</div>
                ) : (
                  libraries.map((lib) => (
                    <div
                      key={lib.id}
                      onClick={() => setSelectedNodeId(`lib-${lib.id}`)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                        selectedNodeId === `lib-${lib.id}` ? 'bg-[#0078d7] text-white font-bold' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileCode className="w-3 h-3 shrink-0 text-amber-500" />
                        <span className="truncate">{lib.name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteLibrary(lib.id, e)}
                        className="hover:text-red-300 p-0.5"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Section: Document Events */}
              <div>
                <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  Document Events
                </div>
                {filteredTreeNodes
                  .filter((n) => n.type === 'document_event')
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                        selectedNodeId === n.id ? 'bg-[#0078d7] text-white font-bold' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-mono text-[10.5px]">{n.label}</span>
                      {n.hasCode && (
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedNodeId === n.id ? 'bg-white' : 'bg-blue-600'}`} />
                      )}
                    </div>
                  ))}
              </div>

              {/* Section: Template Objects */}
              <div>
                <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  Template Objects
                </div>
                {filteredTreeNodes
                  .filter((n) => n.type !== 'document_event' && n.type !== 'script_library')
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                        selectedNodeId === n.id ? 'bg-[#0078d7] text-white font-bold' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="truncate text-[10.5px]">{n.label}</span>
                      {n.hasCode && (
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedNodeId === n.id ? 'bg-white' : 'bg-emerald-600'}`} />
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Tree Node Description (Lower Left) */}
            <div className="p-2 border-t border-slate-200 bg-white text-[10.5px] text-slate-600 max-h-24 overflow-y-auto">
              <span className="font-bold text-slate-700 block mb-0.5">Description:</span>
              <p className="leading-tight">{activeNode?.description || 'Select an item to view details.'}</p>
            </div>
          </div>

          {/* 2. CODE EDITOR (CENTER PANEL) */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Find / Replace Bar */}
            {showFindReplace && (
              <div className="p-1.5 bg-slate-100 border-b border-slate-300 flex items-center gap-2 text-[11px]">
                <input
                  type="text"
                  placeholder="Find..."
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px]"
                />
                <input
                  type="text"
                  placeholder="Replace with..."
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px]"
                />
                <button
                  onClick={() => {
                    if (findText) {
                      handleCodeChange(currentCode.split(findText).join(replaceText));
                    }
                  }}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                >
                  Replace All
                </button>
                <button onClick={() => setShowFindReplace(false)} className="text-slate-500 hover:text-black">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Editor Area with Line Numbers */}
            <div className="flex-1 flex bg-slate-900 overflow-hidden relative">
              {/* Line Gutter */}
              <div
                ref={gutterRef}
                className="select-none text-right py-2.5 px-2 text-slate-500 font-mono text-xs leading-[1.6] bg-slate-950/80 border-r border-slate-800 overflow-hidden"
                style={{ minWidth: '2.8rem' }}
                aria-hidden
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea Code Input */}
              <textarea
                ref={textareaRef}
                value={currentCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onSelect={handleTextareaSelect}
                onKeyDown={handleKeyDown}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                wrap={wordWrap ? 'on' : 'off'}
                spellCheck={false}
                placeholder={
                  activeNode?.language === 'vbscript'
                    ? "' Enter VBScript here\nValue = DateAdd(\"d\", Record(\"ExpiryDays\"), Date)"
                    : "// Enter JavaScript here\nreturn new Date();"
                }
                className="flex-1 p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs leading-[1.6] outline-none resize-none overflow-auto selection:bg-blue-600"
              />
            </div>

            {/* Editor Status Bar */}
            <div className="h-5 bg-slate-100 border-t border-slate-200 px-3 flex items-center justify-between text-[10px] text-slate-600 shrink-0 font-mono">
              <div className="flex items-center gap-3">
                <span>Line: {cursorPos.line}, Column: {cursorPos.col}</span>
                <span>Length: {currentCode.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase font-bold">{activeNode?.language}</span>
                {isDirty && <span className="text-amber-600 font-bold">• Modified</span>}
              </div>
            </div>

            {/* 3. OUTPUT / TEST SCRIPT RESULT (BOTTOM PANEL) */}
            <div
              style={{ height: `${bottomHeight}px` }}
              className="border-t border-slate-300 bg-slate-50 flex flex-col shrink-0 overflow-hidden"
            >
              <div className="h-6 bg-slate-200/80 border-b border-slate-300 px-3 flex items-center justify-between text-[11px] font-bold text-slate-700 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-600" />
                  <span>OUTPUT & TEST RESULT</span>
                </div>
                {testResult && (
                  <span className="text-[10px] font-mono text-slate-500">
                    Execution: {testResult.executionTimeMs} ms
                  </span>
                )}
              </div>

              <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px]">
                {testResult ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      )}
                      <span className={testResult.success ? 'text-emerald-900 font-bold' : 'text-red-900 font-bold'}>
                        {testResult.success ? 'Success' : 'Error'}
                      </span>
                    </div>

                    <div className="p-1.5 bg-white border border-slate-200 rounded text-slate-800">
                      <span className="text-slate-500 font-bold block text-[10px]">Resolved Value:</span>
                      <div className="font-bold text-emerald-700 text-xs">{testResult.value || '<Empty String>'}</div>
                    </div>

                    {testResult.logs.length > 0 && (
                      <div className="text-[10.5px] text-slate-600">
                        <span className="font-bold">Console Logs:</span>
                        {testResult.logs.map((log, idx) => (
                          <div key={idx}>{log}</div>
                        ))}
                      </div>
                    )}

                    {testResult.error && (
                      <div className="text-red-600 font-bold text-[10.5px] p-1 bg-red-50 border border-red-200 rounded">
                        {testResult.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">Click "Test Script" above to run and inspect the result.</div>
                )}
              </div>
            </div>
          </div>

          {/* 4. SCRIPT ASSISTANT (RIGHT PANEL) */}
          <div
            style={{ width: `${rightWidth}px` }}
            className="border-l border-slate-200 bg-[#f8fafc] flex flex-col shrink-0 overflow-hidden select-none"
          >
            {/* Header & Search */}
            <div className="p-2 border-b border-slate-200 bg-white flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                Script Assistant
              </span>
            </div>

            <div className="p-1.5 border-b border-slate-200 flex items-center gap-1 bg-white">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={assistantSearch}
                onChange={(e) => setAssistantSearch(e.target.value)}
                placeholder="Search functions & fields..."
                className="w-full text-[11px] outline-none bg-transparent"
              />
              {assistantSearch && (
                <button onClick={() => setAssistantSearch('')} className="text-slate-400 hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Assistant Categories Tree */}
            <div className="flex-1 overflow-y-auto p-1 text-[11px] space-y-0.5">
              {filteredAssistantCategories.map((cat) => {
                const isExpanded = expandedCategories[cat.id] ?? false;
                return (
                  <div key={cat.id} className="border-b border-slate-100 pb-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories((prev) => ({ ...prev, [cat.id]: !isExpanded }))
                      }
                      className="w-full flex items-center gap-1 px-1.5 py-1 text-left font-bold text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{cat.name}</span>
                      <span className="text-[9.5px] text-slate-400 font-normal ml-auto">({cat.items.length})</span>
                    </button>

                    {isExpanded && (
                      <div className="pl-4 space-y-0.5">
                        {cat.items.map((item) => {
                          const isSelected = selectedAssistantItem?.id === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedAssistantItem(item)}
                              onDoubleClick={() => handleAssistantDoubleClick(item)}
                              className={`px-1.5 py-0.5 rounded cursor-pointer truncate flex items-center justify-between ${
                                isSelected ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-200 text-slate-700'
                              }`}
                              title={`${item.name} — Double click to insert`}
                            >
                              <span className="truncate">{item.name}</span>
                              <span className="text-[9px] text-slate-400 italic">insert</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Documentation Panel (Lower Right) */}
            <div className="p-2.5 border-t border-slate-200 bg-white text-[10.5px] text-slate-700 max-h-36 overflow-y-auto space-y-1">
              {selectedAssistantItem ? (
                <div>
                  <div className="font-bold text-blue-900 text-xs mb-0.5">{selectedAssistantItem.name}</div>
                  <p className="text-slate-600 mb-1">{selectedAssistantItem.description}</p>
                  <div className="font-mono bg-slate-50 p-1 rounded border border-slate-200 text-[10px] text-slate-800">
                    {selectedAssistantItem.syntax}
                  </div>
                  {selectedAssistantItem.example && (
                    <div className="text-[10px] text-emerald-800 mt-1">
                      <span className="font-bold">Example: </span>
                      <code className="font-mono">{selectedAssistantItem.example}</code>
                    </div>
                  )}
                  {selectedAssistantItem.resultExample && (
                    <div className="text-[10px] text-slate-500">
                      <span className="font-bold">Result: </span>
                      {selectedAssistantItem.resultExample}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 italic">Select any function or field above to view its documentation and syntax.</div>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM ACTIONS BAR                                            */}
        {/* ------------------------------------------------------------- */}
        <div className="h-10 bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Double-click assistant items to insert at cursor. Ctrl+S to save.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={!isDirty}
              className={`px-4 py-1 border rounded-xs text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer ${
                isDirty
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-[#94a3b8]'
                  : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
              }`}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleOk}
              className="px-5 py-1 bg-[#0078d7] hover:bg-[#005a9e] text-white border border-[#005a9e] rounded-xs text-[11.5px] font-bold shadow-2xs transition-colors cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
