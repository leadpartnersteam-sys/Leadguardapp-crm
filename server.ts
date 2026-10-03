import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleCreateConnection,
  handleListConnections,
  handleRegenerateSecret,
  handleRevokeConnection,
} from './src/server/connectionHandler';
import { handleWebhookPost } from './src/server/webhookHandler';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parser with 16KB limit (enforcing request body size limit)
  app.use(express.json({ limit: '16kb' }));

  // Webhook ingestion endpoint: POST /api/webhook/:connection
  app.all('/api/webhook/:connection', async (req, res) => {
    await handleWebhookPost(req, res);
  });

  // Authenticated Webhook Connection Management endpoints
  app.get('/api/connections', async (req, res) => {
    await handleListConnections(req, res);
  });

  app.post('/api/connections', async (req, res) => {
    await handleCreateConnection(req, res);
  });

  app.post('/api/connections/:id/revoke', async (req, res) => {
    await handleRevokeConnection(req, res);
  });

  app.post('/api/connections/:id/regenerate-secret', async (req, res) => {
    await handleRegenerateSecret(req, res);
  });

  // Attach Vite middlewares in dev or serve static files in prod
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LeadGuard Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[LeadGuard Server] Failed to start:', err);
  process.exit(1);
});
