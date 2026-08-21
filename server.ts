import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createBackendApp } from './barcode-automation-backend/src/app';

dotenv.config();

async function startServer() {
  // Initialize modular backend application
  const app = createBackendApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  const hasBuiltAssets = fs.existsSync(indexPath);

  // In production mode, serve static assets directly; otherwise use live Vite middleware
  if (process.env.NODE_ENV === 'production') {
    console.log(`[Server] Serving production SPA build from: ${distPath}`);
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(indexPath);
    });
  } else {
    console.log(`[Server] Starting live Vite development middleware...`);
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  🚀 Enterprise Barcode Platform Server running on port ${PORT}`);
    console.log(`  📁 Backend Service: ./barcode-automation-backend/`);
    console.log(`  💾 Storage: Persistent Disk JSON DB in ./barcode-automation-backend/data/`);
    console.log(`=======================================================`);
  });
}

startServer();
