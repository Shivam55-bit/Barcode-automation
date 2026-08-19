import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { createBackendApp } from './barcode-automation-backend/src/app';

dotenv.config();

async function startServer() {
  // Initialize modular backend application
  const app = createBackendApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  🚀 Enterprise Barcode Platform Server running on http://localhost:${PORT}`);
    console.log(`  📁 Backend Service: ./barcode-automation-backend/`);
    console.log(`  💾 Storage: Persistent Disk JSON DB in ./barcode-automation-backend/data/`);
    console.log(`=======================================================`);
  });
}

startServer();
