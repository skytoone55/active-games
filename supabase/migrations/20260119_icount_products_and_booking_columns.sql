-- Migration: Add icount_products, icount_formulas tables and booking columns for iCount integration
-- Date: 2026-01-19

-- =============================================================================
-- Table: icount_products
-- Catalogue de produits/services pour génération de documents iCount
-- =============================================================================

CREATE TABLE IF NOT EXISTS icount_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_he VARCHAR(100),
  description TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  price_type VARCHAR(20) NOT NULL DEFAULT 'per_person', -- 'per_person' | 'flat' | 'per_game'
  category VARCHAR(30) NOT NULL DEFAULT 'game', -- 'game' | 'room' | 'event_tariff' | 'other'
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, code)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_icount_products_branch_id ON icount_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_icount_products_code ON icount_products(code);
CREATE INDEX IF NOT EXISTS idx_icount_products_category ON icount_products(category);

-- =============================================================================
-- Table: icount_formulas
-- Formules = assemblage de produits avec conditions
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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_icount_formulas_branch_id ON icount_formulas(branch_id);
CREATE INDEX IF NOT EXISTS idx_icount_formulas_booking_type ON icount_formulas(booking_type);

-- =============================================================================
-- Add iCount document IDs to bookings table
-- =============================================================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS icount_offer_id INTEGER,
ADD COLUMN IF NOT EXISTS icount_invrec_id INTEGER;

-- =============================================================================
-- Seed default products for all existing branches
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_icount_products_for_branch(p_branch_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only insert if branch doesn't have products yet
  IF NOT EXISTS (SELECT 1 FROM icount_products WHERE branch_id = p_branch_id) THEN
    INSERT INTO icount_products (branch_id, code, name, name_he, unit_price, price_type, category, sort_order) VALUES
      -- GAME: Laser packages (per person)
      (p_branch_id, 'laser_1p', '1 Partie Laser', 'משחק לייזר אחד', 70.00, 'per_person', 'game', 1),
      (p_branch_id, 'laser_2p', '2 Parties Laser', 'שני משחקי לייזר', 120.00, 'per_person', 'game', 2),
      (p_branch_id, 'laser_3p', '3 Parties Laser', 'שלושה משחקי לייזר', 150.00, 'per_person', 'game', 3),
      -- GAME: Active packages (per person)
      (p_branch_id, 'active_30m', 'Active 30min', 'משחק אקטיבי 30 דק', 50.00, 'per_person', 'game', 10),
      (p_branch_id, 'active_1h', 'Active 1h', 'משחק אקטיבי שעה', 100.00, 'per_person', 'game', 11),
      (p_branch_id, 'active_1h30', 'Active 1h30', 'משחק אקטיבי שעה וחצי', 140.00, 'per_person', 'game', 12),
      (p_branch_id, 'active_2h', 'Active 2h', 'משחק אקטיבי שעתיים', 180.00, 'per_person', 'game', 13),
      -- Rooms (flat price)
      (p_branch_id, 'room_1', 'Salle 1', 'חדר 1', 400.00, 'flat', 'room', 20),
      (p_branch_id, 'room_2', 'Salle 2', 'חדר 2', 500.00, 'flat', 'room', 21),
      -- Event tariffs (per person) - can be combined in formulas
      (p_branch_id, 'event_price_1', 'Tarif Event 1', 'מחיר אירוע 1', 110.00, 'per_person', 'event_tariff', 30),
      (p_branch_id, 'event_price_2', 'Tarif Event 2', 'מחיר אירוע 2', 100.00, 'per_person', 'event_tariff', 31),
      (p_branch_id, 'event_price_3', 'Tarif Event 3', 'מחיר אירוע 3', 95.00, 'per_person', 'event_tariff', 32),
      (p_branch_id, 'event_price_4', 'Tarif Event 4', 'מחיר אירוע 4', 90.00, 'per_person', 'event_tariff', 33),
      (p_branch_id, 'event_price_5', 'Tarif Event 5', 'מחיר אירוע 5', 85.00, 'per_person', 'event_tariff', 34),
      (p_branch_id, 'event_price_6', 'Tarif Event 6', 'מחיר אירוע 6', 80.00, 'per_person', 'event_tariff', 35);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Seed default formulas for all existing branches
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_icount_formulas_for_branch(p_branch_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only insert if branch doesn't have formulas yet
  IF NOT EXISTS (SELECT 1 FROM icount_formulas WHERE branch_id = p_branch_id) THEN
    INSERT INTO icount_formulas (branch_id, code, name, name_he, booking_type, game_area, min_participants, max_participants, priority, items) VALUES
      -- EVENT Laser 15-29
      (p_branch_id, 'event_laser_15', 'Event Laser 15-29', 'אירוע לייזר 15-29', 'EVENT', 'LASER', 15, 29, 10,
       '[{"product_code": "room_1", "quantity": 1}, {"product_code": "event_price_1", "quantity": "participants"}]'::jsonb),
      -- EVENT Laser 30+
      (p_branch_id, 'event_laser_30', 'Event Laser 30+', 'אירוע לייזר 30+', 'EVENT', 'LASER', 30, 999, 10,
       '[{"product_code": "room_2", "quantity": 1}, {"product_code": "event_price_2", "quantity": "participants"}]'::jsonb),
      -- EVENT Active 15-29
      (p_branch_id, 'event_active_15', 'Event Active 15-29', 'אירוע אקטיבי 15-29', 'EVENT', 'ACTIVE', 15, 29, 10,
       '[{"product_code": "room_1", "quantity": 1}, {"product_code": "event_price_1", "quantity": "participants"}]'::jsonb),
      -- EVENT Active 30+
      (p_branch_id, 'event_active_30', 'Event Active 30+', 'אירוע אקטיבי 30+', 'EVENT', 'ACTIVE', 30, 999, 10,
       '[{"product_code": "room_2", "quantity": 1}, {"product_code": "event_price_2", "quantity": "participants"}]'::jsonb),
      -- EVENT Combo (Laser + Active) 15-29
      (p_branch_id, 'event_combo_15', 'Event Combo 15-29', 'אירוע משולב 15-29', 'EVENT', 'BOTH', 15, 29, 20,
       '[{"product_code": "room_1", "quantity": 1}, {"product_code": "event_price_3", "quantity": "participants"}]'::jsonb),
      -- EVENT Combo (Laser + Active) 30+
      (p_branch_id, 'event_combo_30', 'Event Combo 30+', 'אירוע משולב 30+', 'EVENT', 'BOTH', 30, 999, 20,
       '[{"product_code": "room_2", "quantity": 1}, {"product_code": "event_price_4", "quantity": "participants"}]'::jsonb);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Seed products and formulas for all existing branches
DO $$
DECLARE
  branch_record RECORD;
BEGIN
  FOR branch_record IN SELECT id FROM branches LOOP
    PERFORM seed_icount_products_for_branch(branch_record.id);
    PERFORM seed_icount_formulas_for_branch(branch_record.id);
  END LOOP;
END $$;

-- Trigger to auto-seed when a new branch is created
CREATE OR REPLACE FUNCTION trigger_seed_icount_data()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_icount_products_for_branch(NEW.id);
  PERFORM seed_icount_formulas_for_branch(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_icount_products ON branches;
CREATE TRIGGER trg_seed_icount_data
  AFTER INSERT ON branches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_icount_data();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE icount_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE icount_formulas ENABLE ROW LEVEL SECURITY;

-- Products: authenticated users can view, service role full access
CREATE POLICY "Allow authenticated users to view products"
  ON icount_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role full access to products"
  ON icount_products FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Formulas: authenticated users can view, service role full access
CREATE POLICY "Allow authenticated users to view formulas"
  ON icount_formulas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role full access to formulas"
  ON icount_formulas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE icount_products IS 'Product catalog for iCount. Each branch has its own prices.';
COMMENT ON COLUMN icount_products.code IS 'Unique product code: laser_1p, active_1h, room_1, event_price_1, etc.';
COMMENT ON COLUMN icount_products.price_type IS 'per_person = multiply by participants, flat = fixed price, per_game = multiply by games';
COMMENT ON COLUMN icount_products.category IS 'Product category: game, room, event_tariff, other';

COMMENT ON TABLE icount_formulas IS 'Formulas for EVENT pricing. Assembles products based on conditions.';
COMMENT ON COLUMN icount_formulas.game_area IS 'LASER, ACTIVE, BOTH (has both), or NULL (any)';
COMMENT ON COLUMN icount_formulas.items IS 'JSON array: [{"product_code": "x", "quantity": 1 or "participants"}]';
COMMENT ON COLUMN icount_formulas.priority IS 'Higher priority formulas are matched first';

COMMENT ON COLUMN bookings.icount_offer_id IS 'iCount offer (quote) document ID';
COMMENT ON COLUMN bookings.icount_invrec_id IS 'iCount invoice+receipt combined document ID';
