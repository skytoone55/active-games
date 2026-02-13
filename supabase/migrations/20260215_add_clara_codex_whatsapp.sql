-- Clara Codex (WhatsApp) - isolated configuration, tracking and agent presence

-- 1) Dedicated settings table (singleton row)
CREATE TABLE IF NOT EXISTS public.clara_codex_whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clara_codex_whatsapp_settings_singleton
  ON public.clara_codex_whatsapp_settings ((true));

-- Ensure one default row exists
INSERT INTO public.clara_codex_whatsapp_settings (is_active, settings)
SELECT false, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.clara_codex_whatsapp_settings
);

-- 2) Dedicated tracking table for Clara Codex decisions/funnel
CREATE TABLE IF NOT EXISTS public.clara_codex_whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clara_codex_events_created_at
  ON public.clara_codex_whatsapp_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clara_codex_events_branch
  ON public.clara_codex_whatsapp_events (branch_id);

CREATE INDEX IF NOT EXISTS idx_clara_codex_events_type
  ON public.clara_codex_whatsapp_events (event_type);

CREATE INDEX IF NOT EXISTS idx_clara_codex_events_conversation
  ON public.clara_codex_whatsapp_events (conversation_id);

-- 3) Presence table used by Clara Codex to know if a human can answer now
CREATE TABLE IF NOT EXISTS public.clara_codex_agent_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  branch_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clara_codex_presence_last_seen
  ON public.clara_codex_agent_presence (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_clara_codex_presence_role
  ON public.clara_codex_agent_presence (role);

CREATE INDEX IF NOT EXISTS idx_clara_codex_presence_branches
  ON public.clara_codex_agent_presence USING gin (branch_ids);

COMMENT ON TABLE public.clara_codex_whatsapp_settings IS 'Dedicated settings storage for Clara Codex WhatsApp engine';
COMMENT ON TABLE public.clara_codex_whatsapp_events IS 'Operational and quality events emitted by Clara Codex WhatsApp engine';
COMMENT ON TABLE public.clara_codex_agent_presence IS 'Recent connected human agents presence used by Clara Codex escalation logic';
