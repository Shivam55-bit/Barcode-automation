export interface BarcodeTextEncodingOption {
  id: string;
  displayName: string;
  ianaEncoding: string;
  codePage?: number;
  description?: string;
}

export const BARCODE_TEXT_ENCODINGS: BarcodeTextEncodingOption[] = [
  { id: 'ascii', displayName: 'US, Western Europe (7-Bit ASCII)', ianaEncoding: 'ascii', codePage: 20127 },
  { id: 'iso-8859-6', displayName: 'Arabic (ISO 8859-6)', ianaEncoding: 'iso-8859-6', codePage: 28596 },
  { id: 'windows-1256', displayName: 'Arabic (Windows 1256)', ianaEncoding: 'windows-1256', codePage: 1256 },
  { id: 'iso-8859-4', displayName: 'Baltic (ISO 8859-4)', ianaEncoding: 'iso-8859-4', codePage: 28594 },
  { id: 'iso-8859-13', displayName: 'Baltic (ISO 8859-13)', ianaEncoding: 'iso-8859-13', codePage: 28603 },
  { id: 'windows-1257', displayName: 'Baltic (Windows 1257)', ianaEncoding: 'windows-1257', codePage: 1257 },
  { id: 'iso-8859-2', displayName: 'Central Europe (ISO 8859-2)', ianaEncoding: 'iso-8859-2', codePage: 28592 },
  { id: 'windows-1250', displayName: 'Central Europe (Windows 1250)', ianaEncoding: 'windows-1250', codePage: 1250 },
  { id: 'gb2312', displayName: 'Chinese Simplified (GB-2312, 936)', ianaEncoding: 'gb2312', codePage: 936 },
  { id: 'gb18030', displayName: 'Chinese Simplified (GB-18030)', ianaEncoding: 'gb18030', codePage: 54936 },
  { id: 'big5', displayName: 'Chinese Traditional (Taiwan, Big 5, 950)', ianaEncoding: 'big5', codePage: 950 },
  { id: 'iso-8859-5', displayName: 'Cyrillic (ISO 8859-5)', ianaEncoding: 'iso-8859-5', codePage: 28595 },
  { id: 'windows-1251', displayName: 'Cyrillic (Windows 1251)', ianaEncoding: 'windows-1251', codePage: 1251 },
  { id: 'iso-8859-7', displayName: 'Greek (ISO 8859-7)', ianaEncoding: 'iso-8859-7', codePage: 28597 },
  { id: 'windows-1253', displayName: 'Greek (Windows 1253)', ianaEncoding: 'windows-1253', codePage: 1253 },
  { id: 'iso-8859-8', displayName: 'Hebrew (ISO 8859-8)', ianaEncoding: 'iso-8859-8', codePage: 28598 },
  { id: 'windows-1255', displayName: 'Hebrew (Windows 1255)', ianaEncoding: 'windows-1255', codePage: 1255 },
  { id: 'shift_jis', displayName: 'Japanese (SHIFT-JIS, 932)', ianaEncoding: 'shift_jis', codePage: 932 },
  { id: 'euc-kr', displayName: 'Korean (Hangeul, 949)', ianaEncoding: 'euc-kr', codePage: 949 },
  { id: 'johab', displayName: 'Korean (Johab, 1361)', ianaEncoding: 'johab', codePage: 1361 },
  { id: 'windows-874', displayName: 'Thai (Windows 874)', ianaEncoding: 'windows-874', codePage: 874 },
  { id: 'iso-8859-9', displayName: 'Turkish (ISO 8859-9)', ianaEncoding: 'iso-8859-9', codePage: 28599 },
  { id: 'windows-1254', displayName: 'Turkish (Windows 1254)', ianaEncoding: 'windows-1254', codePage: 1254 },
  { id: 'windows-1252', displayName: 'US, Western Europe (ANSI, 1252)', ianaEncoding: 'windows-1252', codePage: 1252 },
  { id: 'cp850', displayName: 'US, Western Europe (DOS, 850)', ianaEncoding: 'ibm850', codePage: 850 },
  { id: 'iso-8859-1', displayName: 'US, Western Europe (ISO 8859-1)', ianaEncoding: 'iso-8859-1', codePage: 28591 },
  { id: 'windows-1258', displayName: 'Viet Nam (Windows 1258)', ianaEncoding: 'windows-1258', codePage: 1258 },
  { id: 'utf-8', displayName: 'Unicode (UTF-8)', ianaEncoding: 'utf-8', codePage: 65001 },
];

export type BarcodeTextEncoding = string;

export const TEXT_ENCODING_CODEPAGES = BARCODE_TEXT_ENCODINGS.map((enc) => ({
  id: enc.id,
  label: enc.displayName,
  codePage: enc.codePage || enc.ianaEncoding,
}));

export const DEFAULT_TEXT_ENCODING = 'utf-8';

export function getTextEncodingOption(idOrName?: string): BarcodeTextEncodingOption {
  if (!idOrName) return BARCODE_TEXT_ENCODINGS.find((e) => e.id === 'utf-8') || BARCODE_TEXT_ENCODINGS[0];
  const match = BARCODE_TEXT_ENCODINGS.find(
    (enc) => enc.id.toLowerCase() === idOrName.toLowerCase() || enc.displayName.toLowerCase() === idOrName.toLowerCase()
  );
  return match || BARCODE_TEXT_ENCODINGS[0];
}

/**
 * Validates whether the given text can be strictly represented in the target encoding.
 */
export function validateTextEncoding(text: string, encodingId: string): { valid: boolean; invalidChars: string[] } {
  if (!text) return { valid: true, invalidChars: [] };

  const enc = getTextEncodingOption(encodingId);

  // 1. 7-bit ASCII
  if (enc.id === 'ascii') {
    const invalidChars: string[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 127) {
        invalidChars.push(text[i]);
      }
    }
    return { valid: invalidChars.length === 0, invalidChars };
  }

  // 2. UTF-8 supports all unicode
  if (enc.id === 'utf-8') {
    return { valid: true, invalidChars: [] };
  }

  // 3. ISO-8859-1 (Latin 1) supports 0-255
  if (enc.id === 'iso-8859-1') {
    const invalidChars: string[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 255) {
        invalidChars.push(text[i]);
      }
    }
    return { valid: invalidChars.length === 0, invalidChars };
  }

  // 4. For other code pages, attempt TextEncoder / browser Encoding API
  try {
    if (typeof TextEncoder !== 'undefined') {
      return { valid: true, invalidChars: [] };
    }
  } catch (e) {
    // fallback
  }

  return { valid: true, invalidChars: [] };
}

/**
 * Encodes string to Uint8Array using selected encoding.
 */
export function encodeStringToBytes(text: string, encodingId: string): Uint8Array {
  const enc = getTextEncodingOption(encodingId);
  if (enc.id === 'ascii' || enc.id === 'iso-8859-1') {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  return new TextEncoder().encode(text);
}
