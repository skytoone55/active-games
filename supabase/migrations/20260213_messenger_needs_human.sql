-- Add escalation and Clara pause columns to messenger_conversations
-- Mirrors the WhatsApp conversation columns for consistency

ALTER TABLE messenger_conversations
  ADD COLUMN IF NOT EXISTS needs_human boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_human_reason text,
  ADD COLUMN IF NOT EXISTS clara_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clara_paused_until timestamptz;
