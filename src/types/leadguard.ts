export enum LeadStatus {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
}

export type LeadSourceType =
  | 'Website'
  | 'Google Ads'
  | 'Facebook'
  | 'Instagram'
  | 'Make.com'
  | 'Webhook/API'
  | 'Manual'
  | 'Other';

export type ConnectionStatus =
  | 'CONNECTED'
  | 'NOT CONNECTED'
  | 'COMING SOON'
  | 'CONNECTION ERROR';

export type AppPage =
  | 'landing'
  | 'signup'
  | 'login'
  | 'dashboard'
  | 'leads'
  | 'lead-details'
  | 'add-lead'
  | 'lead-sources'
  | 'settings';

export interface QualificationCriterion {
  key:
    | 'specific_need'
    | 'budget'
    | 'timeline'
    | 'decision_maker'
    | 'target_location'
    | 'engaged';
  label: string;
  maxPoints: number;
  awardedPoints: number;
  met: boolean;
  reason: string;
}

export interface QualificationResult {
  score: number;
  maxScore: 100;
  status: LeadStatus;
  breakdown: QualificationCriterion[];
  assessment: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  business_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface LeadInputPayload {
  name: string;
  phone: string;
  email: string;
  service: string;
  location: string;
  budget: number | string | null;
  timeline: string;
  decision_maker: boolean;
  specific_need: string;
  engaged: boolean;
  source: LeadSourceType;
  notes?: string;
}

export interface Lead {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  location: string;
  budget: number | null;
  budget_display: string;
  timeline: string;
  timeline_days: number | null;
  decision_maker: boolean;
  specific_need: string;
  engaged: boolean;
  source: LeadSourceType;
  score: number;
  status: LeadStatus;
  breakdown: QualificationCriterion[];
  assessment: string;
  notes: LeadNote[];
  date_added: string;
  updated_at: string;
  requires_attention: boolean;
}

export interface BusinessTenant {
  id: string;
  business_name: string;
  industry: string;
  target_locations: string[];
  currency_symbol: string;
  created_at: string;
}

export interface UserSession {
  user_id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'member';
  business: BusinessTenant;
}

export interface LeadSourceDefinition {
  id: string;
  name: string;
  sourceType: LeadSourceType;
  description: string;
  status: ConnectionStatus;
  category: 'automated' | 'future_oauth' | 'fallback';
  architectureSteps: string[];
  securityNotes: string[];
  lastSyncAt?: string;
  errorDetail?: string;
}
