import { createClient, SupabaseClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const rawSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabaseUrl = normalizeSupabaseUrl(rawUrl);
const supabaseSecretKey = rawSecretKey ? rawSecretKey.trim() : '';

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Returns an administrative Supabase client using the server-side secret API key.
 * This client is NEVER exposed to browser code.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not configured in the server environment.');
  }

  if (!supabaseSecretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not configured in the server environment. ' +
        'Please add SUPABASE_SECRET_KEY to your server-side environment variables.'
    );
  }

  cachedAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

/**
 * Verifies a user's JWT token from an incoming Authorization header (`Bearer <token>`).
 * Returns the authenticated user or null.
 */
export async function verifyUserToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const admin = getSupabaseAdmin();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

export interface WebhookConnectionRecord {
  id: string;
  business_id: string;
  name: string;
  connection_key: string;
  secret_hash: string;
  source_type: 'WEBSITE_FORM' | 'WEBHOOK';
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  updated_at: string;
}

/**
 * Resolves a webhook connection by its non-secret connection_key.
 */
export async function lookupWebhookConnection(
  connectionKey: string
): Promise<{ connection: WebhookConnectionRecord | null; error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('webhook_connections')
      .select('id, business_id, name, connection_key, secret_hash, source_type, status, created_at, updated_at')
      .eq('connection_key', connectionKey)
      .maybeSingle();

    if (error) {
      return { connection: null, error: error.message };
    }

    return { connection: (data as WebhookConnectionRecord) || null, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return { connection: null, error: msg };
  }
}

/**
 * Resolves target locations for the business to accurately calculate the +10 target location qualification score.
 */
export async function lookupBusinessTargetLocations(
  businessId: string
): Promise<string[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('businesses')
      .select('target_locations')
      .eq('id', businessId)
      .maybeSingle();

    if (data?.target_locations && Array.isArray(data.target_locations)) {
      return data.target_locations as string[];
    }
    return [];
  } catch {
    return [];
  }
}
