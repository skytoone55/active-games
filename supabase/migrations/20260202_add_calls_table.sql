-- Migration: Add calls table for Telnyx phone calls
-- Date: 2026-02-02

-- Create ENUM types for calls
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('completed', 'missed', 'busy', 'failed', 'no-answer');

-- Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telnyx_call_control_id TEXT UNIQUE NOT NULL,
  telnyx_call_session_id TEXT,
  direction call_direction NOT NULL,
  status call_status NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  from_number_normalized TEXT,
  to_number_normalized TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_linked_at TIMESTAMPTZ,
  contact_linked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_telnyx_call_control_id ON public.calls(telnyx_call_control_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON public.calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_branch_id ON public.calls(branch_id);
CREATE INDEX IF NOT EXISTS idx_calls_from_number_normalized ON public.calls(from_number_normalized);
CREATE INDEX IF NOT EXISTS idx_calls_to_number_normalized ON public.calls(to_number_normalized);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON public.calls(direction);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view calls from their branches"
  ON public.calls FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_branches WHERE branch_id = calls.branch_id
    )
  );

CREATE POLICY "Users can insert calls"
  ON public.calls FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.user_branches WHERE branch_id = calls.branch_id
    )
  );

CREATE POLICY "Users can update calls from their branches"
  ON public.calls FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_branches WHERE branch_id = calls.branch_id
    )
  );

CREATE POLICY "Users can delete calls from their branches"
  ON public.calls FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_branches WHERE branch_id = calls.branch_id
    )
  );

-- Add permissions for calls resource
INSERT INTO public.role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES
  ('super_admin', 'calls', true, true, true, true),
  ('branch_admin', 'calls', true, false, true, false),
  ('agent', 'calls', true, false, false, false)
ON CONFLICT (role, resource) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calls_updated_at();
