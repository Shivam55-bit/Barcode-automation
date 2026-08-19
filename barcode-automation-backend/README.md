# 🏭 Barcode Automation Backend

Enterprise Industrial Barcode & Label Automation REST API Service.

## 📁 Directory Structure
```
barcode-automation-backend/
├── data/                      # Persistent Database JSON storage
│   ├── templates.json         # Label templates repository
│   ├── printers.json          # Configured industrial thermal printers
│   ├── printJobs.json         # Print queue & spooler history
│   ├── batchJobs.json         # Serialized 10-page barcode batches
│   ├── auditLogs.json         # 21 CFR Part 11 Audit Trail logs
│   └── users.json             # User profiles & roles
├── src/
│   ├── app.ts                 # Express Application instance & routing
│   ├── server.ts              # Standalone HTTP Server Listener
│   ├── routes/
│   │   ├── templates.ts       # Template CRUD, Clone & Approval Lifecycle
│   │   ├── printJobs.ts       # Print Spooler, ZPL/TSPL dispatch, Pause/Cancel
│   │   ├── batchJobs.ts       # 10-page serialized batches management
│   │   ├── printers.ts        # Industrial printer network configurations
│   │   ├── auditLogs.ts       # Audit trail tracking & JSON export
│   │   ├── users.ts           # Authentication & User Management
│   │   ├── gs1.ts             # GS1 Bracket Parser & Modulo-10 Check Digit
│   │   ├── zpl.ts             # Direct ZPL/TSPL/EPL raw code generator
│   │   └── ai.ts              # Gemini AI Label Design Assistant
│   └── services/
│       ├── storageService.ts  # Atomic JSON disk database manager
│       └── auditService.ts    # Centralized audit trail recorder
└── package.json
```

## 🔌 API Endpoints Reference

### 📋 Templates (`/api/templates`)
- `GET /api/templates`: List templates with filtering (`?category=...&status=...&search=...`)
- `GET /api/templates/:id`: Fetch specific template
- `POST /api/templates`: Create or save template
- `PUT /api/templates/:id`: Update existing template
- `POST /api/templates/:id/duplicate`: Clone template to draft
- `DELETE /api/templates/:id`: Delete template
- `PATCH /api/templates/:id/status`: Transition approval state (`draft` -> `submitted` -> `approved` / `rejected` / `published`)

### 🖨️ Print Spooler (`/api/print-jobs`)
- `GET /api/print-jobs`: Get all print jobs
- `POST /api/print-jobs`: Dispatch print job (generates raw ZPL/TSPL/EPL code)
- `POST /api/print-jobs/:id/pause`: Pause print job
- `POST /api/print-jobs/:id/resume`: Resume print job
- `POST /api/print-jobs/:id/cancel`: Cancel print job

### 📦 Serialized Batches (`/api/batch-jobs`)
- `GET /api/batch-jobs`: List 10-page serialized barcode batches
- `POST /api/batch-jobs`: Save newly generated 10-page batch
- `PATCH /api/batch-jobs/:id/status`: Update batch status (e.g. mark as `printed`)

### 🛡️ Audit Trail (`/api/audit-logs`)
- `GET /api/audit-logs`: Get 21 CFR Part 11 compliant audit trail
- `POST /api/audit-logs`: Record manual or system audit event
- `GET /api/audit-logs/export`: Download audit logs JSON export

### 🏢 Industrial Printers (`/api/printers`)
- `GET /api/printers`: List network & thermal printers
- `POST /api/printers`: Add new thermal printer definition
- `PUT /api/printers/:id`: Update printer IP/port/DPI
- `DELETE /api/printers/:id`: Remove printer

### 🤖 AI Assistant (`/api/ai/suggest`)
- `POST /api/ai/suggest`: Industrial label specifications & GS1 recommendations

---

## 🚀 Running the Backend Standalone
```bash
cd barcode-automation-backend
npm install
npm start
```
Default URL: `http://localhost:3001`
