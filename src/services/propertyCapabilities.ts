/**
 * BarTender-Style Centralized Property Capabilities Registry
 */

export type PropertySectionType =
  | 'symbology'
  | 'humanReadable'
  | 'font'
  | 'textFormat'
  | 'border'
  | 'position'
  | 'fill'
  | 'line'
  | 'image'
  | 'dataSources'
  | 'errorHandling';

export interface PropertySectionDefinition {
  id: PropertySectionType;
  label: string;
  iconType: 'symbology' | 'humanReadable' | 'font' | 'textFormat' | 'border' | 'position' | 'fill' | 'line' | 'image' | 'dataSources' | 'errorHandling';
  description?: string;
}

export const PROPERTY_SECTION_DEFINITIONS: Record<PropertySectionType, PropertySectionDefinition> = {
  symbology: {
    id: 'symbology',
    label: 'Symbology and Size',
    iconType: 'symbology',
  },
  humanReadable: {
    id: 'humanReadable',
    label: 'Human Readable',
    iconType: 'humanReadable',
  },
  font: {
    id: 'font',
    label: 'Font',
    iconType: 'font',
  },
  textFormat: {
    id: 'textFormat',
    label: 'Text Format',
    iconType: 'textFormat',
  },
  border: {
    id: 'border',
    label: 'Border',
    iconType: 'border',
  },
  position: {
    id: 'position',
    label: 'Position',
    iconType: 'position',
  },
  fill: {
    id: 'fill',
    label: 'Fill / Color',
    iconType: 'fill',
  },
  line: {
    id: 'line',
    label: 'Line Properties',
    iconType: 'line',
  },
  image: {
    id: 'image',
    label: 'Image',
    iconType: 'image',
  },
  dataSources: {
    id: 'dataSources',
    label: 'Data Sources',
    iconType: 'dataSources',
  },
  errorHandling: {
    id: 'errorHandling',
    label: 'Error Handling',
    iconType: 'errorHandling',
  },
};

/**
 * Mapping of object types to their supported property sections
 */
export const PROPERTY_CAPABILITIES: Record<string, PropertySectionType[]> = {
  barcode: [
    'symbology',
    'humanReadable',
    'font',
    'textFormat',
    'border',
    'position',
    'dataSources',
  ],
  text: [
    'font',
    'textFormat',
    'border',
    'position',
    'dataSources',
  ],
  shape: [
    'fill',
    'border',
    'position',
  ],
  rectangle: [
    'fill',
    'border',
    'position',
  ],
  ellipse: [
    'fill',
    'border',
    'position',
  ],
  line: [
    'line',
    'position',
  ],
  image: [
    'image',
    'border',
    'position',
    'dataSources',
  ],
  table: [
    'font',
    'border',
    'position',
    'dataSources',
  ],
};

/**
 * Helper to retrieve allowed sections for an element type
 */
export function getSectionsForElementType(type: string): PropertySectionDefinition[] {
  const normalizedType = type?.toLowerCase() || 'barcode';
  const sectionIds = PROPERTY_CAPABILITIES[normalizedType] || PROPERTY_CAPABILITIES.barcode;
  return sectionIds.map((secId) => PROPERTY_SECTION_DEFINITIONS[secId]).filter(Boolean);
}
