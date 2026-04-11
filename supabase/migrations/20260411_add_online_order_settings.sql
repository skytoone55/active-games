-- Paramètres de réservation en ligne par branche
-- online_orders_enabled : master switch pour activer/désactiver les commandes en ligne
-- active_game_enabled   : autoriser le type Active Games
-- laser_enabled existait déjà (boolean | null)

ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS online_orders_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS active_game_enabled   BOOLEAN DEFAULT true;

-- Par défaut tout est activé pour les branches existantes
UPDATE branch_settings SET
  online_orders_enabled = true,
  active_game_enabled   = true
WHERE online_orders_enabled IS NULL OR active_game_enabled IS NULL;
