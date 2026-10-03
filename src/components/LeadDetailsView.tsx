import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Lead, LeadStatus, UserSession } from '../types/leadguard';
import { ConfirmDialog, LeadStatusBadge } from './StatusBadge';

interface LeadDetailsViewProps {
  lead: Lead;
  session: UserSession;
  backLabel?: string;
  onBack: () => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onAddNote: (leadId: string, noteContent: string) => void;
  onDeleteNote: (leadId: string, noteId: string) => void;
}

const QUICK_NOTE_TEMPLATES = [
  'Called customer. Wants quotation tomorrow.',
  'Waiting for site photos.',
  'Follow up Friday.',
];

export const LeadDetailsView: React.FC<LeadDetailsViewProps> = ({
  lead,
  session,
  backLabel = 'Back to Leads',
  onBack,
  onEditLead,
  onDeleteLead,
  onAddNote,
  onDeleteNote,
}) => {
  const [noteInput, setNoteInput] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Defense-in-depth tenant ownership check
  if (lead.business_id !== session.business.id) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
        <h2 className="text-base font-bold text-slate-900">
          Unauthorized Access Blocked
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          This lead does not belong to your authorized business workspace.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    onAddNote(lead.id, trimmed);
    setNoteInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top CRM Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-2.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {lead.name}
            </h1>
            <LeadStatusBadge status={lead.status} size="md" />
            <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {lead.score}/100
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span>{lead.service}</span>
            <span aria-hidden="true">·</span>
            <span>{lead.location}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Source: {lead.source}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Created: {lead.date_added}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Updated: {lead.updated_at}</span>
          </div>
        </div>

        {/* CRM Actions: Call, Email, Edit, Delete, Back to Leads */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`tel:${lead.phone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Call</span>
          </a>

          <a
            href={`mailto:${lead.email}?subject=${encodeURIComponent(
              `Regarding your ${lead.service} inquiry`
            )}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Email</span>
          </a>

          <button
            type="button"
            onClick={() => onEditLead(lead)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Prominent LeadGuard Assessment Banner */}
      <section
        aria-labelledby="assessment-heading"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-4 h-4 text-slate-700 shrink-0"
              aria-hidden="true"
            />
            <h2
              id="assessment-heading"
              className="text-sm font-bold text-slate-900"
            >
              LeadGuard Assessment
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Automatically generated from submitted lead data
          </span>
        </div>
        <p className="text-sm text-slate-800 leading-relaxed font-medium">
          {lead.assessment}
        </p>
      </section>

      {/* Main Two-Column CRM Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Contact, Project, Internal Notes */}
        <div className="lg:col-span-7 space-y-6">
          {/* Contact Section */}
          <section
            aria-labelledby="contact-heading"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h2
                id="contact-heading"
                className="text-sm font-bold text-slate-900"
              >
                Contact
              </h2>
              <div className="text-xs text-slate-600">
                Lead Source:{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {lead.source}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Name</div>
                <div className="font-semibold text-slate-900">{lead.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Phone</div>
                <a
                  href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                  className="font-mono font-medium text-slate-900 hover:underline"
                >
                  {lead.phone}
                </a>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Email</div>
                <a
                  href={`mailto:${lead.email}`}
                  className="font-mono font-medium text-slate-900 hover:underline break-all"
                >
                  {lead.email}
                </a>
              </div>
            </div>
          </section>

          {/* Project Section */}
          <section
            aria-labelledby="project-heading"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <h2
              id="project-heading"
              className="text-sm font-bold text-slate-900 pb-4 mb-4 border-b border-slate-200"
            >
              Project
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Service</div>
                <div className="font-semibold text-slate-900">
                  {lead.service}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-0.5">Location</div>
                <div className="font-semibold text-slate-900">
                  {lead.location}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-0.5">Budget</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums">
                  {lead.budget_display}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-0.5">Timeline</div>
                <div className="font-mono font-semibold text-slate-900">
                  {lead.timeline}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-0.5">
                  Decision Maker
                </div>
                <div className="font-semibold text-slate-900">
                  {lead.decision_maker ? 'Yes' : 'No'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-0.5">
                  Engaged / Responded
                </div>
                <div className="font-semibold text-slate-900">
                  {lead.engaged ? 'Yes' : 'No'}
                </div>
              </div>

              <div className="sm:col-span-2 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Specific Need</div>
                <div className="text-sm text-slate-900 leading-relaxed">
                  {lead.specific_need}
                </div>
              </div>
            </div>
          </section>

          {/* Internal Notes Section */}
          <section
            aria-labelledby="notes-heading"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText
                  className="w-4 h-4 text-slate-700"
                  aria-hidden="true"
                />
                <div>
                  <h2
                    id="notes-heading"
                    className="text-sm font-bold text-slate-900"
                  >
                    Internal Notes
                  </h2>
                  <p className="text-xs text-slate-500">
                    Visible only to {session.business.business_name}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {lead.notes.length} {lead.notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>

            <form onSubmit={handleNoteSubmit} className="space-y-3 mb-6">
              <label htmlFor="lead-note-textarea" className="sr-only">
                Add internal note
              </label>
              <textarea
                id="lead-note-textarea"
                rows={3}
                maxLength={1000}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Write a note for your team (e.g. Called customer. Wants quotation tomorrow.)"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">
                    Quick insert:
                  </span>
                  {QUICK_NOTE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setNoteInput(tpl)}
                      className="text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!noteInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Note</span>
                </button>
              </div>
            </form>

            {lead.notes.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                No internal notes added yet. Add a note above to keep your team
                updated on follow-up progress.
              </div>
            ) : (
              <div className="space-y-3">
                {lead.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-slate-900 leading-relaxed">
                        {note.content}
                      </p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          {note.author_name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {note.created_at}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete note"
                      onClick={() => onDeleteNote(lead.id, note.id)}
                      title="Delete note"
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 Columns: Qualification Breakdown (Section 6 & 12) */}
        <section
          aria-labelledby="qualification-heading"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                Deterministic Point Breakdown
              </div>
              <h2
                id="qualification-heading"
                className="text-lg font-bold text-slate-900 mt-0.5"
              >
                Qualification Breakdown
              </h2>
            </div>
            <LeadStatusBadge status={lead.status} size="md" />
          </div>

          {/* Qualification Factors & Points Earned */}
          <div className="space-y-3">
            {lead.breakdown.map((criterion) => (
              <div
                key={criterion.key}
                className={`p-3.5 rounded-lg border ${
                  criterion.met
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {criterion.met ? (
                      <Check
                        className="w-4 h-4 text-emerald-700 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <X
                        className="w-4 h-4 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        criterion.met ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {criterion.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                    <span
                      className={
                        criterion.met
                          ? 'font-bold text-emerald-800'
                          : 'text-slate-400'
                      }
                    >
                      +{criterion.maxPoints}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({criterion.met ? 'Met' : 'Not met'})
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 pl-6">
                  {criterion.reason}
                </p>
              </div>
            ))}
          </div>

          {/* Total Score & Status Summary */}
          <div className="pt-4 border-t border-slate-200 space-y-3 font-mono">
            <div className="flex items-center justify-between text-sm font-bold text-slate-900">
              <span>TOTAL SCORE:</span>
              <span className="text-lg tabular-nums">{lead.score}/100</span>
            </div>

            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate-900">STATUS:</span>
              <span
                className={
                  lead.status === LeadStatus.HOT
                    ? 'text-emerald-700'
                    : lead.status === LeadStatus.WARM
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }
              >
                {lead.status}
              </span>
            </div>

            {/* Score Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full ${
                  lead.status === LeadStatus.HOT
                    ? 'bg-emerald-600'
                    : lead.status === LeadStatus.WARM
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                style={{ width: `${lead.score}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>0–49: COLD</span>
              <span>50–79: WARM</span>
              <span>80–100: HOT</span>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation Dialog for Deleting Lead */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete this lead?"
        description={`Are you sure you want to permanently delete "${lead.name}" (${lead.service}) and all associated internal notes?`}
        confirmLabel="Delete Lead"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDeleteLead(lead.id);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};
