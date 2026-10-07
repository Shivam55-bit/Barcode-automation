/**
 * Document Format Detection Engine
 * Authoritative detector for BarcodeFlow documents vs BarTender vs JSON vs Unknown.
 * Guarantees that binary or non-JSON files (.btw) are NEVER passed to JSON.parse.
 */

export type DocumentFormatCategory =
  | 'BARCODEFLOW_NATIVE' // .bfl or JSON with BarcodeFlowDocument schema
  | 'BARTENDER_BTW'      // .btw BarTender document
  | 'JSON'               // Raw legacy LabelTemplate JSON (.json)
  | 'UNKNOWN';           // Unsupported formats

export interface DocumentFormatDetectionResult {
  format: DocumentFormatCategory;
  extension: string;
  filePath: string;
  isBinary: boolean;
  canParseDirectlyAsJson: boolean;
  mimeType?: string;
  magicHeader?: string;
  details?: string;
}

/**
 * Inspects a file path and its optional initial byte buffer or string content
 * to determine the exact document format category without throwing syntax errors.
 */
export function detectDocumentFormat(
  filePath: string,
  contentOrBuffer?: string | Buffer | Uint8Array
): DocumentFormatDetectionResult {
  const normalizedPath = (filePath || '').trim();
  const ext = normalizedPath.includes('.')
    ? '.' + normalizedPath.split('.').pop()!.toLowerCase()
    : '';

  // 1. Explicit .btw extension
  if (ext === '.btw') {
    return {
      format: 'BARTENDER_BTW',
      extension: ext,
      filePath: normalizedPath,
      isBinary: true,
      canParseDirectlyAsJson: false,
      mimeType: 'application/x-bartender-btw',
      details: 'BarTender Label Format Document (.btw)',
    };
  }

  // 2. Buffer/Binary Magic Inspection (if content provided)
  if (contentOrBuffer) {
    if (typeof contentOrBuffer === 'object' && typeof (contentOrBuffer as any).slice !== 'function') {
      const obj = contentOrBuffer as any;
      if (obj.format === 'BarcodeFlowDocument' || obj.format === 'BarTenderDocument' || ext === '.bfl') {
        return {
          format: 'BARCODEFLOW_NATIVE',
          extension: ext || '.bfl',
          filePath: normalizedPath,
          isBinary: false,
          canParseDirectlyAsJson: true,
          details: 'Native BarcodeFlow Document Object',
        };
      }
      if (obj.elements || ext === '.json') {
        return {
          format: 'JSON',
          extension: ext || '.json',
          filePath: normalizedPath,
          isBinary: false,
          canParseDirectlyAsJson: true,
          details: 'BarcodeFlow Template JSON Object',
        };
      }
    }

    let isBinary = false;
    let headerStr = '';

    if (typeof contentOrBuffer === 'string') {
      headerStr = contentOrBuffer.substring(0, 128);
      // Check for binary control characters (null bytes, non-printables)
      for (let i = 0; i < Math.min(contentOrBuffer.length, 64); i++) {
        const code = contentOrBuffer.charCodeAt(i);
        if (code === 0 || (code < 9 && code !== 0) || (code > 13 && code < 32 && code !== 27)) {
          isBinary = true;
          break;
        }
      }
    } else if (contentOrBuffer && typeof contentOrBuffer.slice === 'function') {
      const len = Math.min(contentOrBuffer.length, 128);
      const buf = Buffer.from(contentOrBuffer.slice(0, len));
      headerStr = buf.toString('utf-8', 0, len);

      // Check for OLE compound file header: D0 CF 11 E0 A1 B1 1A E1
      if (
        buf.length >= 8 &&
        buf[0] === 0xd0 &&
        buf[1] === 0xcf &&
        buf[2] === 0x11 &&
        buf[3] === 0xe0
      ) {
        return {
          format: 'BARTENDER_BTW',
          extension: ext || '.btw',
          filePath: normalizedPath,
          isBinary: true,
          canParseDirectlyAsJson: false,
          magicHeader: 'OLE_COMPOUND_DOCUMENT',
          details: 'Microsoft Compound OLE / BarTender Binary Document',
        };
      }

      // Check binary bytes
      for (let i = 0; i < Math.min(buf.length, 64); i++) {
        if (buf[i] === 0) {
          isBinary = true;
          break;
        }
      }
    }

    // Check the verified BTW file signature, not strings inside JSON metadata.
    if (/^\s*Bar Tender Format File(?:\s|$)/.test(headerStr)) {
      return {
        format: 'BARTENDER_BTW',
        extension: ext || '.btw',
        filePath: normalizedPath,
        isBinary: true,
        canParseDirectlyAsJson: false,
        details: 'BarTender Document Header Signature',
      };
    }

    if (isBinary) {
      return {
        format: 'UNKNOWN',
        extension: ext,
        filePath: normalizedPath,
        isBinary: true,
        canParseDirectlyAsJson: false,
        details: 'Binary document with unrecognized format',
      };
    }

    // Textual JSON format checking
    const trimmed = headerStr.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      if (trimmed.includes('"BarcodeFlowDocument"') || ext === '.bfl') {
        return {
          format: 'BARCODEFLOW_NATIVE',
          extension: ext || '.bfl',
          filePath: normalizedPath,
          isBinary: false,
          canParseDirectlyAsJson: true,
          details: 'Native BarcodeFlow Document (.bfl)',
        };
      }
      return {
        format: 'JSON',
        extension: ext || '.json',
        filePath: normalizedPath,
        isBinary: false,
        canParseDirectlyAsJson: true,
        details: 'BarcodeFlow Template JSON',
      };
    }
  }

  // 3. Extension-based categorization
  if (ext === '.bfl') {
    return {
      format: 'BARCODEFLOW_NATIVE',
      extension: ext,
      filePath: normalizedPath,
      isBinary: false,
      canParseDirectlyAsJson: true,
      details: 'Native BarcodeFlow Document (.bfl)',
    };
  }

  if (ext === '.json') {
    return {
      format: 'JSON',
      extension: ext,
      filePath: normalizedPath,
      isBinary: false,
      canParseDirectlyAsJson: true,
      details: 'JSON Template File (.json)',
    };
  }

  return {
    format: 'UNKNOWN',
    extension: ext,
    filePath: normalizedPath,
    isBinary: false,
    canParseDirectlyAsJson: false,
    details: `Unsupported file extension "${ext || 'none'}"`,
  };
}
