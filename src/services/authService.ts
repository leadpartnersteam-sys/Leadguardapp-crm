import { User } from '@supabase/supabase-js';
import { supabase, supabaseEnvStatus } from '../lib/supabase';
import { sanitizeString } from '../lib/validation';
import { BusinessTenant, UserSession } from '../types/leadguard';

const DEFAULT_TARGET_LOCATIONS = [
  'Sandton',
  'Midrand',
  'Fourways',
  'Bryanston',
  'Rosebank',
  'Centurion',
  'Pretoria',
  'Johannesburg',
  'Cape Town',
];

/**
 * Maps Supabase Auth errors to safe, user-friendly messages.
 * Never exposes database internals, stack traces, tokens, or secrets.
 */
function toSafeAuthErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }
  const msg = String((error as { message?: unknown }).message || '').toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email address using the link sent to your inbox before signing in.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('password should be at least')) {
    return 'Password is too weak. Please choose a stronger password (at least 8 characters).';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  return fallback;
}

/**
 * Resolves the authenticated user's `profiles` and `businesses` records from Supabase,
 * or creates a new `businesses` and `profiles` link if the user is completing sign-up
 * (e.g., immediately after sign-up or upon first login after email confirmation).
 *
 * Security:
 * - Never trusts or accepts a client-supplied `business_id`.
 * - Always resolves `business_id` from the `profiles` table for `auth.uid()` (`user.id`),
 *   or generates a fresh `businesses` row server-side in PostgreSQL and links `profiles.business_id`.
 */
export async function resolveOrCreateUserWorkspace(params: {
  user: User;
  preferredFullName?: string;
  preferredBusinessName?: string;
}): Promise<{
  session: UserSession | null;
  errorMessage: string | null;
}> {
  if (!supabaseEnvStatus.isConfigured || !supabase) {
    return {
      session: null,
      errorMessage:
        supabaseEnvStatus.errorMessage ||
        'Authentication service is not configured.',
    };
  }

  const { user, preferredFullName, preferredBusinessName } = params;
  const userId = user.id;
  const userEmail = sanitizeString(user.email || '', 160);

  const metaFullName = sanitizeString(
    preferredFullName ||
      (user.user_metadata?.full_name as string | undefined) ||
      userEmail.split('@')[0] ||
      'Business Owner',
    100
  );

  const metaBusinessName = sanitizeString(
    preferredBusinessName ||
      (user.user_metadata?.business_name as string | undefined) ||
      `${metaFullName}'s Business`,
    120
  );

  try {
    // 1. Check if a profile already exists for this authenticated user (id = auth.uid())
    const { data: existingProfile, error: profileSelectError } = await supabase
      .from('profiles')
      .select('id, business_id, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!profileSelectError && existingProfile && existingProfile.business_id) {
      const authorizedBusinessId = String(existingProfile.business_id);

      // Load the linked business record
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id, business_name, created_at')
        .eq('id', authorizedBusinessId)
        .maybeSingle();

      const resolvedBusinessName = sanitizeString(
        existingBusiness?.business_name || metaBusinessName,
        120
      );

      const businessTenant: BusinessTenant = {
        id: authorizedBusinessId,
        business_name: resolvedBusinessName,
        industry: 'Service & Contracting Business',
        target_locations: DEFAULT_TARGET_LOCATIONS,
        currency_symbol: 'R',
        created_at: existingBusiness?.created_at
          ? String(existingBusiness.created_at).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      };

      return {
        session: {
          user_id: userId,
          full_name: sanitizeString(
            existingProfile.full_name || metaFullName,
            100
          ),
          email: sanitizeString(existingProfile.email || userEmail, 160),
          role: 'owner',
          business: businessTenant,
        },
        errorMessage: null,
      };
    }

    // 2. No profile exists yet for this authenticated user:
    //    Create a new record in `businesses` (database generates `id` via UUID default)
    const { data: createdBusiness, error: businessInsertError } = await supabase
      .from('businesses')
      .insert({
        business_name: metaBusinessName,
      })
      .select('id, business_name, created_at')
      .single();

    if (businessInsertError || !createdBusiness || !createdBusiness.id) {
      return {
        session: null,
        errorMessage:
          'Unable to initialize your business workspace. Please verify your database permissions.',
      };
    }

    const newBusinessId = String(createdBusiness.id);

    // 3. Create the corresponding record in `profiles` linked to the newly created business
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        business_id: newBusinessId,
        full_name: metaFullName,
        email: userEmail,
      });

    if (profileInsertError) {
      return {
        session: null,
        errorMessage:
          'Unable to link your user profile to your business workspace.',
      };
    }

    const businessTenant: BusinessTenant = {
      id: newBusinessId,
      business_name: sanitizeString(
        createdBusiness.business_name || metaBusinessName,
        120
      ),
      industry: 'Service & Contracting Business',
      target_locations: DEFAULT_TARGET_LOCATIONS,
      currency_symbol: 'R',
      created_at: createdBusiness.created_at
        ? String(createdBusiness.created_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    };

    return {
      session: {
        user_id: userId,
        full_name: metaFullName,
        email: userEmail,
        role: 'owner',
        business: businessTenant,
      },
      errorMessage: null,
    };
  } catch {
    return {
      session: null,
      errorMessage:
        'Unable to complete workspace authentication. Please try again.',
    };
  }
}

/**
 * Signs up a new user with Supabase Auth email/password, creates a new `businesses` record,
 * and creates a linked `profiles` record when an active session is established.
 * If email confirmation is required by the Supabase project, handles the confirmation state cleanly.
 */
export async function signUpWithSupabase(params: {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  requiresEmailConfirmation?: boolean;
  session?: UserSession;
  errorMessage?: string;
}> {
  if (!supabaseEnvStatus.isConfigured || !supabase) {
    return {
      success: false,
      errorMessage:
        supabaseEnvStatus.errorMessage ||
        'Authentication service is not configured.',
    };
  }

  const cleanFullName = sanitizeString(params.fullName, 100);
  const cleanBusinessName = sanitizeString(params.businessName, 120);
  const cleanEmail = params.email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        data: {
          full_name: cleanFullName,
          business_name: cleanBusinessName,
        },
      },
    });

    if (error) {
      return {
        success: false,
        errorMessage: toSafeAuthErrorMessage(
          error,
          'Unable to create your account. Please check your details and try again.'
        ),
      };
    }

    if (!data.user) {
      return {
        success: false,
        errorMessage: 'Unable to create user account. Please try again.',
      };
    }

    // If Supabase email confirmation is enabled, `data.session` will be null until confirmed.
    if (!data.session) {
      return {
        success: true,
        requiresEmailConfirmation: true,
      };
    }

    // Active session exists immediately: create `businesses` and `profiles` records now
    const workspace = await resolveOrCreateUserWorkspace({
      user: data.user,
      preferredFullName: cleanFullName,
      preferredBusinessName: cleanBusinessName,
    });

    if (!workspace.session) {
      return {
        success: false,
        errorMessage:
          workspace.errorMessage ||
          'Account created, but workspace setup could not be completed.',
      };
    }

    return {
      success: true,
      session: workspace.session,
    };
  } catch {
    return {
      success: false,
      errorMessage:
        'A network error occurred while creating your account. Please try again.',
    };
  }
}

/**
 * Authenticates an existing user via Supabase Auth email/password and resolves their
 * isolated business workspace.
 */
export async function signInWithSupabase(params: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  session?: UserSession;
  errorMessage?: string;
}> {
  if (!supabaseEnvStatus.isConfigured || !supabase) {
    return {
      success: false,
      errorMessage:
        supabaseEnvStatus.errorMessage ||
        'Authentication service is not configured.',
    };
  }

  const cleanEmail = params.email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: params.password,
    });

    if (error || !data.user) {
      return {
        success: false,
        errorMessage: toSafeAuthErrorMessage(
          error,
          'Incorrect email or password. Please try again.'
        ),
      };
    }

    const workspace = await resolveOrCreateUserWorkspace({
      user: data.user,
    });

    if (!workspace.session) {
      return {
        success: false,
        errorMessage:
          workspace.errorMessage ||
          'Signed in, but unable to load your business profile.',
      };
    }

    return {
      success: true,
      session: workspace.session,
    };
  } catch {
    return {
      success: false,
      errorMessage:
        'A network error occurred while signing in. Please try again.',
    };
  }
}

/**
 * Updates the authenticated user's `full_name` in `profiles` and `business_name` in `businesses`
 * using the server-verified user session.
 */
export async function updateAuthenticatedProfileAndBusiness(params: {
  session: UserSession;
  fullName: string;
  businessName: string;
}): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  if (!supabaseEnvStatus.isConfigured || !supabase) {
    return {
      success: false,
      errorMessage: 'Database connection is not configured.',
    };
  }

  const cleanFullName = sanitizeString(params.fullName, 100);
  const cleanBusinessName = sanitizeString(params.businessName, 120);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== params.session.user_id) {
      return {
        success: false,
        errorMessage: 'Your session has expired. Please sign in again.',
      };
    }

    // Verify business_id from `profiles` for `auth.uid()` rather than trusting client state
    const { data: profileRow, error: profileFetchError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !profileRow?.business_id) {
      return {
        success: false,
        errorMessage: 'Unable to verify your business profile.',
      };
    }

    const verifiedBusinessId = String(profileRow.business_id);

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ full_name: cleanFullName })
      .eq('id', user.id);

    if (profileUpdateError) {
      return {
        success: false,
        errorMessage: 'Unable to update your profile name.',
      };
    }

    const { error: businessUpdateError } = await supabase
      .from('businesses')
      .update({ business_name: cleanBusinessName })
      .eq('id', verifiedBusinessId);

    if (businessUpdateError) {
      return {
        success: false,
        errorMessage: 'Unable to update your business name.',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      errorMessage: 'Unable to save changes right now. Please try again.',
    };
  }
}
