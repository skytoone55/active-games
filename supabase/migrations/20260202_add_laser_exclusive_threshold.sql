-- ============================================================================
-- AJOUT COLONNE laser_exclusive_threshold
-- ============================================================================
-- Date: 2026-02-02
-- Description: Ajoute la colonne laser_exclusive_threshold manquante dans branch_settings
-- ============================================================================

ALTER TABLE branch_settings
ADD COLUMN IF NOT EXISTS laser_exclusive_threshold INTEGER DEFAULT 10;

-- Mettre à jour les branches existantes avec la valeur par défaut
UPDATE branch_settings
SET laser_exclusive_threshold = 10
WHERE laser_exclusive_threshold IS NULL;

-- Vérification
SELECT
  b.slug,
  bs.laser_exclusive_threshold,
  bs.laser_total_vests,
  bs.laser_enabled
FROM branches b
JOIN branch_settings bs ON bs.branch_id = b.id
ORDER BY b.name;
