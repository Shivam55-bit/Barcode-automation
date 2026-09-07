import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createBackendApp } from './barcode-automation-backend/src/app';

dotenv.config();

async function startServer() {
  console.log('[Server] Initializing barcode automation server...');
  // Initialize modular backend application
  const app = createBackendApp();
  console.log('[Server] Backend app initialized successfully');
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  const hasBuiltAssets = fs.existsSync(indexPath);

  let viteMiddleware: any = null;

  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/download')) {
      return next();
    }
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    if (hasBuiltAssets) {
      return next();
    }
    next();
  });

  if (hasBuiltAssets) {
    console.log(`[Server] Serving production SPA build from: ${distPath}`);
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/download')) {
        return next();
      }
      res.sendFile(indexPath);
    });
  }

  // Start listening immediately so REST API is online in 5ms
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  🚀 Enterprise Barcode Platform Server running on port ${PORT}`);
    console.log(`  📁 Backend Service: ./barcode-automation-backend/`);
    console.log(`  💾 Storage: SQLite (WAL mode) with Automatic JSON Bi-directional Sync in ./barcode-automation-backend/data/`);
    console.log(`=======================================================`);
  });

  // Attach live Vite dev middleware in background
  if (!hasBuiltAssets && process.env.NODE_ENV !== 'production') {
    (async () => {
      console.log(`[Server] Starting live Vite development middleware...`);
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: {
            middlewareMode: true,
            watch: {
              ignored: ['**/data/**', '**/barcode-automation-backend/data/**'],
            },
          },
          appType: 'spa',
        });
        viteMiddleware = vite.middlewares;
        console.log(`[Server] Vite development middleware attached successfully.`);
      } catch (err: any) {
        console.warn(`[Server] Vite middleware warning:`, err.message);
      }
    })();
  }
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
