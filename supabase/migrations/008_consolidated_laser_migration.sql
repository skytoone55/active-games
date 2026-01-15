-- Migration consolidée : Support Laser complet
-- Date: 2025-01-XX
-- Description: Création des tables laser_rooms et game_sessions, ajout des colonnes laser dans branch_settings
--              + Migration des bookings existants vers game_sessions

-- =====================================================
-- PARTIE 1: Création des tables et colonnes
-- =====================================================

-- Table: laser_rooms
CREATE TABLE IF NOT EXISTS laser_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  capacity INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_laser_rooms_branch ON laser_rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_laser_rooms_is_active ON laser_rooms(is_active);

-- Table: game_sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  game_area TEXT NOT NULL CHECK (game_area IN ('ACTIVE', 'LASER')),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  laser_room_id UUID REFERENCES laser_rooms(id) ON DELETE SET NULL,
  session_order INTEGER NOT NULL DEFAULT 1,
  pause_before_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_end_after_start CHECK (end_datetime > start_datetime)
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_booking ON game_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_area ON game_sessions(game_area);
CREATE INDEX IF NOT EXISTS idx_game_sessions_laser_room ON game_sessions(laser_room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_start ON game_sessions(start_datetime);

-- Ajout colonnes à branch_settings
ALTER TABLE branch_settings 
  ADD COLUMN IF NOT EXISTS laser_total_vests INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS laser_enabled BOOLEAN DEFAULT FALSE;

-- Commentaires pour documentation
COMMENT ON COLUMN branch_settings.laser_total_vests IS 'Contrainte HARD : nombre maximum de vestes disponibles (pas d''override possible)';
COMMENT ON COLUMN branch_settings.laser_enabled IS 'Active/désactive le support Laser pour cette branche';
COMMENT ON COLUMN game_sessions.game_area IS 'Zone de jeu : ACTIVE (slots) ou LASER (salles laser)';
COMMENT ON COLUMN game_sessions.laser_room_id IS 'Référence à la salle laser si game_area = LASER, NULL sinon';
COMMENT ON COLUMN game_sessions.pause_before_minutes IS 'Pause avant cette session (pour EVENT avec gap entre sessions)';

-- =====================================================
-- PARTIE 2: Migration des bookings existants
-- =====================================================

DO $$
DECLARE
  booking_record RECORD;
  game_start TIMESTAMPTZ;
  game_end TIMESTAMPTZ;
  event_start TIMESTAMPTZ;
  event_end TIMESTAMPTZ;
  session1_start TIMESTAMPTZ;
  session1_end TIMESTAMPTZ;
  session2_start TIMESTAMPTZ;
  session2_end TIMESTAMPTZ;
BEGIN
  -- Migrer les bookings GAME existants (seulement ceux qui n'ont pas déjà de game_sessions)
  FOR booking_record IN 
    SELECT id, type, start_datetime, end_datetime, game_start_datetime, game_end_datetime
    FROM bookings
    WHERE type = 'GAME'
      AND NOT EXISTS (SELECT 1 FROM game_sessions WHERE booking_id = bookings.id)
  LOOP
    -- Utiliser game_start_datetime/game_end_datetime si disponibles, sinon start_datetime/end_datetime
    IF booking_record.game_start_datetime IS NOT NULL AND booking_record.game_end_datetime IS NOT NULL THEN
      game_start := booking_record.game_start_datetime;
      game_end := booking_record.game_end_datetime;
    ELSE
      game_start := booking_record.start_datetime;
      game_end := booking_record.end_datetime;
    END IF;

    -- Créer une game_session avec game_area = ACTIVE
    INSERT INTO game_sessions (
      booking_id,
      game_area,
      start_datetime,
      end_datetime,
      session_order,
      pause_before_minutes
    ) VALUES (
      booking_record.id,
      'ACTIVE',
      game_start,
      game_end,
      1,
      0
    );
  END LOOP;

  -- Migrer les bookings EVENT existants (seulement ceux qui n'ont pas déjà de game_sessions)
  FOR booking_record IN 
    SELECT id, type, start_datetime, end_datetime, game_start_datetime, game_end_datetime
    FROM bookings
    WHERE type = 'EVENT'
      AND NOT EXISTS (SELECT 1 FROM game_sessions WHERE booking_id = bookings.id)
  LOOP
    event_start := booking_record.start_datetime;
    event_end := booking_record.end_datetime;

    -- Si game_start_datetime/game_end_datetime existent, les utiliser pour la session 1
    -- Sinon, utiliser le timing standard : event_start + 15min pour session1
    IF booking_record.game_start_datetime IS NOT NULL AND booking_record.game_end_datetime IS NOT NULL THEN
      -- Cas où les heures de jeu sont déjà définies
      session1_start := booking_record.game_start_datetime;
      session1_end := booking_record.game_end_datetime;
      
      -- Session2 : après une pause de 30 min (par défaut)
      session2_start := session1_end + INTERVAL '30 minutes';
      session2_end := session2_start + (session1_end - session1_start);
    ELSE
      -- Timing standard : session1 à event_start + 15min, pause 30min, session2 après pause
      session1_start := event_start + INTERVAL '15 minutes';
      session1_end := session1_start + INTERVAL '60 minutes'; -- Durée par défaut 60 min
      
      session2_start := session1_end + INTERVAL '30 minutes'; -- Pause 30 min
      session2_end := session2_start + INTERVAL '60 minutes'; -- Durée par défaut 60 min
    END IF;

    -- Créer 2 game_sessions avec game_area = ACTIVE (comportement actuel)
    INSERT INTO game_sessions (
      booking_id,
      game_area,
      start_datetime,
      end_datetime,
      session_order,
      pause_before_minutes
    ) VALUES 
    (
      booking_record.id,
      'ACTIVE',
      session1_start,
      session1_end,
      1,
      15 -- Pause avant session1 = 15 min (event_start + 15min)
    ),
    (
      booking_record.id,
      'ACTIVE',
      session2_start,
      session2_end,
      2,
      30 -- Pause avant session2 = 30 min
    );
  END LOOP;

  RAISE NOTICE 'Migration terminée : game_sessions créées pour tous les bookings existants';
END $$;

-- =====================================================
-- PARTIE 3: Initialisation des données par défaut
-- =====================================================

-- Mettre à jour les valeurs par défaut pour les branches existantes
DO $$
DECLARE
  rishon_branch_id UUID;
  petah_branch_id UUID;
BEGIN
  SELECT id INTO rishon_branch_id FROM branches WHERE slug = 'rishon-lezion' LIMIT 1;
  SELECT id INTO petah_branch_id FROM branches WHERE slug = 'petah-tikva' LIMIT 1;

  IF rishon_branch_id IS NOT NULL THEN
    UPDATE branch_settings
    SET laser_total_vests = 35, laser_enabled = TRUE
    WHERE branch_id = rishon_branch_id;
    
    -- Insérer des laser rooms par défaut pour Rishon (seulement si elles n'existent pas)
    INSERT INTO laser_rooms (branch_id, slug, name, name_en, capacity, sort_order, is_active) VALUES
      (rishon_branch_id, 'L1', 'Laser 1', 'Laser 1', 15, 0, TRUE),
      (rishon_branch_id, 'L2', 'Laser 2', 'Laser 2', 20, 1, TRUE)
    ON CONFLICT (branch_id, slug) DO NOTHING;
  END IF;

  IF petah_branch_id IS NOT NULL THEN
    UPDATE branch_settings
    SET laser_total_vests = 30, laser_enabled = TRUE
    WHERE branch_id = petah_branch_id;
    
    -- Insérer une laser room par défaut pour Petah Tikva (seulement si elle n'existe pas)
    INSERT INTO laser_rooms (branch_id, slug, name, name_en, capacity, sort_order, is_active) VALUES
      (petah_branch_id, 'L1', 'Laser 1', 'Laser 1', 30, 0, TRUE)
    ON CONFLICT (branch_id, slug) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- Vérification finale
-- =====================================================

-- Vérification : compter les game_sessions créées
SELECT 
  COUNT(*) as total_sessions,
  COUNT(DISTINCT booking_id) as bookings_avec_sessions,
  COUNT(*) FILTER (WHERE game_area = 'ACTIVE') as sessions_active,
  COUNT(*) FILTER (WHERE game_area = 'LASER') as sessions_laser
FROM game_sessions;

-- Vérification : compter les laser rooms créées
SELECT 
  b.name as branch_name,
  COUNT(lr.id) as laser_rooms_count,
  STRING_AGG(lr.name, ', ' ORDER BY lr.sort_order) as laser_room_names,
  bs.laser_total_vests,
  bs.laser_enabled
FROM branches b
LEFT JOIN laser_rooms lr ON lr.branch_id = b.id AND lr.is_active = true
LEFT JOIN branch_settings bs ON bs.branch_id = b.id
WHERE b.slug IN ('rishon-lezion', 'petah-tikva')
GROUP BY b.id, b.name, bs.laser_total_vests, bs.laser_enabled
ORDER BY b.name;
