/**
 * Centralized Canonical Control-Character Engine (360Barcode / Barcode Automation Studio)
 * --------------------------------------------------------------------------------------
 * Provides a single source of truth separating:
 * 1. EDITOR/DISPLAY REPRESENTATION (e.g. «CR», «LF», «HT», «GS»)
 * 2. INTERNAL CONTROL CHARACTER VALUE (e.g. ASCII 13, 0x0D, '\r')
 * 3. RENDERED/RUNTIME RESULT (e.g. visual line break on canvas, ASCII 29 in barcode)
 *
 * Implements complete ASCII control-character table (0-31 and 127), deterministic
 * tokenizer with escape handling, newline normalization, and live preview formatters.
 */

export interface ControlCharacterDefinition {
  code: number;
  decimal: number;
  hex: string;
  name: string;
  abbr: string;
  editorToken: string; // e.g. "«CR»"
  runtimeValue: string; // e.g. "\r"
  description: string;
  barcodeUsage?: string;
}

/** Complete canonical table of ASCII C0 control characters (0-31) and DEL (127). */
export const CANONICAL_CONTROL_CHARACTERS: ControlCharacterDefinition[] = [
  { code: 0, decimal: 0, hex: '00', abbr: 'NUL', name: 'Null', editorToken: '«NUL»', runtimeValue: '\x00', description: 'Null character' },
  { code: 1, decimal: 1, hex: '01', abbr: 'SOH', name: 'Start of Heading', editorToken: '«SOH»', runtimeValue: '\x01', description: 'Start of header communication' },
  { code: 2, decimal: 2, hex: '02', abbr: 'STX', name: 'Start of Text', editorToken: '«STX»', runtimeValue: '\x02', description: 'Start of text/message data' },
  { code: 3, decimal: 3, hex: '03', abbr: 'ETX', name: 'End of Text', editorToken: '«ETX»', runtimeValue: '\x03', description: 'End of text/message data' },
  { code: 4, decimal: 4, hex: '04', abbr: 'EOT', name: 'End of Transmission', editorToken: '«EOT»', runtimeValue: '\x04', description: 'End of transmission' },
  { code: 5, decimal: 5, hex: '05', abbr: 'ENQ', name: 'Enquiry', editorToken: '«ENQ»', runtimeValue: '\x05', description: 'Request for response' },
  { code: 6, decimal: 6, hex: '06', abbr: 'ACK', name: 'Acknowledge', editorToken: '«ACK»', runtimeValue: '\x06', description: 'Affirmative response' },
  { code: 7, decimal: 7, hex: '07', abbr: 'BEL', name: 'Bell', editorToken: '«BEL»', runtimeValue: '\x07', description: 'Audible or visual alarm signal' },
  { code: 8, decimal: 8, hex: '08', abbr: 'BS', name: 'Backspace', editorToken: '«BS»', runtimeValue: '\x08', description: 'Moves cursor back one space' },
  { code: 9, decimal: 9, hex: '09', abbr: 'HT', name: 'Horizontal Tab', editorToken: '«HT»', runtimeValue: '\t', description: 'Advances cursor to next tab stop', barcodeUsage: 'Field separator in tab-delimited barcode formats' },
  { code: 10, decimal: 10, hex: '0A', abbr: 'LF', name: 'Line Feed', editorToken: '«LF»', runtimeValue: '\n', description: 'Advances cursor to next line' },
  { code: 11, decimal: 11, hex: '0B', abbr: 'VT', name: 'Vertical Tab', editorToken: '«VT»', runtimeValue: '\x0B', description: 'Advances cursor to next vertical tab' },
  { code: 12, decimal: 12, hex: '0C', abbr: 'FF', name: 'Form Feed', editorToken: '«FF»', runtimeValue: '\x0C', description: 'Page eject / advances to next page/label' },
  { code: 13, decimal: 13, hex: '0D', abbr: 'CR', name: 'Carriage Return', editorToken: '«CR»', runtimeValue: '\r', description: 'Returns cursor to start of line' },
  { code: 14, decimal: 14, hex: '0E', abbr: 'SO', name: 'Shift Out', editorToken: '«SO»', runtimeValue: '\x0E', description: 'Switches to alternate character set' },
  { code: 15, decimal: 15, hex: '0F', abbr: 'SI', name: 'Shift In', editorToken: '«SI»', runtimeValue: '\x0F', description: 'Switches back to standard character set' },
  { code: 16, decimal: 16, hex: '10', abbr: 'DLE', name: 'Data Link Escape', editorToken: '«DLE»', runtimeValue: '\x10', description: 'Modifies meaning of following characters' },
  { code: 17, decimal: 17, hex: '11', abbr: 'DC1', name: 'Device Control 1', editorToken: '«DC1»', runtimeValue: '\x11', description: 'XON (Resume transmission)' },
  { code: 18, decimal: 18, hex: '12', abbr: 'DC2', name: 'Device Control 2', editorToken: '«DC2»', runtimeValue: '\x12', description: 'Device control character 2' },
  { code: 19, decimal: 19, hex: '13', abbr: 'DC3', name: 'Device Control 3', editorToken: '«DC3»', runtimeValue: '\x13', description: 'XOFF (Pause transmission)' },
  { code: 20, decimal: 20, hex: '14', abbr: 'DC4', name: 'Device Control 4', editorToken: '«DC4»', runtimeValue: '\x14', description: 'Device control character 4' },
  { code: 21, decimal: 21, hex: '15', abbr: 'NAK', name: 'Negative Acknowledge', editorToken: '«NAK»', runtimeValue: '\x15', description: 'Negative response' },
  { code: 22, decimal: 22, hex: '16', abbr: 'SYN', name: 'Synchronous Idle', editorToken: '«SYN»', runtimeValue: '\x16', description: 'Synchronous idle signal' },
  { code: 23, decimal: 23, hex: '17', abbr: 'ETB', name: 'End of Transmission Block', editorToken: '«ETB»', runtimeValue: '\x17', description: 'End of transmission block' },
  { code: 24, decimal: 24, hex: '18', abbr: 'CAN', name: 'Cancel', editorToken: '«CAN»', runtimeValue: '\x18', description: 'Indicates error or cancelled data' },
  { code: 25, decimal: 25, hex: '19', abbr: 'EM', name: 'End of Medium', editorToken: '«EM»', runtimeValue: '\x19', description: 'End of storage medium' },
  { code: 26, decimal: 26, hex: '1A', abbr: 'SUB', name: 'Substitute', editorToken: '«SUB»', runtimeValue: '\x1A', description: 'Substitute for invalid/erroneous character' },
  { code: 27, decimal: 27, hex: '1B', abbr: 'ESC', name: 'Escape', editorToken: '«ESC»', runtimeValue: '\x1B', description: 'Escape character for printer command prefixes' },
  { code: 28, decimal: 28, hex: '1C', abbr: 'FS', name: 'File Separator', editorToken: '«FS»', runtimeValue: '\x1C', description: 'Information separator 4' },
  { code: 29, decimal: 29, hex: '1D', abbr: 'GS', name: 'Group Separator', editorToken: '«GS»', runtimeValue: '\x1D', description: 'Information separator 3', barcodeUsage: 'ASCII GS payload; distinct from a symbology-specific FNC1 instruction' },
  { code: 30, decimal: 30, hex: '1E', abbr: 'RS', name: 'Record Separator', editorToken: '«RS»', runtimeValue: '\x1E', description: 'Information separator 2', barcodeUsage: 'Used in ISO/IEC 15434 format envelope headers' },
  { code: 31, decimal: 31, hex: '1F', abbr: 'US', name: 'Unit Separator', editorToken: '«US»', runtimeValue: '\x1F', description: 'Information separator 1 (Field separator)' },
  { code: 127, decimal: 127, hex: '7F', abbr: 'DEL', name: 'Delete', editorToken: '«DEL»', runtimeValue: '\x7F', description: 'Erase or delete character' },
];

/** Fast lookup maps */
const byCode = new Map<number, ControlCharacterDefinition>();
const byHex = new Map<string, ControlCharacterDefinition>();
const byAbbr = new Map<string, ControlCharacterDefinition>();
const byChar = new Map<string, ControlCharacterDefinition>();

for (const def of CANONICAL_CONTROL_CHARACTERS) {
  byCode.set(def.code, def);
  byHex.set(def.hex.toUpperCase(), def);
  byAbbr.set(def.abbr.toUpperCase(), def);
  byChar.set(def.runtimeValue, def);
}

/** Aliases for common abbreviations or alternate token spellings */
const TOKEN_ALIASES: Record<string, number> = {
  TAB: 9,
  HTAB: 9,
  'HT / TAB': 9,
  'HT/TAB': 9,
  NEWLINE: 10,
  RETURN: 13,
};

/** True when numeric code point is an ASCII C0 control or DEL. */
export function isControlCode(code: number): boolean {
  return (code >= 0 && code <= 31) || code === 127;
}

/** True when the string char is an ASCII control character. */
export function isControlChar(char: string): boolean {
  if (!char) return false;
  return isControlCode(char.charCodeAt(0));
}

/** Canonical token string for a control code e.g. 13 -> "CR". */
export function getCanonicalToken(code: number): string {
  const def = byCode.get(code);
  return def ? def.abbr : `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Lookup control character definition by numeric code. */
export function getControlByCode(code: number): ControlCharacterDefinition | undefined {
  return byCode.get(code);
}

/** Lookup control character definition by token/abbreviation/hex/decimal. */
export function getControlByToken(token: string): ControlCharacterDefinition | undefined {
  if (!token) return undefined;
  // Clean surrounding guillemets « », brackets < >, or quotes
  const clean = token.replace(/^[«<"'`\\]+/, '').replace(/[»>"'`]+$/, '').trim().toUpperCase();

  if (byAbbr.has(clean)) return byAbbr.get(clean);
  if (TOKEN_ALIASES[clean] !== undefined) return byCode.get(TOKEN_ALIASES[clean]);

  if (/^\d{1,3}$/.test(clean)) return byCode.get(Number(clean));

  // Hex check e.g. "0x0D", "0D"
  const hexClean = clean.replace(/^0X/, '');
  if (/^[0-9A-F]{1,2}$/.test(hexClean) && byHex.has(hexClean.padStart(2, '0'))) {
    return byHex.get(hexClean.padStart(2, '0'));
  }

  // Decimal check e.g. "13", "29"
  if (/^\d{1,3}$/.test(clean)) {
    const num = parseInt(clean, 10);
    if (byCode.has(num)) return byCode.get(num);
  }

  return undefined;
}

/**
 * Universal lookup from a character, numeric code, or token string.
 * Example: getControlCharacterDefinition(13) -> Carriage Return
 * Example: getControlCharacterDefinition("«CR»") -> Carriage Return
 * Example: getControlCharacterDefinition("\r") -> Carriage Return
 */
export function getControlCharacterDefinition(
  charOrCodeOrToken: string | number
): ControlCharacterDefinition | undefined {
  if (typeof charOrCodeOrToken === 'number') {
    return getControlByCode(charOrCodeOrToken);
  }
  if (!charOrCodeOrToken) return undefined;
  if (charOrCodeOrToken.length === 1 && isControlChar(charOrCodeOrToken)) {
    return byCode.get(charOrCodeOrToken.charCodeAt(0));
  }
  return getControlByToken(charOrCodeOrToken);
}

/**
 * Converts a raw semantic character to its canonical editor token «TOKEN».
 * Example: "\r" -> "«CR»", "\x1D" -> "«GS»"
 */
export function controlCharacterToToken(charOrCode: string | number): string {
  const def = getControlCharacterDefinition(charOrCode);
  if (def) return def.editorToken;
  if (typeof charOrCode === 'string' && !isControlChar(charOrCode)) {
    return charOrCode;
  }
  const code = typeof charOrCode === 'number' ? charOrCode : charOrCode.charCodeAt(0);
  return `«0x${code.toString(16).toUpperCase().padStart(2, '0')}»`;
}

/**
 * Converts a token «TOKEN» or <TOKEN> into its real semantic character string, or '' if unknown.
 */
export function tokenToControlCharacter(token: string): string {
  if (!token) return '';
  const def = getControlByToken(token);
  return def ? def.runtimeValue : '';
}

/**
 * Encodes raw control characters into readable «TOKEN» markers for display and editing.
 * Used by the Embedded Data editor, Data Sources tree preview, and property inspectors.
 * Printable Unicode characters (e.g. ₹, €, ©) are preserved untouched.
 */
export function encodeControlCharactersForEditor(raw: string): string {
  if (!raw) return raw ?? '';
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (isControlCode(code)) {
      const def = byCode.get(code);
      out += def ? def.editorToken : `«0x${code.toString(16).toUpperCase().padStart(2, '0')}»`;
    } else {
      out += raw[i];
    }
  }
  return out;
}

/** Alias kept for API symmetry */
export const encodeControlCharacters = encodeControlCharactersForEditor;
export function escapeForDisplay(raw: string): string {
  return encodeControlCharactersForEditor(raw).replace(/«([^»]+)»/g, '<$1>');
}

/**
 * Deterministic Tokenizer & Control Character Decoder
 * ---------------------------------------------------
 * Replaces genuine control character tokens («CR», «LF», «HT», «GS», etc., as well as <CR>, etc.)
 * with their real runtime character values ('\r', '\n', '\t', '\x1D').
 *
 * Rules:
 * - Distinguishes genuine tokens from malformed text (e.g. «NOT_CONTROL» is left untouched).
 * - Distinguishes escaped tokens: \«CR» or \<CR> is unescaped to literal «CR» / <CR> without converting.
 * - Supports both «TOKEN» and <TOKEN> formats for maximum compatibility.
 * - Fully idempotent: strings with raw semantic characters remain untouched.
 */
export function decodeEditorControlCharacters(text: string): string {
  if (!text) return text ?? '';
  if (text.indexOf('«') === -1 && text.indexOf('<') === -1 && text.indexOf('\\') === -1) {
    return text;
  }

  // Matches either:
  // 1. Escaped token: \«...» or \<...>
  // 2. Normal token: «...» or <...>
  return text.replace(
    /(\\)?(«([a-zA-Z0-9_\s\/\+]+)»|<<([a-zA-Z0-9_\s\/\+]+)>>|<([a-zA-Z0-9_\s\/\+]+)>)/g,
    (whole, backslash, token, canonicalInner, doubleInner, legacyInner) => {
      const inner = canonicalInner ?? doubleInner ?? legacyInner;
      // Escaped token: user explicitly typed \«CR» or \<CR> -> return unescaped literal token
      if (backslash) {
        return token;
      }

      // Check for compound CRLF token
      const cleanUpper = inner.trim().toUpperCase();
      if (cleanUpper === 'CRLF' || cleanUpper === 'CR/LF' || cleanUpper === 'CR+LF') {
        return '\r\n';
      }

      const def = getControlByToken(inner);
      if (def) {
        return def.runtimeValue;
      }

      // Not a recognized control token: leave as literal text (e.g. HTML tag <div> or user brackets)
      return whole;
    }
  );
}

/** Standard aliases */
export const decodeControlCharacters = decodeEditorControlCharacters;
export const parseControlCharacters = decodeEditorControlCharacters;
export const resolveControlCharacters = decodeEditorControlCharacters;
export const resolveDataSourceValue = decodeEditorControlCharacters;
export const resolveForRuntime = decodeEditorControlCharacters;

export function resolveStoredControlValue(value: string, encoding?: 'raw' | 'legacy-control-tokens'): string {
  return encoding === 'raw' ? value : decodeEditorControlCharacters(value);
}

/**
 * Normalizes line endings (CRLF -> LF, CR -> LF) to ensure deterministic
 * layout without accidental double blank lines on multi-line text objects.
 */
export function normalizeLineBreaks(text: string): string {
  if (!text) return text ?? '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalizes single-line text by replacing all line breaks (CRLF, CR, LF)
 * with a single space so single-line text objects never break into multiple visual lines.
 */
export function normalizeSingleLineText(text: string): string {
  if (!text) return text ?? '';
  return text.replace(/\r\n|\r|\n/g, ' ');
}

/**
 * Resolves Multi-Line Text Layout Value:
 * 1. Parses any editor representation tokens («CR», <CR>, «LF», <LF>, «CRLF», etc.) into semantic control characters.
 * 2. Normalizes line breaks so CR, LF, and CRLF create expected \n line breaks.
 * 3. Guarantees that literal <CR> or «CR» NEVER appears on the template canvas or in print output.
 * 4. Filters non-printable control characters (like GS) from visible text so no tofu boxes appear.
 */
export function getMultiLineLayoutValue(raw: string): string {
  if (!raw) return '';
  const decoded = decodeEditorControlCharacters(raw);
  const normalized = normalizeLineBreaks(decoded);
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code === 10 || code === 9) {
      // Keep LF (newline) and TAB for visual layout
      out += normalized[i];
    } else if (isControlCode(code)) {
      // Other control characters (e.g. GS, RS, US, NUL) are non-printable in visual text objects
      continue;
    } else {
      out += normalized[i];
    }
  }
  return out;
}

/**
 * Resolves Single-Line Text Layout Value:
 * 1. Parses any editor representation tokens.
 * 2. Normalizes line breaks (CRLF, CR, LF) into spaces so Single Line text strictly remains single-line.
 */
export function getSingleLineLayoutValue(raw: string): string {
  if (!raw) return '';
  const decoded = decodeEditorControlCharacters(raw);
  const normalized = normalizeSingleLineText(decoded);
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code === 9) {
      out += normalized[i];
    } else if (isControlCode(code)) {
      continue;
    } else {
      out += normalized[i];
    }
  }
  return out;
}

/** Alias kept for layout rendering compatibility */
export const escapeForTextRender = getMultiLineLayoutValue;
export const normalizeTextForMultilineLayout = getMultiLineLayoutValue;

/**
 * Pure helper to insert a character or token at a precise selection/cursor position,
 * supporting cursor insertion and selection range replacement.
 */
export function insertControlCharacterAtSelection(
  currentValue: string = '',
  insertText: string = '',
  start?: number,
  end?: number
): { value: string; newCursor: number } {
  const val = currentValue || '';
  const s = Math.max(0, Math.min(start ?? val.length, val.length));
  const e = Math.max(s, Math.min(end ?? val.length, val.length));
  const nextValue = val.substring(0, s) + insertText + val.substring(e);
  const newCursor = s + insertText.length;
  return { value: nextValue, newCursor };
}

/** Standard alias */
export const insertAtSelection = insertControlCharacterAtSelection;

/**
 * Safe Display Formatter for Data Source Labels in Trees and Lists
 * ---------------------------------------------------------------
 * Produces clean, readable labels representing control character tokens (e.g. «CR»).
 * Guarantees that a data source containing only control characters never shows an invisible blank.
 *
 * Example:
 *   Source with value "\r" or "«CR»" -> "«CR»"
 *   Source with value "multi live «CR» text" -> "multi live «CR» text"
 */
export function getDataSourceDisplayPreview(ds: {
  name?: string;
  value?: string;
  type?: string;
  field?: string;
  databaseField?: string;
  controlCode?: string;
  code?: string;
}): string {
  if (!ds) return '';
  if (ds.type === 'control-character') {
    const cCode = ds.controlCode || ds.code || (ds.value ? ds.value.replace(/[«»<>]/g, '') : 'CR');
    return `<${cCode}>`;
  }
  const val = ds.value !== undefined && ds.value !== null ? String(ds.value) : '';
  if (val.length > 0) {
    const trimmed = val.trim();
    if (trimmed === '<CR>' || trimmed === '«CR»') return '<CR>';
    if (trimmed === '<LF>' || trimmed === '«LF»') return '<LF>';
    if (trimmed === '<CRLF>' || trimmed === '«CRLF»') return '<CRLF>';
    const formatted = encodeControlCharactersForEditor(val);
    return formatted;
  }
  if (ds.field || ds.databaseField) return ds.field || ds.databaseField || '';
  if (ds.name) return ds.name;
  return 'Empty';
}

/** Human summary e.g. "Carriage Return («CR») — ASCII 13, Hex 0D". */
export function describeControl(code: number): string {
  const def = byCode.get(code);
  if (!def) return `Control U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  return `${def.name} (${def.editorToken}) — ASCII ${def.decimal}, Hex 0x${def.hex}`;
}
