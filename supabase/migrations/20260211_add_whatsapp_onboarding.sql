-- Add activity and onboarding status to WhatsApp conversations
-- for the interactive onboarding flow (activity selection + branch selection)

ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS activity text DEFAULT NULL;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT NULL;

-- onboarding_status values: NULL (no onboarding / legacy), 'waiting_activity', 'waiting_branch', 'completed'

COMMENT ON COLUMN whatsapp_conversations.activity IS 'Selected activity (e.g. laser_city, active_games)';
COMMENT ON COLUMN whatsapp_conversations.onboarding_status IS 'Onboarding flow state: waiting_activity, waiting_branch, completed, or NULL';
