import {
  LeadInputPayload,
  LeadStatus,
  QualificationCriterion,
  QualificationResult,
} from '../types/leadguard';

/**
 * Parses a budget value (number or string like "R2,500,000" or "80000")
 * into a positive numeric amount or null if not provided.
 */
export function parseBudgetAmount(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Remove currency symbols, spaces, commas
  const cleaned = trimmed.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Formats a numeric budget in South African Rand (R) or standard currency format.
 */
export function formatBudgetDisplay(
  amount: number | null,
  currencySymbol = 'R'
): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return 'Not provided';
  }
  return `${currencySymbol}${amount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Parses a timeline string (e.g., "21 days", "14 days", "Immediate", "2 weeks", "1 month", "45 days")
 * into an estimated number of days, or null if unspecified/indeterminate.
 */
export function parseTimelineDays(timelineStr: string | null | undefined): number | null {
  if (!timelineStr) return null;
  const normalized = timelineStr.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes('immediate') ||
    normalized.includes('urgent') ||
    normalized.includes('asap') ||
    normalized.includes('today') ||
    normalized.includes('now')
  ) {
    return 1;
  }

  // Match explicit numbers with unit
  const match = normalized.match(/(\d+)\s*(day|days|d|week|weeks|w|month|months|m)?/);
  if (match) {
    const value = Number.parseInt(match[1], 10);
    const unit = match[2] || 'days';
    if (!Number.isFinite(value) || value < 0) return null;
    if (unit.startsWith('w')) return value * 7;
    if (unit.startsWith('m')) return value * 30;
    return value;
  }

  if (normalized.includes('this week')) return 7;
  if (normalized.includes('next week')) return 14;
  if (normalized.includes('this month')) return 25;

  return null;
}

/**
 * Checks whether a lead's location matches the business's target locations.
 * If the business has configured target locations, checks case-insensitively.
 * If the lead provides a valid non-empty location and matches target areas (or if target areas include "All"), awards +10.
 */
export function isTargetLocationMet(
  location: string,
  targetLocations: string[]
): { met: boolean; matchedArea?: string } {
  const cleanLoc = (location || '').trim();
  if (cleanLoc.length < 2) {
    return { met: false };
  }
  if (!targetLocations || targetLocations.length === 0) {
    return { met: true, matchedArea: cleanLoc };
  }
  const lowerLoc = cleanLoc.toLowerCase();
  for (const target of targetLocations) {
    const lowerTarget = target.trim().toLowerCase();
    if (
      lowerTarget &&
      (lowerLoc.includes(lowerTarget) || lowerTarget.includes(lowerLoc))
    ) {
      return { met: true, matchedArea: target.trim() };
    }
  }
  return { met: false };
}

/**
 * Deterministic Point-Based Lead Qualification Engine (MVP Specification)
 *
 * Specific Need:            +20
 * Budget Provided:          +20
 * Timeline Within 30 Days:  +25
 * Decision Maker:           +15
 * Target Location:          +10
 * Engaged/Responded:        +10
 * -----------------------------
 * Maximum:                  100
 *
 * Statuses:
 * 80–100: HOT
 * 50–79:  WARM
 * 0–49:   COLD
 */
export function qualifyLeadDeterministically(
  input: LeadInputPayload,
  targetLocations: string[] = []
): QualificationResult {
  const specificNeedText = (input.specific_need || '').trim();
  const hasSpecificNeed =
    specificNeedText.length >= 5 &&
    !['none', 'n/a', 'unsure', 'not sure', 'general inquiry', 'unknown'].includes(
      specificNeedText.toLowerCase()
    );

  const budgetAmount = parseBudgetAmount(input.budget);
  const hasBudget = budgetAmount !== null && budgetAmount > 0;

  const timelineDays = parseTimelineDays(input.timeline);
  const isTimelineWithin30Days =
    timelineDays !== null && timelineDays >= 0 && timelineDays <= 30;

  const isDecisionMaker = Boolean(input.decision_maker);

  const locationCheck = isTargetLocationMet(input.location, targetLocations);
  const hasTargetLocation = locationCheck.met;

  const isEngaged = Boolean(input.engaged);

  const breakdown: QualificationCriterion[] = [
    {
      key: 'specific_need',
      label: 'Specific need',
      maxPoints: 20,
      awardedPoints: hasSpecificNeed ? 20 : 0,
      met: hasSpecificNeed,
      reason: hasSpecificNeed
        ? `Defined project scope: "${specificNeedText}"`
        : 'No specific requirement or project scope provided',
    },
    {
      key: 'budget',
      label: 'Budget',
      maxPoints: 20,
      awardedPoints: hasBudget ? 20 : 0,
      met: hasBudget,
      reason: hasBudget
        ? `Verified budget figure provided (${formatBudgetDisplay(budgetAmount)})`
        : 'No project budget disclosed',
    },
    {
      key: 'timeline',
      label: 'Timeline',
      maxPoints: 25,
      awardedPoints: isTimelineWithin30Days ? 25 : 0,
      met: isTimelineWithin30Days,
      reason: isTimelineWithin30Days
        ? `Project timeline is within 30 days (${input.timeline.trim()})`
        : input.timeline?.trim()
        ? `Timeline exceeds 30-day priority window (${input.timeline.trim()})`
        : 'No project timeline specified',
    },
    {
      key: 'decision_maker',
      label: 'Decision maker',
      maxPoints: 15,
      awardedPoints: isDecisionMaker ? 15 : 0,
      met: isDecisionMaker,
      reason: isDecisionMaker
        ? 'Contact confirmed as authorized decision maker'
        : 'Contact is not confirmed as the final decision maker',
    },
    {
      key: 'target_location',
      label: 'Target location',
      maxPoints: 10,
      awardedPoints: hasTargetLocation ? 10 : 0,
      met: hasTargetLocation,
      reason: hasTargetLocation
        ? `Location (${input.location.trim()}) falls within service coverage area`
        : input.location?.trim()
        ? `Location (${input.location.trim()}) is outside primary target service zones`
        : 'No location provided',
    },
    {
      key: 'engaged',
      label: 'Engaged',
      maxPoints: 10,
      awardedPoints: isEngaged ? 10 : 0,
      met: isEngaged,
      reason: isEngaged
        ? 'Lead has actively engaged or responded to intake prompts'
        : 'Lead has not yet confirmed follow-up engagement',
    },
  ];

  const rawScore = breakdown.reduce((sum, item) => sum + item.awardedPoints, 0);
  const score = Math.min(100, Math.max(0, rawScore));

  let status: LeadStatus = LeadStatus.COLD;
  if (score >= 80) {
    status = LeadStatus.HOT;
  } else if (score >= 50) {
    status = LeadStatus.WARM;
  } else {
    status = LeadStatus.COLD;
  }

  const assessment = generateDeterministicAssessment({
    hasSpecificNeed,
    hasBudget,
    isTimelineWithin30Days,
    isDecisionMaker,
    hasTargetLocation,
    isEngaged,
    score,
    status,
    timelineText: (input.timeline || '').trim(),
  });

  return {
    score,
    maxScore: 100,
    status,
    breakdown,
    assessment,
  };
}

interface AssessmentFactors {
  hasSpecificNeed: boolean;
  hasBudget: boolean;
  isTimelineWithin30Days: boolean;
  isDecisionMaker: boolean;
  hasTargetLocation: boolean;
  isEngaged: boolean;
  score: number;
  status: LeadStatus;
  timelineText: string;
}

/**
 * Generates a factual, deterministic LeadGuard Assessment based strictly on
 * information provided by the lead. Never invents facts.
 */
function generateDeterministicAssessment(factors: AssessmentFactors): string {
  const positives: string[] = [];
  const gaps: string[] = [];

  if (factors.hasSpecificNeed) {
    positives.push('has a specific requirement');
  } else {
    gaps.push('a defined scope of work');
  }

  if (factors.hasBudget) {
    positives.push('provided a budget');
  } else {
    gaps.push('budget confirmation');
  }

  if (factors.isTimelineWithin30Days) {
    positives.push('has a short project timeline (within 30 days)');
  } else if (factors.timelineText) {
    gaps.push('a near-term timeline within 30 days');
  } else {
    gaps.push('project timeline details');
  }

  if (factors.isDecisionMaker) {
    positives.push('is the decision maker');
  } else {
    gaps.push('decision-maker authority');
  }

  if (factors.hasTargetLocation) {
    positives.push('is located within your target service area');
  } else {
    gaps.push('service area verification');
  }

  if (factors.isEngaged) {
    positives.push('is actively engaged');
  }

  const formatList = (items: string[]): string => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  };

  if (factors.status === LeadStatus.HOT) {
    const positiveSummary = formatList(positives);
    const gapNote =
      gaps.length > 0
        ? ` Confirm ${formatList(gaps)} during initial contact.`
        : '';
    return `Strong potential opportunity. The lead ${positiveSummary}.${gapNote} Prioritize follow-up.`;
  }

  if (factors.status === LeadStatus.WARM) {
    const positiveSummary =
      positives.length > 0
        ? `The lead ${formatList(positives)} but may require additional information`
        : 'The lead has some qualification signals but may require additional information';
    const missingSummary =
      gaps.length > 0 ? ` (${formatList(gaps)}).` : '.';
    return `Moderate potential opportunity. ${positiveSummary}${missingSummary} Schedule a qualification call to verify remaining project requirements.`;
  }

  // COLD (0 - 49)
  const positiveSummary =
    positives.length > 0
      ? `The lead currently has limited qualification information (only ${formatList(positives)})`
      : 'The lead currently has limited qualification information';
  const missingSummary =
    gaps.length > 0 ? ` and is missing ${formatList(gaps)}.` : '.';
  return `Low-priority opportunity. ${positiveSummary}${missingSummary} Place in standard follow-up queue until project readiness is confirmed.`;
}
