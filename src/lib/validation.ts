import { LeadInputPayload, LeadSourceType } from '../types/leadguard';

const ALLOWED_SOURCES: LeadSourceType[] = [
  'Website',
  'Google Ads',
  'Facebook',
  'Instagram',
  'Make.com',
  'Webhook/API',
  'Manual',
  'Other',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: LeadInputPayload;
}

/**
 * Strips potentially dangerous HTML/script tags and control characters from untrusted text.
 * Protects against XSS and malformed input.
 */
export function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // Strip control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Server-grade validation for incoming lead payloads (whether from Webhook/API, Make.com, Website Form, or Manual Entry).
 * Enforces field lengths, data types, email/phone rules, and rejects oversized or malformed payloads.
 * Never trusts client-supplied `business_id` or `score`.
 */
export function validateLeadPayload(rawPayload: unknown): ValidationResult {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return {
      valid: false,
      errors: ['Malformed request: Payload must be a valid JSON object.'],
    };
  }

  // Check overall payload size to prevent oversized request abuse
  const serializedSize = JSON.stringify(rawPayload).length;
  if (serializedSize > 16384) {
    return {
      valid: false,
      errors: ['Oversized request: Payload exceeds maximum allowed size (16 KB).'],
    };
  }

  const record = rawPayload as Record<string, unknown>;
  const errors: string[] = [];

  const name = sanitizeString(record.name, 120);
  if (!name || name.length < 2) {
    errors.push('Name is required and must be between 2 and 120 characters.');
  }

  const phone = sanitizeString(record.phone, 32);
  const phoneRegex = /^[0-9+\-\s()]{7,32}$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.push('Valid phone number is required (7–32 digits/characters).');
  }

  const email = sanitizeString(record.email, 160).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Valid email address is required.');
  }

  const service = sanitizeString(record.service, 120);
  if (!service || service.length < 2) {
    errors.push('Service type is required (max 120 characters).');
  }

  const location = sanitizeString(record.location, 120);
  if (!location || location.length < 2) {
    errors.push('Project location is required (max 120 characters).');
  }

  let budget: number | string | null = null;
  if (
    record.budget !== undefined &&
    record.budget !== null &&
    String(record.budget).trim() !== ''
  ) {
    if (typeof record.budget === 'number') {
      if (!Number.isFinite(record.budget) || record.budget < 0 || record.budget > 1_000_000_000) {
        errors.push('Budget must be a valid non-negative number.');
      } else {
        budget = record.budget;
      }
    } else if (typeof record.budget === 'string') {
      const cleaned = sanitizeString(record.budget, 40);
      const numericPart = cleaned.replace(/[^0-9.]/g, '');
      if (numericPart && Number.isNaN(Number(numericPart))) {
        errors.push('Budget format is invalid.');
      } else {
        budget = cleaned;
      }
    } else {
      errors.push('Budget must be a numeric value or formatted currency string.');
    }
  }

  const timeline = sanitizeString(record.timeline ?? '', 80);

  if (
    record.decision_maker !== undefined &&
    typeof record.decision_maker !== 'boolean'
  ) {
    errors.push('Decision Maker field must be a boolean (true or false).');
  }
  const decision_maker = Boolean(record.decision_maker);

  const specific_need = sanitizeString(record.specific_need ?? '', 500);

  if (record.engaged !== undefined && typeof record.engaged !== 'boolean') {
    errors.push('Engaged field must be a boolean (true or false).');
  }
  const engaged = Boolean(record.engaged);

  const rawSource = sanitizeString(record.source ?? 'Webhook/API', 40) as LeadSourceType;
  const source: LeadSourceType = ALLOWED_SOURCES.includes(rawSource)
    ? rawSource
    : 'Other';

  const notes = sanitizeString(record.notes ?? '', 1000);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      name,
      phone,
      email,
      service,
      location,
      budget,
      timeline,
      decision_maker,
      specific_need,
      engaged,
      source,
      notes: notes || undefined,
    },
  };
}
