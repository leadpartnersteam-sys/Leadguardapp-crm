import type { Request, Response } from 'express';
import { parseBudgetAmount, qualifyLeadDeterministically } from '../lib/qualification';
import { validateLeadPayload } from '../lib/validation';
import type { LeadSourceType } from '../types/leadguard';
import { verifySecret } from './crypto';
import { checkRateLimit } from './rateLimiter';
import {
  getSupabaseAdmin,
  lookupBusinessTargetLocations,
  lookupWebhookConnection,
} from './supabaseAdmin';

/**
 * Core handler for POST /api/webhook/:connection
 *
 * Enforces:
 * 1. HTTP Method POST (405)
 * 2. Content-Type application/json (415)
 * 3. Rate limiting per connection & IP (429)
 * 4. X-Webhook-Secret credential verification (401)
 * 5. Connection status check (403 for REVOKED)
 * 6. Server-side business resolution (never trusting client-supplied business_id)
 * 7. Server-grade payload validation & sanitization (400)
 * 8. Server-side score & assessment calculation (ignoring any client-supplied score/status)
 * 9. Safe insertion into Supabase leads table
 * 10. Minimal response returning only { success, lead_id, score, status }
 */
export async function handleWebhookPost(
  req: Request,
  res: Response,
  connectionParam?: string
): Promise<void> {
  // 1. Method check
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
    return;
  }

  // 2. Content-Type check
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    res.status(415).json({
      success: false,
      error: 'Unsupported Media Type. Request body must be application/json.',
    });
    return;
  }

  // 3. Resolve connection key from param or URL
  const connectionKey = (
    connectionParam ||
    req.params.connection ||
    (req.query.connection as string) ||
    ''
  ).trim();

  if (!connectionKey) {
    res.status(400).json({
      success: false,
      error: 'Missing webhook connection identifier in URL path.',
    });
    return;
  }

  // 4. Basic Rate Limiting (per connection key and per client IP)
  const clientIp = (
    (req.headers['x-forwarded-for'] as string) ||
    req.socket?.remoteAddress ||
    'anonymous'
  ).split(',')[0].trim();

  const ipLimit = checkRateLimit(`ip_${clientIp}`, 30, 60000);
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Too many requests from this IP.',
    });
    return;
  }

  const connLimit = checkRateLimit(`conn_${connectionKey}`, 60, 60000);
  if (!connLimit.allowed) {
    res.setHeader('Retry-After', String(connLimit.retryAfterSeconds));
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for this webhook connection.',
    });
    return;
  }

  // 5. Read authentication secret header
  const rawSecretHeader = req.headers['x-webhook-secret'];
  const candidateSecret = Array.isArray(rawSecretHeader)
    ? rawSecretHeader[0]
    : rawSecretHeader;

  if (!candidateSecret || typeof candidateSecret !== 'string') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  // 6. Look up the connection record in Supabase
  let connectionRecord;
  try {
    const { connection, error } = await lookupWebhookConnection(connectionKey);
    if (error) {
      console.error('[LeadGuard Webhook] Connection lookup error for key:', connectionKey);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
      return;
    }
    connectionRecord = connection;
  } catch {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
    return;
  }

  // Do not reveal whether a connection exists if authentication fails
  if (!connectionRecord) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  // 7. Check if connection has been revoked
  if (connectionRecord.status === 'REVOKED') {
    res.status(403).json({
      success: false,
      error: 'This webhook connection has been revoked.',
    });
    return;
  }

  if (connectionRecord.status !== 'ACTIVE') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  // 8. Verify the secret against stored hash using constant-time comparison
  const isValidSecret = verifySecret(candidateSecret.trim(), connectionRecord.secret_hash);
  if (!isValidSecret) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  // 9. Validate & sanitize payload using LeadGuard's existing validation logic
  const rawBody = req.body;
  const validation = validateLeadPayload(rawBody);

  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({
      success: false,
      errors: validation.errors,
    });
    return;
  }

  const sanitized = validation.sanitized;

  // 10. Map lead source: if provided by payload, sanitize; if not provided or default, map from connection
  let effectiveSource: LeadSourceType = sanitized.source;
  if (!rawBody.lead_source && !rawBody.source) {
    effectiveSource =
      connectionRecord.source_type === 'WEBSITE_FORM' ? 'Website' : 'Webhook/API';
  }

  // 11. Retrieve business target locations to accurately compute location criterion
  const targetLocations = await lookupBusinessTargetLocations(connectionRecord.business_id);

  // 12. Calculate deterministic score, status, and assessment server-side
  const qualification = qualifyLeadDeterministically(
    {
      ...sanitized,
      source: effectiveSource,
    },
    targetLocations
  );

  // 13. Test Connection mode: test payload through authentication & validation without inserting production lead
  const isTestMode =
    req.headers['x-test-mode'] === 'true' ||
    Boolean(rawBody.is_test) ||
    req.query.test === 'true';

  if (isTestMode) {
    console.info(`[LeadGuard Webhook] Test connection verified for business: ${connectionRecord.business_id}`);
    res.status(200).json({
      success: true,
      is_test: true,
      message: 'Connection successful',
      received_payload: {
        name: sanitized.name,
        email: sanitized.email,
        phone: sanitized.phone,
        service: sanitized.service,
        location: sanitized.location,
        source: effectiveSource,
      },
      score: qualification.score,
      status: qualification.status,
      assessment: qualification.assessment,
    });
    return;
  }

  // 14. Insert into Supabase leads table using verified business_id
  const nowIso = new Date().toISOString();
  const budgetNumeric = parseBudgetAmount(sanitized.budget);
  const cleanNotes = sanitized.notes || null;

  try {
    const admin = getSupabaseAdmin();
    const insertPayload = {
      business_id: connectionRecord.business_id, // Authoritative from connection, NEVER from request
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
      lead_source: effectiveSource,
      notes: cleanNotes,
      score: qualification.score,       // Authoritative from server qualification, NEVER from request
      status: qualification.status,     // Authoritative from server qualification, NEVER from request
      assessment: qualification.assessment, // Authoritative from server qualification
      created_at: nowIso,
      updated_at: nowIso,
    };

    let { data: insertedLead, error: insertError } = await admin
      .from('leads')
      .insert(insertPayload)
      .select('id, score, status')
      .single();

    // Fallback if updated_at is omitted from table schema
    if (insertError && String(insertError.message || '').includes('updated_at')) {
      const { updated_at: _omit, ...fallbackPayload } = insertPayload;
      const retry = await admin
        .from('leads')
        .insert(fallbackPayload)
        .select('id, score, status')
        .single();
      insertedLead = retry.data;
      insertError = retry.error;
    }

    if (insertError || !insertedLead) {
      console.error('[LeadGuard Webhook] Failed to insert lead into Supabase:', insertError?.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
      return;
    }

    console.info(`[LeadGuard Webhook] Lead successfully captured. ID: ${insertedLead.id}, Score: ${insertedLead.score}`);

    // 15. Return minimal, safe response without exposing complete database record
    res.status(201).json({
      success: true,
      lead_id: insertedLead.id,
      score: insertedLead.score,
      status: insertedLead.status,
    });
  } catch (err: unknown) {
    console.error('[LeadGuard Webhook] Unexpected error inserting lead:', err instanceof Error ? err.message : 'Unknown');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
