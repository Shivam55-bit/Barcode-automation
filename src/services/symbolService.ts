/**
 * Symbol & Control Character Service
 * Manages Unicode blocks, subsets, names, ASCII control codes, and recently used symbols.
 */

export interface UnicodeSubset {
  id: string;
  name: string;
  start: number;
  end: number;
}

export interface ControlCharacterInfo {
  code: number;
  hex: string;
  name: string;
  abbr: string;
  description: string;
  barcodeUsage?: string;
  char: string;
}

export const UNICODE_SUBSETS: UnicodeSubset[] = [
  { id: 'basic_latin', name: 'Basic Latin (ASCII)', start: 0x0020, end: 0x007E },
  { id: 'latin1_supp', name: 'Latin-1 Supplement', start: 0x00A0, end: 0x00FF },
  { id: 'latin_ext_a', name: 'Latin Extended-A', start: 0x0100, end: 0x017F },
  { id: 'latin_ext_b', name: 'Latin Extended-B', start: 0x0180, end: 0x024F },
  { id: 'ipa_ext', name: 'IPA Extensions', start: 0x0250, end: 0x02AF },
  { id: 'greek_coptic', name: 'Greek and Coptic', start: 0x0370, end: 0x03FF },
  { id: 'cyrillic', name: 'Cyrillic', start: 0x0400, end: 0x04FF },
  { id: 'devanagari', name: 'Devanagari (Hindi / Indian)', start: 0x0900, end: 0x097F },
  { id: 'general_punct', name: 'General Punctuation', start: 0x2000, end: 0x206F },
  { id: 'super_sub', name: 'Superscripts and Subscripts', start: 0x2070, end: 0x209F },
  { id: 'currency', name: 'Currency Symbols', start: 0x20A0, end: 0x20CF },
  { id: 'letterlike', name: 'Letterlike Symbols', start: 0x2100, end: 0x214F },
  { id: 'number_forms', name: 'Number Forms', start: 0x2150, end: 0x218F },
  { id: 'arrows', name: 'Arrows', start: 0x2190, end: 0x21FF },
  { id: 'math_operators', name: 'Mathematical Operators', start: 0x2200, end: 0x22FF },
  { id: 'misc_technical', name: 'Miscellaneous Technical', start: 0x2300, end: 0x23FF },
  { id: 'box_drawing', name: 'Box Drawing', start: 0x2500, end: 0x257F },
  { id: 'block_elements', name: 'Block Elements', start: 0x2580, end: 0x259F },
  { id: 'geometric_shapes', name: 'Geometric Shapes', start: 0x25A0, end: 0x25FF },
  { id: 'misc_symbols', name: 'Miscellaneous Symbols', start: 0x2600, end: 0x26FF },
  { id: 'dingbats', name: 'Dingbats', start: 0x2700, end: 0x27BF },
];

export const AVAILABLE_FONTS: string[] = [
  'Arial',
  'Calibri',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Consolas',
  'Trebuchet MS',
  'Comic Sans MS',
  'Nirmala UI',
  'Arial Unicode MS',
  'System Default'
];

export const COMMON_UNICODE_NAMES: Record<number, string> = {
  0x0020: 'SPACE',
  0x0021: 'EXCLAMATION MARK',
  0x0022: 'QUOTATION MARK',
  0x0023: 'NUMBER SIGN',
  0x0024: 'DOLLAR SIGN',
  0x0025: 'PERCENT SIGN',
  0x0026: 'AMPERSAND',
  0x0027: 'APOSTROPHE',
  0x0028: 'LEFT PARENTHESIS',
  0x0029: 'RIGHT PARENTHESIS',
  0x002A: 'ASTERISK',
  0x002B: 'PLUS SIGN',
  0x002C: 'COMMA',
  0x002D: 'HYPHEN-MINUS',
  0x002E: 'FULL STOP',
  0x002F: 'SOLIDUS',
  0x00A0: 'NO-BREAK SPACE',
  0x00A1: 'INVERTED EXCLAMATION MARK',
  0x00A2: 'CENT SIGN',
  0x00A3: 'POUND SIGN',
  0x00A4: 'CURRENCY SIGN',
  0x00A5: 'YEN SIGN',
  0x00A6: 'BROKEN BAR',
  0x00A7: 'SECTION SIGN',
  0x00A8: 'DIAERESIS',
  0x00A9: 'COPYRIGHT SIGN',
  0x00AA: 'FEMININE ORDINAL INDICATOR',
  0x00AB: 'LEFT-POINTING DOUBLE ANGLE QUOTATION MARK',
  0x00AC: 'NOT SIGN',
  0x00AD: 'SOFT HYPHEN',
  0x00AE: 'REGISTERED SIGN',
  0x00AF: 'MACRON',
  0x00B0: 'DEGREE SIGN',
  0x00B1: 'PLUS-MINUS SIGN',
  0x00B2: 'SUPERSCRIPT TWO',
  0x00B3: 'SUPERSCRIPT THREE',
  0x00B4: 'ACUTE ACCENT',
  0x00B5: 'MICRO SIGN',
  0x00B6: 'PILCROW SIGN (PARAGRAPH SIGN)',
  0x00B7: 'MIDDLE DOT',
  0x00B8: 'CEDILLA',
  0x00B9: 'SUPERSCRIPT ONE',
  0x00BA: 'MASCULINE ORDINAL INDICATOR',
  0x00BB: 'RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK',
  0x00BC: 'VULGAR FRACTION ONE QUARTER',
  0x00BD: 'VULGAR FRACTION ONE HALF',
  0x00BE: 'VULGAR FRACTION THREE QUARTERS',
  0x00BF: 'INVERTED QUESTION MARK',
  0x00D7: 'MULTIPLICATION SIGN',
  0x00F7: 'DIVISION SIGN',
  0x2013: 'EN DASH',
  0x2014: 'EM DASH',
  0x2018: 'LEFT SINGLE QUOTATION MARK',
  0x2019: 'RIGHT SINGLE QUOTATION MARK',
  0x201C: 'LEFT DOUBLE QUOTATION MARK',
  0x201D: 'RIGHT DOUBLE QUOTATION MARK',
  0x2020: 'DAGGER',
  0x2021: 'DOUBLE DAGGER',
  0x2022: 'BULLET',
  0x2026: 'HORIZONTAL ELLIPSIS',
  0x20AC: 'EURO SIGN',
  0x20B9: 'INDIAN RUPEE SIGN',
  0x2122: 'TRADE MARK SIGN',
  0x2190: 'LEFTWARDS ARROW',
  0x2191: 'UPWARDS ARROW',
  0x2192: 'RIGHTWARDS ARROW',
  0x2193: 'DOWNWARDS ARROW',
  0x2194: 'LEFT RIGHT ARROW',
  0x21D2: 'RIGHTWARDS DOUBLE ARROW',
  0x2202: 'PARTIAL DIFFERENTIAL',
  0x2205: 'EMPTY SET',
  0x2208: 'ELEMENT OF',
  0x2211: 'N-ARY SUMMATION',
  0x2212: 'MINUS SIGN',
  0x221A: 'SQUARE ROOT',
  0x221E: 'INFINITY',
  0x2248: 'ALMOST EQUAL TO',
  0x2260: 'NOT EQUAL TO',
  0x2264: 'LESS-THAN OR EQUAL TO',
  0x2265: 'GREATER-THAN OR EQUAL TO',
  0x25A0: 'BLACK SQUARE',
  0x25A1: 'WHITE SQUARE',
  0x25B2: 'BLACK UP-POINTING TRIANGLE',
  0x25BC: 'BLACK DOWN-POINTING TRIANGLE',
  0x25CF: 'BLACK CIRCLE',
  0x25CB: 'WHITE CIRCLE',
  0x2605: 'BLACK STAR',
  0x2606: 'WHITE STAR',
  0x2611: 'BALLOT BOX WITH CHECK',
  0x26A0: 'WARNING SIGN',
  0x2713: 'CHECK MARK',
  0x2714: 'HEAVY CHECK MARK',
  0x2717: 'BALLOT X',
  0x2718: 'HEAVY BALLOT X'
};

export const CONTROL_CHARACTERS: ControlCharacterInfo[] = [
  { code: 0, hex: '00', abbr: 'NUL', name: 'Null', description: 'Null character, fills space or ends string', char: '\x00' },
  { code: 1, hex: '01', abbr: 'SOH', name: 'Start of Heading', description: 'First character of a message header', char: '\x01' },
  { code: 2, hex: '02', abbr: 'STX', name: 'Start of Text', description: 'Terminates header and starts text body', char: '\x02' },
  { code: 3, hex: '03', abbr: 'ETX', name: 'End of Text', description: 'Terminates text body', char: '\x03' },
  { code: 4, hex: '04', abbr: 'EOT', name: 'End of Transmission', description: 'Indicates end of transmission data', char: '\x04' },
  { code: 5, hex: '05', abbr: 'ENQ', name: 'Enquiry', description: 'Request for response from receiver', char: '\x05' },
  { code: 6, hex: '06', abbr: 'ACK', name: 'Acknowledge', description: 'Affirmative response / handshake', char: '\x06' },
  { code: 7, hex: '07', abbr: 'BEL', name: 'Bell', description: 'Audible or visual alarm/beep', char: '\x07' },
  { code: 8, hex: '08', abbr: 'BS', name: 'Backspace', description: 'Moves cursor backward one space', char: '\x08' },
  { code: 9, hex: '09', abbr: 'HT', name: 'Horizontal Tab', description: 'Advances cursor to next tab stop', char: '\t' },
  { code: 10, hex: '0A', abbr: 'LF', name: 'Line Feed', description: 'Advances cursor to next line', char: '\n' },
  { code: 11, hex: '0B', abbr: 'VT', name: 'Vertical Tab', description: 'Advances cursor to next vertical tab', char: '\x0B' },
  { code: 12, hex: '0C', abbr: 'FF', name: 'Form Feed', description: 'Page eject / advances to next page/label', char: '\x0C' },
  { code: 13, hex: '0D', abbr: 'CR', name: 'Carriage Return', description: 'Returns cursor to start of line', char: '\r' },
  { code: 14, hex: '0E', abbr: 'SO', name: 'Shift Out', description: 'Switches to alternate character set', char: '\x0E' },
  { code: 15, hex: '0F', abbr: 'SI', name: 'Shift In', description: 'Switches back to standard character set', char: '\x0F' },
  { code: 16, hex: '10', abbr: 'DLE', name: 'Data Link Escape', description: 'Modifies meaning of following characters', char: '\x10' },
  { code: 17, hex: '11', abbr: 'DC1', name: 'Device Control 1 (XON)', description: 'Flow control resume transmission', char: '\x11' },
  { code: 18, hex: '12', abbr: 'DC2', name: 'Device Control 2', description: 'Special peripheral device control', char: '\x12' },
  { code: 19, hex: '13', abbr: 'DC3', name: 'Device Control 3 (XOFF)', description: 'Flow control pause transmission', char: '\x13' },
  { code: 20, hex: '14', abbr: 'DC4', name: 'Device Control 4', description: 'Special peripheral device control', char: '\x14' },
  { code: 21, hex: '15', abbr: 'NAK', name: 'Negative Acknowledge', description: 'Negative response from receiving station', char: '\x15' },
  { code: 22, hex: '16', abbr: 'SYN', name: 'Synchronous Idle', description: 'Synchronous transmission signal', char: '\x16' },
  { code: 23, hex: '17', abbr: 'ETB', name: 'End of Trans. Block', description: 'Indicates end of a block of data', char: '\x17' },
  { code: 24, hex: '18', abbr: 'CAN', name: 'Cancel', description: 'Indicates that previous data is error', char: '\x18' },
  { code: 25, hex: '19', abbr: 'EM', name: 'End of Medium', description: 'Indicates physical end of medium/tape', char: '\x19' },
  { code: 26, hex: '1A', abbr: 'SUB', name: 'Substitute', description: 'Substitute for invalid/corrupted character', char: '\x1A' },
  { code: 27, hex: '1B', abbr: 'ESC', name: 'Escape', description: 'Prefix for printer commands / sequences', char: '\x1B' },
  { code: 28, hex: '1C', abbr: 'FS', name: 'File Separator', description: 'Information separator 4', char: '\x1C' },
  { 
    code: 29, 
    hex: '1D', 
    abbr: 'GS', 
    name: 'Group Separator', 
    description: 'Information separator 3', 
    barcodeUsage: 'ASCII GS payload; distinct from a symbology-specific FNC1 instruction',
    char: '\x1D' 
  },
  { code: 30, hex: '1E', abbr: 'RS', name: 'Record Separator', description: 'Information separator 2 (Used in ISO/IEC 15434 format headers)', char: '\x1E' },
  { code: 31, hex: '1F', abbr: 'US', name: 'Unit Separator', description: 'Information separator 1 (Field separator)', char: '\x1F' },
  { code: 127, hex: '7F', abbr: 'DEL', name: 'Delete', description: 'Erase or delete character', char: '\x7F' },
];

export const DEFAULT_RECENT_SYMBOLS = [
  '«CR»', '«LF»', '«GS»', '€', '£', '¥', '₹', '©', '®', '™', '·', '§', '†', '‡', '¶', '«', '»', '¼', '½', '¾', '°', '±', '≤', '≥'
];

const RECENT_SYMBOLS_STORAGE_KEY = 'barcodeflow_recent_symbols';

/**
 * Get recently used symbols and control character tokens from localStorage
 */
export function getRecentSymbols(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SYMBOLS_STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_SYMBOLS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load recent symbols from storage', err);
  }
  return DEFAULT_RECENT_SYMBOLS;
}

/**
 * Add a symbol or control character token to the front of recently used items
 */
export function addRecentSymbol(charOrToken: string): string[] {
  if (!charOrToken) return getRecentSymbols();
  try {
    const recents = getRecentSymbols().filter((c) => c !== charOrToken);
    const updated = [charOrToken, ...recents].slice(0, 30);
    localStorage.setItem(RECENT_SYMBOLS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save recent symbol', err);
    return DEFAULT_RECENT_SYMBOLS;
  }
}

/**
 * Get the descriptive name of a Unicode character or code point
 */
export function getCharacterName(charOrCode: string | number): string {
  let code = 0;
  if (typeof charOrCode === 'number') {
    code = charOrCode;
  } else if (typeof charOrCode === 'string' && charOrCode.length > 0) {
    code = charOrCode.codePointAt(0) || 0;
  }

  if (COMMON_UNICODE_NAMES[code]) {
    return COMMON_UNICODE_NAMES[code];
  }

  // Check Control Characters
  const ctrl = CONTROL_CHARACTERS.find((c) => c.code === code);
  if (ctrl) {
    return `${ctrl.name} (${ctrl.abbr})`;
  }

  // Fallback heuristic based on Unicode standard blocks
  if (code >= 0x0041 && code <= 0x005A) {
    return `LATIN CAPITAL LETTER ${String.fromCodePoint(code)}`;
  }
  if (code >= 0x0061 && code <= 0x007A) {
    return `LATIN SMALL LETTER ${String.fromCodePoint(code).toUpperCase()}`;
  }
  if (code >= 0x0030 && code <= 0x0039) {
    return `DIGIT ${String.fromCodePoint(code)}`;
  }
  if (code >= 0x0900 && code <= 0x097F) {
    return `DEVANAGARI CHARACTER U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  }

  return `UNICODE CHARACTER U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Convert Unicode code point to 4-digit hex string
 */
export function getUnicodeHex(charOrCode: string | number): string {
  let code = 0;
  if (typeof charOrCode === 'number') {
    code = charOrCode;
  } else if (typeof charOrCode === 'string' && charOrCode.length > 0) {
    code = charOrCode.codePointAt(0) || 0;
  }
  return code.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parse a hex or U+ hex string to a character string
 */
export function parseUnicodeInput(input: string): { valid: boolean; char?: string; code?: number } {
  if (!input) return { valid: false };
  const clean = input.trim().replace(/^U\+/i, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{1,6}$/.test(clean)) {
    return { valid: false };
  }
  const code = parseInt(clean, 16);
  if (isNaN(code) || code < 0 || code > 0x10ffff) {
    return { valid: false };
  }
  try {
    const char = String.fromCodePoint(code);
    return { valid: true, char, code };
  } catch {
    return { valid: false };
  }
}
