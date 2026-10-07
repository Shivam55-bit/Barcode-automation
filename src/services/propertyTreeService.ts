/**
 * BarTender-Style Property Tree Model and Centralized Tree Builder
 */
import { LabelElement, DataSourceItem } from '../types';
import { getSectionsForElementType, PropertySectionType } from './propertyCapabilities';
import { escapeForDisplay } from './controlCharacterService';

export interface PropertyTreeNode {
  id: string; // Stable unique ID e.g. "el-1", "el-1::font", "el-1::dataSources::ds-1"
  nodeType: 'object' | 'section' | 'dataSource';
  label: string;
  iconType?: string;
  objectId: string;
  objectType: string;
  objectName: string;
  sectionId?: PropertySectionType;
  dataSourceId?: string;
  dataSourceIndex?: number;
  children?: PropertyTreeNode[];
  isExpanded?: boolean;
}

export type PropertyScope = 'selected' | 'all';

/**
 * Derives a human-friendly display label for a data source item
 */
export function getDataSourceDisplayLabel(ds: DataSourceItem, fallbackIndex: number): string {
  if (ds.name && ds.name.trim()) {
    return ds.name.trim();
  }

  const dsAny = ds as any;
  switch (ds.type as string) {
    case 'database':
      return ds.databaseField ? `${ds.databaseField}` : `Database Field ${fallbackIndex + 1}`;
    case 'global_variable':
    case 'named':
      return dsAny.globalVariableName || dsAny.namedSource || ds.namedSourceId || `Named Source ${fallbackIndex + 1}`;
    case 'serialization':
      return ds.value ? `${escapeForDisplay(String(ds.value))}` : `Serial Number`;
    case 'date_time':
    case 'clock':
      return dsAny.dateTimeFormat || ds.dateFormat ? `Date (${dsAny.dateTimeFormat || ds.dateFormat})` : `Current Date`;
    case 'gs1_ai':
      return dsAny.gs1AI ? `(${dsAny.gs1AI}) ${escapeForDisplay(String(ds.value || ''))}` : `GS1 AI ${fallbackIndex + 1}`;
    case 'vbscript':
    case 'script':
      return `VBScript Source`;
    case 'embedded':
    case 'literal':
    default:
      return ds.value !== undefined && ds.value !== '' ? escapeForDisplay(String(ds.value)) : `10850006531238`;
  }
}

/**
 * Builds the hierarchical Property Tree for the active document
 */
export function buildPropertyTree(
  elements: LabelElement[],
  scope: PropertyScope,
  selectedObjectId?: string,
  expandedNodeIds: Set<string> = new Set()
): PropertyTreeNode[] {
  if (!elements || elements.length === 0) {
    return [];
  }

  // 1. Determine which elements to include based on scope
  let targetElements: LabelElement[] = [];
  if (scope === 'selected') {
    const matched = elements.find((e) => e.id === selectedObjectId);
    if (matched) {
      targetElements = [matched];
    } else if (elements.length > 0) {
      targetElements = [elements[0]];
    }
  } else {
    // 'all' scope: preserve stable document order
    targetElements = [...elements];
  }

  // 2. Build tree for each target element
  return targetElements.map((el, elIndex) => {
    const objectNodeId = el.id;
    const objectType = el.type || 'barcode';
    const objectName = el.name || `${objectType.charAt(0).toUpperCase() + objectType.slice(1)} ${elIndex + 1}`;

    const sections = getSectionsForElementType(objectType);

    const sectionNodes: PropertyTreeNode[] = sections.map((sec) => {
      const sectionNodeId = `${el.id}::${sec.id}`;

      // Handle Data Sources children
      if (sec.id === 'dataSources') {
        const dataSources = (el as any).dataSources || [];
        const dsChildren: PropertyTreeNode[] = dataSources.map((ds: DataSourceItem, dsIdx: number) => {
          const dsId = ds.id || `ds-${dsIdx}`;
          const dsNodeId = `${el.id}::ds::${dsId}`;
          const dsLabel = getDataSourceDisplayLabel(ds, dsIdx);

          return {
            id: dsNodeId,
            nodeType: 'dataSource',
            label: dsLabel,
            iconType: ds.type || 'embedded',
            objectId: el.id,
            objectType,
            objectName,
            sectionId: 'dataSources',
            dataSourceId: dsId,
            dataSourceIndex: dsIdx,
          };
        });

        // If no explicit data sources array, create a single default entry from element.value
        if (dsChildren.length === 0 && (el as any).value !== undefined) {
          const fallbackVal = escapeForDisplay(String((el as any).value || (el.type === 'barcode' ? '12345678' : 'Sample Text')));
          dsChildren.push({
            id: `${el.id}::ds::default`,
            nodeType: 'dataSource',
            label: fallbackVal,
            iconType: 'embedded',
            objectId: el.id,
            objectType,
            objectName,
            sectionId: 'dataSources',
            dataSourceId: 'default',
            dataSourceIndex: 0,
          });
        }

        return {
          id: sectionNodeId,
          nodeType: 'section',
          label: sec.label,
          iconType: sec.iconType,
          objectId: el.id,
          objectType,
          objectName,
          sectionId: sec.id,
          children: dsChildren,
          isExpanded: expandedNodeIds.has(sectionNodeId) || true, // Default expanded as in BarTender
        };
      }

      return {
        id: sectionNodeId,
        nodeType: 'section',
        label: sec.label,
        iconType: sec.iconType,
        objectId: el.id,
        objectType,
        objectName,
        sectionId: sec.id,
      };
    });

    return {
      id: objectNodeId,
      nodeType: 'object',
      label: objectName,
      iconType: objectType,
      objectId: el.id,
      objectType,
      objectName,
      children: sectionNodes,
      isExpanded: expandedNodeIds.has(objectNodeId) || true,
    };
  });
}
