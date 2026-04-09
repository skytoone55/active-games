-- Mise à jour prix active_30 : 60 → 70 ₪
-- Impact :
--   - Prix 30 min Active seul : 60 → 70 ₪/personne
--   - Prix Mix (active_30 + laser_1) : 130 → 140 ₪/personne

UPDATE icount_products
SET unit_price = 70,
    updated_at = NOW()
WHERE code = 'active_30'
  AND unit_price = 60;
