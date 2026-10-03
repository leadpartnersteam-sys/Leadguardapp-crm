import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Filter,
  Inbox,
  LayoutList,
  Lock,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { qualifyLeadDeterministically } from '../lib/qualification';
import {
  signInWithSupabase,
  signUpWithSupabase,
} from '../services/authService';
import { AppPage, LeadStatus, UserSession } from '../types/leadguard';
import { LeadStatusBadge } from './StatusBadge';

interface PublicPagesProps {
  currentPage: 'landing' | 'signup' | 'login';
  onNavigate: (page: AppPage) => void;
  onAuthenticateSession: (session: UserSession) => void;
}

const WORKFLOW_STEPS = [
  { step: '01', label: 'Lead Source', detail: 'Website, Make.com, Webhook/API' },
  { step: '02', label: 'Secure Lead Intake', detail: 'Authenticated HTTPS endpoint' },
  { step: '03', label: 'Validate Lead', detail: 'Server-side schema & bounds check' },
  { step: '04', label: 'Automatically Qualify', detail: 'Deterministic 6-factor rules' },
  { step: '05', label: 'Calculate Score', detail: 'Authoritative 0–100 point scale' },
  { step: '06', label: 'Hot / Warm / Cold', detail: '80–100 Hot · 50–79 Warm · 0–49 Cold' },
  { step: '07', label: 'LeadGuard Assessment', detail: 'Fact-based qualification summary' },
  { step: '08', label: 'Business Dashboard', detail: 'Multi-tenant RLS isolated view' },
  { step: '09', label: 'Business Takes Action', detail: 'Prioritized follow-up & notes' },
];

const TARGET_INDUSTRIES = [
  {
    name: 'Construction Companies',
    example: 'New residential builds, structural extensions, civil contracting',
  },
  {
    name: 'Roofing Companies',
    example: 'Full roof replacements, waterproofing, truss repairs',
  },
  {
    name: 'Solar Companies',
    example: 'Commercial & residential hybrid inverters, battery storage arrays',
  },
  {
    name: 'Plumbing Companies',
    example: 'Reticulation upgrades, solar geysers, commercial plumbing',
  },
  {
    name: 'Electrical Companies',
    example: 'Three-phase DB upgrades, rewiring, Certificates of Compliance',
  },
  {
    name: 'Home Renovation Companies',
    example: 'Kitchen & bathroom remodels, turnkey interior refurbishments',
  },
  {
    name: 'Estate Agents',
    example: 'Buyer qualification, mandate inquiries, commercial leasing leads',
  },
  {
    name: 'Service Businesses',
    example: 'HVAC, paving, security installations, specialized trade contractors',
  },
];

export const PublicPages: React.FC<PublicPagesProps> = ({
  currentPage,
  onNavigate,
  onAuthenticateSession,
}) => {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // Interactive deterministic qualifier preview state on Landing Page
  const [demoNeed, setDemoNeed] = useState(true);
  const [demoBudget, setDemoBudget] = useState(true);
  const [demoTimeline, setDemoTimeline] = useState(true);
  const [demoDecisionMaker, setDemoDecisionMaker] = useState(true);
  const [demoLocation, setDemoLocation] = useState(true);
  const [demoEngaged, setDemoEngaged] = useState(true);

  // Sign Up & Login form states
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailConfirmationSentTo, setEmailConfirmationSentTo] = useState<
    string | null
  >(null);

  const demoResult = qualifyLeadDeterministically(
    {
      name: 'John Smith',
      phone: '+27 82 555 0101',
      email: 'john.smith@example.com',
      service: 'New House Construction',
      location: demoLocation ? 'Sandton' : 'Outlying Area',
      budget: demoBudget ? 2500000 : null,
      timeline: demoTimeline ? '21 days' : '90 days',
      decision_maker: demoDecisionMaker,
      specific_need: demoNeed ? 'Build a 4-bedroom home' : '',
      engaged: demoEngaged,
      source: 'Website',
    },
    ['Sandton', 'Midrand', 'Fourways']
  );

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setEmailConfirmationSentTo(null);

    const cleanName = fullName.trim();
    const cleanBiz = businessName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (cleanName.length < 2) {
      setAuthError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (cleanBiz.length < 2) {
      setAuthError('Please enter your business name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setAuthError('Password is too weak. Please enter at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError(
        'Passwords do not match. Please make sure Password and Confirm password are identical.'
      );
      return;
    }

    setIsSubmittingAuth(true);
    const result = await signUpWithSupabase({
      fullName: cleanName,
      businessName: cleanBiz,
      email: cleanEmail,
      password,
    });
    setIsSubmittingAuth(false);
    setPassword('');
    setConfirmPassword('');

    if (!result.success) {
      setAuthError(
        result.errorMessage ||
          'Unable to create account right now. Please check your details and try again.'
      );
      return;
    }

    if (result.requiresEmailConfirmation) {
      setEmailConfirmationSentTo(cleanEmail);
      return;
    }

    if (result.session) {
      onAuthenticateSession(result.session);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setEmailConfirmationSentTo(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    setIsSubmittingAuth(true);
    const result = await signInWithSupabase({
      email: cleanEmail,
      password,
    });
    setIsSubmittingAuth(false);
    setPassword('');

    if (!result.success || !result.session) {
      setAuthError(
        result.errorMessage || 'Incorrect email or password. Please try again.'
      );
      return;
    }

    onAuthenticateSession(result.session);
  };

  if (currentPage === 'signup' || currentPage === 'login') {
    const isSignUp = currentPage === 'signup';
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="text-lg font-bold tracking-tight text-slate-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 rounded"
          >
            LeadGuard
          </button>

          <nav
            aria-label="Public navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Qualification
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Lead Sources
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Security
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setEmailConfirmationSentTo(null);
                onNavigate(isSignUp ? 'login' : 'signup');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isSignUp ? 'Sign In' : 'Get Started'}
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md mb-4">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-xs">
            <div className="mb-6">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Capture. Qualify. Organize.
              </p>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isSignUp
                  ? 'Create your business workspace'
                  : 'Sign in to LeadGuard'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {isSignUp
                  ? 'Isolate your business leads and automate incoming qualification.'
                  : 'Access your business dashboard and prioritized lead queue.'}
              </p>
            </div>

            {emailConfirmationSentTo && (
              <div
                role="status"
                className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-2"
              >
                <div className="font-bold">
                  Check your email to confirm your account
                </div>
                <p className="leading-relaxed">
                  We sent a confirmation link to{' '}
                  <span className="font-semibold">
                    {emailConfirmationSentTo}
                  </span>
                  . Once confirmed, sign in below to complete your business
                  workspace setup.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmailConfirmationSentTo(null);
                    setAuthError(null);
                    onNavigate('login');
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-900 underline cursor-pointer pt-1"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
              >
                <div className="font-semibold">Authentication notice</div>
                <div className="mt-0.5 leading-relaxed">{authError}</div>
              </div>
            )}

            <form
              onSubmit={isSignUp ? handleSignUpSubmit : handleLoginSubmit}
              className="space-y-4"
              noValidate
            >
              {isSignUp && (
                <>
                  <div>
                    <label
                      htmlFor="signup-fullname"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Full name{' '}
                      <span className="text-slate-400 font-normal">
                        (Required)
                      </span>
                    </label>
                    <input
                      id="signup-fullname"
                      type="text"
                      required
                      maxLength={100}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. David Mokoena"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-business"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Business name{' '}
                      <span className="text-slate-400 font-normal">
                        (Required)
                      </span>
                    </label>
                    <input
                      id="signup-business"
                      type="text"
                      required
                      maxLength={120}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Apex Construction & Solar (Pty) Ltd"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email{' '}
                  <span className="text-slate-400 font-normal">(Required)</span>
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.co.za"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password{' '}
                  <span className="text-slate-400 font-normal">(Required)</span>
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {isSignUp && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm password{' '}
                    <span className="text-slate-400 font-normal">
                      (Required)
                    </span>
                  </label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {isSubmittingAuth
                  ? isSignUp
                    ? 'Creating Workspace...'
                    : 'Signing In...'
                  : isSignUp
                  ? 'Create Business Account'
                  : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center text-xs text-slate-600">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setEmailConfirmationSentTo(null);
                      onNavigate('login');
                    }}
                    className="font-semibold text-slate-900 underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Need a workspace for your business?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setEmailConfirmationSentTo(null);
                      onNavigate('signup');
                    }}
                    className="font-semibold text-slate-900 underline cursor-pointer"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // LANDING PAGE
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-12 py-4 bg-white/95 backdrop-blur border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 rounded"
        >
          LeadGuard
        </a>

        {/* Zone 2: 4 clean navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
        >
          <a
            href="#benefits"
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Core Benefits
          </a>
          <a
            href="#workflow"
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Intake Workflow
          </a>
          <a
            href="#qualifier"
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Qualification Engine
          </a>
          <a
            href="#security"
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Security & POPIA
          </a>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* HERO SECTION WITH PRODUCT VISUAL & IMAGERY */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-20 lg:pt-20 lg:pb-24 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold text-slate-600 tracking-wide mb-3">
                Capture. Qualify. Organize.
              </p>
              <h1
                className="text-4xl sm:text-5xl lg:text-[52px] font-bold text-slate-900 tracking-tight leading-[1.1]"
                style={{ textWrap: 'balance' }}
              >
                Turn incoming leads into opportunities.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                LeadGuard captures, qualifies and organizes your leads so your
                team knows which opportunities need attention first.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onNavigate('signup')}
                  className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="px-6 py-3 bg-white text-slate-900 border border-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span>Connected Lead Sources</span>
                  <span aria-hidden="true">·</span>
                  <span>Deterministic 100-Point Scoring</span>
                  <span aria-hidden="true">·</span>
                  <span>Multi-Tenant Data Isolation</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero SaaS Imagery + Live Product Qualification Card */}
            <div className="lg:col-span-6 space-y-4">
              {/* Generated High-Fidelity Abstract SaaS Visual with Resilient Fallback */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video">
                {!heroImgError ? (
                  <img
                    src="/src/assets/images/leadguard_hero_visual_1790932467764.jpg"
                    alt="LeadGuard structured lead capture and qualification pipeline visual"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8">
                    <div className="text-center space-y-2">
                      <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
                      <div className="text-sm font-bold text-white">
                        LeadGuard Qualification Engine
                      </div>
                      <div className="text-xs text-slate-400">
                        Capture · Qualify · Organize
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrim Overlay with Real Product Context */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent flex flex-col justify-end p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-300">
                        AUTOMATED INTAKE & SCORING
                      </div>
                      <div className="text-base sm:text-lg font-bold tracking-tight mt-0.5">
                        John Smith · New House Construction (Sandton)
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        Budget: R2,500,000 · Timeline: 21 days · Decision Maker: Yes
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2 text-right font-mono shrink-0 self-start sm:self-auto">
                      <div className="text-[10px] text-slate-400">
                        QUALIFICATION SCORE
                      </div>
                      <div className="text-sm font-bold text-emerald-400 tabular-nums">
                        100/100 · HOT
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Product Dashboard Preview Strip */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-900">
                    LeadGuard Assessment Preview
                  </span>
                  <LeadStatusBadge status={LeadStatus.HOT} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  “Strong potential opportunity (100/100). The lead has a
                  specific requirement, provided a budget, has a short project
                  timeline (within 30 days), is the decision maker, is located
                  within your target service area and is actively engaged.
                  Prioritize immediate follow-up.”
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CORE BENEFITS SECTION (Sections 5 & 10 Specification) */}
        <section
          id="benefits"
          className="max-w-7xl mx-auto px-6 lg:px-12 py-20 border-b border-slate-200"
        >
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How LeadGuard helps your team focus on the right inquiries
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Instead of entering and qualifying every lead by hand, connect
              your lead sources so inquiries are validated, scored, and
              organized automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                  <Inbox className="w-4 h-4 text-slate-800" aria-hidden="true" />
                </div>
                <div className="text-xs font-mono font-semibold text-slate-500 mb-1">
                  01. CAPTURE
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Bring leads into one organized system.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Bring leads into one place from your connected sources—including
                  Website Forms, Make.com scenarios, and webhooks—with manual
                  entry available whenever your team logs a phone call.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                  <Filter className="w-4 h-4 text-slate-800" aria-hidden="true" />
                </div>
                <div className="text-xs font-mono font-semibold text-slate-500 mb-1">
                  02. QUALIFY
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Automatically score leads using consistent qualification criteria.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Automatically score leads using the information they provide
                  across six clear factors: specific need, budget, timeline
                  within 30 days, decision maker, target location, and
                  engagement.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                  <LayoutList className="w-4 h-4 text-slate-800" aria-hidden="true" />
                </div>
                <div className="text-xs font-mono font-semibold text-slate-500 mb-1">
                  03. ORGANIZE
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Give your team a clear view of which leads need attention.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  See your hottest opportunities and keep every lead organized
                  with clear Hot, Warm, and Cold statuses, automatic LeadGuard
                  Assessments, and private team notes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* END-TO-END WORKFLOW PIPELINE */}
        <section
          id="workflow"
          className="max-w-7xl mx-auto px-6 lg:px-12 py-20 border-b border-slate-200 bg-slate-50/60"
        >
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              The LeadGuard workflow from source to action
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Every incoming lead passes through validation, automatic point
              qualification, and assessment generation before appearing on your
              dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3.5"
              >
                <span className="font-mono text-xs font-semibold text-slate-500 pt-0.5 tabular-nums">
                  {item.step}.
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* INTERACTIVE DETERMINISTIC QUALIFICATION SIMULATOR */}
        <section
          id="qualifier"
          className="max-w-7xl mx-auto px-6 lg:px-12 py-20 border-b border-slate-200"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                <span>Interactive Qualification Sandbox</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Transparent, point-based lead scoring
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Toggle the incoming lead attributes below to see how LeadGuard
                calculates the qualification score (0–100), assigns HOT (80–100),
                WARM (50–79), or COLD (0–49) status, and generates a factual
                LeadGuard Assessment.
              </p>

              <div className="mt-6 space-y-2.5">
                {[
                  {
                    label: 'Specific Need Provided ("Build a 4-bedroom home")',
                    points: '+20',
                    checked: demoNeed,
                    onChange: () => setDemoNeed(!demoNeed),
                  },
                  {
                    label: 'Budget Provided (R2,500,000)',
                    points: '+20',
                    checked: demoBudget,
                    onChange: () => setDemoBudget(!demoBudget),
                  },
                  {
                    label: 'Timeline Within 30 Days (21 days)',
                    points: '+25',
                    checked: demoTimeline,
                    onChange: () => setDemoTimeline(!demoTimeline),
                  },
                  {
                    label: 'Decision Maker Confirmed',
                    points: '+15',
                    checked: demoDecisionMaker,
                    onChange: () => setDemoDecisionMaker(!demoDecisionMaker),
                  },
                  {
                    label: 'Target Location Match (Sandton)',
                    points: '+10',
                    checked: demoLocation,
                    onChange: () => setDemoLocation(!demoLocation),
                  },
                  {
                    label: 'Engaged / Responded',
                    points: '+10',
                    checked: demoEngaged,
                    onChange: () => setDemoEngaged(!demoEngaged),
                  },
                ].map((criterion) => (
                  <button
                    key={criterion.label}
                    type="button"
                    aria-pressed={criterion.checked}
                    onClick={criterion.onChange}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      criterion.checked
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          criterion.checked
                            ? 'bg-white text-slate-900 border-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {criterion.checked && (
                          <Check className="w-3 h-3" aria-hidden="true" />
                        )}
                      </div>
                      <span className="text-xs font-medium">
                        {criterion.label}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {criterion.points}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-6 lg:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-xs text-slate-500">
                    Calculated Qualification Output
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    Qualification Breakdown
                  </h3>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs text-slate-500">TOTAL SCORE</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {demoResult.score}/100
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between py-2.5 px-3.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-xs font-semibold text-slate-700">
                  ASSIGNED STATUS
                </span>
                <LeadStatusBadge status={demoResult.status} size="md" />
              </div>

              <div className="mt-4 space-y-2">
                {demoResult.breakdown.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/70"
                  >
                    <div className="flex items-center gap-2">
                      {item.met ? (
                        <Check
                          className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <X
                          className="w-3.5 h-3.5 text-slate-400 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={
                          item.met
                            ? 'text-slate-900 font-medium'
                            : 'text-slate-400'
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={`font-mono tabular-nums ${
                        item.met
                          ? 'text-slate-900 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.met ? `+${item.awardedPoints}` : `0 / +${item.maxPoints}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-900 mb-1.5">
                  Automatic LeadGuard Assessment
                </div>
                <p className="text-xs text-slate-700 leading-relaxed bg-white p-3.5 rounded-lg border border-slate-200">
                  {demoResult.assessment}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRIES SERVED */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 border-b border-slate-200">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Built for service & contracting businesses
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Designed for teams that handle high-value project inquiries across
              construction, trades, property, and field services.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TARGET_INDUSTRIES.map((ind) => (
              <div
                key={ind.name}
                className="p-4 border border-slate-200 rounded-lg bg-white"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {ind.name}
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {ind.example}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECURITY, MULTI-TENANCY & POPIA CONSIDERATIONS */}
        <section
          id="security"
          className="max-w-7xl mx-auto px-6 lg:px-12 py-20 border-b border-slate-200 bg-slate-50/50"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <Shield className="w-4 h-4" aria-hidden="true" />
                <span>Security & Data Isolation Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Strict multi-tenant isolation and zero client-side secrets
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Every user and every lead belongs to an isolated business tenant.
                Authorization and score calculation are enforced server-side and
                via Supabase Row Level Security (RLS), never trusting a
                client-supplied <code className="font-mono">business_id</code>.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Privacy & POPIA Approach
                </button>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Terms & Responsibilities
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-2">
                  <Lock className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                  <span>Tenant Data Isolation (RLS)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Business A can never view, query, edit, or delete Business B’s
                  leads or internal notes. Database policies enforce ownership on
                  every query.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs font-semibold text-slate-900 mb-2">
                  Untrusted Client & Webhook Validation
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All incoming webhook, Make.com, and form payloads undergo strict
                  type, length, and format validation before storage.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs font-semibold text-slate-900 mb-2">
                  Zero Exposed Credentials
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Service-role keys, webhook signing secrets, and OAuth tokens are
                  never placed in frontend code, browser storage, or API
                  responses.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs font-semibold text-slate-900 mb-2">
                  Data Minimization & POPIA Principles
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  LeadGuard collects only contact and project attributes needed for
                  lead qualification, with built-in lead and account deletion
                  controls.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="bg-white border-t border-slate-200 px-6 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-900">LeadGuard</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>Capture. Qualify. Organize.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Privacy Policy & POPIA
            </button>
            <button
              type="button"
              onClick={() => setLegalModal('terms')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="hover:text-slate-900 cursor-pointer font-semibold text-slate-900"
            >
              Get Started
            </button>
          </div>
        </div>
      </footer>

      {/* PRIVACY POLICY / TERMS MODAL */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3
                id="legal-modal-title"
                className="text-base font-bold text-slate-900"
              >
                {legalModal === 'privacy'
                  ? 'Privacy Policy & POPIA Data Handling Principles'
                  : 'Terms of Service & Customer Responsibilities'}
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setLegalModal(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
              {legalModal === 'privacy' ? (
                <>
                  <p className="text-slate-900 font-semibold">
                    1. Data Minimization & Purpose Specification
                  </p>
                  <p>
                    LeadGuard processes only the contact details (name, phone,
                    email) and project qualification criteria (service, location,
                    budget, timeline, decision-maker status, specific need,
                    engagement, and internal business notes) strictly necessary to
                    capture, qualify, and organize business inquiries.
                  </p>
                  <p className="text-slate-900 font-semibold">
                    2. South African POPIA Considerations
                  </p>
                  <p>
                    In alignment with Protection of Personal Information Act
                    (POPIA) architecture principles, each business tenant acts as
                    the Responsible Party for the leads it collects, while
                    LeadGuard acts as the Operator processing leads on the
                    business’s instruction. Providing these governance tools in
                    the interface does not by itself constitute formal legal
                    certification; each business remains responsible for obtaining
                    lawful consent on its external capture forms.
                  </p>
                  <p className="text-slate-900 font-semibold">
                    3. Data Retention & Deletion Controls
                  </p>
                  <p>
                    Authorized business users can permanently delete individual
                    lead records and associated notes at any time from the Leads
                    or Lead Details view, or purge workspace data from Settings.
                  </p>
                  <p className="text-slate-900 font-semibold">
                    4. Multi-Tenant Security Safeguards
                  </p>
                  <p>
                    Tenant isolation is enforced via database Row Level Security
                    (RLS) and server-side authentication. Credentials and signing
                    secrets are never exposed in client code.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-900 font-semibold">
                    1. Service Scope & No Guaranteed Outcomes
                  </p>
                  <p>
                    LeadGuard provides software tools to capture, validate,
                    score, and organize incoming leads. LeadGuard does not
                    guarantee lead volume, conversion rates, or business revenue.
                  </p>
                  <p className="text-slate-900 font-semibold">
                    2. Customer Responsibilities
                  </p>
                  <p>
                    Businesses connecting Website Forms, Make.com scenarios, or
                    Webhook/API sources are responsible for ensuring they have
                    lawful authority to collect and transmit prospect contact
                    information to LeadGuard.
                  </p>
                  <p className="text-slate-900 font-semibold">
                    3. Account & Credential Security
                  </p>
                  <p>
                    Webhook credentials must be kept confidential on your server
                    or Make.com environment. If a credential is suspected of
                    compromise, revoke or regenerate it immediately from the Lead
                    Sources management panel.
                  </p>
                </>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
