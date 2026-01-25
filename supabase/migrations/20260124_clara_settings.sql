-- =====================================================
-- Migration: Clara AI Settings
-- Date: 2026-01-24
-- Description: Ajoute les settings pour Clara (assistant IA)
-- =====================================================

-- 1. Table system_settings pour les configurations globales
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide par clé
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- 2. Ajouter les colonnes Clara à branch_settings
ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS clara_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clara_settings JSONB DEFAULT '{}'::jsonb;

-- 3. Insérer les settings globaux Clara par défaut
INSERT INTO system_settings (key, value, description) VALUES
  ('clara', '{
    "enabled": true,
    "model": "gemini-1.5-flash",
    "max_tokens": 4096,
    "temperature": 0.7,
    "rate_limit_per_minute": 30,
    "rate_limit_per_hour": 200,
    "session_timeout_minutes": 30,
    "max_conversation_messages": 50,
    "public_chat": {
      "enabled": true,
      "welcome_message": "שלום! אני קלרה, העוזרת הווירטואלית של Active Games. איך אני יכולה לעזור לך היום?",
      "quick_replies": [
        "מה שעות הפעילות?",
        "כמה עולה משחק?",
        "אני רוצה להזמין מסיבת יום הולדת",
        "מה סוגי המשחקים שלכם?"
      ]
    },
    "crm_chat": {
      "enabled": true,
      "features": ["search", "stats", "actions"]
    }
  }'::jsonb, 'Configuration globale de Clara (assistant IA)')
ON CONFLICT (key) DO NOTHING;

-- 4. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_settings_timestamp ON system_settings;
CREATE TRIGGER trigger_update_system_settings_timestamp
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_system_settings_timestamp();

-- 5. RLS Policies pour system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read system settings" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Modification réservée aux super_admin
CREATE POLICY "Super admins can update system settings" ON system_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Service role peut tout faire
CREATE POLICY "Service role full access system settings" ON system_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Table pour le rate limiting Clara (conversations publiques)
CREATE TABLE IF NOT EXISTS clara_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP ou session_id
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour le rate limiting
CREATE INDEX IF NOT EXISTS idx_clara_rate_limits_identifier ON clara_rate_limits(identifier, window_start);

-- Nettoyage automatique des anciennes entrées (plus de 1h)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM clara_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 7. Table pour les conversations publiques (visiteurs non authentifiés)
CREATE TABLE IF NOT EXISTS public_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL, -- Cookie session du visiteur
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  ip_address TEXT,
  user_agent TEXT,
  locale TEXT DEFAULT 'he',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  is_converted BOOLEAN DEFAULT false, -- Visiteur devenu client?
  converted_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL
);

-- Index pour les conversations publiques
CREATE INDEX IF NOT EXISTS idx_public_conversations_session ON public_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_public_conversations_branch ON public_conversations(branch_id);

-- Messages des conversations publiques
CREATE TABLE IF NOT EXISTS public_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_messages_conversation ON public_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_public_messages_created ON public_messages(conversation_id, created_at);

-- Trigger pour mettre à jour last_message_at
CREATE OR REPLACE FUNCTION update_public_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public_conversations
  SET updated_at = NOW(), last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_public_conversation ON public_messages;
CREATE TRIGGER trigger_update_public_conversation
AFTER INSERT ON public_messages
FOR EACH ROW
EXECUTE FUNCTION update_public_conversation_timestamp();

-- RLS pour conversations publiques (accès via service role uniquement)
ALTER TABLE public_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clara_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access public conversations" ON public_conversations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access public messages" ON public_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access rate limits" ON clara_rate_limits
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 8. Ajouter branch_id aux conversations CRM existantes
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_branch ON ai_conversations(branch_id);

-- Commentaires de documentation
COMMENT ON TABLE system_settings IS 'Configuration système globale (Clara, etc.)';
COMMENT ON TABLE clara_rate_limits IS 'Rate limiting pour les requêtes Clara publiques';
COMMENT ON TABLE public_conversations IS 'Conversations Clara avec les visiteurs non authentifiés';
COMMENT ON TABLE public_messages IS 'Messages des conversations publiques Clara';
COMMENT ON COLUMN branch_settings.clara_enabled IS 'Active Clara pour cette branche';
COMMENT ON COLUMN branch_settings.clara_settings IS 'Settings Clara spécifiques à cette branche';
