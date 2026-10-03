import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  Database,
  LogOut,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { AppPage, UserSession } from '../types/leadguard';
import { ConfirmDialog } from './StatusBadge';

interface SettingsViewProps {
  session: UserSession;
  tenantLeadCount: number;
  onNavigate: (page: AppPage) => void;
  onUpdateBusinessSettings: (updates: {
    business_name: string;
    full_name: string;
    target_locations: string[];
  }) => Promise<{ success: boolean; errorMessage?: string }>;
  onPurgeTenantLeads: () => void;
  onLogout: () => void;
}

const SUPABASE_RLS_SCHEMA_REFERENCE = `-- LeadGuard Multi-Tenant Schema & Row Level Security (Supabase PostgreSQL)
-- Never rely on a frontend-supplied business_id for authorization.

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Enforce strict tenant isolation: Business A can never read or modify Business B's leads
CREATE POLICY "Tenant members can view only their own business leads"
  ON leads FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert leads only into their authorized business"
  ON leads FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );`;

export const SettingsView: React.FC<SettingsViewProps> = ({
  session,
  tenantLeadCount,
  onNavigate,
  onUpdateBusinessSettings,
  onPurgeTenantLeads,
  onLogout,
}) => {
  const [businessName, setBusinessName] = useState(
    session.business.business_name
  );
  const [fullName, setFullName] = useState(session.full_name);
  const [locations, setLocations] = useState<string[]>(
    session.business.target_locations
  );
  const [newLocation, setNewLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);

  useEffect(() => {
    setBusinessName(session.business.business_name);
    setFullName(session.full_name);
    setLocations(session.business.target_locations);
  }, [session]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavedNotice(false);

    if (businessName.trim().length < 2 || fullName.trim().length < 2) {
      setSaveError(
        'Both Full Name and Business Name must be at least 2 characters.'
      );
      return;
    }

    setIsSaving(true);
    const result = await onUpdateBusinessSettings({
      business_name: businessName.trim(),
      full_name: fullName.trim(),
      target_locations: locations,
    });
    setIsSaving(false);

    if (!result.success) {
      setSaveError(
        result.errorMessage || 'Unable to save settings. Please try again.'
      );
      return;
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const handleAddLocation = () => {
    const clean = newLocation.trim();
    if (!clean) return;
    if (!locations.some((l) => l.toLowerCase() === clean.toLowerCase())) {
      setLocations([...locations, clean]);
    }
    setNewLocation('');
  };

  const handleRemoveLocation = (target: string) => {
    setLocations(locations.filter((l) => l !== target));
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your authenticated account details, business profile, target
            service locations, and data retention controls.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Business & User Profile + Target Locations */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2
                  className="w-4 h-4 text-slate-700"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold text-slate-900">
                  Account & Business Profile
                </h2>
              </div>
              <span className="text-xs text-emerald-700 font-medium">
                Supabase Authenticated
              </span>
            </div>

            {savedNotice && (
              <div
                role="status"
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Profile and business settings updated in Supabase.
                </span>
              </div>
            )}

            {saveError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2"
              >
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{saveError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="settings-business-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Business Name
              </label>
              <input
                id="settings-business-name"
                type="text"
                required
                maxLength={120}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="settings-user-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="settings-user-name"
                  type="text"
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  disabled
                  value={session.email}
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            {/* Target Locations for +10 Qualification Criterion */}
            <div className="pt-4 border-t border-slate-200">
              <label
                htmlFor="settings-new-location"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                Target Service Locations (+10 Qualification Points)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Incoming leads located in these areas automatically receive +10
                points on the Target Location criterion.
              </p>

              <div className="flex items-center gap-2 mb-3">
                <input
                  id="settings-new-location"
                  type="text"
                  maxLength={60}
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLocation();
                    }
                  }}
                  placeholder="Add suburb or city (e.g. Bedfordview)"
                  className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Area</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <div
                    key={loc}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-800"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${loc}`}
                      onClick={() => handleRemoveLocation(loc)}
                      className="text-slate-400 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
              >
                Sign out of workspace
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* POPIA, Data Minimization & Data Deletion Controls (Sections 31, 32, 33) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Shield className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                Data Minimization, Retention & Deletion (POPIA Architecture)
              </h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              LeadGuard stores only the contact and project qualification
              fields required for your team to prioritize and respond to leads.
              You can delete individual leads at any time or purge all lead
              records belonging to{' '}
              <span className="font-semibold text-slate-900">
                {session.business.business_name}
              </span>
              .
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Purge Workspace Leads ({tenantLeadCount} active records)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Permanently deletes all leads and internal notes for your
                  business tenant without affecting other tenants.
                </div>
              </div>

              <button
                type="button"
                disabled={tenantLeadCount === 0}
                onClick={() => setConfirmPurgeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-40 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete All Business Leads</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Security Summary & Supabase RLS Blueprint */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Multi-Tenant Security & Data Isolation
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your account is authenticated via Supabase Auth and linked to{' '}
              <span className="font-semibold text-slate-900">
                {session.business.business_name}
              </span>
              . All database reads and writes are isolated by Row Level Security
              (RLS) using your authenticated session.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">
                Supabase PostgreSQL & RLS Specification
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Database policies enforcing server-side tenant ownership via{' '}
              <code className="font-mono">auth.uid()</code>:
            </p>
            <pre className="font-mono text-[11px] bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed max-h-80">
              {SUPABASE_RLS_SCHEMA_REFERENCE}
            </pre>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Purging All Workspace Leads */}
      <ConfirmDialog
        isOpen={confirmPurgeOpen}
        title="Delete all leads for this business?"
        description={`Are you sure you want to permanently delete all ${tenantLeadCount} lead records and internal notes belonging to ${session.business.business_name}? Other business tenants will not be affected.`}
        confirmLabel="Confirm Purge"
        onConfirm={() => {
          setConfirmPurgeOpen(false);
          onPurgeTenantLeads();
        }}
        onCancel={() => setConfirmPurgeOpen(false)}
      />
    </div>
  );
};
