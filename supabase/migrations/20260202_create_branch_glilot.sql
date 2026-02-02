-- ============================================================================
-- CRÉATION BRANCH GLILOT
-- ============================================================================
-- Date: 2026-02-02
-- Description: Nouvelle branche Glilot avec 4 slots, 1 laser, 2 event rooms
-- ============================================================================

-- 1. INSERTION BRANCH
-- Note: Le trigger "trigger_seed_icount_products" créera automatiquement les produits iCount
INSERT INTO branches (
  slug,
  name,
  name_en,
  address,
  phone,
  phone_extension,
  timezone,
  is_active
) VALUES (
  'glilot',
  'Glilot',
  'Glilot',
  '',  -- À remplir plus tard dans admin
  '',  -- À remplir plus tard dans admin
  '',
  'Asia/Jerusalem',
  true
)
RETURNING id;

-- Récupération de l'ID pour les étapes suivantes
-- IMPORTANT: Remplacer <BRANCH_ID> ci-dessous par l'ID retourné

-- 2. BRANCH_SETTINGS (copie config Rishon comme base)
INSERT INTO branch_settings (
  branch_id,
  max_concurrent_players,
  slot_duration_minutes,
  game_duration_minutes,
  event_total_duration_minutes,
  event_game_duration_minutes,
  event_buffer_before_minutes,
  event_buffer_after_minutes,
  event_min_participants,
  game_price_per_person,
  bracelet_price,
  event_price_15_29,
  event_price_30_plus,
  total_slots,
  max_players_per_slot,
  laser_total_vests,
  laser_enabled,
  icount_auto_send_quote,
  clara_enabled,
  clara_settings,
  opening_hours
) VALUES (
  '<BRANCH_ID>',
  24,                    -- max_concurrent_players (4 slots x 6 joueurs)
  15,                    -- slot_duration_minutes
  30,                    -- game_duration_minutes
  120,                   -- event_total_duration_minutes
  60,                    -- event_game_duration_minutes
  15,                    -- event_buffer_before_minutes
  15,                    -- event_buffer_after_minutes
  1,                     -- event_min_participants
  '0.00',                -- game_price_per_person
  '0.00',                -- bracelet_price
  '0.00',                -- event_price_15_29
  '0.00',                -- event_price_30_plus
  4,                     -- total_slots (4 vs 14/10 autres)
  6,                     -- max_players_per_slot
  30,                    -- laser_total_vests
  true,                  -- laser_enabled
  true,                  -- icount_auto_send_quote
  false,                 -- clara_enabled
  '{}'::jsonb,           -- clara_settings
  '{
    "monday": {"open": "10:00", "close": "22:00"},
    "tuesday": {"open": "10:00", "close": "22:00"},
    "wednesday": {"open": "10:00", "close": "22:00"},
    "thursday": {"open": "10:00", "close": "22:00"},
    "friday": {"open": "10:00", "close": "22:00"},
    "saturday": {"open": "10:00", "close": "22:00"},
    "sunday": {"open": "10:00", "close": "22:00"}
  }'::jsonb
);

-- 3. EVENT_ROOMS (2 salles anniversaire)
INSERT INTO event_rooms (branch_id, slug, name, name_en, capacity, sort_order, is_active) VALUES
('<BRANCH_ID>', 'salle-anniversaire-1', 'Salle Anniversaire 1', 'Birthday Room 1', 25, 1, true),
('<BRANCH_ID>', 'salle-anniversaire-2', 'Salle Anniversaire 2', 'Birthday Room 2', 30, 2, true);

-- 4. LASER_ROOMS (1 salle laser)
INSERT INTO laser_rooms (branch_id, slug, name, name_en, capacity, sort_order, is_active) VALUES
('<BRANCH_ID>', 'laser-glilot', 'Laser Glilot', 'Laser Glilot', 30, 1, true);

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================

-- Vérifier la branch créée
SELECT
  b.slug,
  b.name,
  bs.total_slots,
  bs.laser_total_vests,
  bs.laser_enabled,
  (SELECT COUNT(*) FROM event_rooms WHERE branch_id = b.id) as event_rooms_count,
  (SELECT COUNT(*) FROM laser_rooms WHERE branch_id = b.id) as laser_rooms_count,
  (SELECT COUNT(*) FROM icount_products WHERE branch_id = b.id) as icount_products_count
FROM branches b
LEFT JOIN branch_settings bs ON bs.branch_id = b.id
WHERE b.slug = 'glilot';

-- Résultat attendu:
-- slug: glilot
-- total_slots: 4
-- laser_total_vests: 30
-- laser_enabled: true
-- event_rooms_count: 2
-- laser_rooms_count: 1
-- icount_products_count: >= 10 (créés par trigger)

-- ============================================================================
-- FIN MIGRATION
-- ============================================================================
