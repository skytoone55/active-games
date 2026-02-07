-- Migration: Ajouter les paramètres AI pour le Messenger
-- Stocke le provider et le modèle global pour tous les modules clara_llm du Messenger

-- On utilise la table system_settings existante avec la clé 'messenger_ai'
-- Structure:
-- {
--   "provider": "anthropic" | "openai" | "gemini",
--   "model": "claude-3-5-sonnet-20241022" | "gpt-4o" | "gemini-2.0-flash-lite" | etc.
-- }

-- Valeurs par défaut
INSERT INTO system_settings (key, value, updated_at)
VALUES (
  'messenger_ai',
  jsonb_build_object(
    'provider', 'anthropic',
    'model', 'claude-3-5-sonnet-20241022'
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_settings IS 'Paramètres système de l''application incluant:
- clara: Settings pour Clara AI
- clara_public_prompt: Prompt personnalisé pour Clara (public chat)
- clara_knowledge: Knowledge base personnalisée pour Clara
- messenger_ai: Provider et modèle global pour tous les modules clara_llm du Messenger';
