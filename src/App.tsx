import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { LeadDetailsView } from './components/LeadDetailsView';
import { LeadFormView } from './components/LeadFormView';
import { LeadSourcesView } from './components/LeadSourcesView';
import { LeadsView } from './components/LeadsView';
import { PublicPages } from './components/PublicPages';
import { SettingsView } from './components/SettingsView';
import { supabase } from './lib/supabase';
import { sanitizeString } from './lib/validation';
import {
  resolveOrCreateUserWorkspace,
  updateAuthenticatedProfileAndBusiness,
} from './services/authService';
import {
  buildQualifiedLeadEntity,
  createLeadInSupabase,
  deleteLeadFromSupabase,
  fetchAuthorizedLeadsFromSupabase,
  formatTimestampDisplay,
  INITIAL_LEAD_SOURCES,
  purgeBusinessLeadsInSupabase,
  updateLeadInSupabase,
  updateLeadNotesInSupabase,
} from './services/leadService';
import {
  AppPage,
  ConnectionStatus,
  Lead,
  LeadInputPayload,
  LeadNote,
  LeadSourceDefinition,
  LeadStatus,
  UserSession,
} from './types/leadguard';

interface ToastNotification {
  id: string;
  title: string;
  detail?: string;
  variant?: 'success' | 'error';
}

const PROTECTED_PAGES: AppPage[] = [
  'dashboard',
  'leads',
  'lead-details',
  'add-lead',
  'lead-sources',
  'settings',
];

function pageFromPathname(pathname: string): AppPage {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/signup') return 'signup';
  if (clean === '/login') return 'login';
  if (clean === '/dashboard') return 'dashboard';
  if (clean === '/leads') return 'leads';
  if (clean === '/lead-details') return 'lead-details';
  if (clean === '/add-lead') return 'add-lead';
  if (clean === '/lead-sources') return 'lead-sources';
  if (clean === '/settings') return 'settings';
  return 'landing';
}

function pathnameFromPage(page: AppPage): string {
  if (page === 'landing') return '/';
  return `/${page}`;
}

export default function App() {
  // Global Supabase Authentication & Session State
  const [currentSession, setCurrentSession] = useState<UserSession | null>(
    null
  );
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isLeadsLoading, setIsLeadsLoading] = useState<boolean>(false);
  const [leadsLoadError, setLeadsLoadError] = useState<string | null>(null);

  // Page navigation & contextual return history
  const [currentPage, setCurrentPage] = useState<AppPage>(() =>
    pageFromPathname(window.location.pathname)
  );
  const [previousPage, setPreviousPage] = useState<AppPage>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadsInitialFilter, setLeadsInitialFilter] = useState<
    'ALL' | LeadStatus
  >('ALL');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const showToast = useCallback(
    (
      title: string,
      detail?: string,
      variant: 'success' | 'error' = 'success'
    ) => {
      const id = `toast_${Date.now()}`;
      setToast({ id, title, detail, variant });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4500);
    },
    []
  );

  // Real Supabase leads for the authenticated business
  const [allLeads, setAllLeads] = useState<Lead[]>([]);

  // Per-business lead source connection states
  const [sourcesByBusiness, setSourcesByBusiness] = useState<
    Record<string, LeadSourceDefinition[]>
  >({});

  const syncUrlWithPage = useCallback((page: AppPage, replace = false) => {
    const targetPath = pathnameFromPage(page);
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath);
      } else {
        window.history.pushState({}, '', targetPath);
      }
    }
  }, []);

  // Strict tenant isolation filter: only return leads belonging to the authenticated business_id
  const authorizedLeads = useMemo(() => {
    if (!currentSession) return [];
    const authorizedBusinessId = currentSession.business.id;
    return allLeads.filter((lead) => lead.business_id === authorizedBusinessId);
  }, [allLeads, currentSession]);

  const authorizedSources = useMemo(() => {
    if (!currentSession) return INITIAL_LEAD_SOURCES;
    return (
      sourcesByBusiness[currentSession.business.id] || INITIAL_LEAD_SOURCES
    );
  }, [sourcesByBusiness, currentSession]);

  const loadBusinessLeads = useCallback(
    async (session: UserSession) => {
      setIsLeadsLoading(true);
      setLeadsLoadError(null);

      const { leads, error } = await fetchAuthorizedLeadsFromSupabase(session);
      setIsLeadsLoading(false);

      if (error || !leads) {
        setLeadsLoadError(
          error ||
            'Unable to load your leads right now. Please check your connection and try again.'
        );
        return;
      }

      setAllLeads(leads);
      setSelectedLeadId((prevId) => {
        if (prevId && leads.some((l) => l.id === prevId)) {
          return prevId;
        }
        return leads.length > 0 ? leads[0].id : null;
      });
    },
    []
  );

  const handleNavigate = useCallback(
    (
      page: AppPage,
      leadId?: string,
      initialStatusFilter?: 'ALL' | LeadStatus
    ) => {
      // Protect authenticated pages: redirect unauthenticated users to Login
      if (!currentSession && PROTECTED_PAGES.includes(page)) {
        setCurrentPage('login');
        syncUrlWithPage('login');
        setMobileMenuOpen(false);
        return;
      }

      // Redirect authenticated users away from Login / Sign Up to Dashboard
      if (currentSession && (page === 'login' || page === 'signup')) {
        setCurrentPage('dashboard');
        syncUrlWithPage('dashboard');
        setMobileMenuOpen(false);
        return;
      }

      if (leadId) {
        setSelectedLeadId(leadId);
      }
      if (initialStatusFilter) {
        setLeadsInitialFilter(initialStatusFilter);
      } else if (page === 'leads' && currentPage !== 'lead-details') {
        setLeadsInitialFilter('ALL');
      }

      if (page !== currentPage) {
        setPreviousPage(currentPage);
      }
      setCurrentPage(page);
      syncUrlWithPage(page);
      setMobileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentSession, currentPage, syncUrlWithPage]
  );

  // Handle browser Back/Forward buttons
  useEffect(() => {
    const onPopState = () => {
      const targetPage = pageFromPathname(window.location.pathname);
      if (!currentSession && PROTECTED_PAGES.includes(targetPage)) {
        setCurrentPage('login');
        syncUrlWithPage('login', true);
      } else if (
        currentSession &&
        (targetPage === 'login' || targetPage === 'signup')
      ) {
        setCurrentPage('dashboard');
        syncUrlWithPage('dashboard', true);
      } else {
        setCurrentPage(targetPage);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentSession, syncUrlWithPage]);

  // Restore active Supabase Auth session on mount and subscribe to auth state changes
  useEffect(() => {
    if (!supabase) {
      setIsAuthChecking(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) return;
        const user = data.session?.user;
        if (!user) {
          setCurrentSession(null);
          const initialRoute = pageFromPathname(window.location.pathname);
          if (PROTECTED_PAGES.includes(initialRoute)) {
            setCurrentPage('login');
            syncUrlWithPage('login', true);
          }
          setIsAuthChecking(false);
          return;
        }

        const workspace = await resolveOrCreateUserWorkspace({ user });
        if (!isMounted) return;

        if (workspace.session) {
          setCurrentSession(workspace.session);
          setSourcesByBusiness((prev) => ({
            ...prev,
            [workspace.session!.business.id]:
              prev[workspace.session!.business.id] || INITIAL_LEAD_SOURCES,
          }));
          const initialRoute = pageFromPathname(window.location.pathname);
          const nextRoute: AppPage =
            initialRoute === 'landing' ||
            initialRoute === 'login' ||
            initialRoute === 'signup'
              ? 'dashboard'
              : initialRoute;
          setCurrentPage(nextRoute);
          syncUrlWithPage(nextRoute, true);
        } else {
          setCurrentSession(null);
          setCurrentPage('login');
          syncUrlWithPage('login', true);
        }
        setIsAuthChecking(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentSession(null);
        setIsAuthChecking(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_OUT' || !session?.user) {
          setCurrentSession(null);
          setAllLeads([]);
          setEditingLead(null);
          setLeadsLoadError(null);
          setCurrentPage((prev) =>
            PROTECTED_PAGES.includes(prev) ? 'login' : prev
          );
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const workspace = await resolveOrCreateUserWorkspace({
            user: session.user,
          });
          if (isMounted && workspace.session) {
            setCurrentSession(workspace.session);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncUrlWithPage]);

  // Enforce route guards whenever session or page changes
  useEffect(() => {
    if (isAuthChecking) return;

    if (!currentSession && PROTECTED_PAGES.includes(currentPage)) {
      setCurrentPage('login');
      syncUrlWithPage('login', true);
    } else if (
      currentSession &&
      (currentPage === 'login' || currentPage === 'signup')
    ) {
      setCurrentPage('dashboard');
      syncUrlWithPage('dashboard', true);
    }
  }, [currentSession, currentPage, isAuthChecking, syncUrlWithPage]);

  // Fetch leads from Supabase when an authenticated session becomes active
  useEffect(() => {
    if (!currentSession) return;
    void loadBusinessLeads(currentSession);
  }, [currentSession?.business.id, loadBusinessLeads]);

  const getBackLabelAndTarget = (): { label: string; target: AppPage } => {
    if (currentPage === 'lead-details') {
      if (previousPage === 'dashboard') {
        return { label: 'Back to Dashboard', target: 'dashboard' };
      }
      if (previousPage === 'lead-sources') {
        return { label: 'Back to Lead Sources', target: 'lead-sources' };
      }
      return { label: 'Back to Leads', target: 'leads' };
    }
    if (currentPage === 'add-lead') {
      if (previousPage === 'leads') {
        return { label: 'Back to Leads', target: 'leads' };
      }
      if (previousPage === 'lead-sources') {
        return { label: 'Back to Lead Sources', target: 'lead-sources' };
      }
      return { label: 'Back to Dashboard', target: 'dashboard' };
    }
    return { label: 'Back to Dashboard', target: 'dashboard' };
  };

  const handleAuthenticateSession = (session: UserSession) => {
    setSourcesByBusiness((prev) => ({
      ...prev,
      [session.business.id]:
        prev[session.business.id] || INITIAL_LEAD_SOURCES,
    }));
    setCurrentSession(session);
    setPreviousPage('dashboard');
    setCurrentPage('dashboard');
    syncUrlWithPage('dashboard');
    showToast(
      `Signed in to ${session.business.business_name}`,
      `Authenticated as ${session.full_name}`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentSession(null);
    setAllLeads([]);
    setEditingLead(null);
    setLeadsLoadError(null);
    setToast(null);
    setCurrentPage('login');
    syncUrlWithPage('login');
    setMobileMenuOpen(false);
  };

  const handleCreateLead = async (payload: LeadInputPayload) => {
    if (!currentSession) {
      return {
        success: false,
        errors: ['Unauthorized: No active business session.'],
      };
    }

    const result = await createLeadInSupabase({
      session: currentSession,
      rawPayload: payload,
    });

    if (!result.success || !result.lead) {
      return {
        success: false,
        errors: result.errors,
      };
    }

    const savedLead = result.lead;
    setAllLeads((prev) => [savedLead, ...prev]);
    setSelectedLeadId(savedLead.id);
    setPreviousPage('leads');
    setCurrentPage('lead-details');
    syncUrlWithPage('lead-details');

    showToast(
      'Lead saved and automatically qualified',
      `${savedLead.name} scored ${savedLead.score}/100 (${savedLead.status}).`
    );
    return {
      success: true,
      errors: [],
      lead: savedLead,
    };
  };

  const handleUpdateLead = async (payload: LeadInputPayload) => {
    if (!currentSession || !editingLead) {
      return {
        success: false,
        errors: ['Unauthorized or missing lead record.'],
      };
    }

    const result = await updateLeadInSupabase({
      session: currentSession,
      existingLead: editingLead,
      rawPayload: payload,
    });

    if (!result.success || !result.lead) {
      return {
        success: false,
        errors: result.errors,
      };
    }

    const updatedLead = result.lead;
    setAllLeads((prev) =>
      prev.map((item) => (item.id === updatedLead.id ? updatedLead : item))
    );
    setEditingLead(null);
    showToast(
      'Lead updated & qualification recalculated',
      `${updatedLead.name} is now ${updatedLead.score}/100 (${updatedLead.status}).`
    );
    return {
      success: true,
      errors: [],
      lead: updatedLead,
    };
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!currentSession) return;
    const target = allLeads.find((l) => l.id === leadId);
    if (!target || target.business_id !== currentSession.business.id) return;

    const result = await deleteLeadFromSupabase(leadId);
    if (!result.success) {
      showToast(
        'Unable to delete lead',
        result.errorMessage || 'Please try again.',
        'error'
      );
      return;
    }

    const remainingLeads = allLeads.filter((l) => l.id !== leadId);
    setAllLeads(remainingLeads);
    showToast(
      'Lead deleted',
      `${target.name} was permanently removed from your business.`
    );

    if (currentPage === 'lead-details' && selectedLeadId === leadId) {
      setSelectedLeadId(remainingLeads.length > 0 ? remainingLeads[0].id : null);
      setCurrentPage('leads');
      syncUrlWithPage('leads');
    }
  };

  const handleAddNote = async (leadId: string, noteContent: string) => {
    if (!currentSession) return;
    const sanitizedContent = sanitizeString(noteContent, 1000);
    if (!sanitizedContent) return;

    const targetLead = allLeads.find(
      (l) => l.id === leadId && l.business_id === currentSession.business.id
    );
    if (!targetLead) return;

    const formattedDate = formatTimestampDisplay(new Date().toISOString());
    const newNote: LeadNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      lead_id: targetLead.id,
      business_id: currentSession.business.id,
      author_name: currentSession.full_name,
      content: sanitizedContent,
      created_at: formattedDate,
    };

    const updatedNotes = [newNote, ...targetLead.notes];
    const result = await updateLeadNotesInSupabase({
      session: currentSession,
      lead: targetLead,
      updatedNotes,
    });

    if (!result.success || !result.lead) {
      showToast(
        'Unable to save note',
        result.errorMessage || 'Please try again.',
        'error'
      );
      return;
    }

    setAllLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? result.lead! : lead))
    );
    showToast('Internal note saved');
  };

  const handleDeleteNote = async (leadId: string, noteId: string) => {
    if (!currentSession) return;
    const targetLead = allLeads.find(
      (l) => l.id === leadId && l.business_id === currentSession.business.id
    );
    if (!targetLead) return;

    const updatedNotes = targetLead.notes.filter((n) => n.id !== noteId);
    const result = await updateLeadNotesInSupabase({
      session: currentSession,
      lead: targetLead,
      updatedNotes,
    });

    if (!result.success || !result.lead) {
      showToast(
        'Unable to remove note',
        result.errorMessage || 'Please try again.',
        'error'
      );
      return;
    }

    setAllLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? result.lead! : lead))
    );
    showToast('Internal note removed');
  };

  const handleUpdateSourceStatus = (
    sourceId: string,
    status: ConnectionStatus,
    errorDetail?: string
  ) => {
    if (!currentSession) return;
    const bizId = currentSession.business.id;
    setSourcesByBusiness((prev) => {
      const currentList = prev[bizId] || INITIAL_LEAD_SOURCES;
      return {
        ...prev,
        [bizId]: currentList.map((src) =>
          src.id === sourceId
            ? {
                ...src,
                status,
                errorDetail:
                  status === 'CONNECTION ERROR' ? errorDetail : undefined,
              }
            : src
        ),
      };
    });
    showToast(`Source status updated to ${status}`);
  };

  const handleSimulateWebhookIntake = async (rawPayload: unknown) => {
    if (!currentSession) {
      return {
        success: false,
        errors: ['Unauthorized request.'],
      };
    }

    const result = await createLeadInSupabase({
      session: currentSession,
      rawPayload,
    });

    if (!result.success || !result.lead) {
      return {
        success: false,
        errors: result.errors,
      };
    }

    const createdLead = result.lead;
    setAllLeads((prev) => [createdLead, ...prev]);
    setSelectedLeadId(createdLead.id);
    showToast(
      'Incoming lead captured & qualified',
      `${createdLead.name} (${createdLead.score}/100 · ${createdLead.status})`
    );
    return {
      success: true,
      errors: [],
      leadId: createdLead.id,
    };
  };

  const handleUpdateBusinessSettings = async (updates: {
    business_name: string;
    full_name: string;
    target_locations: string[];
  }): Promise<{ success: boolean; errorMessage?: string }> => {
    if (!currentSession) {
      return { success: false, errorMessage: 'No active session.' };
    }

    const dbUpdate = await updateAuthenticatedProfileAndBusiness({
      session: currentSession,
      fullName: updates.full_name,
      businessName: updates.business_name,
    });

    if (!dbUpdate.success) {
      return dbUpdate;
    }

    const updatedBusiness = {
      ...currentSession.business,
      business_name: sanitizeString(updates.business_name, 120),
      target_locations: updates.target_locations.map((l) =>
        sanitizeString(l, 60)
      ),
    };

    const updatedSession: UserSession = {
      ...currentSession,
      full_name: sanitizeString(updates.full_name, 100),
      business: updatedBusiness,
    };

    setCurrentSession(updatedSession);

    // Recalculate qualification scores for this tenant's leads using updated target locations
    setAllLeads((prev) =>
      prev.map((lead) => {
        if (lead.business_id !== updatedBusiness.id) return lead;
        return buildQualifiedLeadEntity({
          id: lead.id,
          business: updatedBusiness,
          payload: {
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            service: lead.service,
            location: lead.location,
            budget: lead.budget,
            timeline: lead.timeline,
            decision_maker: lead.decision_maker,
            specific_need: lead.specific_need,
            engaged: lead.engaged,
            source: lead.source,
          },
          date_added: lead.date_added,
          updated_at: lead.updated_at,
          existing_notes: lead.notes,
        });
      })
    );
    showToast('Settings saved & target locations updated');
    return { success: true };
  };

  const handlePurgeTenantLeads = async () => {
    if (!currentSession) return;
    const bizId = currentSession.business.id;
    const result = await purgeBusinessLeadsInSupabase();
    if (!result.success) {
      showToast(
        'Unable to purge leads',
        result.errorMessage || 'Please try again.',
        'error'
      );
      return;
    }
    setAllLeads((prev) => prev.filter((l) => l.business_id !== bizId));
    setSelectedLeadId(null);
    showToast(
      'Workspace leads purged',
      `All leads for ${currentSession.business.business_name} were deleted.`
    );
  };

  // Global Loading Screen while verifying Supabase Auth session
  if (isAuthChecking) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6"
      >
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto font-bold text-sm animate-pulse">
            LG
          </div>
          <div className="text-sm font-bold text-slate-900">
            Verifying your LeadGuard session...
          </div>
          <p className="text-xs text-slate-500">
            Connecting securely to Supabase Authentication.
          </p>
        </div>
      </div>
    );
  }

  // Render Public Pages (Landing, Sign Up, Login) when unauthenticated or on public routes
  if (
    !currentSession ||
    currentPage === 'landing' ||
    currentPage === 'signup' ||
    currentPage === 'login'
  ) {
    const publicRoute =
      currentPage === 'signup' || currentPage === 'login'
        ? currentPage
        : 'landing';
    return (
      <PublicPages
        currentPage={publicRoute}
        onNavigate={handleNavigate}
        onAuthenticateSession={handleAuthenticateSession}
      />
    );
  }

  const activeLead =
    authorizedLeads.find((l) => l.id === selectedLeadId) ||
    authorizedLeads[0] ||
    null;

  const hotCount = authorizedLeads.filter(
    (l) => l.status === LeadStatus.HOT
  ).length;

  const navItems: Array<{
    id: AppPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'leads',
      label: 'Leads',
      icon: Users,
      count: authorizedLeads.length,
    },
    { id: 'lead-sources', label: 'Lead Sources', icon: Radio },
    { id: 'add-lead', label: 'Add Lead', icon: PlusCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const backContext = getBackLabelAndTarget();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation (260px width) */}
      <aside
        aria-label="Workspace sidebar"
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800"
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="text-left cursor-pointer"
          >
            <div className="text-lg font-bold tracking-tight text-white">
              LeadGuard
            </div>
            <div className="text-[11px] text-slate-400">
              Capture. Qualify. Organize.
            </div>
          </button>
        </div>

        {/* Active Business Tenant Context */}
        <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-white truncate">
            <Building2
              className="w-3.5 h-3.5 text-slate-400 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">
              {currentSession.business.business_name}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate pl-5">
            {currentSession.full_name}
          </div>
        </div>

        {/* Primary Navigation Links */}
        <nav
          aria-label="Authenticated workspace navigation"
          className="flex-1 px-3 py-4 space-y-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.id ||
              (currentPage === 'lead-details' && item.id === 'leads');
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Authenticated Account Status & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck
              className="w-3.5 h-3.5 text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{currentSession.email}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Compact Mobile Top Header (Respects <= 15% mobile viewport sticky cap) */}
      <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className="flex items-center gap-2 text-left cursor-pointer min-w-0"
        >
          <span className="text-base font-bold tracking-tight shrink-0">
            LeadGuard
          </span>
          <span className="text-slate-600 shrink-0" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-300 truncate">
            {currentSession.business.business_name}
          </span>
        </button>
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-300 hover:text-white cursor-pointer shrink-0"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden bg-slate-900 text-white px-4 pt-2 pb-4 border-b border-slate-800 space-y-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.id ||
              (currentPage === 'lead-details' && item.id === 'leads');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className="font-mono text-[11px]">{item.count}</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-300 hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </nav>
      )}

      {/* Main Content Workspace Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Workspace Contextual Breadcrumb Bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200 text-xs">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-slate-600"
          >
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="font-semibold text-slate-900 hover:underline cursor-pointer"
            >
              {currentSession.business.business_name}
            </button>
            <ChevronRight
              className="w-3.5 h-3.5 text-slate-400"
              aria-hidden="true"
            />
            {currentPage === 'lead-details' && activeLead ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavigate('leads')}
                  className="hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Leads
                </button>
                <ChevronRight
                  className="w-3.5 h-3.5 text-slate-400"
                  aria-hidden="true"
                />
                <span className="text-slate-900 font-medium truncate max-w-[220px]">
                  {activeLead.name}
                </span>
              </>
            ) : (
              <span className="capitalize text-slate-900 font-medium">
                {currentPage.replace('-', ' ')}
              </span>
            )}
          </nav>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-600 font-mono">
              <button
                type="button"
                onClick={() =>
                  handleNavigate('leads', undefined, LeadStatus.HOT)
                }
                className="hover:underline cursor-pointer"
              >
                <span>HOT LEADS: </span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {hotCount}
                </span>
              </button>
              <span aria-hidden="true">·</span>
              <span>TOTAL:</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {authorizedLeads.length}
              </span>
            </div>
          </div>
        </div>

        {/* Toast Notification Banner */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-40 max-w-sm rounded-xl p-4 shadow-lg flex items-start gap-3 border ${
              toast.variant === 'error'
                ? 'bg-red-950 text-white border-red-800'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toast.variant === 'error' ? (
              <AlertCircle
                className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            )}
            <div className="flex-1 text-xs">
              <div className="font-bold">{toast.title}</div>
              {toast.detail && (
                <div className="text-slate-300 mt-0.5 leading-relaxed">
                  {toast.detail}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Page Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-5 sm:p-6 lg:p-8">
          {/* Error Banner when Loading Leads Fails */}
          {leadsLoadError && (
            <div
              role="alert"
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-800"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <div className="font-bold">Unable to load leads</div>
                  <div className="mt-0.5">{leadsLoadError}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadBusinessLeads(currentSession)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 text-red-800 font-semibold rounded-lg hover:bg-red-100/50 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {isLeadsLoading ? (
            <div
              role="status"
              aria-label="Loading workspace data"
              className="space-y-6 animate-pulse"
            >
              <div className="h-14 bg-slate-200/70 rounded-xl w-1/3" />
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="h-24 bg-slate-200/70 rounded-xl border border-slate-200"
                  />
                ))}
              </div>
              <div className="h-64 bg-slate-200/70 rounded-xl border border-slate-200" />
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && (
                <DashboardView
                  session={currentSession}
                  leads={authorizedLeads}
                  onNavigate={handleNavigate}
                />
              )}

              {currentPage === 'leads' && (
                <LeadsView
                  session={currentSession}
                  leads={authorizedLeads}
                  initialStatusFilter={leadsInitialFilter}
                  onNavigate={handleNavigate}
                  onEditLead={(lead) => setEditingLead(lead)}
                  onDeleteLead={handleDeleteLead}
                />
              )}

              {currentPage === 'lead-details' &&
                (activeLead ? (
                  <LeadDetailsView
                    lead={activeLead}
                    session={currentSession}
                    backLabel={backContext.label}
                    onBack={() => handleNavigate(backContext.target)}
                    onEditLead={(lead) => setEditingLead(lead)}
                    onDeleteLead={handleDeleteLead}
                    onAddNote={handleAddNote}
                    onDeleteNote={handleDeleteNote}
                  />
                ) : (
                  <div className="p-10 bg-white border border-slate-200 rounded-xl text-center space-y-3">
                    <div className="text-sm font-bold text-slate-900">
                      No lead selected
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('leads')}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Back to Leads
                    </button>
                  </div>
                ))}

              {currentPage === 'add-lead' && (
                <LeadFormView
                  session={currentSession}
                  backLabel={backContext.label}
                  onSubmitLead={handleCreateLead}
                  onCancel={() => handleNavigate(backContext.target)}
                />
              )}

              {currentPage === 'lead-sources' && (
                <LeadSourcesView
                  session={currentSession}
                  sources={authorizedSources}
                  onUpdateSourceStatus={handleUpdateSourceStatus}
                  onSimulateWebhookIntake={handleSimulateWebhookIntake}
                  onNavigate={handleNavigate}
                />
              )}

              {currentPage === 'settings' && (
                <SettingsView
                  session={currentSession}
                  tenantLeadCount={authorizedLeads.length}
                  onNavigate={handleNavigate}
                  onUpdateBusinessSettings={handleUpdateBusinessSettings}
                  onPurgeTenantLeads={handlePurgeTenantLeads}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Edit Lead Modal */}
      {editingLead && (
        <LeadFormView
          session={currentSession}
          initialLead={editingLead}
          isModal={true}
          onSubmitLead={handleUpdateLead}
          onCancel={() => setEditingLead(null)}
        />
      )}
    </div>
  );
}
