import React, { useState } from 'react';
import { ArrowLeft, Check, Info, X } from 'lucide-react';
import { qualifyLeadDeterministically } from '../lib/qualification';
import {
  Lead,
  LeadInputPayload,
  LeadSourceType,
  UserSession,
} from '../types/leadguard';
import { LeadStatusBadge } from './StatusBadge';

interface LeadFormViewProps {
  session: UserSession;
  initialLead?: Lead | null;
  isModal?: boolean;
  backLabel?: string;
  onSubmitLead: (payload: LeadInputPayload) => Promise<{
    success: boolean;
    errors: string[];
    lead?: Lead;
  }>;
  onCancel: () => void;
}

const LEAD_SOURCE_OPTIONS: LeadSourceType[] = [
  'Website',
  'Google Ads',
  'Facebook',
  'Instagram',
  'Make.com',
  'Webhook/API',
  'Manual',
  'Other',
];

export const LeadFormView: React.FC<LeadFormViewProps> = ({
  session,
  initialLead = null,
  isModal = false,
  backLabel = 'Back to Leads',
  onSubmitLead,
  onCancel,
}) => {
  const isEditing = Boolean(initialLead);

  const [name, setName] = useState(initialLead?.name ?? '');
  const [phone, setPhone] = useState(initialLead?.phone ?? '');
  const [email, setEmail] = useState(initialLead?.email ?? '');
  const [service, setService] = useState(initialLead?.service ?? '');
  const [location, setLocation] = useState(initialLead?.location ?? '');
  const [budget, setBudget] = useState<string>(
    initialLead?.budget !== null && initialLead?.budget !== undefined
      ? String(initialLead.budget)
      : ''
  );
  const [timeline, setTimeline] = useState(
    initialLead?.timeline && initialLead.timeline !== 'Not specified'
      ? initialLead.timeline
      : '21 days'
  );
  const [decisionMaker, setDecisionMaker] = useState<boolean>(
    initialLead ? initialLead.decision_maker : true
  );
  const [specificNeed, setSpecificNeed] = useState(
    initialLead?.specific_need && initialLead.specific_need !== 'Not specified'
      ? initialLead.specific_need
      : ''
  );
  const [engaged, setEngaged] = useState<boolean>(
    initialLead ? initialLead.engaged : true
  );
  const [source, setSource] = useState<LeadSourceType>(
    initialLead?.source ?? 'Manual'
  );
  const [notes, setNotes] = useState(
    initialLead ? initialLead.notes.map((n) => n.content).join('\n\n') : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const draftPayload: LeadInputPayload = {
    name,
    phone,
    email,
    service,
    location,
    budget: budget.trim() === '' ? null : budget.trim(),
    timeline,
    decision_maker: decisionMaker,
    specific_need: specificNeed,
    engaged,
    source,
    notes: isEditing ? notes.trim() : notes.trim() || undefined,
  };

  // Automatic deterministic score preview (user cannot manually enter an arbitrary score)
  const previewQualification = qualifyLeadDeterministically(
    draftPayload,
    session.business.target_locations
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);
    try {
      const result = await onSubmitLead(draftPayload);
      if (!result.success) {
        setErrors(result.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        {!isEditing && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
            <Info
              className="w-4 h-4 text-slate-700 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <span className="font-semibold text-slate-900">
                Manual Entry Fallback:
              </span>{' '}
              LeadGuard is designed primarily for automatic lead intake from
              your connected sources. Use this form when logging phone calls,
              walk-ins, or referrals. Qualification score is calculated
              automatically upon saving.
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1"
          >
            <div className="font-semibold">
              Please review the following fields before saving:
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Group 1: Contact Information */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 w-full">
            1. Contact Information
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Full Name{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <input
                id="lead-name"
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="lead-phone"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Phone Number{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <input
                id="lead-phone"
                type="tel"
                required
                maxLength={32}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +27 82 555 0101"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email Address{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <input
                id="lead-email"
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john.smith@example.com"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="lead-source"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Lead Source{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <select
                id="lead-source"
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSourceType)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {LEAD_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Group 2: Project Scope & Location */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 w-full">
            2. Project Details & Location
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-service"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Service Requested{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <input
                id="lead-service"
                type="text"
                required
                maxLength={120}
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. New House Construction, Roof Replacement"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="lead-location"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Suburb / City Location{' '}
                <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <input
                id="lead-location"
                type="text"
                required
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={`e.g. ${
                  session.business.target_locations[0] || 'Sandton'
                }`}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <span className="block text-[11px] text-slate-500 mt-1">
                Target areas (+10 pts):{' '}
                {session.business.target_locations.slice(0, 5).join(', ')}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="lead-specific-need"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Specific Need / Scope of Work{' '}
              <span className="text-slate-400 font-normal">(Optional · +20 pts)</span>
            </label>
            <textarea
              id="lead-specific-need"
              rows={2}
              maxLength={500}
              value={specificNeed}
              onChange={(e) => setSpecificNeed(e.target.value)}
              placeholder="e.g. Build a 4-bedroom home / Replace 340 sqm concrete roof tiles"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <span className="block text-[11px] text-slate-500 mt-1">
              Describing a specific project requirement awards +20 qualification
              points.
            </span>
          </div>
        </fieldset>

        {/* Group 3: Qualification Signals */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 w-full">
            3. Budget, Timeline & Readiness
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-budget"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Estimated Budget ({session.business.currency_symbol}){' '}
                <span className="text-slate-400 font-normal">(Optional · +20 pts)</span>
              </label>
              <input
                id="lead-budget"
                type="text"
                inputMode="numeric"
                maxLength={40}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 2500000 (Leave blank if unknown)"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
              />
              <span className="block text-[11px] text-slate-500 mt-1">
                Awards +20 points when a positive budget figure is provided.
              </span>
            </div>

            <div>
              <label
                htmlFor="lead-timeline"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Project Timeline{' '}
                <span className="text-slate-400 font-normal">(Optional · +25 pts)</span>
              </label>
              <input
                id="lead-timeline"
                type="text"
                maxLength={80}
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. 21 days, 14 days, 60 days"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <span className="block text-[11px] text-slate-500 mt-1">
                Awards +25 points if project timeline is within 30 days.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <button
              type="button"
              aria-pressed={decisionMaker}
              onClick={() => setDecisionMaker(!decisionMaker)}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-colors ${
                decisionMaker
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="text-xs font-semibold">Decision Maker</div>
                <div
                  className={`text-[11px] ${
                    decisionMaker ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Authorized to approve quote (+15 pts)
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {decisionMaker ? 'YES' : 'NO'}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={engaged}
              onClick={() => setEngaged(!engaged)}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-colors ${
                engaged
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="text-xs font-semibold">Engaged / Responded</div>
                <div
                  className={`text-[11px] ${
                    engaged ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Confirmed active interest (+10 pts)
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {engaged ? 'YES' : 'NO'}
              </span>
            </button>
          </div>
        </fieldset>

        {/* Group 4: Internal Notes */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 w-full">
            4. Internal Team Notes
          </legend>
          <div>
            <label
              htmlFor="lead-initial-notes"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              {isEditing ? 'Notes' : 'Initial Note'}{' '}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="lead-initial-notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Called customer. Wants quotation tomorrow."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
        </fieldset>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {isSubmitting
              ? isEditing
                ? 'Updating Lead...'
                : 'Saving Lead...'
              : isEditing
              ? 'Save & Recalculate Qualification'
              : 'Save & Qualify Lead'}
          </button>
        </div>
      </form>

      {/* Right Column: Live Automatic Qualification Preview */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 lg:sticky lg:top-20">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              Live Qualification Preview
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Automatic Scoring Output
            </h3>
          </div>
          <div className="text-right font-mono">
            <div className="text-xs text-slate-500">TOTAL SCORE</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {previewQualification.score}/100
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-xs font-semibold text-slate-700">
            CALCULATED STATUS
          </span>
          <LeadStatusBadge status={previewQualification.status} size="md" />
        </div>

        <div className="space-y-2">
          {previewQualification.breakdown.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100"
            >
              <div className="flex items-center gap-2">
                {c.met ? (
                  <Check
                    className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    className="w-3.5 h-3.5 text-slate-300 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    c.met ? 'text-slate-900 font-medium' : 'text-slate-400'
                  }
                >
                  {c.label}
                </span>
              </div>
              <span
                className={`font-mono tabular-nums ${
                  c.met ? 'text-slate-900 font-semibold' : 'text-slate-400'
                }`}
              >
                {c.met ? `+${c.awardedPoints}` : `0 / +${c.maxPoints}`}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-900 mb-1.5">
            Generated LeadGuard Assessment
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            {previewQualification.assessment}
          </p>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-lead-modal-title"
      >
        <div className="bg-slate-50 border border-slate-200 rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-lg">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 rounded-t-xl">
            <div>
              <h2
                id="edit-lead-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Edit Lead & Recalculate Qualification
              </h2>
              <p className="text-xs text-slate-500">
                Score and LeadGuard Assessment are automatically updated from
                the lead’s attributes.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close modal"
              onClick={onCancel}
              className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto">{formContent}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Add Lead
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter inquiry details below. LeadGuard will automatically calculate
          the qualification score and generate an assessment.
        </p>
      </div>
      {formContent}
    </div>
  );
};
