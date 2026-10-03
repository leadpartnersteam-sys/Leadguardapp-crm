import { supabase } from '../lib/supabase';

export interface WebhookConnection {
  id: string;
  business_id: string;
  name: string;
  connection_key: string;
  source_type: 'WEBSITE_FORM' | 'WEBHOOK';
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  updated_at: string;
  webhook_url: string;
}

export interface CreateConnectionResponse {
  success: boolean;
  connection?: WebhookConnection;
  secret?: string;
  webhook_url?: string;
  error?: string;
}

export interface RegenerateSecretResponse {
  success: boolean;
  connection?: WebhookConnection;
  new_secret?: string;
  webhook_url?: string;
  error?: string;
}

export interface WebhookTestResult {
  success: boolean;
  is_test?: boolean;
  message?: string;
  score?: number;
  status?: string;
  assessment?: string;
  received_payload?: Record<string, unknown>;
  error?: string;
  httpStatus?: number;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Session token retrieval failed
  }
  return {};
}

/**
 * Fetches all webhook connections for the current business.
 */
export async function fetchWebhookConnections(): Promise<{
  connections: WebhookConnection[];
  error?: string;
}> {
  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch('/api/connections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        connections: [],
        error: data.error || 'Failed to load connections',
      };
    }

    return { connections: data.connections || [] };
  } catch {
    return { connections: [], error: 'Unable to connect to server' };
  }
}

/**
 * Creates a new webhook connection.
 * The server generates the secret and returns the plaintext secret ONCE.
 */
export async function createWebhookConnection(
  name: string,
  sourceType: 'WEBSITE_FORM' | 'WEBHOOK' = 'WEBHOOK'
): Promise<CreateConnectionResponse> {
  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ name, source_type: sourceType }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to create webhook connection',
      };
    }

    return {
      success: true,
      connection: data.connection,
      secret: data.secret,
      webhook_url: data.webhook_url,
    };
  } catch {
    return {
      success: false,
      error: 'Network error while creating connection',
    };
  }
}

/**
 * Revokes an existing webhook connection.
 */
export async function revokeWebhookConnection(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to revoke connection',
      };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Network error while revoking connection' };
  }
}

/**
 * Regenerates the secret for an existing connection.
 * Returns the new plaintext secret ONCE.
 */
export async function regenerateWebhookSecret(
  connectionId: string
): Promise<RegenerateSecretResponse> {
  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch(
      `/api/connections/${encodeURIComponent(connectionId)}/regenerate-secret`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to regenerate secret',
      };
    }

    return {
      success: true,
      connection: data.connection,
      new_secret: data.new_secret,
      webhook_url: data.webhook_url,
    };
  } catch {
    return {
      success: false,
      error: 'Network error while regenerating secret',
    };
  }
}

/**
 * Sends a real controlled test payload through the webhook endpoint.
 * Sets `X-Test-Mode: true` so the server verifies credentials, qualifies the payload,
 * but does NOT insert a production lead into the database.
 */
export async function testWebhookEndpoint(
  webhookUrl: string,
  secret: string,
  samplePayload?: Record<string, unknown>
): Promise<WebhookTestResult> {
  const payload = samplePayload || {
    name: 'Sarah Connor',
    phone: '+27 82 555 9900',
    email: 'sarah.connor@example.com',
    service: 'Solar Inverter Installation',
    location: 'Sandton',
    budget: 150000,
    timeline: '14 days',
    decision_maker: true,
    specific_need: '10kW hybrid solar system with lithium battery storage',
    engaged: true,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret,
        'X-Test-Mode': 'true',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        httpStatus: res.status,
        error:
          data.error ||
          (data.errors ? data.errors.join(', ') : `HTTP ${res.status}: Verification failed`),
      };
    }

    return {
      success: true,
      is_test: true,
      message: data.message || 'Connection successful',
      score: data.score,
      status: data.status,
      assessment: data.assessment,
      received_payload: data.received_payload,
      httpStatus: res.status,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reach webhook endpoint',
    };
  }
}
