import dotenv from 'dotenv';
import { createBackendApp } from './app';

dotenv.config();

const app = createBackendApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  🚀 Barcode Automation Backend running on http://localhost:${PORT}`);
  console.log(`  📁 Storage: Persistent Disk JSON DB in barcode-automation-backend/data/`);
  console.log(`  🔌 REST Endpoints: /api/templates, /api/print-jobs, /api/batch-jobs, /api/audit-logs, /api/printers`);
  console.log(`=======================================================`);
});
