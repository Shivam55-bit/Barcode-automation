import React, { useState, useEffect } from 'react';
import { X, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Code, Eye, Sparkles, Check } from 'lucide-react';
import { TextElement, FormattedTextRun } from '../../types';
import { sanitizeHtmlForLabel, parseRtfToHtml, parseXamlToHtml, runsToHtml } from '../../services/textMarkupEngine';

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: TextElement | null;
  onSave: (id: string, updates: Partial<TextElement>) => void;
}

export const RichTextEditorModal: React.FC<RichTextEditorModalProps> = ({
  isOpen,
  onClose,
  element,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'source'>('visual');
  const [textContent, setTextContent] = useState<string>('');
  const [rtfContent, setRtfContent] = useState<string>('');
  const [xamlContent, setXamlContent] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [runs, setRuns] = useState<FormattedTextRun[]>([]);

  // WYSIWYG Toolbar state
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(12);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  useEffect(() => {
    if (element && isOpen) {
      setTextContent(element.text || '');
      setRtfContent(element.rtfRaw || element.text || '');
      setXamlContent(element.xamlRaw || element.text || '');
      setHtmlContent(element.richContentHtml || element.sanitizedHtml || element.text || '');
      setRuns(element.runs && element.runs.length > 0 ? JSON.parse(JSON.stringify(element.runs)) : [
        {
          id: 'run-1',
          text: element.text || 'Sample Rich Text',
          fontFamily: element.fontFamily || 'Arial',
          fontSize: element.fontSize || 12,
          fontWeight: element.fontWeight || 'normal',
          fontStyle: element.fontStyle || 'normal',
          underline: !!element.underline,
          color: element.color || '#000000',
        }
      ]);
      setFontFamily(element.fontFamily || 'Arial');
      setFontSize(element.fontSize || 12);
      setIsBold(element.fontWeight === 'bold');
      setIsItalic(element.fontStyle === 'italic');
      setIsUnderline(!!element.underline);
      setTextColor(element.color || '#000000');
      setAlignment(element.textAlign === 'distributed' ? 'left' : element.textAlign || 'left');
    }
  }, [element, isOpen]);

  if (!isOpen || !element) return null;

  const textType = element.textType || 'word-processor';

  const handleApplyFormattingToRun = (index: number) => {
    setRuns((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              fontFamily,
              fontSize,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              underline: isUnderline,
              color: textColor,
            }
          : r
      )
    );
  };

  const handleAddRun = () => {
    const newRun: FormattedTextRun = {
      id: `run-${Date.now()}`,
      text: 'New Run Text',
      fontFamily,
      fontSize,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline,
      color: textColor,
    };
    setRuns((prev) => [...prev, newRun]);
  };

  const handleRemoveRun = (idx: number) => {
    if (runs.length <= 1) return;
    setRuns((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const updates: Partial<TextElement> = {
      textAlign: alignment,
    };

    if (textType === 'word-processor') {
      updates.runs = runs;
      updates.text = runs.map((r) => r.text).join(' ');
      updates.richContentHtml = runsToHtml(runs);
    } else if (textType === 'rtf') {
      updates.rtfRaw = rtfContent;
      updates.text = rtfContent;
      updates.richContentHtml = parseRtfToHtml(rtfContent);
    } else if (textType === 'xaml') {
      updates.xamlRaw = xamlContent;
      updates.text = xamlContent;
      updates.richContentHtml = parseXamlToHtml(xamlContent);
    } else if (textType === 'html') {
      updates.sanitizedHtml = sanitizeHtmlForLabel(htmlContent);
      updates.richContentHtml = sanitizeHtmlForLabel(htmlContent);
      updates.text = htmlContent;
    }

    onSave(element.id, updates);
    onClose();
  };

  // Preview generator
  let previewHtml = '';
  if (textType === 'word-processor') {
    previewHtml = runsToHtml(runs);
  } else if (textType === 'rtf') {
    previewHtml = parseRtfToHtml(rtfContent);
  } else if (textType === 'xaml') {
    previewHtml = parseXamlToHtml(xamlContent);
  } else {
    previewHtml = sanitizeHtmlForLabel(htmlContent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800 text-sm">
              {textType === 'word-processor' && 'Word Processor Rich Text Editor'}
              {textType === 'rtf' && 'RTF (Rich Text Format) Editor & Inspector'}
              {textType === 'xaml' && 'XAML Text Markup Editor & Inspector'}
              {textType === 'html' && 'HTML Markup Container Editor'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'visual' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {textType === 'word-processor' ? 'Structured Runs' : 'Visual Preview'}
            </button>
            <button
              onClick={() => setActiveTab('source')}
              className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'source' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Markup Source
            </button>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">Type: {textType.toUpperCase()}</span>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Word Processor Structured Runs Editor */}
          {textType === 'word-processor' && activeTab === 'visual' && (
            <div className="space-y-3">
              {/* Quick Formatting Bar */}
              <div className="p-2 bg-slate-100 border border-slate-200 rounded flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="h-7 border border-slate-300 rounded px-2 bg-white"
                >
                  <option value="Arial">Arial</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>

                <input
                  type="number"
                  min={6}
                  max={144}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-14 h-7 border border-slate-300 rounded px-2 bg-white text-center"
                />

                <div className="flex items-center gap-0.5 border border-slate-300 rounded bg-white p-0.5">
                  <button
                    onClick={() => setIsBold(!isBold)}
                    className={`p-1 rounded ${isBold ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600'}`}
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsItalic(!isItalic)}
                    className={`p-1 rounded ${isItalic ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsUnderline(!isUnderline)}
                    className={`p-1 rounded ${isUnderline ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-7 h-7 p-0.5 border border-slate-300 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-0.5 border border-slate-300 rounded bg-white p-0.5">
                  <button
                    onClick={() => setAlignment('left')}
                    className={`p-1 rounded ${alignment === 'left' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAlignment('center')}
                    className={`p-1 rounded ${alignment === 'center' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAlignment('right')}
                    className={`p-1 rounded ${alignment === 'right' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAlignment('justify')}
                    className={`p-1 rounded ${alignment === 'justify' ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleAddRun}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 transition-colors ml-auto"
                >
                  + Add Fragment
                </button>
              </div>

              {/* Fragment Runs List */}
              <div className="space-y-2 border border-slate-200 rounded p-2 bg-slate-50 max-h-60 overflow-y-auto">
                {runs.map((r, idx) => (
                  <div key={r.id || idx} className="p-2.5 bg-white border border-slate-200 rounded shadow-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-600">Run #{idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApplyFormattingToRun(idx)}
                          className="px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                        >
                          Apply Active Style
                        </button>
                        {runs.length > 1 && (
                          <button
                            onClick={() => handleRemoveRun(idx)}
                            className="px-1.5 py-0.5 text-[11px] bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={r.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRuns((prev) => prev.map((item, i) => (i === idx ? { ...item, text: val } : item)));
                      }}
                      className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                      rows={2}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{r.fontFamily || 'Arial'}</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{r.fontSize || 12}pt</span>
                      {r.fontWeight === 'bold' && <span className="bg-slate-100 px-1.5 py-0.5 rounded border font-bold">B</span>}
                      {r.fontStyle === 'italic' && <span className="bg-slate-100 px-1.5 py-0.5 rounded border italic">I</span>}
                      {r.underline && <span className="bg-slate-100 px-1.5 py-0.5 rounded border underline">U</span>}
                      <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: r.color || '#000000' }} />
                        {r.color || '#000000'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Markup Source Editors */}
          {(activeTab === 'source' || textType !== 'word-processor') && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Source Content:</label>
              <textarea
                value={
                  textType === 'rtf'
                    ? rtfContent
                    : textType === 'xaml'
                    ? xamlContent
                    : textType === 'html'
                    ? htmlContent
                    : runsToHtml(runs)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (textType === 'rtf') setRtfContent(val);
                  else if (textType === 'xaml') setXamlContent(val);
                  else if (textType === 'html') setHtmlContent(val);
                }}
                readOnly={textType === 'word-processor' && activeTab === 'source'}
                className="w-full h-44 border border-slate-300 rounded p-2.5 text-xs font-mono focus:ring-1 focus:ring-blue-500 bg-slate-900 text-slate-100"
              />
            </div>
          )}

          {/* Live Preview Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Sanitized Visual Output:</label>
            <div
              className="w-full min-h-[90px] border border-slate-300 rounded p-3 bg-white text-slate-900 shadow-inner overflow-auto"
              style={{ textAlign: alignment }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 bg-white rounded text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
