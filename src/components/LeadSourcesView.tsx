import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Code,
  Copy,
  FileSpreadsheet,
  Globe,
  Info,
  Key,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  Sliders,
  Trash2,
  Webhook,
  Workflow,
  X,
} from 'lucide-react';
import { qualifyLeadDeterministically } from '../lib/qualification';
import { validateLeadPayload } from '../lib/validation';
import {
  createWebhookConnection,
  fetchWebhookConnections,
  regenerateWebhookSecret,
  revokeWebhookConnection,
  testWebhookEndpoint,
  WebhookConnection,
  WebhookTestResult,
} from '../services/webhookConnectionService';
import {
  AppPage,
  ConnectionStatus,
  LeadInputPayload,
  LeadSourceDefinition,
  UserSession,
} from '../types/leadguard';
import { ConnectionStatusBadge } from './StatusBadge';

interface LeadSourcesViewProps {
  session: UserSession;
  sources: LeadSourceDefinition[];
  onUpdateSourceStatus: (
    sourceId: string,
    status: ConnectionStatus,
    errorDetail?: string
  ) => void;
  onSimulateWebhookIntake: (rawPayload: unknown) => Promise<{
    success: boolean;
    errors: string[];
    leadId?: string;
  }>;
  onNavigate: (page: AppPage, leadId?: string) => void;
}

const EXAMPLE_WEBHOOK_PAYLOAD = JSON.stringify(
  {
    name: 'Example Customer',
    phone: '+27 82 555 0101',
    email: 'example@example.com',
    service: 'Roof replacement',
    location: 'Sandton',
    budget: 80000,
    timeline: '14 days',
    decision_maker: true,
    specific_need: 'Full roof replacement with waterproof membrane',
    engaged: true,
  },
  null,
  2
);

export const LeadSourcesView: React.FC<LeadSourcesViewProps> = ({
  session,
  sources,
  onUpdateSourceStatus,
  onSimulateWebhookIntake,
  onNavigate,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('src_webhook_api');
  const [payloadText, setPayloadText] = useState<string>(EXAMPLE_WEBHOOK_PAYLOAD);
  const [simulationResult, setSimulationResult] = useState<{
    type: 'dry_run' | 'ingested' | 'error';
    title: string;
    details: string[];
    leadId?: string;
    score?: number;
    status?: string;
    assessment?: string;
  } | null>(null);

  // Real Webhook Connections from Database
  const [connections, setConnections] = useState<WebhookConnection[]>([]);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState<boolean>(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  // Create Webhook Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnType, setNewConnType] = useState<'WEBHOOK' | 'WEBSITE_FORM'>('WEBHOOK');
  const [isCreatingConn, setIsCreatingConn] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Secret Revealed State (shown ONLY ONCE)
  const [revealedSecretData, setRevealedSecretData] = useState<{
    name: string;
    webhookUrl: string;
    secret: string;
    isRegenerated?: boolean;
  } | null>(null);

  // Test Connection Dialog State
  const [testConnTarget, setTestConnTarget] = useState<WebhookConnection | null>(null);
  const [testSecretInput, setTestSecretInput] = useState('');
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  // Copied indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const loadConnections = async () => {
    setIsConnectionsLoading(true);
    setConnectionsError(null);
    const { connections: list, error } = await fetchWebhookConnections();
    setIsConnectionsLoading(false);
    if (error) {
      setConnectionsError(error);
    } else {
      setConnections(list);
      // If active connections exist, reflect in sources
      const activeCount = list.filter((c) => c.status === 'ACTIVE').length;
      if (activeCount > 0) {
        onUpdateSourceStatus('src_webhook_api', 'CONNECTED');
      }
    }
  };

  useEffect(() => {
    void loadConnections();
  }, [session.business.id]);

  const selectedSource = sources.find((s) => s.id === selectedSourceId) || sources[0];
  const availableSources = sources.filter((s) => s.status !== 'COMING SOON');
  const comingSoonSources = sources.filter((s) => s.status === 'COMING SOON');

  const automatedConnectedCount = availableSources.filter(
    (s) => s.id !== 'src_manual_entry' && s.status === 'CONNECTED'
  ).length;

  const handleCreateWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConnName.trim()) {
      setCreateError('Connection name is required.');
      return;
    }
    setCreateError(null);
    setIsCreatingConn(true);

    const res = await createWebhookConnection(newConnName.trim(), newConnType);
    setIsCreatingConn(false);

    if (!res.success || !res.connection || !res.secret) {
      setCreateError(res.error || 'Failed to create webhook connection.');
      return;
    }

    // Success: reveal secret once, close modal, reload list
    setRevealedSecretData({
      name: res.connection.name,
      webhookUrl: res.webhook_url || '',
      secret: res.secret,
      isRegenerated: false,
    });
    setIsCreateModalOpen(false);
    setNewConnName('');
    void loadConnections();
  };

  const handleRevoke = async (connectionId: string) => {
    const confirmed = window.confirm('Are you sure you want to revoke this connection? External POST requests using this connection will be rejected.');
    if (!confirmed) return;

    const res = await revokeWebhookConnection(connectionId);
    if (res.success) {
      void loadConnections();
    } else {
      alert(res.error || 'Failed to revoke connection');
    }
  };

  const handleRegenerate = async (connection: WebhookConnection) => {
    const confirmed = window.confirm(`Are you sure you want to regenerate the secret for "${connection.name}"? The previous secret will immediately stop working.`);
    if (!confirmed) return;

    const res = await regenerateWebhookSecret(connection.id);
    if (res.success && res.new_secret) {
      setRevealedSecretData({
        name: connection.name,
        webhookUrl: res.webhook_url || connection.webhook_url,
        secret: res.new_secret,
        isRegenerated: true,
      });
      void loadConnections();
    } else {
      alert(res.error || 'Failed to regenerate secret');
    }
  };

  const handleRunTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testConnTarget) return;
    if (!testSecretInput.trim()) {
      setTestResult({
        success: false,
        error: 'Please enter the webhook secret to authenticate the test.',
      });
      return;
    }

    setIsTestingConn(true);
    setTestResult(null);

    const res = await testWebhookEndpoint(testConnTarget.webhook_url, testSecretInput.trim());
    setIsTestingConn(false);
    setTestResult(res);
  };

  const getSourceIcon = (sourceId: string) => {
    switch (sourceId) {
      case 'src_website_forms':
        return <Globe className="w-4 h-4 text-slate-800" aria-hidden="true" />;
      case 'src_make_com':
        return <Workflow className="w-4 h-4 text-slate-800" aria-hidden="true" />;
      case 'src_webhook_api':
        return <Webhook className="w-4 h-4 text-slate-800" aria-hidden="true" />;
      case 'src_manual_entry':
        return <FileSpreadsheet className="w-4 h-4 text-slate-800" aria-hidden="true" />;
      case 'src_google_ads':
        return <Megaphone className="w-4 h-4 text-slate-600" aria-hidden="true" />;
      case 'src_meta_ads':
        return <Share2 className="w-4 h-4 text-slate-600" aria-hidden="true" />;
      default:
        return <Globe className="w-4 h-4 text-slate-800" aria-hidden="true" />;
    }
  };

  const handleDryRunValidation = () => {
    try {
      const parsed = JSON.parse(payloadText);
      const validation = validateLeadPayload(parsed);
      if (!validation.valid || !validation.sanitized) {
        setSimulationResult({
          type: 'error',
          title: 'Request Rejected by Validation Layer (HTTP 422)',
          details: validation.errors,
        });
        return;
      }

      const payloadWithSource: LeadInputPayload = {
        ...validation.sanitized,
        source:
          selectedSource.sourceType === 'Manual'
            ? 'Webhook/API'
            : selectedSource.sourceType,
      };

      const qual = qualifyLeadDeterministically(
        payloadWithSource,
        session.business.target_locations
      );

      setSimulationResult({
        type: 'dry_run',
        title: 'Payload Validated & Qualified (Dry-Run Preview)',
        details: [
          `Authorized Business Resolved Server-Side: ${session.business.business_name}`,
          `Sanitized Contact: ${payloadWithSource.name} (${payloadWithSource.email})`,
          `Source Assigned: ${payloadWithSource.source}`,
        ],
        score: qual.score,
        status: qual.status,
        assessment: qual.assessment,
      });
    } catch {
      setSimulationResult({
        type: 'error',
        title: 'Malformed JSON Request Rejected (HTTP 400)',
        details: [
          'Incoming body is not valid JSON. The server endpoint rejects malformed payloads before processing.',
        ],
      });
    }
  };

  const handleIngestIntoDashboard = async () => {
    try {
      const parsed = JSON.parse(payloadText);
      const payloadWithSource = {
        ...parsed,
        source:
          selectedSource.sourceType === 'Manual'
            ? 'Webhook/API'
            : selectedSource.sourceType,
      };
      const result = await onSimulateWebhookIntake(payloadWithSource);
      if (!result.success) {
        setSimulationResult({
          type: 'error',
          title: 'Intake Rejected by Server Validation',
          details: result.errors,
        });
        return;
      }
      setSimulationResult({
        type: 'ingested',
        title: 'Lead Captured, Qualified & Added to Business Dashboard',
        details: [
          `Lead assigned to tenant: ${session.business.business_name}`,
          'Qualification score and LeadGuard Assessment computed automatically.',
        ],
        leadId: result.leadId,
      });
    } catch {
      setSimulationResult({
        type: 'error',
        title: 'Malformed JSON Request Rejected (HTTP 400)',
        details: ['Incoming request body must be valid JSON.'],
      });
    }
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
            Lead Sources
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect external lead channels, configure production webhooks, and automate incoming qualification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create Webhook</span>
          </button>
        </div>
      </div>

      {/* Secret Revealed Banner (Shown ONCE upon creation or regeneration) */}
      {revealedSecretData && (
        <div
          role="region"
          aria-label="Webhook Credentials Created"
          className="p-5 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3.5 text-xs text-amber-900 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-800 shrink-0" aria-hidden="true" />
              <span className="font-bold text-sm text-amber-950">
                {revealedSecretData.isRegenerated ? 'New Webhook Secret Generated' : 'Webhook Connection Created Successfully'}
              </span>
            </div>
            <button
              type="button"
              aria-label="Dismiss credential notice"
              onClick={() => setRevealedSecretData(null)}
              className="text-amber-700 hover:text-amber-950 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-amber-800 leading-relaxed font-medium">
            ⚠️ <span className="font-bold">Save this secret now.</span> For security, LeadGuard hashes the secret server-side using scrypt and will <span className="underline">never display it again</span>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Webhook URL</div>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-xs text-slate-900 truncate">{revealedSecretData.webhookUrl}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(revealedSecretData.webhookUrl, 'copy_new_url')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded cursor-pointer shrink-0"
                >
                  {copiedKey === 'copy_new_url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'copy_new_url' ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Webhook Secret (X-Webhook-Secret)</div>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-xs text-emerald-800 font-bold truncate">{revealedSecretData.secret}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(revealedSecretData.secret, 'copy_new_secret')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded cursor-pointer shrink-0"
                >
                  {copiedKey === 'copy_new_secret' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'copy_new_secret' ? 'Copied' : 'Copy Secret'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOK CONNECTIONS MANAGEMENT SECTION */}
      <section aria-labelledby="connections-heading" className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-slate-800" aria-hidden="true" />
              <h2 id="connections-heading" className="text-base font-bold text-slate-900">
                Active Webhook Endpoints (External Intake)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure HTTPS endpoints configured for {session.business.business_name}. Authenticated via <code className="font-mono">X-Webhook-Secret</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create Webhook</span>
          </button>
        </div>

        {isConnectionsLoading ? (
          <div className="py-6 text-center text-xs text-slate-500 animate-pulse">
            Loading configured webhook endpoints...
          </div>
        ) : connections.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg space-y-2">
            <div>No webhook connections created yet for this business.</div>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Click &quot;Create Webhook&quot; to provision a dedicated URL and cryptographic secret for your website forms or automation scenarios.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-sm text-slate-900">{conn.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        conn.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}
                    >
                      {conn.status}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Type: {conn.source_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono truncate max-w-md">
                      {conn.webhook_url}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy Webhook URL"
                      onClick={() => copyToClipboard(conn.webhook_url, `copy_url_${conn.id}`)}
                      className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                    >
                      {copiedKey === `copy_url_${conn.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">Created: {conn.created_at?.slice(0, 16).replace('T', ' ')}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTestConnTarget(conn);
                      setTestSecretInput('');
                      setTestResult(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-slate-600" aria-hidden="true" />
                    <span>Test Connection</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegenerate(conn)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-600" aria-hidden="true" />
                    <span>Regenerate Secret</span>
                  </button>

                  {conn.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(conn.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" aria-hidden="true" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 1: AVAILABLE LEAD SOURCES */}
      <section aria-labelledby="available-sources-heading" className="space-y-4">
        <div>
          <h2 id="available-sources-heading" className="text-base font-bold text-slate-900">
            Available Lead Channels
          </h2>
          <p className="text-xs text-slate-600">
            Connect external lead channels, test incoming JSON payloads, or use Manual Entry as a phone fallback.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {availableSources.map((src) => {
            const isSelected = src.id === selectedSource.id;
            const isConnected = src.status === 'CONNECTED';

            return (
              <div
                key={src.id}
                className={`bg-white rounded-xl p-6 border transition-colors flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-900 ring-1 ring-slate-900/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        {getSourceIcon(src.id)}
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {src.name}
                      </h3>
                    </div>
                    <ConnectionStatusBadge status={src.status} />
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {src.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  {src.id === 'src_manual_entry' ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('add-lead')}
                      className="w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open Add Lead Form
                    </button>
                  ) : src.id === 'src_webhook_api' ? (
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Create Webhook Connection
                    </button>
                  ) : isConnected ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSourceId(src.id)}
                      className="w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Inspect Architecture
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedSourceId(src.id)}
                      className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Configure & Inspect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: COMING SOON INTEGRATIONS */}
      <section aria-labelledby="coming-soon-sources-heading" className="space-y-4">
        <div>
          <h2 id="coming-soon-sources-heading" className="text-base font-bold text-slate-900">
            Coming Soon
          </h2>
          <p className="text-xs text-slate-600">
            Planned direct OAuth 2.0 integrations. Until released, you can route these platforms into LeadGuard via Webhook / API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {comingSoonSources.map((src) => (
            <div
              key={src.id}
              className="bg-slate-50/70 rounded-xl p-6 border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {getSourceIcon(src.id)}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {src.name}
                    </h3>
                  </div>
                  <ConnectionStatusBadge status="COMING SOON" />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {src.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Official OAuth integration in development
                </span>
                <button
                  type="button"
                  disabled
                  className="py-1.5 px-3 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed whitespace-nowrap"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Selected Source Architecture & Interactive Webhook/Intake Inspector */}
      <section
        id="source-inspector"
        aria-labelledby="inspector-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 id="inspector-heading" className="text-lg font-bold text-slate-900">
                {selectedSource.name} — Architecture & Validation Pipeline
              </h3>
              <ConnectionStatusBadge status={selectedSource.status} />
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Scoped to authorized tenant: <span className="font-semibold text-slate-900">{session.business.business_name}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* Left Column: Pipeline Steps & Security Guarantees */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 mb-3">
                Server-Side Intake & Qualification Flow
              </h4>
              <ol className="space-y-2.5">
                {selectedSource.architectureSteps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <span className="font-mono font-semibold text-slate-400 tabular-nums">0{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-2">
                <Shield className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                <span>Security & Data Isolation</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                {selectedSource.securityNotes.map((note) => (
                  <li key={note} className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Production Webhook Protocol
              </div>
              <div className="font-mono text-xs bg-slate-100 text-slate-800 px-3 py-2 rounded border border-slate-200 break-all">
                POST /api/webhook/[connection_key]
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Send HTTPS POST requests with header <code className="font-mono text-slate-800">X-Webhook-Secret: &lt;secret&gt;</code> and JSON payload. The server validates credentials, scores the lead, and assigns the verified business_id.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Payload Validator & Intake Simulator */}
          <div className="lg:col-span-7">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Test Incoming Lead Payload (Validation & Qualification)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayloadText(EXAMPLE_WEBHOOK_PAYLOAD);
                    setSimulationResult(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>Reset Example</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                Test how LeadGuard validates incoming JSON fields, ignores any unauthorized client-supplied <code className="font-mono">business_id</code> or <code className="font-mono">score</code>, and calculates the authoritative score and assessment.
              </p>

              <label htmlFor="webhook-payload-textarea" className="sr-only">
                Test JSON Payload
              </label>
              <textarea
                id="webhook-payload-textarea"
                rows={11}
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                spellCheck={false}
                className="w-full font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800 focus:outline-none focus:border-slate-600 leading-relaxed"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDryRunValidation}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Validate & Preview Score (Dry Run)
                </button>
                <button
                  type="button"
                  onClick={handleIngestIntoDashboard}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Send Test Lead to Dashboard</span>
                </button>
              </div>

              {simulationResult && (
                <div
                  role="status"
                  className={`mt-4 p-4 rounded-lg border text-xs ${
                    simulationResult.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{simulationResult.title}</span>
                    <button
                      type="button"
                      aria-label="Dismiss result"
                      onClick={() => setSimulationResult(null)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ul className="space-y-1 mb-3">
                    {simulationResult.details.map((detail) => (
                      <li key={detail}>• {detail}</li>
                    ))}
                  </ul>

                  {simulationResult.score !== undefined && (
                    <div className="pt-3 border-t border-slate-200 space-y-1.5">
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        CALCULATED SCORE: {simulationResult.score}/100 · STATUS: {simulationResult.status}
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        {simulationResult.assessment}
                      </p>
                    </div>
                  )}

                  {simulationResult.leadId && (
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-emerald-700 font-semibold">
                        Saved to your business lead table.
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('lead-details', simulationResult.leadId)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-900 underline cursor-pointer"
                      >
                        <span>View Lead Details</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CREATE WEBHOOK CONNECTION MODAL */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-webhook-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-slate-800" aria-hidden="true" />
                <h3 id="create-webhook-modal-title" className="text-base font-bold text-slate-900">
                  Create Webhook Endpoint
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The server will generate a unique connection key and cryptographically secure secret. Only the hash is stored in the database.
            </p>

            {createError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWebhookSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-conn-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Connection Name
                </label>
                <input
                  id="new-conn-name"
                  type="text"
                  required
                  maxLength={80}
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="e.g. Website Contact Form, Zapier Lead Flow"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="new-conn-type" className="block text-xs font-semibold text-slate-700 mb-1">
                  Channel Source Type
                </label>
                <select
                  id="new-conn-type"
                  value={newConnType}
                  onChange={(e) => setNewConnType(e.target.value as 'WEBHOOK' | 'WEBSITE_FORM')}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  <option value="WEBHOOK">Generic Webhook / API (lead_source: Webhook/API)</option>
                  <option value="WEBSITE_FORM">Website Form (lead_source: Website)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isCreatingConn}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingConn || !newConnName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingConn ? 'Generating...' : 'Create & Generate Secret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REAL TEST CONNECTION MODAL (Section 15) */}
      {testConnTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="test-conn-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-slate-800" aria-hidden="true" />
                <h3 id="test-conn-modal-title" className="text-base font-bold text-slate-900">
                  Test Connection: {testConnTarget.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close test dialog"
                onClick={() => setTestConnTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This executes a live test request to <code className="font-mono text-slate-800">{testConnTarget.webhook_url}</code> using the same authentication, payload validation, and qualification path. With <code className="font-mono">X-Test-Mode: true</code>, it will not create a production lead.
            </p>

            <form onSubmit={handleRunTestConnection} className="space-y-4">
              <div>
                <label htmlFor="test-secret-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Webhook Secret (X-Webhook-Secret)
                </label>
                <input
                  id="test-secret-input"
                  type="password"
                  required
                  value={testSecretInput}
                  onChange={(e) => setTestSecretInput(e.target.value)}
                  placeholder="Paste your whsec_... secret here"
                  className="w-full px-3.5 py-2 font-mono text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Enter the secret that was provided when this connection was created or regenerated.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isTestingConn}
                  onClick={() => setTestConnTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isTestingConn || !testSecretInput.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isTestingConn ? 'Testing Endpoint...' : 'Send Test Request'}</span>
                </button>
              </div>
            </form>

            {testResult && (
              <div
                role="status"
                className={`p-4 rounded-lg border text-xs space-y-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="font-bold text-sm flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Connection successful</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />
                      <span>Test Failed</span>
                    </>
                  )}
                </div>

                {testResult.success ? (
                  <div className="space-y-2 pt-1 border-t border-emerald-200">
                    <div className="font-mono font-bold">
                      Calculated Score: {testResult.score}/100 · Status: {testResult.status}
                    </div>
                    <p className="leading-relaxed text-emerald-800">
                      Assessment: {testResult.assessment}
                    </p>
                    <div className="text-[11px] text-emerald-700 font-mono">
                      Received payload validated: {JSON.stringify(testResult.received_payload)}
                    </div>
                  </div>
                ) : (
                  <div className="leading-relaxed">{testResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
