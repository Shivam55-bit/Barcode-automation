import { describe, it, expect } from 'vitest';
import {
  evaluateDataSourceItem,
  evaluateTextElement,
  evaluateElementData,
  interpolateDynamicTokens,
  formatCustomDate,
} from '../src/services/dataSourceEngine';
import { executeVBScript, parseVBDate, vbDateAdd } from '../src/services/vbscriptEngine';
import { evaluateFormula } from '../src/services/formulaEngine';
import { executeEnterpriseTransformPipeline } from '../src/services/transformEngine';
import { evaluateSerializedValue } from '../src/services/serializationEngine';
import { createPrintPlan } from '../src/services/printPlanService';
import { validateBarcodeValue } from '../src/services/barcodeEngine';
import { serializeBarcodeFlowDocument, deserializeBarcodeFlowDocument } from '../src/services/documentFileService';
import {
  DataSourceItem,
  TextElement,
  BarcodeElement,
  EvaluationContext,
  LabelTemplate,
  OpenDocument,
} from '../src/types';

describe('360Barcode Comprehensive Professional Data Source & Scripting Engine Suite', () => {
  // Test record as specified in Phase 39
  const sampleExcelRecord = {
    ProductName: 'Shampoo 500ml',
    SKU: '000101',
    Barcode: '8901234567890',
    Price: 500,
    Qty: 10,
    BatchNo: 'B101',
    Stock: 20,
    ExpiryDays: 9,
    MFGDate: '18/09/2026',
    GST: 18,
    PrintQty: 3,
    Category: 'Personal Care',
    ImagePath: 'C:\\Data\\shampoo.png',
  };

  const frozenDate = new Date(2026, 8, 18, 10, 0, 0); // 18-09-2026

  const baseContext: EvaluationContext = {
    record: sampleExcelRecord,
    currentRecordIndex: 0,
    totalRecords: 5,
    printerName: 'Zebra ZT410 (203 dpi)',
    jobId: 'JOB-2026-001',
    jobName: 'Batch_Print_1',
    globalData: {
      CompanyName: '360Barcode Global Ltd',
      FactoryCode: 'FAC-99',
    },
    namedDataSources: [
      { id: 'ns-1', name: 'ProductPrice', defaultValue: '500', databaseField: 'Price' },
      { id: 'ns-2', name: 'ExpiryInterval', defaultValue: '9' },
    ],
  };

  // --------------------------------------------------------------------------
  // PHASE 2 & 20: CLOCK DATA SOURCE & DYNAMIC EXPIRY DATE
  // --------------------------------------------------------------------------
  describe('Phase 2 & 20: Clock Source with Dynamic Offsets', () => {
    it('resolves Current Date + Dynamic Database Field ExpiryDays = 27-09-2026', () => {
      const clockItem: DataSourceItem = {
        id: 'clock-1',
        name: 'Expiry Date',
        type: 'clock',
        value: '',
        clockBase: 'date',
        dateFormat: 'DD-MM-YYYY',
        dateOffsetDaysSource: 'database_field',
        dateOffsetDaysField: 'ExpiryDays',
        enabled: true,
      };

      const ctx = { ...baseContext, currentDateTime: frozenDate } as any;
      const resolved = evaluateDataSourceItem(clockItem, ctx);
      expect(resolved).toBe('27-09-2026');
    });

    it('matches VBScript DateAdd output with Clock Data Source exactly (Phase 20 acceptance)', () => {
      const vbScript = 'Value = DateAdd("d", Record("ExpiryDays"), Date)';
      const vbRes = executeVBScript(vbScript, {
        record: sampleExcelRecord,
        system: { Date: '18/09/2026' } as any,
      });
      expect(vbRes.success).toBe(true);
      expect(vbRes.value).toBe('27/09/2026');
    });

    it('handles month boundaries and leap year rollovers without string concatenation', () => {
      // 31/01/2026 + 1 month -> 28/02/2026
      const d1 = vbDateAdd('m', 1, '31/01/2026');
      expect(d1).toBe('28/02/2026');

      // 28/02/2024 (leap year) + 1 day -> 29/02/2024
      const d2 = vbDateAdd('d', 1, '28/02/2024');
      expect(d2).toBe('29/02/2024');

      // Year boundary rollover: 30/12/2026 + 5 days -> 04/01/2027
      const d3 = vbDateAdd('d', 5, '30/12/2026');
      expect(d3).toBe('04/01/2027');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 2 & 21: MFG DATE + EXPIRY DAYS FORMULA
  // --------------------------------------------------------------------------
  describe('Phase 2 & 21: MFGDate + Expiry Days date calculation', () => {
    it('correctly parses DD/MM/YYYY and adds 90 days: 18/09/2026 + 90 -> 17/12/2026', () => {
      const parsed = parseVBDate('18/09/2026');
      expect(parsed).not.toBeNull();
      expect(parsed?.getDate()).toBe(18);
      expect(parsed?.getMonth()).toBe(8); // September (0-indexed 8)
      expect(parsed?.getFullYear()).toBe(2026);

      const added = vbDateAdd('d', 90, '18/09/2026');
      expect(added).toBe('17/12/2026');
    });

    it('evaluates formula ADDDAYS(MFGDate, 90) -> 17/12/2026', () => {
      const evalRes = evaluateFormula('ADDDAYS(MFGDate, 90)', {
        record: sampleExcelRecord,
      });
      expect(evalRes.success).toBe(true);
      expect(evalRes.value).toBe('17/12/2026');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 2: DATABASE FIELD & LEADING ZERO PRESERVATION
  // --------------------------------------------------------------------------
  describe('Phase 2: Database Field Resolution', () => {
    it('preserves leading zeros on identifier fields (SKU 000101)', () => {
      const skuItem: DataSourceItem = {
        id: 'sku-1',
        name: 'Product SKU',
        type: 'database-field',
        databaseField: 'SKU',
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(skuItem, baseContext);
      expect(resolved).toBe('000101');
    });

    it('performs case-insensitive field lookup fallback', () => {
      const item: DataSourceItem = {
        id: 'p-1',
        name: 'Product',
        type: 'database-field',
        databaseField: 'productname', // lowercase
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(item, baseContext);
      expect(resolved).toBe('Shampoo 500ml');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 2 & 4: FORMULA EXPRESSIONS
  // --------------------------------------------------------------------------
  describe('Phase 2 & 4: Formula Engine Expressions', () => {
    it('calculates {{Price}} * 1.18 -> 590', () => {
      const formulaItem: DataSourceItem = {
        id: 'f-1',
        name: 'Price with Tax',
        type: 'formula',
        formulaExpression: '{{Price}} * 1.18',
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(formulaItem, baseContext);
      expect(Number(resolved)).toBe(590);
    });

    it('evaluates conditional stock expressions IF({{Stock}} <= 0, ...)', () => {
      const inStockFormula = 'IF({{Stock}} > 0, "IN STOCK", "OUT OF STOCK")';
      const evalRes = evaluateFormula(inStockFormula, { record: sampleExcelRecord });
      expect(evalRes.success).toBe(true);
      expect(evalRes.value).toBe('IN STOCK');

      const outOfStockRes = evaluateFormula(inStockFormula, { record: { ...sampleExcelRecord, Stock: 0 } });
      expect(outOfStockRes.value).toBe('OUT OF STOCK');
    });

    it('handles string concatenation with {{ProductName}} + " - " + {{BatchNo}}', () => {
      const evalRes = evaluateFormula('{{ProductName}} + " - " + {{BatchNo}}', { record: sampleExcelRecord });
      expect(evalRes.success).toBe(true);
      expect(evalRes.value).toBe('Shampoo 500ml - B101');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 3: NAMED DATA SOURCES
  // --------------------------------------------------------------------------
  describe('Phase 3: Named Data Sources', () => {
    it('resolves named data source bound to database field', () => {
      const namedItem: DataSourceItem = {
        id: 'item-named',
        name: 'Price Named',
        type: 'variable',
        namedSourceId: 'ProductPrice',
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(namedItem, baseContext);
      expect(String(resolved)).toBe('500');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 4: GLOBAL DATA FIELDS
  // --------------------------------------------------------------------------
  describe('Phase 4: Global Data Fields', () => {
    it('resolves global document fields across elements', () => {
      const globalItem: DataSourceItem = {
        id: 'item-global',
        name: 'Company',
        type: 'global',
        globalField: 'CompanyName',
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(globalItem, baseContext);
      expect(resolved).toBe('360Barcode Global Ltd');
    });

    it('interpolates {Global.CompanyName} inside template strings', () => {
      const interpolated = interpolateDynamicTokens('Manufactured by {Global.CompanyName}', baseContext);
      expect(interpolated).toBe('Manufactured by 360Barcode Global Ltd');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 5: OBJECT VALUE & CIRCULAR REFERENCE DETECTION
  // --------------------------------------------------------------------------
  describe('Phase 5: Object Value & Cycle Detection', () => {
    it('resolves another element value by ID', () => {
      const textElem: TextElement = {
        id: 'txt-1',
        name: 'ProductNameText',
        type: 'text',
        x: 10,
        y: 10,
        width: 50,
        height: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 1,
        text: 'Dynamic Shampoo',
      };

      const objectItem: DataSourceItem = {
        id: 'obj-ref',
        name: 'Ref Object',
        type: 'object',
        linkedObjectId: 'txt-1',
        value: '',
        enabled: true,
      };

      const ctxWithElements = { ...baseContext, elements: [textElem] };
      const resolved = evaluateDataSourceItem(objectItem, ctxWithElements);
      expect(resolved).toBe('Dynamic Shampoo');
    });

    it('detects circular dependency between Object A and Object B', () => {
      const elemA: TextElement = {
        id: 'elem-A',
        name: 'Object A',
        type: 'text',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 1,
        text: '',
        dataSources: [
          { id: 'ds-a', name: 'Ref B', type: 'object', linkedObjectId: 'elem-B', value: '', enabled: true },
        ],
      };

      const elemB: TextElement = {
        id: 'elem-B',
        name: 'Object B',
        type: 'text',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 1,
        text: '',
        dataSources: [
          { id: 'ds-b', name: 'Ref A', type: 'object', linkedObjectId: 'elem-A', value: '', enabled: true },
        ],
      };

      const ctxWithCycle = { ...baseContext, elements: [elemA, elemB] };
      const resA = evaluateElementData(elemA, ctxWithCycle);
      expect(resA).toMatch(/\[Circular Dependency: elem-[AB]\]/);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 6: EXTERNAL FILE DATA SOURCE
  // --------------------------------------------------------------------------
  describe('Phase 6: External File Data Source', () => {
    it('handles missing file gracefully without crashing', () => {
      const fileItem: DataSourceItem = {
        id: 'ext-file',
        name: 'External Info',
        type: 'external_file',
        filePath: 'C:\\NonExistentPath\\info.txt',
        value: '',
        enabled: true,
      };
      const resolved = evaluateDataSourceItem(fileItem, baseContext);
      expect(resolved).toContain('[External File Missing: C:\\NonExistentPath\\info.txt]');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 7: PRINT JOB DATA
  // --------------------------------------------------------------------------
  describe('Phase 7: Print Job Data', () => {
    it('resolves real print job context values', () => {
      const pjItem: DataSourceItem = {
        id: 'pj-1',
        name: 'Job Name',
        type: 'print_job',
        printJobField: 'job_name',
        value: '',
        enabled: true,
      };
      expect(evaluateDataSourceItem(pjItem, baseContext)).toBe('Batch_Print_1');

      const recNumItem: DataSourceItem = {
        id: 'pj-2',
        name: 'Rec Num',
        type: 'print_job',
        printJobField: 'record_number',
        value: '',
        enabled: true,
      };
      expect(evaluateDataSourceItem(recNumItem, baseContext)).toBe('1');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 8 & 11: VBSCRIPT ENGINE & DATE BUG FIX
  // --------------------------------------------------------------------------
  describe('Phase 8 & 11: VBScript Engine & Date Bug Fix', () => {
    it('verifies Value = Date returns formatted date, NOT native code', () => {
      const res = executeVBScript('Value = Date', {});
      expect(res.success).toBe(true);
      expect(res.value).not.toContain('native code');
      expect(res.value).not.toContain('function Date');
      expect(res.value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('executes Record("Field") lookups inside VBScript', () => {
      const res = executeVBScript('Value = UCase(Record("ProductName"))', { record: sampleExcelRecord });
      expect(res.success).toBe(true);
      expect(res.value).toBe('SHAMPOO 500ML');
    });

    it('supports VBScript string functions (Left, Right, Mid, Len, Trim)', () => {
      const script = `
        Dim p
        p = Record("ProductName")
        Value = Left(p, 7)
      `;
      const res = executeVBScript(script, { record: sampleExcelRecord });
      expect(res.success).toBe(true);
      expect(res.value).toBe('Shampoo');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 12: JAVASCRIPT ENGINE & SANDBOX SAFETY
  // --------------------------------------------------------------------------
  describe('Phase 12: JavaScript Engine & Sandboxing', () => {
    it('evaluates safe JavaScript expressions with Record() accessor', () => {
      const jsItem: DataSourceItem = {
        id: 'js-1',
        name: 'JS Engine',
        type: 'script',
        scriptLanguage: 'javascript',
        scriptCode: 'return "ITEM: " + Record("SKU") + " - " + Record("ProductName");',
        value: '',
        enabled: true,
      };
      const res = evaluateDataSourceItem(jsItem, baseContext);
      expect(res).toBe('ITEM: 000101 - Shampoo 500ml');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 16 & 17: TRANSFORMS ORDER & EXECUTION
  // --------------------------------------------------------------------------
  describe('Phase 16 & 17: Enterprise Transform Pipeline', () => {
    it('applies character filter -> search replace -> prefix/suffix deterministically', () => {
      const input = 'Price: $500.00 USD';
      const config = {
        characterFilter: { type: 'digits' as const }, // leaves "50000"
        searchReplace: [{ find: '0000', replace: '' }], // "50000" -> "5"
        prefixSuffix: { prefix: 'Rs.', suffix: '/-' },
      };
      const result = executeEnterpriseTransformPipeline(input, config);
      expect(result).toBe('Rs.5/-');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 18: SERIALIZATION PREVIEW VS COMMIT ISOLATION
  // --------------------------------------------------------------------------
  describe('Phase 18: Serialization Isolation', () => {
    it('computes offset for print preview without mutating original state', () => {
      const serialConfig = {
        action: 'increment' as const,
        method: 'numeric' as const,
        incrementBy: 1,
        event: 'standard' as const,
        eventInterval: 1,
        copies: 1,
        preserveCharacters: true,
        prefix: 'SN-',
      };

      // Preview with printIndex = 0
      const preview0 = evaluateSerializedValue('100', serialConfig, { printIndex: 0 });
      expect(preview0).toBe('SN-100');

      // Preview with printIndex = 5
      const preview5 = evaluateSerializedValue('100', serialConfig, { printIndex: 5 });
      expect(preview5).toBe('SN-105');

      // Original base string remains completely unaffected
      const previewAgain = evaluateSerializedValue('100', serialConfig, { printIndex: 0 });
      expect(previewAgain).toBe('SN-100');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 23: BARCODE DATA VALIDATION
  // --------------------------------------------------------------------------
  describe('Phase 23: Barcode Symbology Validation', () => {
    it('detects invalid barcode content before print', () => {
      const valRes = validateBarcodeValue('ean13', '12345'); // EAN-13 requires 12 or 13 digits
      expect(valRes.valid).toBe(false);
      expect(valRes.message).toBeDefined();
    });

    it('passes valid Code128 barcode content', () => {
      const valRes = validateBarcodeValue('code128', 'BATCH-2026-X');
      expect(valRes.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 25: PRINT QUANTITY FROM DATABASE FIELD
  // --------------------------------------------------------------------------
  describe('Phase 25: Database Driven Print Quantity', () => {
    it('expands records by PrintQty column: Shampoo(3) + HairOil(2) + FaceWash(1) = 6 labels', () => {
      const records = [
        { ProductName: 'Shampoo', PrintQty: 3 },
        { ProductName: 'Hair Oil', PrintQty: 2 },
        { ProductName: 'Face Wash', PrintQty: 1 },
      ];

      const dummyTemplate: LabelTemplate = {
        id: 'tmpl-qty',
        name: 'Qty Test Template',
        dimensions: { width: 100, height: 50, orientation: 'portrait', unit: 'mm' },
        elements: [],
        databaseConnection: {
          id: 'conn-1',
          name: 'Excel DB',
          type: 'excel',
          records,
          fields: ['ProductName', 'PrintQty'],
        },
      };

      const plan = createPrintPlan(dummyTemplate, {
        printer: { id: 'p1', name: 'Zebra', dpi: 203, model: 'ZT410', type: 'thermal', printableArea: { width: 100, height: 100 } } as any,
        quantitySource: 'database_field',
        selectedQtyColumn: 'PrintQty',
      });

      expect(plan.totalLabels).toBe(6);
      expect(plan.items.filter((i) => i.record.ProductName === 'Shampoo')).toHaveLength(3);
      expect(plan.items.filter((i) => i.record.ProductName === 'Hair Oil')).toHaveLength(2);
      expect(plan.items.filter((i) => i.record.ProductName === 'Face Wash')).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 29 & 30: EDITABLE DOCUMENT SAVE & REOPEN ROUNDTRIP
  // --------------------------------------------------------------------------
  describe('Phase 29 & 30: Document Persistence (.bfl)', () => {
    it('serializes and parses template preserving all data sources, formulas, and bindings without flattening', () => {
      const fullTemplate: LabelTemplate = {
        id: 'tmpl-full-persisted',
        name: 'Full Persisted Product Label',
        dimensions: { width: 100, height: 75, unit: 'mm', orientation: 'portrait' },
        elements: [
          {
            id: 'el-text-name',
            name: 'ProductNameField',
            type: 'text',
            x: 10,
            y: 10,
            width: 80,
            height: 10,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 1,
            text: '',
            dataSources: [
              {
                id: 'ds-1',
                name: 'Product Name',
                type: 'database-field',
                databaseField: 'ProductName',
                value: '',
                enabled: true,
              },
            ],
          },
          {
            id: 'el-clock-exp',
            name: 'ClockExpiryField',
            type: 'text',
            x: 10,
            y: 25,
            width: 80,
            height: 10,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 2,
            text: '',
            dataSources: [
              {
                id: 'ds-clock',
                name: 'Dynamic Expiry',
                type: 'clock',
                clockBase: 'date',
                dateFormat: 'DD-MM-YYYY',
                dateOffsetDaysSource: 'database_field',
                dateOffsetDaysField: 'ExpiryDays',
                value: '',
                enabled: true,
              },
            ],
          },
        ],
        databaseConnection: {
          id: 'db-1',
          name: 'Products.xlsx',
          type: 'excel',
          records: [sampleExcelRecord],
          fields: Object.keys(sampleExcelRecord),
        },
        namedDataSources: baseContext.namedDataSources,
      };

      const openDoc: OpenDocument = {
        documentId: 'doc-100',
        name: fullTemplate.name,
        type: 'template',
        template: fullTemplate,
        isDirty: false,
      };

      // Serialize to .bfl JSON
      const serializedObj = serializeBarcodeFlowDocument(openDoc);
      expect(serializedObj.format).toBe('BarcodeFlowDocument');
      const jsonStr = JSON.stringify(serializedObj);

      // Reopen / parse
      const restored = deserializeBarcodeFlowDocument(jsonStr, 'Full Persisted Product Label.bfl');
      expect(restored.name).toBe('Full Persisted Product Label');
      expect(restored.template.elements).toHaveLength(2);

      // Verify bindings remain fully editable
      const restoredText = restored.template.elements[0] as TextElement;
      expect(restoredText.dataSources?.[0].databaseField).toBe('ProductName');

      const restoredClock = restored.template.elements[1] as TextElement;
      expect(restoredClock.dataSources?.[0].dateOffsetDaysField).toBe('ExpiryDays');
    });
  });
});
