import type { Request, Response } from 'express';
import { handleRegenerateSecret } from '../../../src/server/connectionHandler';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }
  req.params = { ...req.params, id: req.query.id as string };
  await handleRegenerateSecret(req, res);
}
