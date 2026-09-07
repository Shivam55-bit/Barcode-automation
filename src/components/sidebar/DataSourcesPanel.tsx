import React, { useState, useMemo, useRef } from 'react';
import {
  Database,
  FileSpreadsheet,
  Calendar,
  Clock,
  Code2,
  Terminal,
  Layers,
  Tag,
  Search,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Type,
  Barcode as BarcodeIcon,
  QrCode,
  Hash,
  AlertTriangle,
  Pin,
  PinOff,
  MoreVertical,
  Sliders,
  Eye,
  Check,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  LabelTemplate,
  LabelElement,
  DatabaseConnectionConfig,
  NamedDataSource,
} from '../../types';
import { evaluateElementData } from '../../services/dataSourceEngine';

export interface DatabaseFieldBindingPayload {
  type: 'database-field';
  connectionId: string;
  connectionName: string;
  sheetId: string;
  sheetName: string;
  fieldId: string;
  fieldName: string;
  sampleValue?: string;
  suggestedType?: 'text' | 'barcode' | 'qr';
}

export interface DataSourcesPanelProps {
  template: LabelTemplate;
  datasets?: any[];
  currentRecordData?: Record<string, any>;
  currentRecordIndex?: number;
  totalRecords?: number;
  selectedElementIds?: string[];
  onSelectElement?: (id: string) => void;
  onBindElementToField?: (elementId: string, payload: DatabaseFieldBindingPayload) => void;
  onInsertBoundElement?: (
    payload: DatabaseFieldBindingPayload,
    xMm?: number,
    yMm?: number,
    asType?: 'text' | 'barcode' | 'qr'
  ) => void;
  onOpenConnectWizard?: () => void;
  onRefreshConnection?: () => Promise<void> | void;
  onClose?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  width?: number;
  onWidthChange?: (w: number) => void;
}

export const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({
  template,
  datasets = [],
  currentRecordData = {},
  currentRecordIndex = 0,
  totalRecords = 1,
  selectedElementIds = [],
  onSelectElement,
  onBindElementToField,
  onInsertBoundElement,
  onOpenConnectWizard,
  onRefreshConnection,
  onClose,
  isPinned = true,
  onTogglePin,
  width: customWidth,
  onWidthChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(customWidth || 280);
  const isResizingRef = useRef(false);

  // Tree expansion states
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    screen_data: false,
    date: false,
    time: false,
    formula: false,
    database_fields: true,
    named_sources: false,
    system_vars: false,
    label_objects: true,
  });

  // Per-connection expansion
  const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({
    default: true,
  });

  // Context menu state for right-click on field
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    payload: DatabaseFieldBindingPayload;
  } | null>(null);

  // Sample data inspection modal
  const [previewField, setPreviewField] = useState<{
    name: string;
    connectionName: string;
    sheetName: string;
    value: string;
    allSampleValues: string[];
  } | null>(null);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  const toggleConn = (connKey: string) => {
    setExpandedConnections((prev) => ({ ...prev, [connKey]: !prev[connKey] }));
  };

  // Compile list of available connections (active template DB connection + registered datasets)
  const connectionsList = useMemo(() => {
    const list: {
      id: string;
      name: string;
      sheetName: string;
      availableSheets: string[];
      fields: string[];
      records: Record<string, any>[];
      filePath?: string;
      status?: string;
    }[] = [];

    if (template.databaseConnection) {
      const db = template.databaseConnection;
      list.push({
        id: db.id || 'excel-primary',
        name: db.name || 'Product Master',
        sheetName: db.sheetName || 'Sheet1$',
        availableSheets: db.availableSheets || [db.sheetName || 'Sheet1$'],
        fields: db.fields || (db.records?.[0] ? Object.keys(db.records[0]) : []),
        records: db.records || template.sampleRecords || [],
        filePath: db.filePath,
        status: db.status || 'CONNECTED',
      });
    }

    // Add any external datasets not yet in template.databaseConnection
    if (Array.isArray(datasets)) {
      for (const ds of datasets) {
        if (!list.some((c) => c.id === ds.id)) {
          list.push({
            id: ds.id,
            name: ds.name,
            sheetName: ds.sheetName || 'Sheet1$',
            availableSheets: ds.availableSheets || [ds.sheetName || 'Sheet1$'],
            fields: ds.columns?.map((c: any) => typeof c === 'string' ? c : c.name) || ds.fields || [],
            records: ds.records || [],
            filePath: ds.filePath,
            status: 'AVAILABLE',
          });
        }
      }
    }

    return list;
  }, [template.databaseConnection, datasets, template.sampleRecords]);

  // Handle Drag Start for a database field
  const handleDragStart = (e: React.DragEvent, payload: DatabaseFieldBindingPayload) => {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', payload.fieldName);
    e.dataTransfer.effectAllowed = 'copyMove';

    // Create a compact professional BarTender-style drag ghost
    const dragGhost = document.createElement('div');
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-1000px';
    dragGhost.style.left = '-1000px';
    dragGhost.style.padding = '4px 10px';
    dragGhost.style.background = '#1e293b';
    dragGhost.style.color = '#ffffff';
    dragGhost.style.fontSize = '11px';
    dragGhost.style.fontFamily = 'Segoe UI, sans-serif';
    dragGhost.style.fontWeight = '600';
    dragGhost.style.borderRadius = '4px';
    dragGhost.style.border = '1px solid #38bdf8';
    dragGhost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.display = 'flex';
    dragGhost.style.alignItems = 'center';
    dragGhost.style.gap = '6px';
    dragGhost.innerHTML = `
      <span style="color: #38bdf8; font-size: 13px;">❖</span>
      <span>${payload.fieldName}</span>
      <span style="opacity: 0.65; font-size: 10px; font-weight: normal;">(${payload.connectionName} → ${payload.sheetName})</span>
    `;
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 15, 12);
    setTimeout(() => {
      if (document.body.contains(dragGhost)) {
        document.body.removeChild(dragGhost);
      }
    }, 0);
  };

  // Double click field -> automatically insert as Text object
  const handleFieldDoubleClick = (payload: DatabaseFieldBindingPayload) => {
    if (onInsertBoundElement) {
      onInsertBoundElement(payload, 15, 15, 'text');
    }
  };

  // Right click field -> Open context menu
  const handleFieldContextMenu = (e: React.MouseEvent, payload: DatabaseFieldBindingPayload) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 200),
      payload,
    });
  };

  // Helper to determine field icon and suggestion
  const getFieldMeta = (fieldName: string) => {
    const lower = fieldName.toLowerCase();
    if (lower.includes('barcode') || lower.includes('upc') || lower.includes('ean') || lower.includes('code128')) {
      return { icon: <BarcodeIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />, type: 'barcode' as const };
    }
    if (lower.includes('qr') || lower.includes('matrix') || lower.includes('2d')) {
      return { icon: <QrCode className="w-3.5 h-3.5 text-purple-600 shrink-0" />, type: 'qr' as const };
    }
    if (lower.includes('no') || lower.includes('sl') || lower.includes('qty') || lower.includes('id') || lower.includes('price')) {
      return { icon: <Hash className="w-3.5 h-3.5 text-amber-600 shrink-0" />, type: 'text' as const };
    }
    return { icon: <Type className="w-3.5 h-3.5 text-blue-600 shrink-0" />, type: 'text' as const };
  };

  // Handle manual refresh button click
  const handleRefresh = async () => {
    if (onRefreshConnection) {
      setIsRefreshing(true);
      try {
        await onRefreshConnection();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  // Horizontal Resize Handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.max(220, Math.min(500, startW + (moveEvent.clientX - startX)));
      setPanelWidth(newW);
      if (onWidthChange) onWidthChange(newW);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Close context menu on outside click
  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter elements by search query
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.trim().toLowerCase());
  };

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="bg-[#f1f5f9] border-r border-[#cbd5e1] flex flex-col h-full select-none text-xs text-slate-800 shadow-sm relative shrink-0 z-20"
    >
      {/* 1. Header Toolbar (BarTender Style) */}
      <div className="bg-[#e4ebf5] border-b border-[#cbd5e1] px-2.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[12px]">
          <Database className="w-4 h-4 text-blue-700" />
          <span>Data Sources</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh Connected Data Sources (Reloads file schema & rows)"
            className="p-1 hover:bg-[#d5e0ee] active:bg-[#c2d3e7] text-slate-600 rounded cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              title={isPinned ? 'Unpin Panel' : 'Pin Panel'}
              className="p-1 hover:bg-[#d5e0ee] active:bg-[#c2d3e7] text-slate-600 rounded cursor-pointer transition-colors"
            >
              {isPinned ? <Pin className="w-3.5 h-3.5 text-blue-700" /> : <PinOff className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Data Sources Panel (◀)"
              className="p-1 hover:bg-red-100 hover:text-red-700 text-slate-500 rounded cursor-pointer transition-colors"
            >
              <span className="font-bold text-xs leading-none">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Instant Search / Filter Box */}
      <div className="p-2 border-b border-slate-200 bg-white">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Data Sources..."
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded px-2 pl-7 py-1 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Tree Content Explorer */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 font-sans text-slate-700">
        {/* Category A: Screen Data */}
        {matchesSearch('Screen Data') && (
          <div className="rounded hover:bg-slate-200/50">
            <div
              onClick={() => toggleNode('screen_data')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.screen_data ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>Screen Data</span>
            </div>
            {expandedNodes.screen_data && (
              <div className="pl-6 pr-2 py-1 text-[11px] text-slate-500 italic">
                No interactive prompt fields defined.
              </div>
            )}
          </div>
        )}

        {/* Category B: Date */}
        {matchesSearch('Date') && (
          <div className="rounded hover:bg-slate-200/50">
            <div
              onClick={() => toggleNode('date')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.date ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Date</span>
            </div>
            {expandedNodes.date && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-[11px]">
                <div
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: 'database-field',
                      connectionId: 'system-clock',
                      connectionName: 'System Clock',
                      sheetId: 'date',
                      sheetName: 'Current Date',
                      fieldId: 'System.Date',
                      fieldName: 'System.Date',
                      sampleValue: new Date().toISOString().split('T')[0],
                      suggestedType: 'text',
                    })
                  }
                  className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded cursor-grab active:cursor-grabbing hover:border-blue-400"
                >
                  <span className="font-mono text-slate-800">YYYY-MM-DD</span>
                  <span className="font-semibold text-blue-700">{new Date().toISOString().split('T')[0]}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category C: Time */}
        {matchesSearch('Time') && (
          <div className="rounded hover:bg-slate-200/50">
            <div
              onClick={() => toggleNode('time')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.time ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Time</span>
            </div>
            {expandedNodes.time && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-[11px]">
                <div
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: 'database-field',
                      connectionId: 'system-clock',
                      connectionName: 'System Clock',
                      sheetId: 'time',
                      sheetName: 'Current Time',
                      fieldId: 'System.Time',
                      fieldName: 'System.Time',
                      sampleValue: new Date().toTimeString().split(' ')[0],
                      suggestedType: 'text',
                    })
                  }
                  className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded cursor-grab active:cursor-grabbing hover:border-blue-400"
                >
                  <span className="font-mono text-slate-800">HH:mm:ss</span>
                  <span className="font-semibold text-amber-700">{new Date().toTimeString().split(' ')[0]}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category D: Formula / Expression */}
        {matchesSearch('Formula') && (
          <div className="rounded hover:bg-slate-200/50">
            <div
              onClick={() => toggleNode('formula')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.formula ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Formula / Expression</span>
            </div>
            {expandedNodes.formula && (
              <div className="pl-6 pr-2 py-1 text-[11px] text-slate-500 italic">
                Drag fields into expressions in Object Properties.
              </div>
            )}
          </div>
        )}

        {/* Category E: Database Fields (Root Hierarchy) */}
        <div className="pt-1">
          <div
            onClick={() => toggleNode('database_fields')}
            className="flex items-center justify-between px-1.5 py-1 rounded cursor-pointer hover:bg-slate-200/60 font-semibold text-slate-900"
          >
            <div className="flex items-center gap-1.5">
              {expandedNodes.database_fields ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              )}
              <Database className="w-3.5 h-3.5 text-blue-700" />
              <span>Database Fields</span>
            </div>
            {onOpenConnectWizard && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenConnectWizard();
                }}
                title="Add New Excel / CSV Connection..."
                className="p-0.5 hover:bg-blue-100 text-blue-700 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Database Connections List */}
          {expandedNodes.database_fields && (
            <div className="pl-3 border-l-2 border-slate-300 ml-3 mt-0.5 space-y-2">
              {connectionsList.length === 0 ? (
                <div className="p-3 bg-white border border-dashed border-slate-300 rounded text-center space-y-2 my-1">
                  <FileSpreadsheet className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-[11px] text-slate-500">No Excel or Database Connected</p>
                  {onOpenConnectWizard && (
                    <button
                      onClick={onOpenConnectWizard}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold shadow-xs flex items-center justify-center gap-1 mx-auto"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Connection</span>
                    </button>
                  )}
                </div>
              ) : (
                connectionsList.map((conn) => {
                  const connKey = conn.id;
                  const isConnExpanded = expandedConnections[connKey] !== false;
                  const sheets = conn.availableSheets && conn.availableSheets.length > 0 ? conn.availableSheets : [conn.sheetName || 'Sheet1$'];

                  return (
                    <div key={conn.id} className="space-y-1">
                      {/* Connection Level Node (e.g. Product Master) */}
                      <div
                        onClick={() => toggleConn(connKey)}
                        className="flex items-center justify-between px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer text-slate-800 font-semibold"
                        title={conn.filePath ? `File: ${conn.filePath}` : conn.name}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {isConnExpanded ? (
                            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                          )}
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="truncate">{conn.name}</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0">
                          {conn.records.length} rec
                        </span>
                      </div>

                      {/* Sheet & Column Hierarchy */}
                      {isConnExpanded && (
                        <div className="pl-3 border-l border-slate-300 ml-2 space-y-1.5">
                          {sheets.map((sheet) => {
                            const sheetKey = `${conn.id}-${sheet}`;
                            const isSheetExpanded = expandedConnections[sheetKey] !== false;
                            const fields = conn.fields;

                            return (
                              <div key={sheet} className="space-y-0.5">
                                {/* Sheet Level Node (e.g. Sheet1$) */}
                                <div
                                  onClick={() => toggleConn(sheetKey)}
                                  className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-200 cursor-pointer text-slate-700 font-medium text-[11.5px]"
                                >
                                  {isSheetExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <span className="text-emerald-700 font-bold">📄</span>
                                  <span className="truncate">{sheet}</span>
                                  <span className="text-[10px] text-slate-400">({fields.length})</span>
                                </div>

                                {/* Columns List with Live Sample Values */}
                                {isSheetExpanded && (
                                  <div className="pl-4 space-y-0.5">
                                    {fields.map((col) => {
                                      if (!matchesSearch(col)) return null;
                                      const { icon, type: suggestedType } = getFieldMeta(col);

                                      // Resolve live active record value
                                      let liveVal: string = '';
                                      if (currentRecordData && currentRecordData[col] !== undefined) {
                                        liveVal = String(currentRecordData[col] ?? '');
                                      } else if (conn.records && conn.records[currentRecordIndex]) {
                                        liveVal = String(conn.records[currentRecordIndex][col] ?? '');
                                      } else if (conn.records && conn.records[0]) {
                                        liveVal = String(conn.records[0][col] ?? '');
                                      }

                                      const bindingPayload: DatabaseFieldBindingPayload = {
                                        type: 'database-field',
                                        connectionId: conn.id,
                                        connectionName: conn.name,
                                        sheetId: sheet,
                                        sheetName: sheet,
                                        fieldId: col,
                                        fieldName: col,
                                        sampleValue: liveVal,
                                        suggestedType,
                                      };

                                      return (
                                        <div
                                          key={col}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, bindingPayload)}
                                          onDoubleClick={() => handleFieldDoubleClick(bindingPayload)}
                                          onContextMenu={(e) => handleFieldContextMenu(e, bindingPayload)}
                                          className="group flex items-center justify-between px-1.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded cursor-grab active:cursor-grabbing transition-all text-slate-800 shadow-2xs"
                                          title={`Drag to canvas or double-click to add.\nField: ${col}\nConnection: ${conn.name}\nSheet: ${sheet}\nCurrent Value: ${liveVal}`}
                                        >
                                          <div className="flex items-center gap-1.5 truncate flex-1 mr-2">
                                            {icon}
                                            <span className="truncate font-medium text-[11px] group-hover:text-blue-900">
                                              {col}
                                            </span>
                                          </div>
                                          {/* Live Record Sample Value Pill */}
                                          <span
                                            className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-slate-100 text-blue-700 border border-slate-200 truncate max-w-[85px] group-hover:bg-white group-hover:border-blue-300 shrink-0 text-right"
                                            title={liveVal}
                                          >
                                            {liveVal || <span className="text-slate-300 italic">empty</span>}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Category F: Named Data Sources */}
        {matchesSearch('Named Data Sources') && (
          <div className="rounded hover:bg-slate-200/50 pt-1">
            <div
              onClick={() => toggleNode('named_sources')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.named_sources ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Named Data Sources</span>
            </div>
            {expandedNodes.named_sources && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-[11px]">
                {template.namedDataSources && template.namedDataSources.length > 0 ? (
                  template.namedDataSources.map((nds) => (
                    <div
                      key={nds.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, {
                          type: 'database-field',
                          connectionId: 'named-source',
                          connectionName: 'Named Source',
                          sheetId: 'named',
                          sheetName: 'Named',
                          fieldId: nds.name,
                          fieldName: nds.name,
                          sampleValue: nds.defaultValue,
                          suggestedType: 'text',
                        })
                      }
                      className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded cursor-grab active:cursor-grabbing hover:border-indigo-400"
                    >
                      <span className="font-semibold text-indigo-900">{nds.name}</span>
                      <span className="text-slate-500 text-[10px] truncate max-w-[80px]">
                        {nds.defaultValue || '<None>'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic">&lt;None&gt;</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Category G: System Variables */}
        {matchesSearch('System Variables') && (
          <div className="rounded hover:bg-slate-200/50">
            <div
              onClick={() => toggleNode('system_vars')}
              className="flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-slate-700 font-medium"
            >
              {expandedNodes.system_vars ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span>System Variables</span>
            </div>
            {expandedNodes.system_vars && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-[11px]">
                {[
                  { name: 'SYSTEM.DATE', desc: 'Current Date', val: new Date().toISOString().split('T')[0] },
                  { name: 'SYSTEM.TIME', desc: 'Current Time', val: new Date().toTimeString().split(' ')[0] },
                  { name: 'SYSTEM.USER', desc: 'Active Operator', val: 'Operator' },
                  { name: 'SYSTEM.PRINTER', desc: 'Target Printer', val: 'Zebra ZT411' },
                  { name: 'SYSTEM.RECORD_NUMBER', desc: 'Active Record #', val: String(currentRecordIndex + 1) },
                  { name: 'SYSTEM.TOTAL_RECORDS', desc: 'Total Records', val: String(totalRecords) },
                ].map((sysVar) => (
                  <div
                    key={sysVar.name}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, {
                        type: 'database-field',
                        connectionId: 'system-var',
                        connectionName: 'System Variable',
                        sheetId: 'sys',
                        sheetName: 'System',
                        fieldId: sysVar.name,
                        fieldName: sysVar.name,
                        sampleValue: sysVar.val,
                        suggestedType: 'text',
                      })
                    }
                    className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded cursor-grab active:cursor-grabbing hover:border-blue-400"
                    title={`Drag ${sysVar.name} to canvas`}
                  >
                    <span className="font-mono text-[10px] text-slate-800">{sysVar.name}</span>
                    <span className="text-[10px] text-blue-700 font-semibold">{sysVar.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category H: Label Object Strings Section (Requirement 20) */}
        <div className="pt-2 border-t border-slate-200">
          <div
            onClick={() => toggleNode('label_objects')}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-slate-200/60 font-semibold text-slate-900"
          >
            {expandedNodes.label_objects ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            )}
            <Layers className="w-3.5 h-3.5 text-purple-700" />
            <span>Label Object Strings</span>
            <span className="text-[10px] text-slate-400 font-normal">({template.elements.length})</span>
          </div>

          {expandedNodes.label_objects && (
            <div className="pl-3 border-l-2 border-purple-300 ml-3 mt-0.5 space-y-1">
              {template.elements.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic p-1">No canvas elements</div>
              ) : (
                template.elements.map((el) => {
                  const isSelected = selectedElementIds.includes(el.id);
                  const resolvedText = evaluateElementData(el, { record: currentRecordData });

                  return (
                    <div
                      key={el.id}
                      onClick={() => onSelectElement && onSelectElement(el.id)}
                      className={`flex items-center justify-between px-2 py-1 rounded border cursor-pointer transition-colors text-[11px] ${
                        isSelected
                          ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                      title={`Click to focus and select ${el.name} on canvas`}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                        {el.type === 'barcode' ? (
                          <BarcodeIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Type className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className="truncate">{el.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 rounded truncate max-w-[80px]">
                        {resolvedText}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Context Menu on Right Click */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-44 bg-white border border-slate-300 rounded-md shadow-xl py-1 text-xs text-slate-800 divide-y divide-slate-100 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 font-semibold text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
            {contextMenu.payload.fieldName}
          </div>
          <div className="py-0.5">
            <button
              onClick={() => {
                if (onInsertBoundElement) onInsertBoundElement(contextMenu.payload, 15, 15, 'text');
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
            >
              <Type className="w-3.5 h-3.5 text-blue-600" />
              <span>Add as Text</span>
            </button>
            <button
              onClick={() => {
                if (onInsertBoundElement) onInsertBoundElement(contextMenu.payload, 15, 25, 'barcode');
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer"
            >
              <BarcodeIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add as Barcode</span>
            </button>
            <button
              onClick={() => {
                if (onInsertBoundElement) onInsertBoundElement(contextMenu.payload, 15, 30, 'qr');
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-purple-600" />
              <span>Add as QR Code</span>
            </button>
          </div>
          <div className="py-0.5">
            <button
              onClick={() => {
                const conn = connectionsList.find((c) => c.id === contextMenu.payload.connectionId);
                const allVals = (conn?.records || []).slice(0, 10).map((r) => String(r[contextMenu.payload.fieldName] ?? ''));
                setPreviewField({
                  name: contextMenu.payload.fieldName,
                  connectionName: contextMenu.payload.connectionName,
                  sheetName: contextMenu.payload.sheetName,
                  value: contextMenu.payload.sampleValue || '',
                  allSampleValues: allVals,
                });
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>View Sample Data</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Sample Data Preview Modal */}
      {previewField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl w-96 max-h-[80vh] flex flex-col overflow-hidden text-xs">
            <div className="bg-[#e4ebf5] border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                <span>Field Preview: {previewField.name}</span>
              </div>
              <button
                onClick={() => setPreviewField(null)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 font-sans">
                <div className="text-[11px] text-slate-500">
                  Connection: <span className="font-semibold text-slate-800">{previewField.connectionName}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Sheet: <span className="font-semibold text-slate-800">{previewField.sheetName}</span>
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">First 10 Sample Rows:</div>
                <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-y-auto font-mono text-[11px]">
                  {previewField.allSampleValues.map((val, idx) => (
                    <div key={idx} className="px-2.5 py-1 flex items-center justify-between hover:bg-slate-50">
                      <span className="text-slate-400 text-[10px]">Row {idx + 1}</span>
                      <span className="font-bold text-blue-700">{val || '<empty>'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex justify-end">
              <button
                onClick={() => setPreviewField(null)}
                className="px-4 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-medium text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Resizable Horizontal Border Drag Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag horizontally to resize Data Sources panel"
        className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/40 transition-colors z-30"
      />
    </div>
  );
};
