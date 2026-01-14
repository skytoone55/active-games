-- Migration: Ajout colonne color à bookings
-- Date: 2024
-- Description: Ajoute la colonne color pour personnaliser la couleur des réservations dans l'agenda

-- Ajouter la colonne color si elle n'existe pas
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS color TEXT;

-- Commentaire pour documentation
COMMENT ON COLUMN bookings.color IS 'Couleur personnalisée pour l\'affichage de la réservation dans l\'agenda (format hex: #RRGGBB)';
