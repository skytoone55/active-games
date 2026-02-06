-- Migration: Ajouter le module availability_check
-- Ce module vérifie la disponibilité et redirige selon le résultat

-- Le type availability_check sera géré dans l'engine
-- Pas de modification de schéma nécessaire, juste documentation

-- Structure du module availability_check:
-- {
--   "ref_code": "CHECK_AVAILABILITY",
--   "module_type": "availability_check",
--   "content": {
--     "fr": "Vérification de la disponibilité en cours...",
--     "en": "Checking availability...",
--     "he": "בודק זמינות..."
--   },
--   "success_message": {
--     "fr": "Parfait ! Ce créneau est disponible pour vous.",
--     "en": "Perfect! This slot is available for you.",
--     "he": "מושלם! המועד פנוי עבורך."
--   },
--   "failure_message": {
--     "fr": "Désolé, ce créneau n'est pas disponible.",
--     "en": "Sorry, this slot is not available.",
--     "he": "מצטערים, המועד אינו פנוי."
--   },
--   "metadata": {
--     "check_fields": ["date", "time", "participants", "game_type", "game_count"],
--     "branch_slug": "tel-aviv"
--   }
-- }

-- Outputs attendus:
-- 1. output_available: Redirige si disponible
-- 2. output_unavailable: Redirige si non disponible (vers suggestions)

COMMENT ON COLUMN messenger_modules.module_type IS
'Types de modules:
- info: Message informatif simple
- choix_multiples: Choix avec boutons
- input_text: Saisie de texte
- availability_check: Vérification de disponibilité (nouveau)';
