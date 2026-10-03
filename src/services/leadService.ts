import {
  formatBudgetDisplay,
  parseBudgetAmount,
  parseTimelineDays,
  qualifyLeadDeterministically,
} from '../lib/qualification';
import { supabase, supabaseEnvStatus } from '../lib/supabase';
import { sanitizeString, validateLeadPayload } from '../lib/validation';
import {
  BusinessTenant,
  Lead,
  LeadInputPayload,
  LeadNote,
  LeadSourceDefinition,
  LeadSourceType,
  LeadStatus,
  UserSession,
} from '../types/leadguard';

/**
 * Formats an ISO or raw timestamp into a clean human-readable date string (`YYYY-MM-DD HH:mm`).
 */
export function formatTimestampDisplay(raw: unknown): string {
  if (!raw) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(parsed.getDate()).padStart(2, '0')} ${String(
      parsed.getHours()
    ).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  }
  return str.slice(0, 16).replace('T', ' ');
}

/**
 * Parses the `notes` field stored in Supabase `leads.notes` (text or array)
 * into structured LeadNote objects for display in Lead Details.
 */
export function parseStoredNotes(params: {
  rawNotes: unknown;
  leadId: string;
  businessId: string;
  defaultAuthor: string;
  defaultTimestamp: string;
}): LeadNote[] {
  const { rawNotes, leadId, businessId, defaultAuthor, defaultTimestamp } =
    params;

  if (!rawNotes) return [];

  if (Array.isArray(rawNotes)) {
    return rawNotes
      .map((item, idx) => {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const content = sanitizeString(obj.content ?? '', 1000);
          if (!content) return null;
          return {
            id: String(obj.id || `note_${leadId}_${idx}`),
            lead_id: leadId,
            business_id: businessId,
            author_name: sanitizeString(obj.author_name || defaultAuthor, 100),
            content,
            created_at: formatTimestampDisplay(
              obj.created_at || defaultTimestamp
            ),
          };
        }
        return null;
      })
      .filter((n): n is LeadNote => n !== null);
  }

  if (typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim();
    if (!trimmed) return [];

    // Split multiple note blocks separated by double newlines
    const blocks = trimmed
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);

    return blocks.map((block, index) => {
      const metaMatch = block.match(/^\[([^\]]+)\s*\|\s*([^\]]+)\]\s*([\s\S]+)$/);
      if (metaMatch) {
        return {
          id: `note_${leadId}_${index}`,
          lead_id: leadId,
          business_id: businessId,
          created_at: sanitizeString(metaMatch[1], 40),
          author_name: sanitizeString(metaMatch[2], 100),
          content: sanitizeString(metaMatch[3], 1000),
        };
      }
      return {
        id: `note_${leadId}_${index}`,
        lead_id: leadId,
        business_id: businessId,
        author_name: defaultAuthor,
        content: sanitizeString(block, 1000),
        created_at: defaultTimestamp,
      };
    });
  }

  return [];
}

/**
 * Serializes LeadNote items into a clean text string for the `leads.notes` column.
 */
export function serializeNotesForDatabase(notes: LeadNote[]): string | null {
  if (!notes || notes.length === 0) return null;
  if (notes.length === 1) {
    return sanitizeString(notes[0].content, 1000) || null;
  }
  return notes
    .map(
      (n) =>
        `[${n.created_at} | ${n.author_name}] ${sanitizeString(n.content, 1000)}`
    )
    .join('\n\n');
}

/**
 * Builds a complete Lead entity from validated input using the deterministic qualification engine.
 */
export function buildQualifiedLeadEntity(params: {
  id: string;
  business: BusinessTenant;
  payload: LeadInputPayload;
  date_added: string;
  updated_at?: string;
  existing_notes?: LeadNote[];
  author_name?: string;
  persistedScore?: number | null;
  persistedStatus?: LeadStatus | null;
  persistedAssessment?: string | null;
}): Lead {
  const {
    id,
    business,
    payload,
    date_added,
    updated_at,
    existing_notes = [],
    author_name = 'Team Member',
    persistedScore,
    persistedStatus,
    persistedAssessment,
  } = params;

  const qualification = qualifyLeadDeterministically(
    payload,
    business.target_locations
  );

  const budgetNumeric = parseBudgetAmount(payload.budget);
  const budgetDisplay = formatBudgetDisplay(
    budgetNumeric,
    business.currency_symbol
  );
  const timelineDays = parseTimelineDays(payload.timeline);

  const notes: LeadNote[] = [...existing_notes];
  if (
    payload.notes &&
    payload.notes.trim().length > 0 &&
    existing_notes.length === 0
  ) {
    notes.unshift({
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      lead_id: id,
      business_id: business.id,
      author_name,
      content: sanitizeString(payload.notes, 1000),
      created_at: date_added,
    });
  }

  const finalScore =
    typeof persistedScore === 'number' &&
    Number.isFinite(persistedScore) &&
    persistedScore >= 0 &&
    persistedScore <= 100
      ? persistedScore
      : qualification.score;

  const finalStatus: LeadStatus =
    persistedStatus === LeadStatus.HOT ||
    persistedStatus === LeadStatus.WARM ||
    persistedStatus === LeadStatus.COLD
      ? persistedStatus
      : qualification.status;

  const finalAssessment =
    typeof persistedAssessment === 'string' &&
    persistedAssessment.trim().length > 0
      ? persistedAssessment.trim()
      : qualification.assessment;

  return {
    id,
    business_id: business.id,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    service: payload.service,
    location: payload.location,
    budget: budgetNumeric,
    budget_display: budgetDisplay,
    timeline: payload.timeline || 'Not specified',
    timeline_days: timelineDays,
    decision_maker: payload.decision_maker,
    specific_need: payload.specific_need || 'Not specified',
    engaged: payload.engaged,
    source: payload.source,
    score: finalScore,
    status: finalStatus,
    breakdown: qualification.breakdown,
    assessment: finalAssessment,
    notes,
    date_added,
    updated_at: updated_at || date_added,
    requires_attention:
      finalStatus === LeadStatus.HOT ||
      (finalStatus === LeadStatus.WARM && finalScore >= 65),
  };
}

export const INITIAL_LEAD_SOURCES: LeadSourceDefinition[] = [
  {
    id: 'src_website_forms',
    name: 'Website Forms',
    sourceType: 'Website',
    description:
      'Capture inquiries directly from your company website contact or quote request forms via a validated HTTPS server endpoint.',
    status: 'NOT CONNECTED',
    category: 'automated',
    architectureSteps: [
      'Customer Website Form submits HTTPS POST request',
      'LeadGuard Server Endpoint authenticates request credential',
      'Server validates & sanitizes payload fields and length limits',
      'Server resolves authorized business_id from endpoint credential',
      'Lead saved to Supabase PostgreSQL with Row Level Security',
      'Automatic Point Qualifier calculates 0–100 score & HOT/WARM/COLD tier',
      'LeadGuard Assessment generated and surfaced on Business Dashboard',
    ],
    securityNotes: [
      'Your public website never receives or uses a Supabase service-role key or database password.',
      'CORS validation, rate limiting, and server-side schema checks reject malformed or oversized requests.',
      'Business ownership is resolved strictly server-side from the endpoint credential, never from a client-supplied business_id.',
    ],
  },
  {
    id: 'src_make_com',
    name: 'Make.com',
    sourceType: 'Make.com',
    description:
      'Connect external lead channels, landing pages, and form tools into LeadGuard through Make.com automation scenarios.',
    status: 'NOT CONNECTED',
    category: 'automated',
    architectureSteps: [
      'External Lead Source triggers Make.com Scenario',
      'Make.com HTTP module sends POST payload to LeadGuard Webhook',
      'LeadGuard Server verifies per-business authentication header',
      'Server validates lead schema and strips unsafe markup',
      'Authorized business_id assigned server-side',
      'Deterministic score & LeadGuard Assessment computed automatically',
      'Lead appears immediately in your Business Dashboard',
    ],
    securityNotes: [
      'Each business connection uses an isolated, revocable server-side credential.',
      'Webhook signing secrets are never returned in regular frontend API responses or stored in browser storage.',
      'Supports credential rotation and immediate revocation if a scenario is decommissioned.',
    ],
  },
  {
    id: 'src_google_ads',
    name: 'Google Ads',
    sourceType: 'Google Ads',
    description:
      'Receive leads captured via Google Ads Lead Form extensions automatically into your qualification pipeline.',
    status: 'COMING SOON',
    category: 'future_oauth',
    architectureSteps: [
      'Planned official Google Ads API & OAuth 2.0 server-side integration',
      'Google Lead Form webhook delivers payload to LeadGuard server',
      'Server verifies webhook signature and maps campaign lead fields',
      'Automatic qualification and scoring into Business Dashboard',
    ],
    securityNotes: [
      'Future integration will use official Google OAuth 2.0 and webhook verification.',
      'LeadGuard will never ask for your Google password.',
      'OAuth client secrets, access tokens, and refresh tokens will remain strictly server-side.',
    ],
  },
  {
    id: 'src_meta_ads',
    name: 'Facebook / Instagram',
    sourceType: 'Facebook',
    description:
      'Sync leads from Meta Instant Forms across Facebook and Instagram campaigns directly into LeadGuard.',
    status: 'COMING SOON',
    category: 'future_oauth',
    architectureSteps: [
      'Planned official Meta Graph API & OAuth 2.0 server-side integration',
      'Meta Leadgen webhook notifies LeadGuard server of new form submission',
      'Server retrieves lead details using server-side page access token',
      'Automatic qualification and scoring into Business Dashboard',
    ],
    securityNotes: [
      'Future integration will use Meta official APIs and OAuth 2.0.',
      'LeadGuard will never request Facebook or Instagram user passwords.',
      'Meta access tokens and app secrets will never be exposed in frontend code.',
    ],
  },
  {
    id: 'src_webhook_api',
    name: 'Webhook / API',
    sourceType: 'Webhook/API',
    description:
      'Universal HTTPS JSON endpoint allowing custom software, industry portals, or internal systems to push leads into LeadGuard.',
    status: 'NOT CONNECTED',
    category: 'automated',
    architectureSteps: [
      'External system sends HTTPS POST with JSON payload',
      'Server authenticates Bearer / Webhook header before parsing body',
      'Strict field validation checks types, bounds, and contact formats',
      'Unauthorized or malformed payloads are rejected with safe HTTP status codes',
      'Valid lead is persisted, scored (0–100), and assessed automatically',
    ],
    securityNotes: [
      'All incoming fields are treated as untrusted and sanitized against XSS and SQL injection.',
      'Client-supplied business_id or score values in the JSON body are ignored; the server calculates the authoritative score.',
    ],
  },
  {
    id: 'src_manual_entry',
    name: 'Manual Entry',
    sourceType: 'Manual',
    description:
      'Fallback form for logging walk-in clients, direct phone inquiries, or site referrals when automatic intake does not apply.',
    status: 'CONNECTED',
    category: 'fallback',
    lastSyncAt: 'Active fallback',
    architectureSteps: [
      'Team member enters lead details in the Add Lead fallback form',
      'Payload is validated using the same strict server-grade rules',
      'Qualification score (0–100) and HOT/WARM/COLD status are calculated automatically',
      'LeadGuard Assessment is generated immediately from submitted facts',
    ],
    securityNotes: [
      'Users cannot manually override or fabricate a qualification score.',
      'Every manual entry is scoped strictly to the authenticated user’s business_id.',
    ],
  },
];

/**
 * ============================================================================
 * SUPABASE AUTHORIZED TENANT & LEADS DATABASE LAYER
 *
 * Security Rules Enforced:
 * 1. Get the authenticated Supabase user via `supabase.auth.getUser()`.
 * 2. Retrieve that user's profile from `profiles` (`WHERE id = user.id`).
 * 3. Determine the user's `business_id` strictly from `profiles.business_id`.
 * 4. Never trust a `business_id`, `score`, `status`, or `assessment` from the frontend.
 * 5. Rely on Supabase Row Level Security (RLS) policies and parameterized queries.
 * ============================================================================
 */

const LEAD_SELECT_COLUMNS =
  'id, business_id, name, phone, email, service, location, budget, timeline, decision_maker, specific_need, engaged, lead_source, score, status, assessment, notes, created_at, updated_at';

const LEAD_SELECT_COLUMNS_FALLBACK =
  'id, business_id, name, phone, email, service, location, budget, timeline, decision_maker, specific_need, engaged, lead_source, score, status, assessment, notes, created_at';

interface VerifiedBusinessContext {
  userId: string;
  businessId: string;
  fullName: string;
}

/**
 * Resolves the authenticated user and their authorized `business_id` directly from
 * Supabase Auth + the `profiles` table. Never trusts client-provided IDs.
 */
async function resolveVerifiedBusinessContext(): Promise<{
  context: VerifiedBusinessContext | null;
  errorMessage: string | null;
}> {
  if (!supabaseEnvStatus.isConfigured || !supabase) {
    return {
      context: null,
      errorMessage:
        supabaseEnvStatus.errorMessage ||
        'Database connection is not configured.',
    };
  }

  try {
    // 1. Get the authenticated Supabase user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        context: null,
        errorMessage: 'Your session has expired. Please sign in again.',
      };
    }

    // 2. Retrieve that user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, business_id, full_name')
      .eq('id', user.id)
      .single();

    // 3. Determine the user's business through the profile
    if (profileError || !profile || !profile.business_id) {
      return {
        context: null,
        errorMessage:
          'Unable to verify your business profile. Please sign out and sign in again.',
      };
    }

    return {
      context: {
        userId: String(profile.id),
        businessId: String(profile.business_id),
        fullName: sanitizeString(profile.full_name || 'Team Member', 100),
      },
      errorMessage: null,
    };
  } catch {
    return {
      context: null,
      errorMessage: 'Unable to verify your session with the database.',
    };
  }
}

/**
 * Maps a raw database row from `public.leads` into a strongly typed `Lead` entity.
 */
function mapDatabaseRowToLead(
  row: Record<string, unknown>,
  business: BusinessTenant,
  defaultAuthor: string
): Lead {
  const leadId = String(row.id);
  const businessId = String(row.business_id || business.id);
  const rawSource = sanitizeString(
    row.lead_source ?? row.source ?? 'Website',
    40
  ) as LeadSourceType;

  const payload: LeadInputPayload = {
    name: sanitizeString(row.name ?? 'Lead', 120),
    phone: sanitizeString(row.phone ?? '', 32),
    email: sanitizeString(row.email ?? '', 160),
    service: sanitizeString(row.service ?? '', 120),
    location: sanitizeString(row.location ?? '', 120),
    budget:
      typeof row.budget === 'number' || typeof row.budget === 'string'
        ? row.budget
        : null,
    timeline: sanitizeString(row.timeline ?? '', 80),
    decision_maker: Boolean(row.decision_maker),
    specific_need: sanitizeString(row.specific_need ?? '', 500),
    engaged: Boolean(row.engaged),
    source: rawSource || 'Website',
  };

  const createdAtDisplay = formatTimestampDisplay(
    row.created_at ?? row.date_added
  );
  const updatedAtDisplay = formatTimestampDisplay(
    row.updated_at ?? row.created_at ?? row.date_added
  );

  const parsedNotes = parseStoredNotes({
    rawNotes: row.notes,
    leadId,
    businessId,
    defaultAuthor,
    defaultTimestamp: updatedAtDisplay,
  });

  const rawScore =
    typeof row.score === 'number'
      ? row.score
      : typeof row.score === 'string' && row.score.trim() !== ''
      ? Number(row.score)
      : null;

  const rawStatus = String(row.status || '').toUpperCase();
  const persistedStatus =
    rawStatus === LeadStatus.HOT
      ? LeadStatus.HOT
      : rawStatus === LeadStatus.WARM
      ? LeadStatus.WARM
      : rawStatus === LeadStatus.COLD
      ? LeadStatus.COLD
      : null;

  const persistedAssessment =
    typeof row.assessment === 'string' && row.assessment.trim().length > 0
      ? row.assessment
      : null;

  return buildQualifiedLeadEntity({
    id: leadId,
    business: {
      ...business,
      id: businessId,
    },
    payload,
    date_added: createdAtDisplay,
    updated_at: updatedAtDisplay,
    existing_notes: parsedNotes,
    author_name: defaultAuthor,
    persistedScore: rawScore,
    persistedStatus,
    persistedAssessment,
  });
}

/**
 * 1. LOAD REAL LEADS
 * Follows the strict 5-step authorization sequence:
 * 1. Get authenticated Supabase user
 * 2. Retrieve user's profile
 * 3. Determine user's business_id through the profile
 * 4. Query only leads belonging to that business
 * 5. Return mapped leads for the UI
 */
export async function fetchAuthorizedLeadsFromSupabase(
  session: UserSession
): Promise<{ leads: Lead[] | null; error: string | null }> {
  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      leads: null,
      error: errorMessage || 'Unable to authenticate your workspace.',
    };
  }

  try {
    let { data, error } = await supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS)
      .eq('business_id', context.businessId)
      .order('created_at', { ascending: false });

    // Graceful fallback if the `updated_at` column is not present on the table
    if (error && String(error.message || '').includes('updated_at')) {
      const retry = await supabase
        .from('leads')
        .select(LEAD_SELECT_COLUMNS_FALLBACK)
        .eq('business_id', context.businessId)
        .order('created_at', { ascending: false });
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) {
      return {
        leads: null,
        error:
          'Unable to load your leads right now. Please try refreshing the page.',
      };
    }

    if (!data || data.length === 0) {
      return { leads: [], error: null };
    }

    const authorizedBusiness: BusinessTenant = {
      ...session.business,
      id: context.businessId,
    };

    const mappedLeads: Lead[] = (data as unknown as Array<Record<string, unknown>>)
      .filter((row) => String(row.business_id) === context.businessId)
      .map((row) =>
        mapDatabaseRowToLead(row, authorizedBusiness, context.fullName)
      );

    return { leads: mappedLeads, error: null };
  } catch {
    return {
      leads: null,
      error: 'A network error occurred while loading your leads.',
    };
  }
}

/**
 * 3, 4 & 5. ADD LEAD WITH AUTOMATIC DETERMINISTIC QUALIFICATION & ASSESSMENT
 * Validates input, resolves `business_id` from the authenticated user's profile,
 * calculates `score`, `status`, and `assessment`, and inserts into Supabase `leads`.
 */
export async function createLeadInSupabase(params: {
  session: UserSession;
  rawPayload: unknown;
}): Promise<{
  success: boolean;
  errors: string[];
  lead?: Lead;
}> {
  const validation = validateLeadPayload(params.rawPayload);
  if (!validation.valid || !validation.sanitized) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      success: false,
      errors: [errorMessage || 'Unauthorized: Please sign in again.'],
    };
  }

  const sanitized = validation.sanitized;
  const authorizedBusiness: BusinessTenant = {
    ...params.session.business,
    id: context.businessId,
  };

  // Deterministic 6-factor qualification & factual assessment calculation
  const qualification = qualifyLeadDeterministically(
    sanitized,
    authorizedBusiness.target_locations
  );

  const budgetNumeric = parseBudgetAmount(sanitized.budget);
  const nowIso = new Date().toISOString();
  const cleanNotes = sanitized.notes
    ? sanitizeString(sanitized.notes, 1000)
    : null;

  const insertRecordWithUpdated = {
    business_id: context.businessId,
    name: sanitized.name,
    phone: sanitized.phone,
    email: sanitized.email,
    service: sanitized.service,
    location: sanitized.location,
    budget: budgetNumeric,
    timeline: sanitized.timeline || 'Not specified',
    decision_maker: sanitized.decision_maker,
    specific_need: sanitized.specific_need || 'Not specified',
    engaged: sanitized.engaged,
    lead_source: sanitized.source,
    notes: cleanNotes,
    score: qualification.score,
    status: qualification.status,
    assessment: qualification.assessment,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    let { data, error } = await supabase
      .from('leads')
      .insert(insertRecordWithUpdated)
      .select(LEAD_SELECT_COLUMNS)
      .single();

    if (error && String(error.message || '').includes('updated_at')) {
      const { updated_at: _omit, ...insertRecordFallback } =
        insertRecordWithUpdated;
      const retry = await supabase
        .from('leads')
        .insert(insertRecordFallback)
        .select(LEAD_SELECT_COLUMNS_FALLBACK)
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        success: false,
        errors: [
          'Unable to save lead to the database. Please check your connection and try again.',
        ],
      };
    }

    const createdLead = mapDatabaseRowToLead(
      data as unknown as Record<string, unknown>,
      authorizedBusiness,
      context.fullName
    );

    return {
      success: true,
      errors: [],
      lead: createdLead,
    };
  } catch {
    return {
      success: false,
      errors: ['A network error occurred while saving the lead.'],
    };
  }
}

/**
 * 7. EDIT LEAD
 * Validates updated fields, recalculates `score`, `status`, and `assessment`,
 * updates `updated_at`, and never allows modifying `id`, `business_id`, or `created_at`.
 */
export async function updateLeadInSupabase(params: {
  session: UserSession;
  existingLead: Lead;
  rawPayload: unknown;
}): Promise<{
  success: boolean;
  errors: string[];
  lead?: Lead;
}> {
  const validation = validateLeadPayload(params.rawPayload);
  if (!validation.valid || !validation.sanitized) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      success: false,
      errors: [errorMessage || 'Unauthorized: Please sign in again.'],
    };
  }

  if (params.existingLead.business_id !== context.businessId) {
    return {
      success: false,
      errors: ['Access denied: You can only edit leads belonging to your business.'],
    };
  }

  const sanitized = validation.sanitized;
  const authorizedBusiness: BusinessTenant = {
    ...params.session.business,
    id: context.businessId,
  };

  // Recalculate qualification score, status, and LeadGuard Assessment deterministically
  const qualification = qualifyLeadDeterministically(
    sanitized,
    authorizedBusiness.target_locations
  );

  const budgetNumeric = parseBudgetAmount(sanitized.budget);
  const nowIso = new Date().toISOString();

  // Preserve existing structured notes unless edited in the form
  const notesForDb =
    sanitized.notes !== undefined
      ? sanitizeString(sanitized.notes, 1000) || null
      : serializeNotesForDatabase(params.existingLead.notes);

  // Do NOT allow editing of `id`, `business_id`, or `created_at`
  const updatePayloadWithUpdated = {
    name: sanitized.name,
    phone: sanitized.phone,
    email: sanitized.email,
    service: sanitized.service,
    location: sanitized.location,
    budget: budgetNumeric,
    timeline: sanitized.timeline || 'Not specified',
    decision_maker: sanitized.decision_maker,
    specific_need: sanitized.specific_need || 'Not specified',
    engaged: sanitized.engaged,
    lead_source: sanitized.source,
    notes: notesForDb,
    score: qualification.score,
    status: qualification.status,
    assessment: qualification.assessment,
    updated_at: nowIso,
  };

  try {
    let { data, error } = await supabase
      .from('leads')
      .update(updatePayloadWithUpdated)
      .eq('id', params.existingLead.id)
      .eq('business_id', context.businessId)
      .select(LEAD_SELECT_COLUMNS)
      .single();

    if (error && String(error.message || '').includes('updated_at')) {
      const { updated_at: _omit, ...updatePayloadFallback } =
        updatePayloadWithUpdated;
      const retry = await supabase
        .from('leads')
        .update(updatePayloadFallback)
        .eq('id', params.existingLead.id)
        .eq('business_id', context.businessId)
        .select(LEAD_SELECT_COLUMNS_FALLBACK)
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        success: false,
        errors: [
          'Unable to update lead in the database. Please try again.',
        ],
      };
    }

    const updatedLead = mapDatabaseRowToLead(
      data as unknown as Record<string, unknown>,
      authorizedBusiness,
      context.fullName
    );

    return {
      success: true,
      errors: [],
      lead: updatedLead,
    };
  } catch {
    return {
      success: false,
      errors: ['A network error occurred while updating the lead.'],
    };
  }
}

/**
 * Updates internal notes for a lead in Supabase `leads` and sets `updated_at`.
 */
export async function updateLeadNotesInSupabase(params: {
  session: UserSession;
  lead: Lead;
  updatedNotes: LeadNote[];
}): Promise<{
  success: boolean;
  lead?: Lead;
  errorMessage?: string;
}> {
  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      success: false,
      errorMessage: errorMessage || 'Unauthorized: Please sign in again.',
    };
  }

  if (params.lead.business_id !== context.businessId) {
    return {
      success: false,
      errorMessage: 'Access denied.',
    };
  }

  const serializedNotes = serializeNotesForDatabase(params.updatedNotes);
  const nowIso = new Date().toISOString();

  try {
    let { error } = await supabase
      .from('leads')
      .update({
        notes: serializedNotes,
        updated_at: nowIso,
      })
      .eq('id', params.lead.id)
      .eq('business_id', context.businessId);

    if (error && String(error.message || '').includes('updated_at')) {
      const retry = await supabase
        .from('leads')
        .update({
          notes: serializedNotes,
        })
        .eq('id', params.lead.id)
        .eq('business_id', context.businessId);
      error = retry.error;
    }

    if (error) {
      return {
        success: false,
        errorMessage: 'Unable to save note to database.',
      };
    }

    return {
      success: true,
      lead: {
        ...params.lead,
        notes: params.updatedNotes,
        updated_at: formatTimestampDisplay(nowIso),
      },
    };
  } catch {
    return {
      success: false,
      errorMessage: 'Network error while saving note.',
    };
  }
}

/**
 * 8. DELETE LEAD
 * Verifies the authenticated user's profile and `business_id` before deleting the lead.
 */
export async function deleteLeadFromSupabase(
  leadId: string
): Promise<{ success: boolean; errorMessage?: string }> {
  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      success: false,
      errorMessage: errorMessage || 'Unauthorized: Please sign in again.',
    };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('business_id', context.businessId);

    if (error) {
      return {
        success: false,
        errorMessage: 'Unable to delete lead. Please try again.',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      errorMessage: 'Network error while deleting lead.',
    };
  }
}

/**
 * Deletes all leads belonging to the authenticated user's business tenant.
 */
export async function purgeBusinessLeadsInSupabase(): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const { context, errorMessage } = await resolveVerifiedBusinessContext();
  if (!context || !supabase) {
    return {
      success: false,
      errorMessage: errorMessage || 'Unauthorized: Please sign in again.',
    };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('business_id', context.businessId);

    if (error) {
      return {
        success: false,
        errorMessage: 'Unable to purge workspace leads. Please try again.',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      errorMessage: 'Network error while deleting workspace leads.',
    };
  }
}
