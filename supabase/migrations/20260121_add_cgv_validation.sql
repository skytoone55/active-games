-- Migration: Ajout système de validation CGV pour commandes admin
-- Les commandes créées via admin nécessitent une validation CGV par le client

-- Ajouter les colonnes CGV sur orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgv_token VARCHAR(64) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgv_validated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgv_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgv_reminder_count INTEGER DEFAULT 0;

-- Créer un index sur le token pour les lookups rapides
CREATE INDEX IF NOT EXISTS idx_orders_cgv_token ON orders(cgv_token) WHERE cgv_token IS NOT NULL;

-- Créer un index pour trouver les commandes qui nécessitent un rappel
CREATE INDEX IF NOT EXISTS idx_orders_cgv_pending ON orders(requested_date, cgv_validated_at)
WHERE source = 'admin_agenda' AND cgv_validated_at IS NULL;

COMMENT ON COLUMN orders.cgv_token IS 'Token unique pour le lien de validation CGV (commandes admin uniquement)';
COMMENT ON COLUMN orders.cgv_validated_at IS 'Date/heure de validation des CGV par le client';
COMMENT ON COLUMN orders.cgv_reminder_sent_at IS 'Date/heure du dernier rappel envoyé';
COMMENT ON COLUMN orders.cgv_reminder_count IS 'Nombre de rappels envoyés';
