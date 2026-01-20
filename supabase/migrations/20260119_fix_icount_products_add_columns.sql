-- Migration corrective: Ajouter les colonnes manquantes à icount_products
-- Date: 2026-01-19
-- Contexte: La table icount_products existe mais sans les colonnes price_type et category

-- =============================================================================
-- 1. Ajouter price_type (remplace is_per_person)
-- =============================================================================
ALTER TABLE icount_products
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) NOT NULL DEFAULT 'per_person';

-- =============================================================================
-- 2. Ajouter category
-- =============================================================================
ALTER TABLE icount_products
ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'game';

-- =============================================================================
-- 3. Supprimer is_per_person si existe (ancienne colonne)
-- =============================================================================
ALTER TABLE icount_products
DROP COLUMN IF EXISTS is_per_person;

-- =============================================================================
-- 4. Mettre à jour les produits existants avec les bonnes catégories
-- =============================================================================
UPDATE icount_products SET category = 'game' WHERE code LIKE 'laser_%' OR code LIKE 'active_%';
UPDATE icount_products SET category = 'room' WHERE code LIKE 'room_%';
UPDATE icount_products SET category = 'event_tariff' WHERE code LIKE 'event_%';

-- =============================================================================
-- 5. Créer la table icount_formulas si elle n'existe pas
-- =============================================================================
CREATE TABLE IF NOT EXISTS icount_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_he VARCHAR(100),
  description TEXT,
  booking_type VARCHAR(10) NOT NULL, -- 'EVENT' | 'GAME'
  game_area VARCHAR(20), -- 'LASER' | 'ACTIVE' | 'BOTH' | NULL (any)
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 999,
  priority INTEGER DEFAULT 0, -- Higher = checked first
  is_active BOOLEAN DEFAULT true,
  -- JSON array of product codes to apply: [{"product_code": "room_1", "quantity": 1}, {"product_code": "event_price_1", "quantity": "participants"}]
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, code)
);

-- =============================================================================
-- 6. Ajouter colonnes iCount sur bookings
-- =============================================================================
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS icount_offer_id INTEGER,
ADD COLUMN IF NOT EXISTS icount_invrec_id INTEGER;

-- =============================================================================
-- 7. Index pour icount_formulas
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_icount_formulas_branch_id ON icount_formulas(branch_id);
CREATE INDEX IF NOT EXISTS idx_icount_formulas_booking_type ON icount_formulas(booking_type);

-- =============================================================================
-- 8. RLS pour icount_formulas
-- =============================================================================
ALTER TABLE icount_formulas ENABLE ROW LEVEL SECURITY;

-- Note: Utilisation de DO block car CREATE POLICY IF NOT EXISTS n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'icount_formulas'
    AND policyname = 'Allow authenticated users to view formulas'
  ) THEN
    CREATE POLICY "Allow authenticated users to view formulas"
      ON icount_formulas FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'icount_formulas'
    AND policyname = 'Allow service role full access to formulas'
  ) THEN
    CREATE POLICY "Allow service role full access to formulas"
      ON icount_formulas FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON COLUMN icount_products.price_type IS 'per_person = multiply by participants, flat = fixed price, per_game = multiply by games';
COMMENT ON COLUMN icount_products.category IS 'Product category: game, room, event_tariff, other';

COMMENT ON TABLE icount_formulas IS 'Formulas for EVENT pricing. Assembles products based on conditions.';
COMMENT ON COLUMN icount_formulas.game_area IS 'LASER, ACTIVE, BOTH (has both), or NULL (any)';
COMMENT ON COLUMN icount_formulas.items IS 'JSON array: [{"product_code": "x", "quantity": 1 or "participants"}]';
COMMENT ON COLUMN icount_formulas.priority IS 'Higher priority formulas are matched first';

COMMENT ON COLUMN bookings.icount_offer_id IS 'iCount offer (quote) document ID';
COMMENT ON COLUMN bookings.icount_invrec_id IS 'iCount invoice+receipt combined document ID';
