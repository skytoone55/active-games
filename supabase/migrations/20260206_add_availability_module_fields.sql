-- Migration: Ajouter les champs pour les modules availability_check et availability_suggestions

-- Ajouter les colonnes success_message, failure_message et metadata à messenger_modules
ALTER TABLE messenger_modules
ADD COLUMN IF NOT EXISTS success_message JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS failure_message JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN messenger_modules.success_message IS 'Message multilingue affiché en cas de succès (pour availability_check)';
COMMENT ON COLUMN messenger_modules.failure_message IS 'Message multilingue affiché en cas d''échec (pour availability_check)';
COMMENT ON COLUMN messenger_modules.metadata IS 'Métadonnées additionnelles (branch_slug pour availability_check, etc.)';
