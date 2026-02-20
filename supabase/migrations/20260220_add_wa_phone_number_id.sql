-- Add wa_phone_number_id to track which Meta phone number received each conversation.
-- Prepares multi-number support (same WABA, different phone_number_ids).
-- Existing conversations keep NULL = fallback to WHATSAPP_PHONE_NUMBER_ID env var.

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text DEFAULT NULL;

COMMENT ON COLUMN whatsapp_conversations.wa_phone_number_id
  IS 'Meta Cloud API phone_number_id that received this conversation. NULL = use env var fallback.';
