import type { Request, Response } from 'express';
import { handleWebhookPost } from '../../src/server/webhookHandler';

/**
 * Vercel Serverless Function entry point:
 * POST /api/webhook/[connection]
 */
export default async function handler(req: Request, res: Response) {
  const connectionKey = (req.query.connection as string) || '';
  await handleWebhookPost(req, res, connectionKey);
}
