import React from 'react';
import { PropertyTreeNode, PropertyScope } from '../../services/propertyTreeService';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface PropertyTreeProps {
  treeNodes: PropertyTreeNode[];
  selectedNodeId: string;
  onSelectNode: (node: PropertyTreeNode) => void;
  scope: PropertyScope;
  onChangeScope: (scope: PropertyScope) => void;
  expandedNodeIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
}

export const PropertyTree: React.FC<PropertyTreeProps> = ({
  treeNodes,
  selectedNodeId,
  onSelectNode,
  scope,
  onChangeScope,
  expandedNodeIds,
  onToggleExpand,
}) => {
  // Render icon for object or section
  const renderIcon = (node: PropertyTreeNode, isSelected: boolean) => {
    if (node.nodeType === 'object') {
      if (node.objectType === 'barcode') {
        return (
          <div className="flex flex-col items-center justify-center shrink-0 w-3.5 h-3.5">
            <svg width="14" height="6" viewBox="0 0 14 6" className="overflow-visible">
              <rect x="0" y="0" width="1" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
              <rect x="2" y="0" width="1.5" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
              <rect x="4.5" y="0" width="1" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
              <rect x="6.5" y="0" width="2" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
              <rect x="9.5" y="0" width="1" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
              <rect x="11.5" y="0" width="1.5" height="6" fill={isSelected ? '#ffffff' : '#0f172a'} />
            </svg>
            <span className={`text-[6px] font-mono tracking-tighter leading-none -mt-0.5 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
              123
            </span>
          </div>
        );
      }
      if (node.objectType === 'text') {
        return (
          <span className={`font-bold text-[13px] leading-none font-serif shrink-0 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
            A
          </span>
        );
      }
      if (node.objectType === 'rectangle' || node.objectType === 'shape') {
        return (
          <div className={`w-3.5 h-3 border rounded-[1px] shrink-0 ${isSelected ? 'border-white bg-blue-300/30' : 'border-slate-800 bg-slate-100'}`} />
        );
      }
      if (node.objectType === 'ellipse') {
        return (
          <div className={`w-3.5 h-3 border rounded-full shrink-0 ${isSelected ? 'border-white bg-blue-300/30' : 'border-slate-800 bg-slate-100'}`} />
        );
      }
      if (node.objectType === 'line') {
        return (
          <div className={`w-3.5 h-[1.5px] shrink-0 ${isSelected ? 'bg-white' : 'bg-slate-800'}`} />
        );
      }
      if (node.objectType === 'image') {
        return (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <rect x="2" y="2" width="12" height="12" rx="1" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1.2" />
            <circle cx="5.5" cy="5.5" r="1.5" fill={isSelected ? '#ffffff' : '#3b82f6'} />
            <path d="M3 13 L7 8 L10 11 L13 7 L14 13 Z" fill={isSelected ? '#ffffff' : '#94a3b8'} />
          </svg>
        );
      }
      return <span className="text-[11px]">📁</span>;
    }

    if (node.nodeType === 'section') {
      switch (node.sectionId) {
        case 'symbology':
          return (
            <svg width="14" height="12" viewBox="0 0 14 12" className="shrink-0">
              <rect x="0" y="1" width="1.2" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
              <rect x="2.2" y="1" width="1.2" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
              <rect x="4.4" y="1" width="2" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
              <rect x="7.4" y="1" width="1" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
              <rect x="9.4" y="1" width="2.2" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
              <rect x="12.4" y="1" width="1.2" height="10" fill={isSelected ? '#ffffff' : '#000000'} />
            </svg>
          );
        case 'humanReadable':
          return (
            <span className={`text-[9px] font-mono tracking-tighter shrink-0 ${isSelected ? 'text-white font-bold' : 'text-slate-700'}`}>
              123
            </span>
          );
        case 'font':
          return (
            <div className="flex items-center shrink-0">
              <span className={`text-[11px] font-serif font-bold ${isSelected ? 'text-white' : 'text-fuchsia-600'}`}>A</span>
              <span className={`text-[7.5px] font-serif font-bold -ml-0.5 -mt-1 ${isSelected ? 'text-white' : 'text-blue-600'}`}>a</span>
            </div>
          );
        case 'textFormat':
          return (
            <svg width="14" height="12" viewBox="0 0 14 12" className="shrink-0">
              <rect x="1" y="1" width="12" height="10" rx="1" fill="none" stroke={isSelected ? '#ffffff' : '#475569'} strokeWidth="1" />
              <line x1="3" y1="4" x2="11" y2="4" stroke={isSelected ? '#ffffff' : '#3b82f6'} strokeWidth="1" />
              <line x1="3" y1="6.5" x2="9" y2="6.5" stroke={isSelected ? '#ffffff' : '#94a3b8'} strokeWidth="1" />
              <line x1="3" y1="9" x2="11" y2="9" stroke={isSelected ? '#ffffff' : '#94a3b8'} strokeWidth="1" />
            </svg>
          );
        case 'border':
          return (
            <div className={`w-3.5 h-3.5 border shrink-0 ${isSelected ? 'border-white' : 'border-slate-800'}`} />
          );
        case 'position':
          return (
            <svg width="14" height="13" viewBox="0 0 15 14" className="shrink-0">
              <path d="M2 1 V12 H13" fill="none" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1.3" />
              <line x1="2" y1="3.5" x2="4.5" y2="3.5" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1" />
              <line x1="2" y1="6.5" x2="4" y2="6.5" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="0.8" />
              <line x1="2" y1="9.5" x2="4.5" y2="9.5" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1" />
              <line x1="4.5" y1="12" x2="4.5" y2="9.5" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1" />
              <line x1="7.5" y1="12" x2="7.5" y2="10" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="0.8" />
              <line x1="10.5" y1="12" x2="10.5" y2="9.5" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1" />
            </svg>
          );
        case 'fill':
          return (
            <div className={`w-3.5 h-3.5 border rounded-[1px] shrink-0 ${isSelected ? 'border-white bg-white/40' : 'border-slate-800 bg-amber-400'}`} />
          );
        case 'line':
          return (
            <div className={`w-3.5 h-[2px] shrink-0 ${isSelected ? 'bg-white' : 'bg-slate-800'}`} />
          );
        case 'image':
          return (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <rect x="2" y="2" width="12" height="12" rx="1" stroke={isSelected ? '#ffffff' : '#334155'} strokeWidth="1.2" />
              <circle cx="5.5" cy="5.5" r="1.5" fill={isSelected ? '#ffffff' : '#3b82f6'} />
              <path d="M3 13 L7 8 L10 11 L13 7 L14 13 Z" fill={isSelected ? '#ffffff' : '#94a3b8'} />
            </svg>
          );
        case 'dataSources':
          return (
            <div
              className={`flex items-center justify-center px-1 py-0.2 rounded-xs text-[8px] font-mono font-bold leading-tight shadow-2xs shrink-0 ${
                isSelected ? 'bg-white text-[#0078d7]' : 'bg-[#475569] text-white'
              }`}
            >
              ab
            </div>
          );
        default:
          return <span className="text-[10px]">⚙️</span>;
      }
    }

    if (node.nodeType === 'dataSource') {
      return (
        <div className="w-4 h-3.5 bg-[#004b98] text-white flex flex-col items-center justify-center rounded-[1px] shadow-2xs shrink-0">
          <svg width="10" height="4" viewBox="0 0 10 4">
            <rect x="0" y="0" width="1" height="4" fill="white" />
            <rect x="2" y="0" width="1.5" height="4" fill="white" />
            <rect x="4.5" y="0" width="1" height="4" fill="white" />
            <rect x="6.5" y="0" width="1" height="4" fill="white" />
            <rect x="8.5" y="0" width="1.5" height="4" fill="white" />
          </svg>
          <span className="text-[5.5px] font-bold font-mono tracking-tighter leading-none text-blue-100 -mt-0.2">
            BT
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Scope Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-[#f1f5f9] border-b border-[#cbd5e1]">
        {/* Button 1: Selected Object */}
        <button
          type="button"
          title="Selected Object"
          onClick={() => onChangeScope('selected')}
          className={`p-1 rounded-[2px] border transition-colors cursor-pointer ${
            scope === 'selected'
              ? 'bg-[#cce8ff] border-[#99d1ff] text-[#004b98]'
              : 'bg-white border-[#cbd5e1] hover:bg-slate-100 text-slate-700'
          }`}
        >
          {/* Selected Object Icon (Bounding box with resize handles) */}
          <svg width="15" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="3" width="10" height="10" stroke="#004b98" strokeWidth="1.2" strokeDasharray="2,1" />
            <rect x="1.5" y="1.5" width="3" height="3" fill="#0078d7" stroke="#004b98" strokeWidth="0.8" />
            <rect x="11.5" y="1.5" width="3" height="3" fill="#0078d7" stroke="#004b98" strokeWidth="0.8" />
            <rect x="1.5" y="11.5" width="3" height="3" fill="#0078d7" stroke="#004b98" strokeWidth="0.8" />
            <rect x="11.5" y="11.5" width="3" height="3" fill="#0078d7" stroke="#004b98" strokeWidth="0.8" />
            <circle cx="8" cy="8" r="1.5" fill="#10b981" />
          </svg>
        </button>

        {/* Button 2: All Objects */}
        <button
          type="button"
          title="All Objects"
          onClick={() => onChangeScope('all')}
          className={`p-1 rounded-[2px] border transition-colors cursor-pointer ${
            scope === 'all'
              ? 'bg-[#cce8ff] border-[#99d1ff] text-[#004b98]'
              : 'bg-white border-[#cbd5e1] hover:bg-slate-100 text-slate-700'
          }`}
        >
          {/* All Objects Icon (Overlapping cards / multi-object) */}
          <svg width="15" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="9" height="9" rx="1" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.2" />
            <rect x="5" y="5" width="9" height="9" rx="1" fill="#60a5fa" stroke="#1e40af" strokeWidth="1.2" />
          </svg>
        </button>
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 bg-white text-[12px]">
        {treeNodes.length === 0 ? (
          <div className="p-3 text-[11px] text-slate-500 italic text-center">
            No objects in this document.
          </div>
        ) : (
          <div className="space-y-0.5">
            {treeNodes.map((objNode, objIdx) => {
              const isObjExpanded = expandedNodeIds.has(objNode.id);
              const isObjSelected = selectedNodeId === objNode.id;

              return (
                <div key={objNode.id} className="flex flex-col">
                  {/* Object Root Row */}
                  <div
                    onClick={() => onSelectNode(objNode)}
                    className={`flex items-center h-[24px] cursor-pointer px-1 rounded-[1px] transition-colors group ${
                      isObjSelected
                        ? 'bg-[#0078d7] text-white'
                        : 'text-slate-900 hover:bg-[#e5f3ff] hover:text-[#0078d7]'
                    }`}
                  >
                    {/* Disclosure Arrow */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(objNode.id);
                      }}
                      className="w-4 h-4 flex items-center justify-center mr-0.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      {isObjExpanded ? (
                        <ChevronDown className={`w-3 h-3 ${isObjSelected ? 'text-white' : 'text-slate-600'}`} />
                      ) : (
                        <ChevronRight className={`w-3 h-3 ${isObjSelected ? 'text-white' : 'text-slate-600'}`} />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 truncate">
                      {renderIcon(objNode, isObjSelected)}
                      <span className="font-bold text-[12px] truncate">{objNode.label}</span>
                    </div>
                  </div>

                  {/* Object Children (Capability Sections) */}
                  {isObjExpanded && objNode.children && (
                    <div className="flex flex-col">
                      {objNode.children.map((secNode, secIdx, secArr) => {
                        const isSecSelected = selectedNodeId === secNode.id;
                        const isLastSection = secIdx === secArr.length - 1 && (!secNode.children || secNode.children.length === 0);
                        const isSecExpanded = expandedNodeIds.has(secNode.id);

                        return (
                          <div key={secNode.id} className="flex flex-col">
                            {/* Section Row */}
                            <div
                              onClick={() => onSelectNode(secNode)}
                              className="flex items-center h-[22px] cursor-pointer select-none group"
                            >
                              {/* Dotted connector */}
                              <svg width="22" height="22" className="shrink-0 overflow-visible">
                                <line
                                  x1="8"
                                  y1="0"
                                  x2="8"
                                  y2={isLastSection ? 11 : 22}
                                  stroke="#6b7280"
                                  strokeWidth="1"
                                  strokeDasharray="1,1"
                                  shapeRendering="crispEdges"
                                />
                                <line
                                  x1="8"
                                  y1="11"
                                  x2="22"
                                  y2="11"
                                  stroke="#6b7280"
                                  strokeWidth="1"
                                  strokeDasharray="1,1"
                                  shapeRendering="crispEdges"
                                />
                              </svg>

                              <div
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-[1px] w-full mr-1 transition-colors ${
                                  isSecSelected
                                    ? 'bg-[#0078d7] text-white font-normal'
                                    : 'text-slate-900 hover:bg-[#e5f3ff] hover:text-[#0078d7]'
                                }`}
                              >
                                {renderIcon(secNode, isSecSelected)}
                                <span className="truncate text-[11.5px]">{secNode.label}</span>
                              </div>
                            </div>

                            {/* Section Children (e.g. Data Sources List) */}
                            {isSecExpanded && secNode.children && secNode.children.length > 0 && (
                              <div className="flex flex-col">
                                {secNode.children.map((dsNode, dsIdx, dsArr) => {
                                  const isDsSelected = selectedNodeId === dsNode.id;
                                  const isLastDs = dsIdx === dsArr.length - 1;

                                  return (
                                    <div
                                      key={dsNode.id}
                                      onClick={() => onSelectNode(dsNode)}
                                      className="flex items-center h-[22px] cursor-pointer select-none group"
                                    >
                                      {/* Indented Dotted connector */}
                                      <svg width="38" height="22" className="shrink-0 overflow-visible">
                                        <line
                                          x1="26"
                                          y1="0"
                                          x2="26"
                                          y2={isLastDs ? 11 : 22}
                                          stroke="#6b7280"
                                          strokeWidth="1"
                                          strokeDasharray="1,1"
                                          shapeRendering="crispEdges"
                                        />
                                        <line
                                          x1="26"
                                          y1="11"
                                          x2="38"
                                          y2="11"
                                          stroke="#6b7280"
                                          strokeWidth="1"
                                          strokeDasharray="1,1"
                                          shapeRendering="crispEdges"
                                        />
                                      </svg>

                                      <div
                                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-[1px] w-full mr-1 transition-colors ${
                                          isDsSelected
                                            ? 'bg-[#0078d7] text-white font-normal'
                                            : 'text-slate-900 hover:bg-[#e5f3ff] hover:text-[#0078d7]'
                                        }`}
                                      >
                                        {renderIcon(dsNode, isDsSelected)}
                                        <span className="truncate font-mono text-[11px]">{dsNode.label}</span>
                                      </div>
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
