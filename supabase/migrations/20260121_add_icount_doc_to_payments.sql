-- Migration: Ajouter les colonnes document iCount à la table payments
-- Date: 2026-01-21
-- Description: Permet de lier chaque paiement à son document iCount (invrec)
--              pour faciliter les remboursements via /doc/cancel avec refund_cc:true

-- Ajouter les colonnes pour le document iCount
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS icount_doctype VARCHAR(20),
ADD COLUMN IF NOT EXISTS icount_docnum INTEGER,
ADD COLUMN IF NOT EXISTS icount_doc_url TEXT;

-- Commentaires
COMMENT ON COLUMN payments.icount_doctype IS 'Type de document iCount (invrec, receipt, etc.)';
COMMENT ON COLUMN payments.icount_docnum IS 'Numéro du document iCount';
COMMENT ON COLUMN payments.icount_doc_url IS 'URL du document iCount (PDF)';

-- Index pour recherche par document
CREATE INDEX IF NOT EXISTS idx_payments_icount_docnum ON payments(icount_doctype, icount_docnum) WHERE icount_docnum IS NOT NULL;
