import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes the Supabase project URL so that if a REST endpoint suffix
 * (such as `/rest/v1` or `/rest/v1/`) is included in VITE_SUPABASE_URL,
 * `createClient` receives the canonical base project origin (`https://<project>.supabase.co`).
 */
function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabasePublishableKey = rawPublishableKey ? rawPublishableKey.trim() : '';

/**
 * Validates that both required Supabase environment variables exist and are well-formed.
 * Never logs or exposes the key values in errors or UI output.
 */
export function validateSupabaseEnv(): {
  isConfigured: boolean;
  errorMessage: string | null;
} {
  if (!supabaseUrl) {
    return {
      isConfigured: false,
      errorMessage:
        'Missing required environment variable: VITE_SUPABASE_URL is not set.',
    };
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      return {
        isConfigured: false,
        errorMessage: 'Invalid VITE_SUPABASE_URL: Must use HTTPS protocol.',
      };
    }
  } catch {
    return {
      isConfigured: false,
      errorMessage: 'Invalid VITE_SUPABASE_URL: Must be a valid URL.',
    };
  }

  if (!supabasePublishableKey) {
    return {
      isConfigured: false,
      errorMessage:
        'Missing required environment variable: VITE_SUPABASE_PUBLISHABLE_KEY is not set.',
    };
  }

  return {
    isConfigured: true,
    errorMessage: null,
  };
}

export const supabaseEnvStatus = validateSupabaseEnv();

/**
 * Single reusable official Supabase JavaScript client instance.
 * Uses only the public/publishable key and relies on Supabase Auth + Row Level Security (RLS).
 * Never uses a service-role or secret key on the client.
 */
export const supabase: SupabaseClient | null = supabaseEnvStatus.isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Helper to retrieve the validated Supabase client or throw a safe, non-sensitive error.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      supabaseEnvStatus.errorMessage ||
        'Supabase client is not configured. Please check your environment variables.'
    );
  }
  return supabase;
}
