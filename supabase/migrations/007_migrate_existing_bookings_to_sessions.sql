-- Migration: Migration des bookings existants vers game_sessions
-- Date: 2025-01-XX
-- Description: Crée des game_sessions pour tous les bookings GAME et EVENT existants

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
  -- Migrer les bookings GAME existants
  FOR booking_record IN 
    SELECT id, type, start_datetime, end_datetime, game_start_datetime, game_end_datetime
    FROM bookings
    WHERE type = 'GAME'
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

  -- Migrer les bookings EVENT existants
  FOR booking_record IN 
    SELECT id, type, start_datetime, end_datetime, game_start_datetime, game_end_datetime
    FROM bookings
    WHERE type = 'EVENT'
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

-- Vérification : compter les game_sessions créées
SELECT 
  COUNT(*) as total_sessions,
  COUNT(DISTINCT booking_id) as bookings_avec_sessions,
  COUNT(*) FILTER (WHERE game_area = 'ACTIVE') as sessions_active,
  COUNT(*) FILTER (WHERE game_area = 'LASER') as sessions_laser
FROM game_sessions;
