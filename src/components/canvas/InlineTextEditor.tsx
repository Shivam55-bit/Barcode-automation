import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TextElement } from '../../types';
import { isMultiLineTextElement, isSingleLineTextElement, measureTextObject, normalizeTextForObjectType } from '../../services/textMeasurementEngine';

interface InlineTextEditorProps {
  element: TextElement;
  scale: number; // px per mm
  onCommit: (id: string, newText: string) => void;
  onCancel: () => void;
  onDraftDimensionsChange?: (id: string, widthMm: number, heightMm: number) => void;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  element,
  scale,
  onCommit,
  onCancel,
  onDraftDimensionsChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draftText, setDraftText] = useState<string>(element.text || '');
  const draftTextRef = useRef<string>(element.text || '');
  const onDraftDimensionsChangeRef = useRef(onDraftDimensionsChange);
  onDraftDimensionsChangeRef.current = onDraftDimensionsChange;
  const initialTextRef = useRef<string>(element.text || '');
  const isCommittedRef = useRef<boolean>(false);

  const isMultiLine = isMultiLineTextElement(element);
  const isSingleLine = isSingleLineTextElement(element);
  const isParagraphLayout = element.textFormatType === 'paragraph' || element.textType === 'paragraph';
  const autoHeightEnabled = isParagraphLayout && (element.autoHeight ?? element.autoSize === true);

  const sizingMode = element.sizingMode || (isMultiLine ? 'fixed-width' : (element.autoSize !== false ? 'auto-width' : 'fixed-width'));
  const isSingleLineAutoWidth = isSingleLine && sizingMode === 'auto-width';

  // Border & padding configuration in screen pixels
  const border = element.borderConfig;
  const mTop = (border?.marginTop || 0) * scale;
  const mLeft = (border?.marginLeft || 0) * scale;
  const mBottom = (border?.marginBottom || 0) * scale;
  const mRight = (border?.marginRight || 0) * scale;

  // Exact typographic font properties
  const baseFontSizePx = (element.fontSize || 10) * (25.4 / 72) * scale;
  const isUnderline = element.underline || element.textDecoration === 'underline';
  const isStrikeout = element.strikeout || element.textDecoration === 'line-through';
  const textDecor = isUnderline && isStrikeout ? 'underline line-through' : isUnderline ? 'underline' : isStrikeout ? 'line-through' : 'none';
  const fontScale = (element.fontWidthScale || 100) / 100;

  // Auto-focus and select placeholder / position caret
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      if (initialTextRef.current === 'Sample Text' || initialTextRef.current === 'Text') {
        textareaRef.current.select();
      } else {
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  }, []);

  const measureDraftDimensions = (value: string) => {
    if ((isSingleLineAutoWidth || autoHeightEnabled) && onDraftDimensionsChange) {
      const measured = measureTextObject({
        text: value,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        letterSpacing: element.letterSpacing,
        lineHeight: element.lineHeight,
        fontWidthScale: element.fontWidthScale || 100,
        textType: autoHeightEnabled ? 'paragraph' : 'single-line',
        textFormatType: autoHeightEnabled ? 'paragraph' : 'single-line',
        multiline: autoHeightEnabled,
        wrap: autoHeightEnabled ? element.wrap !== false && element.wordWrap !== false : false,
        containerWidthMm: autoHeightEnabled ? element.width : undefined,
        borderConfig: element.borderConfig,
        ignoreMinSize: true,
      });

      onDraftDimensionsChangeRef.current?.(
        element.id,
        autoHeightEnabled ? element.width : measured.width,
        measured.height,
      );
    }
  };

  const updateDraftText = (value: string) => {
    const newText = isSingleLine
      ? normalizeTextForObjectType(value, element.textType || 'single-line')
      : value;
    draftTextRef.current = newText;
    setDraftText(newText);
    measureDraftDimensions(newText);
  };

  useEffect(() => {
    if ((!isSingleLineAutoWidth && !autoHeightEnabled) || !document.fonts?.load) return;
    let current = true;
    const fontSizePx = (element.fontSize || 10) * (96 / 72);
    const font = `${element.fontStyle || 'normal'} ${element.fontWeight || 'normal'} ${fontSizePx}px ${element.fontFamily || 'Arial, sans-serif'}`;
    void document.fonts.load(font, draftText || 'M').then(() => {
      if (current) measureDraftDimensions(draftTextRef.current);
    }).catch(error => console.warn('[TextLayout] Could not load the editing font before measuring.', error));
    return () => { current = false; };
  }, [draftText, element.fontFamily, element.fontSize, element.fontWeight, element.fontStyle, element.fontWidthScale,
    element.letterSpacing, element.lineHeight, element.borderConfig, element.width, element.wrap, element.wordWrap,
    isSingleLineAutoWidth, autoHeightEnabled]);

  // Real-time dynamic auto-size measurement during typing and paste
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateDraftText(e.target.value);
  };

  const handleCommit = useCallback(() => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    const finalVal = normalizeTextForObjectType(draftText, element.textType || (isSingleLine ? 'single-line' : 'multi-line'));
    onCommit(element.id, finalVal);
  }, [draftText, element.id, isSingleLine, onCommit, element.textType]);

  const handleCancel = useCallback(() => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    if (autoHeightEnabled) measureDraftDimensions(element.text || '');
    onCancel();
  }, [autoHeightEnabled, element.text, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // Stop propagation to canvas / global hotkeys

    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
      return;
    }

    if (e.key === 'Enter') {
      if (isSingleLine) {
        e.preventDefault();
        handleCommit();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleCommit();
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      return;
    }

    // Ctrl+A inside textarea
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.stopPropagation();
      // Browser default selects all text inside textarea
    }
  };

  return (
    <div
      className="w-full h-full relative"
      style={{
        paddingTop: `${mTop}px`,
        paddingLeft: `${mLeft}px`,
        paddingBottom: `${mBottom}px`,
        paddingRight: `${mRight}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={draftText}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onBlur={handleCommit}
        onPaste={(e) => {
          if (isSingleLine) {
            e.preventDefault();
            const dataTransfer = e.clipboardData;
            const pasted = dataTransfer && typeof dataTransfer.getData === 'function' ? dataTransfer.getData('text') : '';
            const normalized = normalizeTextForObjectType(pasted, element.textType || 'single-line');
            const textarea = e.currentTarget;
            const start = textarea.selectionStart ?? 0;
            const end = textarea.selectionEnd ?? textarea.value.length;
            const nextValue = textarea.value.slice(0, start) + normalized + textarea.value.slice(end);
            updateDraftText(nextValue);
            requestAnimationFrame(() => {
              const cursorPos = start + normalized.length;
              textarea.focus();
              textarea.setSelectionRange(cursorPos, cursorPos);
            });
          }
        }}
        spellCheck={false}
        rows={isSingleLine ? 1 : undefined}
        className="w-full h-full bg-transparent resize-none border-none outline-none overflow-hidden m-0 p-0 select-text"
        style={{
          fontFamily: element.fontFamily || 'Arial, sans-serif',
          fontSize: `${baseFontSizePx}px`,
          fontWeight: element.fontWeight || 'normal',
          fontStyle: element.fontStyle || 'normal',
          textDecoration: textDecor,
          color: element.whiteOnBlack ? '#ffffff' : element.color || '#000000',
          letterSpacing: `${element.letterSpacing || 0}px`,
          lineHeight: element.lineHeight || 1.15,
          textAlign: element.textAlign === 'distributed' ? 'justify' : element.textAlign || 'left',
          transform: fontScale !== 1 ? `scaleX(${fontScale})` : undefined,
          transformOrigin: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'right' : 'left',
          whiteSpace: isSingleLine ? 'nowrap' : element.wrap !== false ? 'pre-wrap' : 'pre',
          overflowWrap: isSingleLine ? 'normal' : 'break-word',
          wordWrap: isSingleLine ? 'normal' : 'break-word',
          cursor: 'text',
          caretColor: element.whiteOnBlack ? '#ffffff' : '#000000',
        }}
      />
    </div>
  );
};
