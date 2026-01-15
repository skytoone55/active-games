-- Migration: Ajout du support Laser
-- Date: 2025-01-XX
-- Description: Création des tables laser_rooms et game_sessions, ajout des colonnes laser dans branch_settings

-- =====================================================
-- Table: laser_rooms
-- =====================================================
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

-- =====================================================
-- Table: game_sessions
-- =====================================================
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

-- =====================================================
-- Ajout colonnes à branch_settings
-- =====================================================
ALTER TABLE branch_settings 
  ADD COLUMN IF NOT EXISTS laser_total_vests INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS laser_enabled BOOLEAN DEFAULT FALSE;

-- Commentaires pour documentation
COMMENT ON COLUMN branch_settings.laser_total_vests IS 'Contrainte HARD : nombre maximum de vestes disponibles (pas d''override possible)';
COMMENT ON COLUMN branch_settings.laser_enabled IS 'Active/désactive le support Laser pour cette branche';
COMMENT ON COLUMN game_sessions.game_area IS 'Zone de jeu : ACTIVE (slots) ou LASER (salles laser)';
COMMENT ON COLUMN game_sessions.laser_room_id IS 'Référence à la salle laser si game_area = LASER, NULL sinon';
COMMENT ON COLUMN game_sessions.pause_before_minutes IS 'Pause avant cette session (pour EVENT avec gap entre sessions)';
