-- Mise à jour forfaits événement Active + Laser (BOTH)
-- +15 participants : 135 → 140 ₪/personne
-- +30 participants : 125 → 130 ₪/personne

UPDATE icount_event_formulas
SET price_per_person = 140,
    updated_at = NOW()
WHERE game_type = 'BOTH'
  AND min_participants <= 15
  AND max_participants >= 15
  AND price_per_person = 135;

UPDATE icount_event_formulas
SET price_per_person = 130,
    updated_at = NOW()
WHERE game_type = 'BOTH'
  AND min_participants <= 30
  AND max_participants >= 30
  AND price_per_person = 125;
