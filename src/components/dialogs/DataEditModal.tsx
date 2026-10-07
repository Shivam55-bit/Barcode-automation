import React, { useState, useEffect, useRef } from 'react';
import { BarcodeElement, TextElement, LabelElement, DataSourceItem } from '../../types';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { getSymbologyMetadata } from '../../services/barcodeEngine';
import { X } from 'lucide-react';
import { SpecialCharacterModal } from './SpecialCharacterModal';
import { insertAtSelection } from '../../services/controlCharacterService';

interface DataEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: LabelElement | null;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onOpenDataSources?: (element: LabelElement) => void;
}

/**
 * BarTender-Style Classic "Data Edit" Dialog
 * Activated by the Data Edit Tool in the toolbar when clicking any barcode or text object.
 * Allows instant direct editing of embedded data with immediate canvas reflection and Undo/Redo.
 * Features the [Data Source...] button to seamlessly navigate to full Barcode Properties,
 * and the [ Ω ] button to insert special Unicode symbols and control characters.
 */
export const DataEditModal: React.FC<DataEditModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  onOpenDataSources,
}) => {
  const [dataValue, setDataValue] = useState<string>('');
  const [isSpecialCharModalOpen, setIsSpecialCharModalOpen] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    if (isOpen && element) {
      if (element.dataSources && element.dataSources.length > 0) {
        setDataValue(element.dataSources[0]?.value ?? '');
      } else if (element.type === 'barcode') {
        setDataValue((element as BarcodeElement).value || '');
      } else if (element.type === 'text') {
        setDataValue((element as TextElement).text || '');
      } else {
        setDataValue((element as any).value || (element as any).content || '');
      }
    }
  }, [isOpen, element]);

  if (!isOpen || !element) return null;

  const handleOpenSpecialCharacters = () => {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : (savedSelectionRef.current.start ?? dataValue.length);
    const end = textarea ? textarea.selectionEnd : (savedSelectionRef.current.end ?? dataValue.length);
    savedSelectionRef.current = { start, end };
    setIsSpecialCharModalOpen(true);
  };

  const handleInsertSymbol = (symbol: string) => {
    const start = savedSelectionRef.current.start ?? dataValue.length;
    const end = savedSelectionRef.current.end ?? dataValue.length;
    const { value: nextVal, newCursor } = insertAtSelection(dataValue, symbol, start, end);
    savedSelectionRef.current = { start: newCursor, end: newCursor };
    setDataValue(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        try {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        } catch {}
      }
    }, 0);
  };

  const handleOk = () => {
    const trimmedVal = dataValue;
    let updatedDsList: DataSourceItem[] | undefined = undefined;

    if (element.dataSources && element.dataSources.length > 0) {
      updatedDsList = element.dataSources.map((ds, idx) => {
        if (idx === 0) {
          // If serialization is enabled, update base value safely without deleting settings
          const currentSerial = ds.serialization || ds.transformConfig?.serialization;
          return {
            ...ds,
            value: trimmedVal,
            type: ds.type === 'database' || ds.type === 'variable' ? 'embedded' : ds.type,
            ...(currentSerial
              ? {
                  serialization: {
                    ...currentSerial,
                    currentValue: trimmedVal,
                  },
                }
              : {}),
            ...(ds.transformConfig
              ? {
                  transformConfig: {
                    ...ds.transformConfig,
                    ...(currentSerial
                      ? {
                          serialization: {
                            ...currentSerial,
                            currentValue: trimmedVal,
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          };
        }
        return ds;
      });
    } else {
      const newDs: DataSourceItem = {
        id: `ds-${Date.now()}`,
        name: 'Embedded Data',
        type: 'embedded',
        value: trimmedVal,
        enabled: true,
      };
      updatedDsList = [newDs];
    }

    const simulatedEl = { ...element, dataSources: updatedDsList };
    const compiled = evaluateElementData(simulatedEl as any);

    onUpdateElement(element.id, {
      dataSources: updatedDsList,
      dataBinding: undefined,
      ...(element.type === 'barcode'
        ? {
            value: compiled || trimmedVal,
            barcodeValue: compiled || trimmedVal,
            content: compiled || trimmedVal,
          }
        : {}),
      ...(element.type === 'text'
        ? {
            text: compiled || trimmedVal,
            value: compiled || trimmedVal,
            content: compiled || trimmedVal,
          }
        : {}),
    });

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || element.type === 'barcode' || !(element as any).multiline)) {
      e.preventDefault();
      handleOk();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleOpenDataSources = () => {
    onClose();
    if (onOpenDataSources && element) {
      onOpenDataSources(element);
    }
  };

  const handleHelp = () => {
    alert(
      'Data Edit Tool:\n\nAllows quick modification of the primary embedded value for barcode and text objects.\nClick "Ω" to insert Unicode symbols / control characters.\nClick "Data Source..." to configure Advanced Data Sources, Symbology, Transforms, or Serialization.'
    );
  };

  const elementFont = (element as any).fontFamily || 'Arial';
  const symbologyMeta = element.type === 'barcode' ? getSymbologyMetadata((element as BarcodeElement).symbology) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-full bg-[#f0f4f9] rounded-sm shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Classic Windows Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1 flex items-center justify-between">
          <span className="font-semibold text-slate-900 text-[12px]">Data Edit</span>
          <button
            onClick={onClose}
            className="w-7 h-4.5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs shadow-xs cursor-pointer"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="block text-[11.5px] font-medium text-slate-700">Embedded Data</label>
              {symbologyMeta && (
                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {symbologyMeta.name}
                </span>
              )}
            </div>
            <button
              type="button"
              title="Insert Symbols or Special Characters"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenSpecialCharacters}
              className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-sm cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <span>Ω</span>
              <span className="text-[10.5px] font-sans font-normal text-slate-700">Symbols...</span>
            </button>
          </div>
          <div className="flex items-start gap-2.5">
            <textarea
              ref={textareaRef}
              rows={4}
              value={dataValue}
              onChange={(e) => {
                setDataValue(e.target.value);
                savedSelectionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
              }}
              onSelect={(e) => {
                savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
              }}
              onKeyUp={(e) => {
                savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
              }}
              onMouseUp={(e) => {
                savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 bg-white border border-[#94a3b8] rounded-xs p-2 font-mono text-sm text-slate-900 focus:outline-[#0078d7] resize-none"
              placeholder="Enter embedded data..."
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                title="Insert Symbols or Special Characters"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleOpenSpecialCharacters}
                className="w-9 h-8 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-base cursor-pointer shadow-2xs flex items-center justify-center"
              >
                Ω
              </button>
              <button
                type="button"
                onClick={handleOpenDataSources}
                className="px-3 py-1.5 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[11px] font-medium shadow-2xs cursor-pointer whitespace-nowrap"
              >
                Data Source...
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10.5px] text-slate-500 pt-1">
            <span>Length: {dataValue.length} characters</span>
            <span className="italic text-slate-400">Press Enter to save</span>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-center gap-2">
          <button
            onClick={handleOk}
            className="px-6 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] text-slate-800 font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            Cancel
          </button>
          <button
            onClick={handleHelp}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] text-slate-800 font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            Help
          </button>
        </div>
      </div>

      {/* Insert Symbols or Special Characters Modal */}
      <SpecialCharacterModal
        isOpen={isSpecialCharModalOpen}
        onClose={() => setIsSpecialCharModalOpen(false)}
        onInsert={handleInsertSymbol}
        currentFont={elementFont}
      />
    </div>
  );
};
