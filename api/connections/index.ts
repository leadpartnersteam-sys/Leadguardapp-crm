import type { Request, Response } from 'express';
import { handleCreateConnection, handleListConnections } from '../../src/server/connectionHandler';

/**
 * Vercel Serverless Function entry point:
 * GET /api/connections
 * POST /api/connections
 */
export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    await handleListConnections(req, res);
  } else if (req.method === 'POST') {
    await handleCreateConnection(req, res);
  } else {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
