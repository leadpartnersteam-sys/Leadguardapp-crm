import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Filter,
  Inbox,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { exportLeadsToCsv } from '../lib/csvExport';
import {
  AppPage,
  Lead,
  LeadSourceType,
  LeadStatus,
  UserSession,
} from '../types/leadguard';
import {
  ConfirmDialog,
  LeadStatusBadge,
  ScoreIndicator,
} from './StatusBadge';

interface LeadsViewProps {
  session: UserSession;
  leads: Lead[];
  initialStatusFilter?: 'ALL' | LeadStatus;
  onNavigate: (
    page: AppPage,
    leadId?: string,
    initialStatusFilter?: 'ALL' | LeadStatus
  ) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
}

type SortOption =
  | 'score_desc'
  | 'score_asc'
  | 'date_desc'
  | 'date_asc'
  | 'name_asc';

const ALL_SOURCES: LeadSourceType[] = [
  'Website',
  'Make.com',
  'Webhook/API',
  'Google Ads',
  'Facebook',
  'Instagram',
  'Manual',
  'Other',
];

export const LeadsView: React.FC<LeadsViewProps> = ({
  session,
  leads,
  initialStatusFilter = 'ALL',
  onNavigate,
  onEditLead,
  onDeleteLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeadStatus>(
    initialStatusFilter
  );
  const [sourceFilter, setSourceFilter] = useState<'ALL' | LeadSourceType>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('score_desc');
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  // 1. Comprehensive multi-field search + filter + sort
  const filteredAndSortedLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      // Status filter
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) {
        return false;
      }
      // Source filter
      if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) {
        return false;
      }
      // Search query across: Name, Phone, Email, Service, Location, Lead Source, Specific Need, Notes
      if (!q) return true;

      const inName = lead.name.toLowerCase().includes(q);
      const inPhone = lead.phone.toLowerCase().includes(q);
      const inEmail = lead.email.toLowerCase().includes(q);
      const inService = lead.service.toLowerCase().includes(q);
      const inLocation = lead.location.toLowerCase().includes(q);
      const inSource = (lead.source || '').toLowerCase().includes(q);
      const inSpecificNeed = (lead.specific_need || '').toLowerCase().includes(q);
      const inTimeline = (lead.timeline || '').toLowerCase().includes(q);
      const inNotes = lead.notes.some((note) =>
        note.content.toLowerCase().includes(q)
      );

      return (
        inName ||
        inPhone ||
        inEmail ||
        inService ||
        inLocation ||
        inSource ||
        inSpecificNeed ||
        inTimeline ||
        inNotes
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'score_desc') return b.score - a.score;
      if (sortBy === 'score_asc') return a.score - b.score;
      if (sortBy === 'date_desc') return b.date_added.localeCompare(a.date_added);
      if (sortBy === 'date_asc') return a.date_added.localeCompare(b.date_added);
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [leads, searchQuery, statusFilter, sourceFilter, sortBy]);

  // 2. CSV Export Handler respecting active view/filters
  const handleExportCsv = () => {
    if (filteredAndSortedLeads.length === 0) return;

    setIsExporting(true);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterSuffix = statusFilter !== 'ALL' ? `-${statusFilter}` : '';
    const filename = `LeadGuard-Leads-${dateStr}${filterSuffix}.csv`;

    const success = exportLeadsToCsv(filteredAndSortedLeads, filename);
    setIsExporting(false);

    if (success) {
      setExportSuccessMessage(`Exported ${filteredAndSortedLeads.length} leads`);
      setTimeout(() => setExportSuccessMessage(null), 3500);
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== 'ALL' ||
    sourceFilter !== 'ALL';

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Back Button & Actions */}
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
            Leads Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Search, filter, and export all incoming leads for{' '}
            <span className="font-semibold text-slate-800">
              {session.business.business_name}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Top Export Button */}
          <button
            type="button"
            disabled={filteredAndSortedLeads.length === 0 || isExporting}
            onClick={handleExportCsv}
            title={
              filteredAndSortedLeads.length === 0
                ? 'No matching leads to export'
                : `Export ${filteredAndSortedLeads.length} filtered leads to CSV`
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            {exportSuccessMessage ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700">{exportSuccessMessage}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Export CSV ({filteredAndSortedLeads.length})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('add-lead')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Global Empty State when Business has 0 total leads */}
      {leads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto space-y-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-2">
            <Inbox className="w-5 h-5 text-slate-700" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Your leads will appear here once they're captured.
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Once connected lead sources send inquiries—or when you add a lead
            manually—LeadGuard will automatically score and organize them here.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('add-lead')}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add your first lead</span>
          </button>
        </div>
      ) : (
        <>
          {/* SEARCH, FILTER & EXPORT CONTROLS BAR */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
            {/* Top Row: Prominent Search Input + Status Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Prominent Search Bar */}
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search leads across name, phone, email, service, location, source, and notes"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads by name, phone, email, service, location, source, or notes..."
                  className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search query"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Segmented Tabs */}
              <div
                role="group"
                aria-label="Filter leads by status"
                className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto shrink-0"
              >
                {(
                  [
                    { id: 'ALL', label: `All (${leads.length})` },
                    {
                      id: LeadStatus.HOT,
                      label: `Hot (${
                        leads.filter((l) => l.status === LeadStatus.HOT).length
                      })`,
                    },
                    {
                      id: LeadStatus.WARM,
                      label: `Warm (${
                        leads.filter((l) => l.status === LeadStatus.WARM).length
                      })`,
                    },
                    {
                      id: LeadStatus.COLD,
                      label: `Cold (${
                        leads.filter((l) => l.status === LeadStatus.COLD).length
                      })`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Row: Source Filter, Sort Dropdown, Reset & Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Source Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="source-filter-select"
                    className="font-semibold text-slate-600 whitespace-nowrap"
                  >
                    Source:
                  </label>
                  <select
                    id="source-filter-select"
                    value={sourceFilter}
                    onChange={(e) =>
                      setSourceFilter(e.target.value as 'ALL' | LeadSourceType)
                    }
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-900 text-xs cursor-pointer"
                  >
                    <option value="ALL">All Sources</option>
                    {ALL_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown
                    className="w-3.5 h-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <label
                    htmlFor="sort-leads-select"
                    className="font-semibold text-slate-600 whitespace-nowrap"
                  >
                    Sort:
                  </label>
                  <select
                    id="sort-leads-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-900 text-xs cursor-pointer"
                  >
                    <option value="score_desc">Score: High to Low (Priority)</option>
                    <option value="score_asc">Score: Low to High</option>
                    <option value="date_desc">Date: Newest First</option>
                    <option value="date_asc">Date: Oldest First</option>
                    <option value="name_asc">Name: A to Z</option>
                  </select>
                </div>

                {/* Reset Filters Shortcut */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer ml-1"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* Status & Export Indicators */}
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono tabular-nums text-xs">
                  Showing <span className="font-bold text-slate-900">{filteredAndSortedLeads.length}</span> of {leads.length} leads
                </span>

                <button
                  type="button"
                  disabled={filteredAndSortedLeads.length === 0 || isExporting}
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download className="w-3 h-3 text-slate-600" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* FILTERED EMPTY STATE */}
          {filteredAndSortedLeads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                <Filter className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                No leads match your current search and filter criteria
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {searchQuery ? (
                  <>
                    No records found containing &quot;<span className="font-semibold text-slate-800">{searchQuery}</span>&quot; in name, contact, service, location, or notes.
                  </>
                ) : (
                  'No leads match the selected status or source filters.'
                )}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (lg and up) */}
              <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                        <th className="py-3 px-4">Contact Name</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Service</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Date Added</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredAndSortedLeads.map((lead) => {
                        const isHot = lead.status === LeadStatus.HOT;
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => onNavigate('lead-details', lead.id)}
                            className={`transition-colors cursor-pointer ${
                              isHot
                                ? 'bg-emerald-50/20 hover:bg-emerald-50/50'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {lead.name}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {lead.phone}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {lead.email}
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                              {lead.service}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {lead.location}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {lead.source}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <ScoreIndicator
                                score={lead.score}
                                status={lead.status}
                              />
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <LeadStatusBadge status={lead.status} />
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                              {lead.date_added}
                            </td>
                            <td
                              className="py-3.5 px-4 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  aria-label={`View ${lead.name}`}
                                  onClick={() =>
                                    onNavigate('lead-details', lead.id)
                                  }
                                  title="View lead details"
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Edit ${lead.name}`}
                                  onClick={() => onEditLead(lead)}
                                  title="Edit lead"
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${lead.name}`}
                                  onClick={() => setLeadToDelete(lead)}
                                  title="Delete lead"
                                  className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RESPONSIVE MOBILE/TABLET CARDS VIEW (< lg) */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAndSortedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('lead-details', lead.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onNavigate('lead-details', lead.id);
                        }
                      }}
                      className="cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {lead.name}
                          </h3>
                          <p className="text-xs font-medium text-slate-700 mt-0.5">
                            {lead.service} · {lead.location}
                          </p>
                        </div>
                        <LeadStatusBadge status={lead.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {lead.phone}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {lead.email}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 font-mono">
                          Source: {lead.source}
                        </span>
                        <ScoreIndicator
                          score={lead.score}
                          status={lead.status}
                          showBar={false}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {lead.date_added}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigate('lead-details', lead.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${lead.name}`}
                          onClick={() => onEditLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${lead.name}`}
                          onClick={() => setLeadToDelete(lead)}
                          className="p-1.5 text-slate-500 hover:text-red-700 bg-slate-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Confirmation Dialog for Deleting a Lead */}
      <ConfirmDialog
        isOpen={Boolean(leadToDelete)}
        title="Delete lead record?"
        description={
          leadToDelete
            ? `Are you sure you want to permanently delete "${leadToDelete.name}" (${leadToDelete.service}) and its internal notes? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Lead"
        onConfirm={() => {
          if (leadToDelete) {
            onDeleteLead(leadToDelete.id);
            setLeadToDelete(null);
          }
        }}
        onCancel={() => setLeadToDelete(null)}
      />
    </div>
  );
};
