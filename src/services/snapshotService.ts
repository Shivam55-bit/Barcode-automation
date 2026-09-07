import { LabelTemplate, LabelElement, TemplateVersionSnapshot, VersionDiffResult, CanvasAnnotation, ApprovalTierRecord } from '../types';
import { renderBarcodeToCanvas } from './barcodeEngine';
import { evaluateElementData } from './dataSourceEngine';

/**
 * Calculates SHA-256 cryptographic hash of any object or string
 */
export async function calculateSha256(data: any): Promise<string> {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(jsonStr);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback simple checksum if WebCrypto unavailable
  let hash = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'chk_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Calculates a quick human-readable short checksum
 */
export function calculateShortChecksum(template: LabelTemplate): string {
  const content = `${template.id}:${template.version}:${template.elements.length}:${template.dimensions.width}x${template.dimensions.height}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 31 + content.charCodeAt(i)) % 1000000007;
  }
  return `CRC32-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Extracts clean object tree with lock & editable states
 */
export function extractObjectTree(elements: LabelElement[]) {
  return elements.map((el) => ({
    id: el.id,
    name: el.name,
    type: el.type,
    locked: !!el.locked,
    editable: el.locked ? false : el.editable !== undefined ? el.editable : el.isEditable !== undefined ? el.isEditable : true,
    position: {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation || 0,
    },
    zIndex: el.zIndex,
  }));
}

/**
 * Extracts granular properties of all elements
 */
export function extractObjectProperties(elements: LabelElement[]): Record<string, any> {
  const propMap: Record<string, any> = {};
  for (const el of elements) {
    propMap[el.id] = {
      name: el.name,
      type: el.type,
      locked: !!el.locked,
      editable: el.locked ? false : el.editable !== undefined ? el.editable : true,
      allowMove: el.allowMove !== false,
      allowResize: el.allowResize !== false,
      allowRotate: el.allowRotate !== false,
      allowDelete: el.allowDelete !== false,
      allowContentEdit: el.allowContentEdit !== false,
      allowPropertyEdit: el.allowPropertyEdit !== false,
      allowVariableEdit: el.allowVariableEdit !== false,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation || 0,
      opacity: el.opacity,
      zIndex: el.zIndex,
      ...(el.type === 'text' ? {
        text: (el as any).text,
        fontFamily: (el as any).fontFamily,
        fontSize: (el as any).fontSize,
        fontWeight: (el as any).fontWeight,
        color: (el as any).color,
        textAlign: (el as any).textAlign,
        dataBinding: (el as any).dataBinding,
      } : {}),
      ...(el.type === 'barcode' ? {
        symbology: (el as any).symbology,
        value: (el as any).value,
        dataBinding: (el as any).dataBinding,
        includeText: (el as any).includeText,
        barWidth: (el as any).barWidth,
        barHeight: (el as any).barHeight,
      } : {}),
      ...(el.type === 'shape' ? {
        shapeType: (el as any).shapeType,
        fillColor: (el as any).fillColor,
        strokeColor: (el as any).strokeColor,
        strokeWidth: (el as any).strokeWidth,
        cornerRadius: (el as any).cornerRadius,
      } : {}),
      ...(el.type === 'image' ? {
        src: (el as any).src ? '[Image Data Present]' : 'empty',
        objectFit: (el as any).objectFit,
      } : {}),
    };
  }
  return propMap;
}

/**
 * Extracts variable mappings
 */
export function extractVariableMapping(template: LabelTemplate): Record<string, { type: any; defaultValue: string; dataBinding?: string }> {
  const map: Record<string, { type: any; defaultValue: string; dataBinding?: string }> = {};
  if (template.variables) {
    for (const v of template.variables) {
      map[v.name] = {
        type: v.type,
        defaultValue: v.defaultValue,
      };
    }
  }
  for (const el of template.elements) {
    if ((el as any).dataBinding) {
      const bindingKey = (el as any).dataBinding.replace(/[{}]/g, '').trim();
      if (!map[bindingKey]) {
        map[bindingKey] = {
          type: 'static',
          defaultValue: (el as any).text || (el as any).value || '',
          dataBinding: (el as any).dataBinding,
        };
      }
    }
  }
  return map;
}

/**
 * Generates an SVG snapshot of the template
 */
export function generateSvgSnapshot(template: LabelTemplate, record: Record<string, string> = {}): string {
  const w = template.dimensions.width;
  const h = template.dimensions.height;
  const elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  let svgElements = '';
  for (const el of elements) {
    if (!el.visible) continue;
    const content = evaluateElementData(el, { record });
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const transform = el.rotation ? `transform="rotate(${el.rotation} ${cx} ${cy})"` : '';

    if (el.type === 'text') {
      const textEl = el as any;
      const fontSizeMm = (textEl.fontSize || 10) * 0.352778; // pt to mm
      svgElements += `<text x="${el.x}" y="${el.y + fontSizeMm}" font-family="${textEl.fontFamily || 'Arial'}" font-size="${fontSizeMm}px" font-weight="${textEl.fontWeight || 'normal'}" fill="${textEl.color || '#000000'}" opacity="${el.opacity ?? 1}" ${transform}>${escapeXml(content)}</text>\n`;
    } else if (el.type === 'shape') {
      const shapeEl = el as any;
      if (shapeEl.shapeType === 'rectangle') {
        svgElements += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${shapeEl.cornerRadius || 0}" fill="${shapeEl.fillColor || 'none'}" stroke="${shapeEl.strokeColor || '#000'}" stroke-width="${shapeEl.strokeWidth || 0.5}" opacity="${el.opacity ?? 1}" ${transform}/>\n`;
      } else if (shapeEl.shapeType === 'circle' || shapeEl.shapeType === 'ellipse') {
        svgElements += `<ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${shapeEl.fillColor || 'none'}" stroke="${shapeEl.strokeColor || '#000'}" stroke-width="${shapeEl.strokeWidth || 0.5}" opacity="${el.opacity ?? 1}" ${transform}/>\n`;
      } else if (shapeEl.shapeType === 'line') {
        svgElements += `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${shapeEl.strokeColor || '#000'}" stroke-width="${shapeEl.strokeWidth || 0.5}" opacity="${el.opacity ?? 1}" ${transform}/>\n`;
      }
    } else if (el.type === 'barcode') {
      svgElements += `<g ${transform} opacity="${el.opacity ?? 1}"><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3"/><text x="${cx}" y="${cy}" font-family="monospace" font-size="2.5px" text-anchor="middle" fill="#0f172a">||| ${(el as any).symbology}: ${escapeXml(content)} |||</text></g>\n`;
    } else if (el.type === 'image' && (el as any).src) {
      svgElements += `<image href="${(el as any).src}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity ?? 1}" ${transform}/>\n`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" style="background:#ffffff">\n${svgElements}</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a high-resolution PNG snapshot data URL
 */
export async function generatePngSnapshot(template: LabelTemplate, record: Record<string, string> = {}): Promise<string> {
  const dpmm = 12; // 300 DPI = ~11.81 dpmm
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(template.dimensions.width * dpmm);
  canvas.height = Math.round(template.dimensions.height * dpmm);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  for (const el of elements) {
    if (!el.visible) continue;
    const evaluated = evaluateElementData(el, { record });
    const xPx = el.x * dpmm;
    const yPx = el.y * dpmm;
    const wPx = el.width * dpmm;
    const hPx = el.height * dpmm;

    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;

    // Rotation around center
    if (el.rotation) {
      ctx.translate(xPx + wPx / 2, yPx + hPx / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-(xPx + wPx / 2), -(yPx + hPx / 2));
    }

    if (el.type === 'shape') {
      const shape = el as any;
      ctx.fillStyle = shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : 'transparent';
      ctx.strokeStyle = shape.strokeColor && shape.strokeColor !== 'transparent' ? shape.strokeColor : '#000000';
      ctx.lineWidth = (shape.strokeWidth || 0.5) * dpmm;

      if (shape.shapeType === 'rectangle') {
        const radius = (shape.cornerRadius || 0) * dpmm;
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(xPx, yPx, wPx, hPx, radius);
          if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
          if (shape.strokeColor && shape.strokeColor !== 'transparent') ctx.stroke();
        } else {
          if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fillRect(xPx, yPx, wPx, hPx);
          if (shape.strokeColor && shape.strokeColor !== 'transparent') ctx.strokeRect(xPx, yPx, wPx, hPx);
        }
      } else if (shape.shapeType === 'circle' || shape.shapeType === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(xPx + wPx / 2, yPx + hPx / 2, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        if (shape.strokeColor && shape.strokeColor !== 'transparent') ctx.stroke();
      } else if (shape.shapeType === 'line') {
        ctx.beginPath();
        ctx.moveTo(xPx, yPx);
        ctx.lineTo(xPx + wPx, yPx + hPx);
        ctx.stroke();
      }
    } else if (el.type === 'text') {
      const textEl = el as any;
      const fontSizePx = textEl.fontSize * (dpmm / 3.78) * 1.25;
      ctx.font = `${textEl.fontStyle === 'italic' ? 'italic ' : ''}${textEl.fontWeight || 'normal'} ${fontSizePx}px ${textEl.fontFamily || 'Arial, sans-serif'}`;
      ctx.fillStyle = textEl.color || '#000000';
      ctx.textAlign = textEl.textAlign === 'center' ? 'center' : textEl.textAlign === 'right' ? 'right' : 'left';
      ctx.textBaseline = textEl.verticalAlign === 'middle' ? 'middle' : textEl.verticalAlign === 'bottom' ? 'bottom' : 'top';
      
      const drawX = textEl.textAlign === 'center' ? xPx + wPx / 2 : textEl.textAlign === 'right' ? xPx + wPx : xPx;
      const drawY = textEl.verticalAlign === 'middle' ? yPx + hPx / 2 : textEl.verticalAlign === 'bottom' ? yPx + hPx : yPx;
      ctx.fillText(evaluated, drawX, drawY);
    } else if (el.type === 'barcode') {
      try {
        const barcodeCanvas = document.createElement('canvas');
        await renderBarcodeToCanvas(barcodeCanvas, el as any, 4, { record });
        ctx.drawImage(barcodeCanvas, xPx, yPx, wPx, hPx);
      } catch (err) {
        ctx.strokeStyle = '#dc2626';
        ctx.strokeRect(xPx, yPx, wPx, hPx);
      }
    } else if (el.type === 'image' && (el as any).src) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = (el as any).src;
        await new Promise((resolve) => {
          if (img.complete) return resolve(true);
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        });
        ctx.drawImage(img, xPx, yPx, wPx, hPx);
      } catch {
        // ignore image error
      }
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Creates a complete immutable TemplateVersionSnapshot
 */
export async function createTemplateSnapshot(
  template: LabelTemplate,
  submittedBy: string,
  comments: string = 'Submitted for Regulatory QA Review'
): Promise<TemplateVersionSnapshot> {
  const snapshotJson = JSON.parse(JSON.stringify(template));
  const hash = await calculateSha256(snapshotJson);
  const checksum = calculateShortChecksum(template);
  const svgSnapshot = generateSvgSnapshot(template);
  let pngSnapshot = '';
  try {
    pngSnapshot = await generatePngSnapshot(template);
  } catch (err) {
    console.warn('PNG Snapshot fallback to SVG data url:', err);
    pngSnapshot = `data:image/svg+xml;utf8,${encodeURIComponent(svgSnapshot)}`;
  }

  const initialTimeline: ApprovalTierRecord[] = [
    {
      id: `apr-${Date.now()}-1`,
      level: 1,
      role: 'Approver Level 1',
      status: 'pending',
    },
    {
      id: `apr-${Date.now()}-2`,
      level: 2,
      role: 'Approver Level 2',
      status: 'pending',
    },
  ];

  return {
    id: `snap-${template.id}-v${template.version}-${Date.now()}`,
    version: template.version,
    templateId: template.id,
    templateName: template.name,
    snapshotJson,
    canvasJson: {
      dimensions: template.dimensions,
      margins: template.margins,
      sheetGrid: template.sheetGrid,
      scaleDpi: template.dimensions.dpi || 300,
      elementCount: template.elements.length,
    },
    svgSnapshot,
    pngSnapshot,
    objectTree: extractObjectTree(template.elements),
    objectProperties: extractObjectProperties(template.elements),
    variableMapping: extractVariableMapping(template),
    hash,
    checksum,
    status: 'pending_level_1',
    submittedBy,
    submittedAt: new Date().toISOString(),
    approvalTimeline: initialTimeline,
    annotations: [],
    comments: [
      {
        id: `cm-${Date.now()}`,
        author: submittedBy,
        authorRole: 'Label Designer',
        content: comments,
        createdAt: new Date().toISOString(),
        statusChange: 'pending_level_1',
      },
    ],
  };
}

/**
 * Compares two template snapshots and returns comprehensive diff
 */
export function compareTemplateSnapshots(
  templateA: LabelTemplate,
  templateB: LabelTemplate
): VersionDiffResult {
  const elementsA = templateA.elements || [];
  const elementsB = templateB.elements || [];

  const mapA = new Map(elementsA.map((el) => [el.id, el]));
  const mapB = new Map(elementsB.map((el) => [el.id, el]));

  const addedElements = elementsB.filter((el) => !mapA.has(el.id));
  const removedElements = elementsA.filter((el) => !mapB.has(el.id));

  const modifiedElements: VersionDiffResult['modifiedElements'] = [];

  for (const elA of elementsA) {
    const elB = mapB.get(elA.id);
    if (!elB) continue;

    const changes: Array<{ property: string; oldValue: any; newValue: any }> = [];
    const keysToCheck = [
      'name', 'x', 'y', 'width', 'height', 'rotation', 'locked', 'editable',
      'text', 'fontSize', 'fontWeight', 'color', 'textAlign', 'dataBinding',
      'symbology', 'value', 'fillColor', 'strokeColor', 'strokeWidth'
    ];

    for (const key of keysToCheck) {
      const valA = (elA as any)[key];
      const valB = (elB as any)[key];
      if (valA !== undefined && valB !== undefined && JSON.stringify(valA) !== JSON.stringify(valB)) {
        changes.push({
          property: key,
          oldValue: valA,
          newValue: valB,
        });
      }
    }

    if (changes.length > 0) {
      modifiedElements.push({
        id: elA.id,
        name: elA.name,
        type: elA.type,
        changes,
      });
    }
  }

  const dimensionChanged =
    templateA.dimensions.width !== templateB.dimensions.width ||
    templateA.dimensions.height !== templateB.dimensions.height ||
    templateA.dimensions.dpi !== templateB.dimensions.dpi;

  const variableChanges: VersionDiffResult['variableChanges'] = [];
  const varsA = new Map((templateA.variables || []).map((v) => [v.name, v]));
  const varsB = new Map((templateB.variables || []).map((v) => [v.name, v]));

  for (const [name, vB] of varsB.entries()) {
    if (!varsA.has(name)) {
      variableChanges.push({ name, action: 'added', details: `New variable ${name} (${vB.type})` });
    }
  }
  for (const [name] of varsA.entries()) {
    if (!varsB.has(name)) {
      variableChanges.push({ name, action: 'removed', details: `Removed variable ${name}` });
    }
  }

  const hasChanges =
    addedElements.length > 0 ||
    removedElements.length > 0 ||
    modifiedElements.length > 0 ||
    dimensionChanged ||
    variableChanges.length > 0;

  return {
    versionA: templateA.version,
    versionB: templateB.version,
    hasChanges,
    addedElements,
    removedElements,
    modifiedElements,
    dimensionChanged,
    variableChanges,
  };
}
