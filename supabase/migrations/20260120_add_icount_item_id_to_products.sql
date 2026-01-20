-- Migration: Ajouter icount_item_id aux produits pour sync bidirectionnelle
-- Date: 2026-01-20

-- Ajouter la colonne icount_item_id pour stocker l'ID du produit sur iCount
ALTER TABLE icount_products
ADD COLUMN IF NOT EXISTS icount_item_id INTEGER;

-- Ajouter la colonne icount_itemcode pour stocker le code produit iCount (si différent)
ALTER TABLE icount_products
ADD COLUMN IF NOT EXISTS icount_itemcode VARCHAR(50);

-- Ajouter un flag pour savoir si le produit est synchronisé
ALTER TABLE icount_products
ADD COLUMN IF NOT EXISTS icount_synced_at TIMESTAMPTZ;

-- Index pour recherche par icount_item_id
CREATE INDEX IF NOT EXISTS idx_icount_products_icount_item_id
ON icount_products(icount_item_id)
WHERE icount_item_id IS NOT NULL;

-- Même chose pour les salles (rooms)
ALTER TABLE icount_rooms
ADD COLUMN IF NOT EXISTS icount_item_id INTEGER;

ALTER TABLE icount_rooms
ADD COLUMN IF NOT EXISTS icount_itemcode VARCHAR(50);

ALTER TABLE icount_rooms
ADD COLUMN IF NOT EXISTS icount_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_icount_rooms_icount_item_id
ON icount_rooms(icount_item_id)
WHERE icount_item_id IS NOT NULL;
