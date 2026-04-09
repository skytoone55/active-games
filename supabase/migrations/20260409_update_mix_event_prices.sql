-- Mise à jour forfaits événement Active + Laser (BOTH)
-- +15 participants : 130 → 135 ₪/personne
-- +30 participants : 120 → 125 ₪/personne

UPDATE icount_event_formulas
SET price_per_person = 135,
    updated_at = NOW()
WHERE game_type = 'BOTH'
  AND min_participants <= 15
  AND max_participants >= 15
  AND price_per_person = 130;

UPDATE icount_event_formulas
SET price_per_person = 125,
    updated_at = NOW()
WHERE game_type = 'BOTH'
  AND min_participants <= 30
  AND max_participants >= 30
  AND price_per_person = 120;
