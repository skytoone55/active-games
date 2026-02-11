-- Add onboarding_data JSONB column for flexible step answers
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS onboarding_data jsonb DEFAULT NULL;

COMMENT ON COLUMN whatsapp_conversations.onboarding_data
  IS 'JSON object storing custom onboarding step answers. Keys are step IDs, values are selected option IDs.';

-- Migrate existing onboarding_status values to new format (waiting:step_id)
UPDATE whatsapp_conversations
  SET onboarding_status = 'waiting:activity'
  WHERE onboarding_status = 'waiting_activity';

UPDATE whatsapp_conversations
  SET onboarding_status = 'waiting:branch'
  WHERE onboarding_status = 'waiting_branch';
