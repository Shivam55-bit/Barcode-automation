import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';

export const datasetsRouter = Router();
const storage = StorageService.getInstance();
const audit = AuditService.getInstance();

export interface DatasetItem {
  id: string;
  name: string;
  description?: string;
  sourceType: 'manual' | 'excel' | 'csv' | 'json' | 'api';
  fileName?: string;
  columns: string[];
  records: Record<string, any>[];
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const DEFAULT_DATASETS: DatasetItem[] = [
  {
    id: 'ds-pharma-01',
    name: 'Pharmaceutical Master Packaging Lots',
    description: 'Sterile Injectable Vials Serialization Master Dataset',
    sourceType: 'excel',
    fileName: 'Pharma_Master_Lots_2026.xlsx',
    columns: ['ITEM_CODE', 'PRODUCT_NAME', 'BATCH_NO', 'LOT_NO', 'MFG_DATE', 'EXP_DATE', 'MRP', 'GTIN', 'SERIAL_PREFIX'],
    records: [
      {
        ITEM_CODE: 'INJ-500MG-01',
        PRODUCT_NAME: 'Ceftriaxone Sodium 1g Vial',
        BATCH_NO: 'BATCH-2026-X8',
        LOT_NO: 'LOT-9921',
        MFG_DATE: '2026-08-01',
        EXP_DATE: '2028-07-31',
        MRP: '$149.00',
        GTIN: '00850006539987',
        SERIAL_PREFIX: 'SN-BATCH2026X8',
      },
      {
        ITEM_CODE: 'INJ-500MG-02',
        PRODUCT_NAME: 'Amoxicillin & Clavulanate Injection',
        BATCH_NO: 'BATCH-2026-Y9',
        LOT_NO: 'LOT-9922',
        MFG_DATE: '2026-08-05',
        EXP_DATE: '2028-08-04',
        MRP: '$189.50',
        GTIN: '00850006540013',
        SERIAL_PREFIX: 'SN-BATCH2026Y9',
      },
      {
        ITEM_CODE: 'INJ-1000MG-03',
        PRODUCT_NAME: 'Paracetamol IV Infusion 100ml',
        BATCH_NO: 'BATCH-2026-Z1',
        LOT_NO: 'LOT-9923',
        MFG_DATE: '2026-08-10',
        EXP_DATE: '2028-08-09',
        MRP: '$99.00',
        GTIN: '00850006540051',
        SERIAL_PREFIX: 'SN-BATCH2026Z1',
      },
    ],
    recordCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'System Administrator',
  },
  {
    id: 'ds-logistics-02',
    name: 'Global Logistics Pallet Shipping Index',
    description: 'Master SSCC-18 Shipping Container Manifest Dataset',
    sourceType: 'csv',
    fileName: 'Logistics_Pallet_Manifest.csv',
    columns: ['PALLET_ID', 'SHIP_TO', 'DESTINATION_ZONE', 'CARRIER', 'TOTAL_CASES', 'NET_WEIGHT_KG', 'SSCC_18'],
    records: [
      {
        PALLET_ID: 'PLT-88102',
        SHIP_TO: 'Distribution Center Frankfurt',
        DESTINATION_ZONE: 'EU-CENTRAL-01',
        CARRIER: 'DHL Supply Chain Express',
        TOTAL_CASES: '120',
        NET_WEIGHT_KG: '485.50',
        SSCC_18: '(00)108500065399870014',
      },
      {
        PALLET_ID: 'PLT-88103',
        SHIP_TO: 'Regional Hub Chicago',
        DESTINATION_ZONE: 'US-MIDWEST-04',
        CARRIER: 'FedEx Freight Priority',
        TOTAL_CASES: '95',
        NET_WEIGHT_KG: '390.20',
        SSCC_18: '(00)108500065399870021',
      },
    ],
    recordCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Logistics Lead',
  },
];

// GET /api/datasets
datasetsRouter.get('/', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    res.json(datasets);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch datasets' });
  }
});

// GET /api/datasets/:id
datasetsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === req.params.id);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json(ds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets
datasetsRouter.post('/', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const body = req.body;

    const newDataset: DatasetItem = {
      id: body.id || `ds-${Date.now()}`,
      name: body.name || 'Untitled Dataset',
      description: body.description || '',
      sourceType: body.sourceType || 'manual',
      fileName: body.fileName,
      columns: Array.isArray(body.columns) ? body.columns : [],
      records: Array.isArray(body.records) ? body.records : [],
      recordCount: Array.isArray(body.records) ? body.records.length : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: body.createdBy || 'User',
    };

    const updated = [newDataset, ...datasets];
    storage.write('datasets', updated);

    audit.log('DATASET_CREATE', `Created dataset "${newDataset.name}" with ${newDataset.recordCount} records.`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/datasets/:id
datasetsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const idx = datasets.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const updatedDs: DatasetItem = {
      ...datasets[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
      recordCount: Array.isArray(req.body.records) ? req.body.records.length : datasets[idx].recordCount,
    };

    datasets[idx] = updatedDs;
    storage.write('datasets', datasets);

    audit.log('DATASET_UPDATE', `Updated dataset "${updatedDs.name}".`);

    res.json(updatedDs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/datasets/:id
datasetsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const filtered = datasets.filter((d) => d.id !== req.params.id);
    storage.write('datasets', filtered);

    audit.log('DATASET_DELETE', `Deleted dataset ID: ${req.params.id}`);

    res.json({ success: true, message: 'Dataset deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/upload-excel
datasetsRouter.post('/upload-excel', (req: Request, res: Response) => {
  try {
    const { name, fileName, records, columns, createdBy } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);

    const parsedRecords = Array.isArray(records) ? records : [];
    const parsedCols = Array.isArray(columns) && columns.length > 0
      ? columns
      : parsedRecords.length > 0 ? Object.keys(parsedRecords[0]) : [];

    const newDataset: DatasetItem = {
      id: `ds-excel-${Date.now()}`,
      name: name || fileName || 'Imported Excel Dataset',
      description: `Imported from Excel file "${fileName || 'spreadsheet.xlsx'}"`,
      sourceType: 'excel',
      fileName: fileName || 'spreadsheet.xlsx',
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'User',
    };

    storage.write('datasets', [newDataset, ...datasets]);
    audit.log('DATASET_IMPORT_EXCEL', `Imported ${parsedRecords.length} records from Excel: ${newDataset.name}`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/upload-csv
datasetsRouter.post('/upload-csv', (req: Request, res: Response) => {
  try {
    const { name, fileName, csvText, records, columns, createdBy } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);

    let parsedRecords: Record<string, any>[] = Array.isArray(records) ? records : [];
    let parsedCols: string[] = Array.isArray(columns) ? columns : [];

    if (!parsedRecords.length && typeof csvText === 'string') {
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        parsedCols = lines[0].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        parsedRecords = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, any> = {};
          parsedCols.forEach((col, i) => {
            row[col] = vals[i] ?? '';
          });
          return row;
        });
      }
    }

    const newDataset: DatasetItem = {
      id: `ds-csv-${Date.now()}`,
      name: name || fileName || 'Imported CSV Dataset',
      description: `Imported from CSV file "${fileName || 'data.csv'}"`,
      sourceType: 'csv',
      fileName: fileName || 'data.csv',
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'User',
    };

    storage.write('datasets', [newDataset, ...datasets]);
    audit.log('DATASET_IMPORT_CSV', `Imported ${parsedRecords.length} records from CSV: ${newDataset.name}`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/preview
datasetsRouter.post('/preview', (req: Request, res: Response) => {
  try {
    const { datasetId, limit = 10, offset = 0 } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const sliced = ds.records.slice(offset, offset + limit);
    res.json({
      datasetId: ds.id,
      name: ds.name,
      totalRecords: ds.recordCount,
      columns: ds.columns,
      preview: sliced,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
