import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LabelTemplate, LabelElement, VersionDiffResult } from '../../types';
import { UnifiedLabelCanvas } from '../canvas/UnifiedLabelCanvas';
import { compareTemplateSnapshots } from '../../services/snapshotService';
import {
  Columns,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  Sliders,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: LabelTemplate;
  versionList: { version: string; template: LabelTemplate; timestamp: string; author: string }[];
  onRollback?: (targetTemplate: LabelTemplate) => void;
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  versionList = [],
  onRollback,
}) => {
  // Ensure we have at least 2 versions to compare
  const availableVersions = versionList.length > 0 ? versionList : [
    {
      version: currentTemplate.version,
      template: currentTemplate,
      timestamp: currentTemplate.updatedAt,
      author: currentTemplate.createdBy || 'Designer',
    },
    {
      version: '1.0',
      template: {
        ...currentTemplate,
        version: '1.0',
        elements: currentTemplate.elements.slice(0, Math.max(1, currentTemplate.elements.length - 1)),
      },
      timestamp: currentTemplate.createdAt,
      author: 'Initial Author',
    }
  ];

  const [versionAId, setVersionAId] = useState<string>(availableVersions[0]?.version || currentTemplate.version);
  const [versionBId, setVersionBId] = useState<string>(
    availableVersions[1]?.version || availableVersions[0]?.version || '1.0'
  );
  const [zoom, setZoom] = useState<number>(0.85);
  const [activeTab, setActiveTab] = useState<'visual' | 'properties'>('visual');

  const templateA = availableVersions.find((v) => v.version === versionAId)?.template || currentTemplate;
  const templateB = availableVersions.find((v) => v.version === versionBId)?.template || currentTemplate;

  const diffResult: VersionDiffResult = compareTemplateSnapshots(templateA, templateB);

  const diffMapA = {
    removed: diffResult.removedElements.map((el) => el.id),
    modified: diffResult.modifiedElements.map((el) => el.id),
  };

  const diffMapB = {
    added: diffResult.addedElements.map((el) => el.id),
    modified: diffResult.modifiedElements.map((el) => el.id),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enterprise Template Version Comparison & Visual Diff"
      subtitle={`Comparing Version ${versionAId} vs Version ${versionBId}`}
      maxWidth="6xl"
    >
      <div className="space-y-4 text-xs text-slate-700">
        {/* Header Controls & Version Selectors */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3">
            {/* Version A Selector */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Baseline (Version A)</span>
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({new Date(v.timestamp).toLocaleDateString()}) - {v.author}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-slate-400 mt-4">
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* Version B Selector */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Comparison (Version B)</span>
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({new Date(v.timestamp).toLocaleDateString()}) - {v.author}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode & Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-200 p-0.5 rounded-lg flex items-center">
              <button
                onClick={() => setActiveTab('visual')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'visual' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Visual Diff
              </button>
              <button
                onClick={() => setActiveTab('properties')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'properties' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Property Inspector ({diffResult.modifiedElements.length + diffResult.addedElements.length + diffResult.removedElements.length})
              </button>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] w-10 text-center font-bold">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-2 py-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs border-2 border-emerald-500 bg-emerald-100" />
            <span>Added in v{versionBId} ({diffResult.addedElements.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs border-2 border-amber-500 bg-amber-100" />
            <span>Modified Properties ({diffResult.modifiedElements.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs border-2 border-red-500 bg-red-100" />
            <span>Removed in v{versionBId} ({diffResult.removedElements.length})</span>
          </div>
          {diffResult.dimensionChanged && (
            <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Canvas Dimensions Changed
            </span>
          )}
        </div>

        {/* Tab 1: Visual Side-by-Side Comparison */}
        {activeTab === 'visual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/5 p-4 rounded-xl border border-slate-200 min-h-[420px] max-h-[500px] overflow-auto">
            {/* Version A Box */}
            <div className="flex flex-col items-center bg-slate-100/50 p-4 rounded-xl border border-slate-200">
              <div className="font-bold text-xs text-slate-700 mb-2 flex items-center gap-2">
                <span>Version {versionAId} (Baseline)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {templateA.dimensions.width}×{templateA.dimensions.height}mm
                </span>
              </div>
              <div className="overflow-hidden flex items-center justify-center p-2">
                <UnifiedLabelCanvas
                  template={templateA}
                  mode="approval"
                  zoom={zoom}
                  diffMap={diffMapA}
                  showGrid={false}
                  showMargins={true}
                />
              </div>
            </div>

            {/* Version B Box */}
            <div className="flex flex-col items-center bg-slate-100/50 p-4 rounded-xl border border-slate-200">
              <div className="font-bold text-xs text-slate-700 mb-2 flex items-center gap-2">
                <span>Version {versionBId} (Comparison)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {templateB.dimensions.width}×{templateB.dimensions.height}mm
                </span>
              </div>
              <div className="overflow-hidden flex items-center justify-center p-2">
                <UnifiedLabelCanvas
                  template={templateB}
                  mode="approval"
                  zoom={zoom}
                  diffMap={diffMapB}
                  showGrid={false}
                  showMargins={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Granular Property Changes List */}
        {activeTab === 'properties' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-[450px] overflow-y-auto space-y-3">
            {!diffResult.hasChanges ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="font-bold text-slate-800">No Differences Detected</div>
                <div className="text-xs text-slate-400">Version {versionAId} and Version {versionBId} are identical.</div>
              </div>
            ) : (
              <>
                {/* Added Elements */}
                {diffResult.addedElements.length > 0 && (
                  <div>
                    <h4 className="font-bold text-xs text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Added Elements ({diffResult.addedElements.length})</span>
                    </h4>
                    <div className="divide-y divide-slate-100 border border-emerald-200 bg-emerald-50/30 rounded-lg">
                      {diffResult.addedElements.map((el) => (
                        <div key={el.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-800">{el.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono uppercase">[{el.type}]</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Pos: ({el.x}, {el.y}) mm | Size: {el.width}×{el.height} mm
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modified Elements */}
                {diffResult.modifiedElements.length > 0 && (
                  <div>
                    <h4 className="font-bold text-xs text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Modified Object Properties ({diffResult.modifiedElements.length})</span>
                    </h4>
                    <div className="space-y-2">
                      {diffResult.modifiedElements.map((mod) => (
                        <div key={mod.id} className="border border-amber-200 bg-amber-50/20 rounded-lg p-3">
                          <div className="font-bold text-xs text-slate-900 mb-1.5">
                            {mod.name} <span className="font-mono text-[10px] text-slate-400 uppercase">[{mod.type}]</span>
                          </div>
                          <div className="space-y-1">
                            {mod.changes.map((ch, idx) => (
                              <div key={idx} className="flex items-center text-xs bg-white p-1.5 rounded border border-slate-200">
                                <span className="font-mono font-bold text-slate-700 w-28 shrink-0">{ch.property}:</span>
                                <span className="text-red-600 line-through mr-2 font-mono">{String(ch.oldValue)}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 mr-2 shrink-0" />
                                <span className="text-emerald-700 font-bold font-mono">{String(ch.newValue)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Elements */}
                {diffResult.removedElements.length > 0 && (
                  <div>
                    <h4 className="font-bold text-xs text-red-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Removed Elements ({diffResult.removedElements.length})</span>
                    </h4>
                    <div className="divide-y divide-slate-100 border border-red-200 bg-red-50/30 rounded-lg">
                      {diffResult.removedElements.map((el) => (
                        <div key={el.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-800 line-through">{el.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono uppercase">[{el.type}]</span>
                          </div>
                          <div className="text-[10px] text-red-600 font-semibold">Deleted in v{versionBId}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-[11px] text-slate-500">
            {diffResult.hasChanges ? 'Differences identified between revisions.' : 'Versions are identical.'}
          </div>
          <div className="flex items-center gap-2">
            {onRollback && versionAId !== currentTemplate.version && (
              <button
                onClick={() => {
                  onRollback(templateA);
                  onClose();
                }}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore v{versionAId} to Designer</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
