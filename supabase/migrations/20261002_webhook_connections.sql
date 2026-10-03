-- ============================================================================
-- LeadGuard: webhook_connections table & Row Level Security policies
-- Enables secure, authenticated external lead intake via webhook endpoints
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  connection_key text UNIQUE NOT NULL,
  secret_hash text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('WEBSITE_FORM', 'WEBHOOK')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for connection lookup and business scoping
CREATE INDEX IF NOT EXISTS idx_webhook_connections_key ON public.webhook_connections(connection_key);
CREATE INDEX IF NOT EXISTS idx_webhook_connections_business ON public.webhook_connections(business_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.webhook_connections ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Members can only read connections belonging to their business
CREATE POLICY "Users can view connections for their business"
  ON public.webhook_connections
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. INSERT Policy: Members can only insert connections for their business
CREATE POLICY "Users can create connections for their business"
  ON public.webhook_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 3. UPDATE Policy: Members can only update connections for their business
CREATE POLICY "Users can update connections for their business"
  ON public.webhook_connections
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. DELETE Policy: Members can only delete connections for their business
CREATE POLICY "Users can delete connections for their business"
  ON public.webhook_connections
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );
