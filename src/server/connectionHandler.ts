import type { Request, Response } from 'express';
import { generateConnectionKey, generateSecret, hashSecret } from './crypto';
import { getSupabaseAdmin, verifyUserToken } from './supabaseAdmin';

function getAppBaseUrl(req: Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

async function resolveAuthenticatedUserBusiness(req: Request) {
  const user = await verifyUserToken(req.headers.authorization);
  if (!user) return null;

  try {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, business_id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.business_id) return null;
    return {
      userId: user.id,
      businessId: String(profile.business_id),
      fullName: profile.full_name || 'User',
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/connections
 * Lists webhook connections belonging to the authenticated user's business.
 * Never returns secret_hash.
 */
export async function handleListConnections(req: Request, res: Response): Promise<void> {
  const auth = await resolveAuthenticatedUserBusiness(req);
  if (!auth) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('webhook_connections')
      .select('id, business_id, name, connection_key, source_type, status, created_at, updated_at')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, error: 'Unable to load connections' });
      return;
    }

    const baseUrl = getAppBaseUrl(req);
    const enriched = (data || []).map((conn) => ({
      ...conn,
      webhook_url: `${baseUrl}/api/webhook/${conn.connection_key}`,
    }));

    res.status(200).json({ success: true, connections: enriched });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/connections
 * Creates a new webhook connection for the authenticated business.
 * Generates a high-entropy secret, stores only the hash, and returns the plaintext secret ONCE.
 */
export async function handleCreateConnection(req: Request, res: Response): Promise<void> {
  const auth = await resolveAuthenticatedUserBusiness(req);
  if (!auth) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { name, source_type } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  const cleanSourceType =
    source_type === 'WEBSITE_FORM' ? 'WEBSITE_FORM' : 'WEBHOOK';

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({
      success: false,
      error: 'Connection name is required (between 2 and 80 characters).',
    });
    return;
  }

  // 1. Server generates cryptographic secret and connection key
  const plaintextSecret = generateSecret();
  const connectionKey = generateConnectionKey();
  const secretHash = hashSecret(plaintextSecret);
  const nowIso = new Date().toISOString();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('webhook_connections')
      .insert({
        business_id: auth.businessId,
        name: cleanName,
        connection_key: connectionKey,
        secret_hash: secretHash,
        source_type: cleanSourceType,
        status: 'ACTIVE',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, business_id, name, connection_key, source_type, status, created_at, updated_at')
      .single();

    if (error || !data) {
      console.error('[LeadGuard Connections] Insert error:', error?.message);
      res.status(500).json({ success: false, error: 'Failed to create connection in database' });
      return;
    }

    const baseUrl = getAppBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/webhook/${data.connection_key}`;

    res.status(201).json({
      success: true,
      connection: {
        ...data,
        webhook_url: webhookUrl,
      },
      secret: plaintextSecret, // Plaintext secret returned ONCE so the user can copy it
      webhook_url: webhookUrl,
    });
  } catch (err) {
    console.error('[LeadGuard Connections] Create exception:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/connections/:id/revoke
 * Sets a connection status to REVOKED.
 */
export async function handleRevokeConnection(req: Request, res: Response): Promise<void> {
  const auth = await resolveAuthenticatedUserBusiness(req);
  if (!auth) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const connectionId = req.params.id;
  if (!connectionId) {
    res.status(400).json({ success: false, error: 'Missing connection ID' });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('webhook_connections')
      .update({
        status: 'REVOKED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
      .eq('business_id', auth.businessId);

    if (error) {
      res.status(500).json({ success: false, error: 'Unable to revoke connection' });
      return;
    }

    res.status(200).json({ success: true, message: 'Connection revoked' });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/connections/:id/regenerate-secret
 * Generates a new secret, updates hash in database, and returns the new secret ONCE.
 */
export async function handleRegenerateSecret(req: Request, res: Response): Promise<void> {
  const auth = await resolveAuthenticatedUserBusiness(req);
  if (!auth) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const connectionId = req.params.id;
  if (!connectionId) {
    res.status(400).json({ success: false, error: 'Missing connection ID' });
    return;
  }

  const newPlaintextSecret = generateSecret();
  const newSecretHash = hashSecret(newPlaintextSecret);
  const nowIso = new Date().toISOString();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('webhook_connections')
      .update({
        secret_hash: newSecretHash,
        status: 'ACTIVE',
        updated_at: nowIso,
      })
      .eq('id', connectionId)
      .eq('business_id', auth.businessId)
      .select('id, business_id, name, connection_key, source_type, status, created_at, updated_at')
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, error: 'Unable to regenerate secret' });
      return;
    }

    const baseUrl = getAppBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/webhook/${data.connection_key}`;

    res.status(200).json({
      success: true,
      connection: {
        ...data,
        webhook_url: webhookUrl,
      },
      new_secret: newPlaintextSecret, // Returned ONCE to copy
      webhook_url: webhookUrl,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
