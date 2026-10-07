import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createBackendApp } from './barcode-automation-backend/src/app';
import type { Server } from 'node:http';

export { getLegacyPasswordAccounts, initializeLegacyPassword } from './barcode-automation-backend/src/routes/users';

dotenv.config();

async function startServer() {
  console.log('[Server] Initializing barcode automation server...');
  // Initialize modular backend application
  const app = createBackendApp();
  console.log('[Server] Backend app initialized successfully');
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  const distPath = path.resolve(process.env.BARCODEFLOW_DIST_DIR || path.join(process.cwd(), 'dist'));
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

  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(PORT, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Backend failed to assign a TCP port.');
  console.log(`[Server] Ready at http://127.0.0.1:${address.port}`);
  process.send?.({ type: 'backend-ready', port: address.port });

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
  return server;
}

export const serverReady = startServer();
serverReady.catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
