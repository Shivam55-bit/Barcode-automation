import React, { useState, useEffect, useMemo } from 'react';
import { TextElement, DataSourceItem, DataSourceFontOverride } from '../../types';
import { getEffectiveSourceFont } from '../../services/dataSourceEngine';
import { getDataSourceDisplayPreview } from '../../services/controlCharacterService';
import { X, RotateCcw, Check, Sparkles } from 'lucide-react';

interface DataSourceFontsModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: TextElement;
  onUpdateElement: (updates: Partial<TextElement>) => void;
  systemFonts?: string[];
}

const COMMON_FONTS = [
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Arial Rounded MT Bold',
  'Bahnschrift',
  'Bahnschrift Condensed',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Franklin Gothic Medium',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Microsoft Sans Serif',
  'Palatino Linotype',
  'Segoe UI',
  'Segoe UI Semibold',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

const PRESET_FONT_SIZES = [6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

export const DataSourceFontsModal: React.FC<DataSourceFontsModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  systemFonts = [],
}) => {
  const [activeDsIndex, setActiveDsIndex] = useState<number>(0);
  const [fontSubTab, setFontSubTab] = useState<'style' | 'outline' | 'width' | 'advanced'>('style');
  const [fontSearch, setFontSearch] = useState<string>('');

  const dataSources = useMemo(() => {
    if (element.dataSources && element.dataSources.length > 0) {
      return element.dataSources;
    }
    return [
      {
        id: `ds-${element.id || 'default'}`,
        name: 'Sample Text',
        type: 'embedded' as const,
        value: element.text || 'Sample Text',
        enabled: true,
      },
    ];
  }, [element.dataSources, element.id, element.text]);

  // Keep activeDsIndex in bounds
  useEffect(() => {
    if (activeDsIndex >= dataSources.length) {
      setActiveDsIndex(Math.max(0, dataSources.length - 1));
    }
  }, [dataSources.length, activeDsIndex]);

  const activeSource: DataSourceItem = dataSources[activeDsIndex] || dataSources[0];

  // Font list combining system fonts with common fonts
  const allAvailableFonts = useMemo(() => {
    const set = new Set<string>([...COMMON_FONTS, ...systemFonts]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [systemFonts]);

  const filteredFonts = useMemo(() => {
    if (!fontSearch.trim()) return allAvailableFonts;
    const q = fontSearch.toLowerCase();
    return allAvailableFonts.filter((f) => f.toLowerCase().includes(q));
  }, [allAvailableFonts, fontSearch]);

  if (!isOpen) return null;

  const isOverrideActive = !!(activeSource.fontOverrideEnabled && (activeSource.fontStyleOverride || activeSource.fontOverride));
  const effectiveFont = getEffectiveSourceFont(activeSource, element);

  // Helper to update active source font properties
  const updateActiveSourceFont = (fontUpdates: Partial<DataSourceFontOverride>, enableOverride: boolean = true) => {
    const currentOverride: DataSourceFontOverride = activeSource.fontStyleOverride || activeSource.fontOverride || {};
    const nextOverride: DataSourceFontOverride = {
      ...currentOverride,
      ...fontUpdates,
    };

    const updatedDataSources = dataSources.map((ds, idx) => {
      if (idx !== activeDsIndex) return ds;
      return {
        ...ds,
        fontOverrideEnabled: enableOverride,
        fontStyleOverride: nextOverride,
        fontOverride: nextOverride, // Backward-compat alias
      };
    });

    onUpdateElement({ dataSources: updatedDataSources });
  };

  const handleToggleOverride = (enable: boolean) => {
    if (enable) {
      updateActiveSourceFont({}, true);
    } else {
      // Disable override for this source
      const updatedDataSources = dataSources.map((ds, idx) => {
        if (idx !== activeDsIndex) return ds;
        const copy = { ...ds };
        delete copy.fontOverrideEnabled;
        delete copy.fontStyleOverride;
        delete copy.fontOverride;
        return copy;
      });
      onUpdateElement({ dataSources: updatedDataSources });
    }
  };

  const handleResetSelected = () => {
    handleToggleOverride(false);
  };

  const handleResetAll = () => {
    const updatedDataSources = dataSources.map((ds) => {
      const copy = { ...ds };
      delete copy.fontOverrideEnabled;
      delete copy.fontStyleOverride;
      delete copy.fontOverride;
      return copy;
    });
    onUpdateElement({ dataSources: updatedDataSources });
  };

  const currentWeight = effectiveFont.fontWeight || 'normal';
  const currentStyle = effectiveFont.fontStyle || 'normal';
  const currentStyleId =
    currentWeight === 'bold' && currentStyle === 'italic'
      ? 'bold-italic'
      : currentWeight === 'bold'
      ? 'bold'
      : currentStyle === 'italic'
      ? 'italic'
      : 'regular';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-[820px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Data Source Fonts — [{element.name || 'Text Object'}]
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="w-8 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs ml-1 shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 min-h-[440px] max-h-[500px] bg-white">
          {/* LEFT PANEL: Data Sources Tree */}
          <div className="w-64 bg-[#f8fafc] border-r border-[#cbd5e1] flex flex-col justify-between select-none">
            <div className="p-2 border-b border-[#cbd5e1] bg-[#f1f5f9] flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-[11.5px]">Data Sources</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {dataSources.length} source{dataSources.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-2 space-y-1 text-[11.5px] overflow-y-auto flex-1">
              {dataSources.map((ds, idx) => {
                const isSelected = activeDsIndex === idx;
                const isOverridden = !!(ds.fontOverrideEnabled && (ds.fontStyleOverride || ds.fontOverride));
                const previewLabel = getDataSourceDisplayPreview(ds) || ds.name || `Source ${idx + 1}`;
                const isControl = ds.type === 'control-character';

                return (
                  <div
                    key={ds.id || `ds-${idx}`}
                    onClick={() => setActiveDsIndex(idx)}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#0078d7] text-white font-medium shadow-xs'
                        : 'text-slate-800 hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isControl ? (
                        <span
                          className={`text-[10px] font-mono px-1 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          CTRL
                        </span>
                      ) : (
                        <span
                          className={`w-3.5 h-3.5 flex items-center justify-center text-[10px] rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 font-bold'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      )}
                      <span className="truncate">{previewLabel}</span>
                    </div>

                    {isOverridden && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase font-bold shrink-0 ${
                          isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
                        }`}
                        title="Font is overridden for this data source"
                      >
                        Override
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Left Footer: Reset All */}
            <div className="p-2 border-t border-[#cbd5e1] bg-[#eef2f6] flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetAll}
                title="Reset all sources to inherit the Text Object font"
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All to Default</span>
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Font Settings */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-white p-4">
            {/* Override Toggle Banner */}
            <div className="mb-3 p-2 rounded border bg-[#f8fafc] border-[#cbd5e1] flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOverrideActive}
                  onChange={(e) => handleToggleOverride(e.target.checked)}
                  className="w-4 h-4 accent-[#0078d7] cursor-pointer"
                />
                <span className="font-medium text-slate-900 text-[12px]">
                  Override default font for this data source
                </span>
              </label>

              {isOverrideActive ? (
                <button
                  type="button"
                  onClick={handleResetSelected}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Use Object Default</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  (Currently inheriting Text Object default font)
                </span>
              )}
            </div>

            {/* Main Font Configuration Grid */}
            <div className={`space-y-4 ${!isOverrideActive ? 'opacity-65' : ''}`}>
              <div className="grid grid-cols-12 gap-3">
                {/* Typeface Search & List */}
                <div className="col-span-6 space-y-1.5">
                  <label className="text-[11.5px] text-slate-700 font-medium">Typeface:</label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled={!isOverrideActive}
                      value={fontSearch || effectiveFont.fontFamily}
                      onChange={(e) => setFontSearch(e.target.value)}
                      placeholder="Search font..."
                      className="w-full border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] focus:outline-[#0078d7] disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="h-32 border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                    {filteredFonts.map((f) => (
                      <div
                        key={f}
                        onClick={() => {
                          if (!isOverrideActive) handleToggleOverride(true);
                          updateActiveSourceFont({ fontFamily: f }, true);
                          setFontSearch('');
                        }}
                        className={`px-2 py-1 text-[11.5px] rounded-xs cursor-pointer truncate ${
                          effectiveFont.fontFamily === f
                            ? 'bg-[#ffe8a1] text-slate-900 font-semibold'
                            : 'hover:bg-slate-100 text-slate-800'
                        }`}
                        style={{ fontFamily: f }}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font Style */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[11.5px] text-slate-700 font-medium">Font Style:</label>
                  <div className="h-[162px] border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                    {[
                      { id: 'regular', label: 'Regular', weight: 'normal', style: 'normal' },
                      { id: 'italic', label: 'Italic', weight: 'normal', style: 'italic' },
                      { id: 'bold', label: 'Bold', weight: 'bold', style: 'normal' },
                      { id: 'bold-italic', label: 'Bold Italic', weight: 'bold', style: 'italic' },
                    ].map((st) => {
                      const isCurrent = currentStyleId === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont(
                              {
                                fontWeight: st.weight as any,
                                fontStyle: st.style as any,
                              },
                              true
                            );
                          }}
                          className={`px-2 py-1 text-[11.5px] rounded-xs cursor-pointer ${
                            isCurrent
                              ? 'bg-[#0078d7] text-white font-medium'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          {st.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Point Size */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[11.5px] text-slate-700 font-medium">Point Size:</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    disabled={!isOverrideActive}
                    value={effectiveFont.fontSize || 12}
                    onChange={(e) => {
                      const sz = Math.max(1, parseFloat(e.target.value) || 12);
                      if (!isOverrideActive) handleToggleOverride(true);
                      updateActiveSourceFont({ fontSize: sz }, true);
                    }}
                    className="w-full border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <div className="h-[126px] border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                    {PRESET_FONT_SIZES.map((sz) => (
                      <div
                        key={sz}
                        onClick={() => {
                          if (!isOverrideActive) handleToggleOverride(true);
                          updateActiveSourceFont({ fontSize: sz }, true);
                        }}
                        className={`px-2 py-0.8 text-[11.5px] rounded-xs cursor-pointer ${
                          effectiveFont.fontSize === sz
                            ? 'bg-[#0078d7] text-white font-medium'
                            : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        {sz}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Font Sub-Tabs: Style | Outline | Width | Advanced */}
              <div className="border border-[#cbd5e1] rounded p-3 bg-[#f8fafc] space-y-3">
                <div className="flex border-b border-[#cbd5e1] pb-1.5 gap-4 text-[11.5px]">
                  {(['style', 'outline', 'width', 'advanced'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFontSubTab(st)}
                      className={`capitalize font-medium pb-0.5 cursor-pointer ${
                        fontSubTab === st
                          ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {fontSubTab === 'style' && (
                  <div className="grid grid-cols-2 gap-4 text-[11.5px]">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isOverrideActive}
                          checked={!!effectiveFont.underline}
                          onChange={(e) => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont({ underline: e.target.checked }, true);
                          }}
                          className="accent-[#0078d7] disabled:cursor-not-allowed"
                        />
                        <span>Underline</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isOverrideActive}
                          checked={!!effectiveFont.strikeout}
                          onChange={(e) => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont({ strikeout: e.target.checked }, true);
                          }}
                          className="accent-[#0078d7] disabled:cursor-not-allowed"
                        />
                        <span>Strikeout</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isOverrideActive}
                          checked={!!effectiveFont.whiteOnBlack}
                          onChange={(e) => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont(
                              {
                                whiteOnBlack: e.target.checked,
                                color: e.target.checked ? '#ffffff' : '#000000',
                                backgroundColor: e.target.checked ? '#000000' : 'transparent',
                              },
                              true
                            );
                          }}
                          className="accent-[#0078d7] disabled:cursor-not-allowed"
                        />
                        <span>White On Black</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Foreground Color:</span>
                        <input
                          type="color"
                          disabled={!isOverrideActive}
                          value={effectiveFont.color || '#000000'}
                          onChange={(e) => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont({ color: e.target.value }, true);
                          }}
                          className="w-10 h-6 border border-slate-300 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Background Color:</span>
                        <input
                          type="color"
                          disabled={!isOverrideActive}
                          value={effectiveFont.backgroundColor && effectiveFont.backgroundColor !== 'transparent' ? effectiveFont.backgroundColor : '#ffffff'}
                          onChange={(e) => {
                            if (!isOverrideActive) handleToggleOverride(true);
                            updateActiveSourceFont({ backgroundColor: e.target.value }, true);
                          }}
                          className="w-10 h-6 border border-slate-300 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {fontSubTab === 'width' && (
                  <div className="space-y-2 text-[11.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-700">Font Width Scaling (%):</span>
                      <input
                        type="number"
                        min={25}
                        max={400}
                        disabled={!isOverrideActive}
                        value={effectiveFont.fontWidthScale || 100}
                        onChange={(e) => {
                          const val = Math.max(25, parseInt(e.target.value, 10) || 100);
                          if (!isOverrideActive) handleToggleOverride(true);
                          updateActiveSourceFont({ fontWidthScale: val }, true);
                        }}
                        className="w-20 border border-[#cbd5e1] rounded px-2 py-0.5 text-right disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={200}
                      disabled={!isOverrideActive}
                      value={effectiveFont.fontWidthScale || 100}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isOverrideActive) handleToggleOverride(true);
                        updateActiveSourceFont({ fontWidthScale: val }, true);
                      }}
                      className="w-full accent-[#0078d7] disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {fontSubTab === 'outline' && (
                  <div className="space-y-2 text-[11.5px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isOverrideActive}
                        checked={!!effectiveFont.textOutline?.enabled}
                        onChange={(e) => {
                          if (!isOverrideActive) handleToggleOverride(true);
                          updateActiveSourceFont(
                            {
                              textOutline: {
                                enabled: e.target.checked,
                                color: effectiveFont.textOutline?.color || '#000000',
                                width: effectiveFont.textOutline?.width || 1,
                              },
                            },
                            true
                          );
                        }}
                        className="accent-[#0078d7] disabled:cursor-not-allowed"
                      />
                      <span>Enable Text Outline</span>
                    </label>
                    {effectiveFont.textOutline?.enabled && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span>Outline Color:</span>
                          <input
                            type="color"
                            disabled={!isOverrideActive}
                            value={effectiveFont.textOutline.color}
                            onChange={(e) => {
                              if (!isOverrideActive) handleToggleOverride(true);
                              updateActiveSourceFont(
                                {
                                  textOutline: {
                                    ...effectiveFont.textOutline!,
                                    color: e.target.value,
                                  },
                                },
                                true
                              );
                            }}
                            className="w-10 h-6 border rounded cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Outline Width:</span>
                          <input
                            type="number"
                            min={0.5}
                            max={10}
                            step={0.5}
                            disabled={!isOverrideActive}
                            value={effectiveFont.textOutline.width}
                            onChange={(e) => {
                              if (!isOverrideActive) handleToggleOverride(true);
                              updateActiveSourceFont(
                                {
                                  textOutline: {
                                    ...effectiveFont.textOutline!,
                                    width: parseFloat(e.target.value) || 1,
                                  },
                                },
                                true
                              );
                            }}
                            className="w-16 border rounded px-1.5 py-0.5 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {fontSubTab === 'advanced' && (
                  <div className="space-y-2 text-[11.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-700">Character Spacing / Tracking (px):</span>
                      <input
                        type="number"
                        min={-5}
                        max={50}
                        step={0.5}
                        disabled={!isOverrideActive}
                        value={effectiveFont.letterSpacing || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (!isOverrideActive) handleToggleOverride(true);
                          updateActiveSourceFont({ letterSpacing: val }, true);
                        }}
                        className="w-20 border border-[#cbd5e1] rounded px-2 py-0.5 text-right disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom TrueType note matching Screenshot 2 */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-[11px] text-slate-500">
                This is a TrueType font. This same font will be used on both your printer and your screen.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#f0f4f9] border-t border-[#cbd5e1] px-4 py-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0078d7] hover:bg-[#106ebe] text-white rounded text-[12px] font-medium shadow-sm transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
