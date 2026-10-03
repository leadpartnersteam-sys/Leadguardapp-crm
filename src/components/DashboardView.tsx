import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Inbox,
  Layers,
  MapPin,
  MessageSquare,
  PhoneCall,
  Plus,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AppPage, Lead, LeadStatus, UserSession } from '../types/leadguard';
import {
  LeadQualityChart,
  LeadSourceChart,
  LeadsOverTimeChart,
  ServiceDemandChart,
  TimeframeOption,
} from './AnalyticsCharts';
import { LeadStatusBadge, ScoreIndicator } from './StatusBadge';

interface DashboardViewProps {
  session: UserSession;
  leads: Lead[];
  onNavigate: (
    page: AppPage,
    leadId?: string,
    initialStatusFilter?: 'ALL' | LeadStatus
  ) => void;
}

function parseLeadDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getRecommendedAction(lead: Lead): string {
  if (lead.status === LeadStatus.HOT) {
    if (lead.budget !== null && lead.budget > 0) {
      return 'Immediate quote call — verified budget';
    }
    if (lead.timeline_days !== null && lead.timeline_days <= 30) {
      return 'Priority consultation — urgent timeline';
    }
    return 'Immediate priority follow-up';
  }
  if (lead.status === LeadStatus.WARM) {
    if (lead.notes.length === 0) {
      return 'Discovery call — verify project scope';
    }
    return 'Follow up on inquiry details';
  }
  return 'Standard queue — clarify requirements';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  session,
  leads,
  onNavigate,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('30d');

  // Core KPI metrics computed from real Supabase leads
  const totalLeads = leads.length;
  const hotLeads = useMemo(
    () => leads.filter((l) => l.status === LeadStatus.HOT),
    [leads]
  );
  const warmLeads = useMemo(
    () => leads.filter((l) => l.status === LeadStatus.WARM),
    [leads]
  );
  const coldLeads = useMemo(
    () => leads.filter((l) => l.status === LeadStatus.COLD),
    [leads]
  );

  const averageScore = useMemo(() => {
    if (totalLeads === 0) return 0;
    const sum = leads.reduce((acc, curr) => acc + curr.score, 0);
    return Math.round(sum / totalLeads);
  }, [leads, totalLeads]);

  // Analytics summary calculations
  const analyticsSummary = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const hotPct = totalLeads > 0 ? Math.round((hotLeads.length / totalLeads) * 100) : 0;
    const warmPct = totalLeads > 0 ? Math.round((warmLeads.length / totalLeads) * 100) : 0;
    const coldPct = totalLeads > 0 ? Math.max(0, 100 - hotPct - warmPct) : 0;

    const thisWeek = leads.filter((l) => {
      const d = parseLeadDate(l.date_added);
      return d ? now - d.getTime() <= 7 * oneDayMs : false;
    }).length;

    const thisMonth = leads.filter((l) => {
      const d = parseLeadDate(l.date_added);
      return d ? now - d.getTime() <= 30 * oneDayMs : false;
    }).length;

    const uncontacted = leads.filter((l) => l.notes.length === 0).length;

    return {
      hotPct,
      warmPct,
      coldPct,
      thisWeek,
      thisMonth,
      uncontacted,
    };
  }, [leads, totalLeads, hotLeads.length, warmLeads.length]);

  // 7. Priority Leads: sorted strictly by:
  // 1. HOT before WARM before COLD
  // 2. Higher score first
  // 3. More recent leads first when scores are equal
  const priorityLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const statusRank = (s: LeadStatus) =>
        s === LeadStatus.HOT ? 3 : s === LeadStatus.WARM ? 2 : 1;
      const rankDiff = statusRank(b.status) - statusRank(a.status);
      if (rankDiff !== 0) return rankDiff;

      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      const dateA = parseLeadDate(a.date_added)?.getTime() || 0;
      const dateB = parseLeadDate(b.date_added)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [leads]);

  // 8. Leads Requiring Attention:
  // Leads that need follow-up (HOT leads, leads with score >= 65, or uncontacted with zero team notes)
  const leadsRequiringAttention = useMemo(() => {
    return [...leads]
      .filter((l) => {
        return (
          l.requires_attention ||
          l.status === LeadStatus.HOT ||
          l.score >= 65 ||
          (l.notes.length === 0 && l.status !== LeadStatus.COLD)
        );
      })
      .sort((a, b) => {
        // High scores first, then uncontacted first
        if (b.score !== a.score) return b.score - a.score;
        return a.notes.length - b.notes.length;
      });
  }, [leads]);

  // 9. Chronological Recent Leads
  const recentLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const dateA = parseLeadDate(a.date_added)?.getTime() || 0;
      const dateB = parseLeadDate(b.date_added)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [leads]);

  return (
    <div className="space-y-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            {session.business.business_name} · Command Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Executive Analytics & Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Real-time qualification insights, volume trends, and prioritized lead queues.
          </p>
        </div>

        {/* Quick Navigation Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('leads', undefined, LeadStatus.HOT)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Flame className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Hot Leads ({hotLeads.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('leads', undefined, 'ALL')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>All Leads ({totalLeads})</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('lead-sources')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Lead Channels</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('add-lead')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Global Empty State when Workspace has 0 leads */}
      {totalLeads === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto my-6 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6 text-slate-700" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Your pipeline analytics will activate once leads are captured.
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Connect your Website Forms, Webhook endpoint, or log phone inquiries manually. LeadGuard automatically qualifies, scores, and tracks lead trends here.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('add-lead')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add First Lead</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lead-sources')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Configure Ingestion Webhook</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. KEY KPI CARDS */}
          <section
            aria-label="Executive Key Performance Indicators"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            {/* Total Leads */}
            <button
              type="button"
              onClick={() => onNavigate('leads', undefined, 'ALL')}
              className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-5 text-left transition-colors cursor-pointer space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Leads
                </span>
                <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {totalLeads}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Active business pipeline
              </div>
            </button>

            {/* Hot Leads */}
            <button
              type="button"
              onClick={() => onNavigate('leads', undefined, LeadStatus.HOT)}
              className="bg-white border border-emerald-200 hover:border-emerald-400 rounded-xl p-5 text-left transition-colors cursor-pointer space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Hot Leads
                </span>
                <Flame className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 tabular-nums">
                {hotLeads.length}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {analyticsSummary.hotPct}% of pipeline · Score 80+
              </div>
            </button>

            {/* Warm Leads */}
            <button
              type="button"
              onClick={() => onNavigate('leads', undefined, LeadStatus.WARM)}
              className="bg-white border border-amber-200 hover:border-amber-400 rounded-xl p-5 text-left transition-colors cursor-pointer space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  Warm Leads
                </span>
                <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-700 tabular-nums">
                {warmLeads.length}
              </div>
              <div className="text-[11px] text-amber-700 font-medium">
                {analyticsSummary.warmPct}% of pipeline · Score 50–79
              </div>
            </button>

            {/* Cold Leads */}
            <button
              type="button"
              onClick={() => onNavigate('leads', undefined, LeadStatus.COLD)}
              className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-5 text-left transition-colors cursor-pointer space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Cold Leads
                </span>
                <Target className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-700 tabular-nums">
                {coldLeads.length}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {analyticsSummary.coldPct}% of pipeline · Score 0–49
              </div>
            </button>

            {/* Average Lead Score */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Average Score
                </span>
                <Sparkles className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {averageScore}
                <span className="text-xs font-normal text-slate-400 ml-1">/100</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Deterministic 6-factor model
              </div>
            </div>

            {/* Leads Requiring Attention */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Needs Attention
                </span>
                <AlertCircle className="w-4 h-4 text-amber-500" aria-hidden="true" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {leadsRequiringAttention.length}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Priority follow-up queue
              </div>
            </div>
          </section>

          {/* 10. ANALYTICS SUMMARY BANNER */}
          <section
            aria-label="Pipeline Velocity Summary"
            className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 shadow-xs"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  Analytics Snapshot
                </div>
                <div className="text-lg font-bold mt-0.5">
                  Pipeline Health & Inquiry Velocity
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Real metrics derived strictly from your business inquiries. Hot opportunities represent{' '}
                  <span className="font-semibold text-emerald-400">{analyticsSummary.hotPct}%</span> of total intake.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0 font-mono">
                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">THIS WEEK</div>
                  <div className="text-xl font-bold text-white mt-1 tabular-nums">
                    {analyticsSummary.thisWeek}
                  </div>
                  <div className="text-[10px] text-slate-400">Last 7 days</div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">THIS MONTH</div>
                  <div className="text-xl font-bold text-white mt-1 tabular-nums">
                    {analyticsSummary.thisMonth}
                  </div>
                  <div className="text-[10px] text-slate-400">Last 30 days</div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">HOT RATIO</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
                    {analyticsSummary.hotPct}%
                  </div>
                  <div className="text-[10px] text-slate-400">{hotLeads.length} hot leads</div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">UNCONTACTED</div>
                  <div className="text-xl font-bold text-amber-300 mt-1 tabular-nums">
                    {analyticsSummary.uncontacted}
                  </div>
                  <div className="text-[10px] text-slate-400">0 notes logged</div>
                </div>
              </div>
            </div>
          </section>

          {/* 2 & 3. CHART ROW 1: LEADS OVER TIME + LEAD QUALITY DISTRIBUTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Leads Over Time Line Chart */}
            <div className="lg:col-span-7">
              <LeadsOverTimeChart
                leads={leads}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            </div>

            {/* Right 5 Cols: Lead Quality Distribution */}
            <div className="lg:col-span-5">
              <LeadQualityChart leads={leads} />
            </div>
          </div>

          {/* 4 & 5. CHART ROW 2: LEAD SOURCES + SERVICE DEMAND */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6">
              <LeadSourceChart leads={leads} />
            </div>
            <div className="lg:col-span-6">
              <ServiceDemandChart leads={leads} />
            </div>
          </div>

          {/* 7. PRIORITY LEADS SECTION */}
          <section
            aria-labelledby="priority-leads-heading"
            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
          >
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <h2
                    id="priority-leads-heading"
                    className="text-base font-bold text-slate-900 tracking-tight"
                  >
                    Priority Leads Queue
                  </h2>
                  <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                    {priorityLeads.length} Total
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ordered strictly by priority: Hot tier first, higher score first, and newest inquiries when scores are equal.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('leads', undefined, LeadStatus.HOT)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-slate-900 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <span>View Hot Queue</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Desktop Table for Priority Leads */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Recommended Action</th>
                    <th className="py-3 px-4 text-right">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {priorityLeads.slice(0, 6).map((lead) => {
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
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {lead.service}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {lead.location}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <ScoreIndicator score={lead.score} status={lead.status} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <LeadStatusBadge status={lead.status} />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {lead.source}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                            <ArrowUpRight className="w-3 h-3 text-slate-500" />
                            <span>{getRecommendedAction(lead)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          {lead.date_added}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Priority Leads */}
            <div className="lg:hidden divide-y divide-slate-100">
              {priorityLeads.slice(0, 5).map((lead) => (
                <div
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate('lead-details', lead.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate('lead-details', lead.id);
                    }
                  }}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{lead.name}</h3>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {lead.service} · {lead.location}
                      </div>
                    </div>
                    <LeadStatusBadge status={lead.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">Source: {lead.source}</span>
                    <ScoreIndicator score={lead.score} status={lead.status} showBar={false} />
                  </div>

                  <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-200">
                    <span className="font-semibold text-slate-900">Next Action:</span>{' '}
                    {getRecommendedAction(lead)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 8 & 9. LEADS REQUIRING ATTENTION + RECENT LEADS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 8. Leads Requiring Attention (7 Cols) */}
            <section
              aria-labelledby="attention-heading"
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  <h2
                    id="attention-heading"
                    className="text-base font-bold text-slate-900 tracking-tight"
                  >
                    Leads Requiring Attention
                  </h2>
                </div>
                <span className="font-mono text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md tabular-nums">
                  {leadsRequiringAttention.length} Pending
                </span>
              </div>

              {leadsRequiringAttention.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  All high-scoring leads have active team notes and follow-ups logged.
                </div>
              ) : (
                <div className="space-y-3">
                  {leadsRequiringAttention.slice(0, 4).map((lead) => (
                    <div
                      key={lead.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('lead-details', lead.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onNavigate('lead-details', lead.id);
                        }
                      }}
                      className="p-4 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer bg-slate-50/40 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{lead.name}</div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {lead.service} · {lead.location}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <LeadStatusBadge status={lead.status} />
                          <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                            {lead.score}/100
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {lead.assessment}
                      </p>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lead.notes.length} internal notes</span>
                        </span>
                        <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 9. Chronological Recent Leads (5 Cols) */}
            <section
              aria-labelledby="recent-leads-heading"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-800" aria-hidden="true" />
                  <h2
                    id="recent-leads-heading"
                    className="text-base font-bold text-slate-900 tracking-tight"
                  >
                    Recent Inquiries
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('leads', undefined, 'ALL')}
                  className="text-xs font-semibold text-slate-800 hover:text-slate-900 underline cursor-pointer"
                >
                  All Leads
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate('lead-details', lead.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate('lead-details', lead.id);
                      }
                    }}
                    className="py-3 first:pt-0 last:pb-0 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {lead.name}
                      </span>
                      <LeadStatusBadge status={lead.status} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate max-w-[170px]">{lead.service}</span>
                      <span className="font-mono text-slate-700 font-bold tabular-nums">
                        {lead.score}/100
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Source: {lead.source}</span>
                      <span>{lead.date_added}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
