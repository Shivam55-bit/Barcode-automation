import { DatabaseConnectionConfig } from '../types';

export const SAMPLE_ENTERPRISE_DATASETS: DatabaseConnectionConfig[] = [
  {
    id: 'db-pharma-serial',
    name: 'Pharmaceutical Serialization Master (FDA UDI)',
    type: 'sql_mock',
    sqlQuery: 'SELECT GTIN, BatchNo, ExpiryDate, SerialNumber, ProductDesc, Dosage, MfgDate FROM PharmaInventory WHERE Status = "ACTIVE"',
    fields: ['GTIN', 'BatchNo', 'ExpiryDate', 'SerialNumber', 'ProductDesc', 'Dosage', 'MfgDate', 'CountryOrigin'],
    records: [
      { GTIN: '00850006531234', BatchNo: 'LOT-9042', ExpiryDate: '261231', SerialNumber: 'SN-7849102', ProductDesc: 'Amoxicillin 500mg Capsules', Dosage: '500mg', MfgDate: '240115', CountryOrigin: 'USA' },
      { GTIN: '00850006531241', BatchNo: 'LOT-9042', ExpiryDate: '261231', SerialNumber: 'SN-7849103', ProductDesc: 'Amoxicillin 500mg Capsules', Dosage: '500mg', MfgDate: '240115', CountryOrigin: 'USA' },
      { GTIN: '00850006531258', BatchNo: 'LOT-9043', ExpiryDate: '270430', SerialNumber: 'SN-7849104', ProductDesc: 'Ibuprofen 400mg Tablets', Dosage: '400mg', MfgDate: '240210', CountryOrigin: 'Germany' },
      { GTIN: '00850006531265', BatchNo: 'LOT-9043', ExpiryDate: '270430', SerialNumber: 'SN-7849105', ProductDesc: 'Ibuprofen 400mg Tablets', Dosage: '400mg', MfgDate: '240210', CountryOrigin: 'Germany' },
      { GTIN: '00850006531272', BatchNo: 'LOT-9044', ExpiryDate: '260815', SerialNumber: 'SN-7849106', ProductDesc: 'Cetirizine 10mg Film-Coated', Dosage: '10mg', MfgDate: '231120', CountryOrigin: 'Switzerland' },
    ],
  },
  {
    id: 'db-logistics-pallets',
    name: 'WMS Pallet & SSCC Logistics Hub',
    type: 'rest_api',
    endpointOrPath: 'https://api.enterprise-wms.corp/v2/pallets/active',
    fields: ['SSCC', 'PalletID', 'WarehouseLoc', 'Carrier', 'DestinationHub', 'GrossWeightKg', 'ItemCount', 'ShipDate'],
    records: [
      { SSCC: '000085000653123451', PalletID: 'PAL-9821', WarehouseLoc: 'BAY-A12-R4', Carrier: 'FedEx Freight', DestinationHub: 'ORD-Chicago', GrossWeightKg: '420.5', ItemCount: '48', ShipDate: '2026-08-20' },
      { SSCC: '000085000653123468', PalletID: 'PAL-9822', WarehouseLoc: 'BAY-A12-R5', Carrier: 'FedEx Freight', DestinationHub: 'ORD-Chicago', GrossWeightKg: '385.0', ItemCount: '44', ShipDate: '2026-08-20' },
      { SSCC: '000085000653123475', PalletID: 'PAL-9823', WarehouseLoc: 'BAY-B04-R1', Carrier: 'DHL Supply Chain', DestinationHub: 'DFW-Dallas', GrossWeightKg: '512.2', ItemCount: '60', ShipDate: '2026-08-21' },
      { SSCC: '000085000653123482', PalletID: 'PAL-9824', WarehouseLoc: 'BAY-C09-R2', Carrier: 'UPS Freight', DestinationHub: 'ATL-Atlanta', GrossWeightKg: '290.8', ItemCount: '32', ShipDate: '2026-08-21' },
    ],
  },
  {
    id: 'db-retail-apparel',
    name: 'Retail Apparel Inventory & Pricing',
    type: 'csv',
    fields: ['SKU', 'UPC', 'ItemName', 'Size', 'Color', 'RetailPrice', 'DiscountPrice', 'Department'],
    records: [
      { SKU: 'APP-TEE-BLK-S', UPC: '012345678905', ItemName: 'Premium Cotton T-Shirt', Size: 'S', Color: 'Black', RetailPrice: '$29.99', DiscountPrice: '$24.99', Department: 'Mens' },
      { SKU: 'APP-TEE-BLK-M', UPC: '012345678912', ItemName: 'Premium Cotton T-Shirt', Size: 'M', Color: 'Black', RetailPrice: '$29.99', DiscountPrice: '$24.99', Department: 'Mens' },
      { SKU: 'APP-TEE-BLK-L', UPC: '012345678929', ItemName: 'Premium Cotton T-Shirt', Size: 'L', Color: 'Black', RetailPrice: '$29.99', DiscountPrice: '$24.99', Department: 'Mens' },
      { SKU: 'APP-HDY-NVY-XL', UPC: '012345678936', ItemName: 'Fleece Zip Hoodie', Size: 'XL', Color: 'Navy', RetailPrice: '$59.99', DiscountPrice: '$49.99', Department: 'Unisex' },
    ],
  },
];

/**
 * Parses raw CSV string into fields and records
 */
export function parseCSVToDatabaseConnection(csvText: string, connectionName: string = 'Imported CSV'): DatabaseConnectionConfig {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) {
    return {
      id: `db-${Date.now()}`,
      name: connectionName,
      type: 'csv',
      fields: [],
      records: [],
    };
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const fields = parseLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    fields.forEach((field, fIdx) => {
      row[field] = values[fIdx] || '';
    });
    records.push(row);
  }

  return {
    id: `db-${Date.now()}`,
    name: connectionName,
    type: 'csv',
    fields,
    records,
  };
}
