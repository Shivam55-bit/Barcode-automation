/**
 * 360Barcode Enterprise - Text Markup & Security Engine
 * 
 * Provides robust, sandboxed parsing, sanitization, and transformation for:
 * 1. Safe HTML Subsets (strips scripts, iframes, events, javascript: urls)
 * 2. Safe RTF (Rich Text Format) Parser to HTML/Runs
 * 3. Safe XAML (WPF/Silverlight TextBlock markup) to HTML/Runs
 * 4. Structured Word Processor Run compilation & serialization
 */

import { FormattedTextRun, WordProcessorBlock, TextElement, ResolvedTextRun } from '../types';
import { paragraphSvg } from './paragraphLayout';
import { evaluateTextElementRuns } from './dataSourceEngine';

export function getTextElementMarkup(element: TextElement, resolvedText = element.text ?? '', runs?: ResolvedTextRun[]): string | null {
  let html: string;
  if (element.textType === 'word-processor') {
    html = element.runs?.length ? runsToHtml(element.runs)
      : element.blocks?.length ? blocksToHtml(element.blocks)
      : element.richContentHtml ?? resolvedText;
  } else if (element.textType === 'rtf') {
    html = parseRtfToHtml(element.rtfRaw ?? resolvedText);
  } else if (element.textType === 'xaml') {
    html = parseXamlToHtml(element.xamlRaw ?? resolvedText);
  } else if (element.textType === 'html' || element.richContentHtml) {
    html = element.sanitizedHtml ?? element.richContentHtml ?? resolvedText;
  } else if (element.textType === 'paragraph' || element.textFormatType === 'paragraph') {
    return paragraphSvg(element, runs ?? evaluateTextElementRuns(element));
  } else {
    return null;
  }
  return sanitizeHtmlForLabel(html);
}

// ============================================================
// 1. HTML SANITIZATION (ZERO NODE/ELECTRON SCRIPT EXECUTION)
// ============================================================

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup',
  'span', 'div', 'p', 'br', 'hr', 'font',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'tbody', 'thead', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'pre', 'code', 'blockquote',
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'line-height',
  'letter-spacing',
  'padding',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'width',
  'height',
  'max-width',
  'max-height',
  'display',
  'vertical-align',
  'white-space',
  'word-break',
]);

/**
 * Sanitizes an inline CSS style string, keeping only safe typographic properties.
 */
export function sanitizeInlineStyle(styleStr: string): string {
  if (!styleStr) return '';
  const declarations = styleStr.split(';');
  const cleanDeclarations: string[] = [];

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();

    // Block url(), javascript:, expression(), behavioral injection
    if (
      ALLOWED_STYLE_PROPERTIES.has(prop) &&
      !val.toLowerCase().includes('javascript:') &&
      !val.toLowerCase().includes('expression(') &&
      !val.toLowerCase().includes('url(') &&
      !val.toLowerCase().includes('behavior:')
    ) {
      cleanDeclarations.push(`${prop}:${val}`);
    }
  }

  return cleanDeclarations.join('; ');
}

/**
 * Robust HTML Sanitizer that works in browser and node/test environments.
 */
export function sanitizeHtmlForLabel(rawHtml: string): string {
  if (!rawHtml) return '';

  // Fast pre-filter for dangerous executable tags
  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '');

  // Strip event handlers (onload, onclick, onerror, onmouseover, etc.)
  cleaned = cleaned.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // Strip javascript: and data: URIs in attributes
  cleaned = cleaned.replace(/(href|src)\s*=\s*['"]\s*(?:javascript|data):[^'"]*['"]/gi, '');

  // Tag filter & attribute sanitizer
  cleaned = cleaned.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
    const lowerTag = tagName.toLowerCase();
    const isClosing = match.startsWith('</');

    if (!ALLOWED_TAGS.has(lowerTag)) {
      // Disallowed tag -> strip tag completely but keep text content
      return '';
    }

    if (isClosing) {
      return `</${lowerTag}>`;
    }

    // Process attributes for allowed tag
    let safeAttrs = '';
    const styleMatch = attrs.match(/\bstyle\s*=\s*(?:'([^']*)'|"([^"]*)")/i);
    if (styleMatch) {
      const rawStyle = styleMatch[1] || styleMatch[2] || '';
      const safeStyle = sanitizeInlineStyle(rawStyle);
      if (safeStyle) {
        safeAttrs += ` style="${safeStyle}"`;
      }
    }

    const classMatch = attrs.match(/\bclass\s*=\s*(?:'([^']*)'|"([^"]*)")/i);
    if (classMatch) {
      const safeClass = (classMatch[1] || classMatch[2] || '').replace(/[^a-zA-Z0-9_ -]/g, '');
      if (safeClass) {
        safeAttrs += ` class="${safeClass}"`;
      }
    }

    // Font tag attributes
    if (lowerTag === 'font') {
      const colorMatch = attrs.match(/\bcolor\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);
      const faceMatch = attrs.match(/\bface\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);
      const sizeMatch = attrs.match(/\bsize\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);

      if (colorMatch) safeAttrs += ` color="${colorMatch[1] || colorMatch[2] || colorMatch[3]}"`;
      if (faceMatch) safeAttrs += ` face="${faceMatch[1] || faceMatch[2] || faceMatch[3]}"`;
      if (sizeMatch) safeAttrs += ` size="${sizeMatch[1] || sizeMatch[2] || sizeMatch[3]}"`;
    }

    // Table cell attributes
    if (['td', 'th', 'table'].includes(lowerTag)) {
      const alignMatch = attrs.match(/\balign\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);
      const widthMatch = attrs.match(/\bwidth\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);
      if (alignMatch) safeAttrs += ` align="${alignMatch[1] || alignMatch[2] || alignMatch[3]}"`;
      if (widthMatch) safeAttrs += ` width="${widthMatch[1] || widthMatch[2] || widthMatch[3]}"`;
    }

    return `<${lowerTag}${safeAttrs}>`;
  });

  return cleaned;
}

// ============================================================
// 2. SAFE RTF (RICH TEXT FORMAT) PARSER
// ============================================================

/**
 * Parses RTF raw markup into safe, clean HTML representation.
 */
export function parseRtfToHtml(rtfRaw: string): string {
  if (!rtfRaw) return '';
  if (!rtfRaw.trim().startsWith('{\\rtf')) {
    // Plain text or already non-RTF content
    return sanitizeHtmlForLabel(rtfRaw.replace(/\n/g, '<br/>'));
  }

  // Parse color table
  const colorTable: string[] = ['#000000'];
  const colortblMatch = rtfRaw.match(/\{\\colortbl;?([^}]+)\}/);
  if (colortblMatch) {
    const rawEntries = colortblMatch[1].split(';');
    for (const entry of rawEntries) {
      const r = entry.match(/\\red(\d+)/);
      const g = entry.match(/\\green(\d+)/);
      const b = entry.match(/\\blue(\d+)/);
      if (r && g && b) {
        const hexR = parseInt(r[1], 10).toString(16).padStart(2, '0');
        const hexG = parseInt(g[1], 10).toString(16).padStart(2, '0');
        const hexB = parseInt(b[1], 10).toString(16).padStart(2, '0');
        colorTable.push(`#${hexR}${hexG}${hexB}`);
      }
    }
  }

  // Parse font table
  const fontTable: Record<number, string> = {};
  const fonttblMatch = rtfRaw.match(/\{\\fonttbl([^}]+)\}/);
  if (fonttblMatch) {
    const fontDefs = fonttblMatch[1].match(/\\f(\d+)[^;]*\s+([^;}]+);/g);
    if (fontDefs) {
      for (const fDef of fontDefs) {
        const idMatch = fDef.match(/\\f(\d+)/);
        const nameMatch = fDef.match(/([A-Za-z0-9\s]+);/);
        if (idMatch && nameMatch) {
          fontTable[parseInt(idMatch[1], 10)] = nameMatch[1].trim();
        }
      }
    }
  }

  // Strip specific header groups: fonttbl, colortbl, stylesheet, info, generator, \*...
  let body = rtfRaw
    .replace(/\{\\fonttbl[\s\S]*?\}/gi, '')
    .replace(/\{\\colortbl[\s\S]*?\}/gi, '')
    .replace(/\{\\stylesheet[\s\S]*?\}/gi, '')
    .replace(/\{\\info[\s\S]*?\}/gi, '')
    .replace(/\{\\\*[\s\S]*?\}/gi, '')
    .replace(/^\{\\rtf\d*/i, '');

  let htmlResult = '';
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let currentColor = '';
  let currentFont = '';
  let currentFontSizePt = 0;

  // Tokenize RTF control words and text
  const tokenRegex = /\\([a-zA-Z]+)(-?\d+)? ?|\\(['\\{}])|([{}])|([^\\{}]+)/g;
  let match;

  while ((match = tokenRegex.exec(body)) !== null) {
    const [, word, num, escapedChar, , plainText] = match;

    if (word) {
      const val = num !== undefined ? parseInt(num, 10) : undefined;
      switch (word.toLowerCase()) {
        case 'b':
          isBold = val === undefined || val === 1;
          break;
        case 'b0':
          isBold = false;
          break;
        case 'i':
          isItalic = val === undefined || val === 1;
          break;
        case 'i0':
          isItalic = false;
          break;
        case 'ul':
        case 'ulnone':
          isUnderline = word.toLowerCase() === 'ul';
          break;
        case 'strike':
          isStrike = val === undefined || val === 1;
          break;
        case 'cf':
          if (val !== undefined && colorTable[val]) {
            currentColor = colorTable[val];
          }
          break;
        case 'f':
          if (val !== undefined && fontTable[val]) {
            currentFont = fontTable[val];
          }
          break;
        case 'fs':
          if (val !== undefined) {
            currentFontSizePt = val / 2; // RTF font sizes are in half-points
          }
          break;
        case 'par':
        case 'line':
          htmlResult += '<br/>';
          break;
        case 'tab':
          htmlResult += '&emsp;';
          break;
        case 'u':
          if (val !== undefined) {
            htmlResult += String.fromCharCode(val < 0 ? val + 65536 : val);
          }
          break;
      }
    } else if (escapedChar) {
      htmlResult += escapedChar;
    } else if (plainText) {
      let segment = plainText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const styleRules: string[] = [];
      if (isBold) styleRules.push('font-weight:bold');
      if (isItalic) styleRules.push('font-style:italic');
      if (isUnderline) styleRules.push('text-decoration:underline');
      if (isStrike) styleRules.push('text-decoration:line-through');
      if (currentColor) styleRules.push(`color:${currentColor}`);
      if (currentFont) styleRules.push(`font-family:${currentFont}`);
      if (currentFontSizePt > 0) styleRules.push(`font-size:${currentFontSizePt}pt`);

      if (styleRules.length > 0) {
        htmlResult += `<span style="${styleRules.join(';')}">${segment}</span>`;
      } else {
        htmlResult += segment;
      }
    }
  }

  return sanitizeHtmlForLabel(htmlResult || rtfRaw);
}

// ============================================================
// 3. SAFE XAML (TEXTBLOCK & RUN MARKUP) PARSER
// ============================================================

/**
 * Parses safe XAML markup (TextBlock, Run, Span, Bold, Italic, Underline, LineBreak)
 * into safe HTML suitable for rendering.
 */
export function parseXamlToHtml(xamlRaw: string): string {
  if (!xamlRaw) return '';
  if (!xamlRaw.trim().includes('<')) {
    return sanitizeHtmlForLabel(xamlRaw.replace(/\n/g, '<br/>'));
  }

  try {
    let result = '';

    // Extract TextBlock attributes
    const tbMatch = xamlRaw.match(/<TextBlock([^>]*)>([\s\S]*?)<\/TextBlock>/i);
    let innerContent = tbMatch ? tbMatch[2] : xamlRaw;
    const tbAttrs = tbMatch ? tbMatch[1] : '';

    const tbStyles: string[] = [];
    const fontFam = tbAttrs.match(/FontFamily\s*=\s*["']([^"']+)["']/i);
    const fontSz = tbAttrs.match(/FontSize\s*=\s*["']([^"']+)["']/i);
    const fontWt = tbAttrs.match(/FontWeight\s*=\s*["']([^"']+)["']/i);
    const fontSt = tbAttrs.match(/FontStyle\s*=\s*["']([^"']+)["']/i);
    const fg = tbAttrs.match(/Foreground\s*=\s*["']([^"']+)["']/i);
    const bg = tbAttrs.match(/Background\s*=\s*["']([^"']+)["']/i);
    const txtAlign = tbAttrs.match(/TextAlignment\s*=\s*["']([^"']+)["']/i);

    if (fontFam) tbStyles.push(`font-family:${fontFam[1]}`);
    if (fontSz) tbStyles.push(`font-size:${fontSz[1]}px`);
    if (fontWt) tbStyles.push(`font-weight:${fontWt[1].toLowerCase()}`);
    if (fontSt) tbStyles.push(`font-style:${fontSt[1].toLowerCase()}`);
    if (fg) tbStyles.push(`color:${fg[1]}`);
    if (bg) tbStyles.push(`background-color:${bg[1]}`);
    if (txtAlign) tbStyles.push(`text-align:${txtAlign[1].toLowerCase()}`);

    // If TextBlock has direct Text attribute: <TextBlock Text="..." />
    const directText = tbAttrs.match(/\bText\s*=\s*["']([^"']+)["']/i);
    if (directText && !innerContent.trim()) {
      innerContent = directText[1];
    }

    // Helper to extract styles from XAML element attributes
    const extractXamlInlineStyles = (attrs: string): string[] => {
      const styles: string[] = [];
      const fg = attrs.match(/Foreground\s*=\s*["']([^"']+)["']/i);
      const bg = attrs.match(/Background\s*=\s*["']([^"']+)["']/i);
      const wt = attrs.match(/FontWeight\s*=\s*["']([^"']+)["']/i);
      const st = attrs.match(/FontStyle\s*=\s*["']([^"']+)["']/i);
      const sz = attrs.match(/FontSize\s*=\s*["']([^"']+)["']/i);
      const fam = attrs.match(/FontFamily\s*=\s*["']([^"']+)["']/i);
      const dec = attrs.match(/TextDecorations\s*=\s*["']([^"']+)["']/i);

      if (fg) styles.push(`color:${fg[1]}`);
      if (bg) styles.push(`background-color:${bg[1]}`);
      if (wt) styles.push(`font-weight:${wt[1].toLowerCase()}`);
      if (st) styles.push(`font-style:${st[1].toLowerCase()}`);
      if (sz) styles.push(`font-size:${sz[1]}px`);
      if (fam) styles.push(`font-family:${fam[1]}`);
      if (dec && dec[1].toLowerCase() === 'underline') styles.push('text-decoration:underline');
      if (dec && dec[1].toLowerCase() === 'strikethrough') styles.push('text-decoration:line-through');

      return styles;
    };

    // Parse XAML Inlines: <LineBreak>, <Bold>, <Italic>, <Underline>, <Span>, <Run>
    // Process <Span> before <Run> to allow nested <Run> elements and avoid regex collision with generated <span> tags
    let parsedContent = innerContent
      .replace(/<LineBreak\s*\/?>/gi, '<br/>')
      .replace(/<Bold>([\s\S]*?)<\/Bold>/gi, '<b>$1</b>')
      .replace(/<Italic>([\s\S]*?)<\/Italic>/gi, '<i>$1</i>')
      .replace(/<Underline>([\s\S]*?)<\/Underline>/gi, '<u>$1</u>')
      .replace(/<Span\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Span>)/gi, (_match, attrs, text) => {
        const spanStyles = extractXamlInlineStyles(attrs || '');
        const content = text || '';
        return spanStyles.length > 0 ? `<span style="${spanStyles.join(';')}">${content}</span>` : `<span>${content}</span>`;
      })
      .replace(/<Run\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Run>)/gi, (_match, attrs, text) => {
        const runStyles = extractXamlInlineStyles(attrs || '');
        const textAttr = (attrs || '').match(/\bText\s*=\s*["']([^"']+)["']/i);
        const content = textAttr ? textAttr[1] : (text || '');
        if (runStyles.length > 0) {
          return `<span style="${runStyles.join(';')}">${content}</span>`;
        }
        return `<span>${content}</span>`;
      });

    if (tbStyles.length > 0) {
      result = `<div style="${tbStyles.join(';')}">${parsedContent}</div>`;
    } else {
      result = parsedContent;
    }

    return sanitizeHtmlForLabel(result);
  } catch (err) {
    console.warn('XAML parse warning, falling back to safe text:', err);
    return sanitizeHtmlForLabel(xamlRaw.replace(/<[^>]+>/g, ''));
  }
}

// ============================================================
// 4. STRUCTURED WORD PROCESSOR RUNS CONVERTER
// ============================================================

/**
 * Converts structured runs to sanitized HTML.
 */
export function runsToHtml(runs: FormattedTextRun[]): string {
  if (!runs || runs.length === 0) return '';
  let html = '';

  for (const run of runs) {
    let text = (run.text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const styles: string[] = [];
    if (run.fontFamily) styles.push(`font-family:${run.fontFamily}`);
    if (run.fontSize) styles.push(`font-size:${run.fontSize}pt`);
    if (run.fontWeight && run.fontWeight !== 'normal') styles.push(`font-weight:${run.fontWeight}`);
    if (run.fontStyle && run.fontStyle !== 'normal') styles.push(`font-style:${run.fontStyle}`);
    if (run.underline) styles.push('text-decoration:underline');
    if (run.strikeout) styles.push('text-decoration:line-through');
    if (run.color) styles.push(`color:${run.color}`);
    if (run.backgroundColor && run.backgroundColor !== 'transparent') styles.push(`background-color:${run.backgroundColor}`);

    if (styles.length > 0) {
      html += `<span style="${styles.join(';')}">${text}</span>`;
    } else {
      html += text;
    }
  }

  return sanitizeHtmlForLabel(html);
}

/**
 * Converts structured blocks to sanitized HTML.
 */
export function blocksToHtml(blocks: WordProcessorBlock[]): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks
    .map((b) => {
      const align = b.align ? ` style="text-align:${b.align}"` : '';
      const content = runsToHtml(b.runs);
      if (b.type === 'heading') return `<h3${align}>${content}</h3>`;
      if (b.type === 'bullet-list') return `<ul${align}><li>${content}</li></ul>`;
      if (b.type === 'numbered-list') return `<ol${align}><li>${content}</li></ol>`;
      return `<p${align}>${content}</p>`;
    })
    .join('');
}
