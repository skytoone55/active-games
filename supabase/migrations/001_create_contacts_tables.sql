-- Migration CRM: Création des tables contacts et booking_contacts
-- Date: 2024
-- Description: Ajout du système CRM avec relations contacts ↔ bookings

-- =====================================================
-- Table: contacts
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id_main UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  notes_client TEXT, -- Notes globales (allergies, préférences, comportement)
  alias TEXT, -- Optionnel : peut être utile pour certains cas
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source TEXT DEFAULT 'admin_agenda' CHECK (source IN ('admin_agenda', 'public_booking')),
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,
  deleted_at TIMESTAMPTZ, -- Pour hard delete futur (pas utilisé en v1)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id), -- Optionnel v1, structure prête
  updated_by UUID REFERENCES auth.users(id) -- Optionnel v1, structure prête
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_contacts_branch_main ON contacts(branch_id_main);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status) WHERE status = 'active'; -- Index partiel pour les actifs
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(last_name, first_name);
-- Index full-text pour recherche future (v1.1)
CREATE INDEX IF NOT EXISTS idx_contacts_full_text ON contacts USING gin(
  to_tsvector('french', 
    coalesce(first_name, '') || ' ' || 
    coalesce(last_name, '') || ' ' || 
    coalesce(phone, '') || ' ' || 
    coalesce(email, '')
  )
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Table: booking_contacts (junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT, -- 'payer', 'parent2', 'organizer', etc. (optionnel v1, utilisé v1.1)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id, contact_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_booking_contacts_booking ON booking_contacts(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_contacts_contact ON booking_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_booking_contacts_primary ON booking_contacts(booking_id, is_primary) WHERE is_primary = TRUE;

-- Contrainte : un seul primary par booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_contacts_one_primary 
ON booking_contacts(booking_id) 
WHERE is_primary = TRUE;

-- =====================================================
-- Modifications table: bookings
-- =====================================================

-- Ajouter primary_contact_id (optionnel, pour backward compatibility)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_primary_contact ON bookings(primary_contact_id);

-- Ajouter champ snapshot pour notes client (distinct de notes booking)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS customer_notes_at_booking TEXT;

-- Les champs customer_* existent déjà et servent de snapshot
-- Pas besoin de les modifier

-- =====================================================
-- Commentaires pour documentation
-- =====================================================

COMMENT ON TABLE contacts IS 'Table des contacts clients (CRM). Un contact appartient à une branche principale.';
COMMENT ON COLUMN contacts.branch_id_main IS 'Branche principale du contact (partage multi-branches hors scope v1)';
COMMENT ON COLUMN contacts.status IS 'Statut: active (visible, modifiable) ou archived (caché par défaut, lecture seule)';
COMMENT ON COLUMN contacts.notes_client IS 'Notes globales du client (allergies, préférences) - différentes des notes booking';
COMMENT ON TABLE booking_contacts IS 'Table de liaison many-to-many entre bookings et contacts';
COMMENT ON COLUMN booking_contacts.is_primary IS 'True pour le contact principal du booking (un seul par booking)';
COMMENT ON COLUMN booking_contacts.role IS 'Rôle optionnel (payer, parent2, organizer) - utilisé en v1.1';
COMMENT ON COLUMN bookings.primary_contact_id IS 'ID du contact principal (pour backward compatibility, déduit aussi de booking_contacts)';
COMMENT ON COLUMN bookings.customer_notes_at_booking IS 'Snapshot des notes client au moment de la réservation (pour historique)';
