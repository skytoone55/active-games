-- Migration: Add PayPages fields for secure payment processing
-- Date: 2026-01-26
-- Purpose: Support iCount PayPages (hosted payment) to comply with PCI-DSS

-- =============================================
-- Add PayPages fields to payments table
-- =============================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS icount_sale_uniqid VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS icount_sale_url TEXT,
ADD COLUMN IF NOT EXISTS icount_paypage_id INTEGER,
ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS icount_doctype VARCHAR(50),
ADD COLUMN IF NOT EXISTS icount_docnum INTEGER,
ADD COLUMN IF NOT EXISTS icount_doc_url TEXT;

-- =============================================
-- Add index for sale_uniqid (idempotence checks)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_payments_sale_uniqid ON payments(icount_sale_uniqid);
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(payment_expires_at);

-- =============================================
-- Update payment_method to include 'paypage'
-- =============================================
COMMENT ON COLUMN payments.payment_method IS 'Method: card (direct - DEPRECATED), paypage (hosted), cash, transfer, or check';

-- =============================================
-- Comments for new fields
-- =============================================
COMMENT ON COLUMN payments.icount_sale_uniqid IS 'Unique identifier from iCount PayPages for idempotence';
COMMENT ON COLUMN payments.icount_sale_url IS 'URL to iCount hosted payment page';
COMMENT ON COLUMN payments.icount_paypage_id IS 'PayPage template ID used';
COMMENT ON COLUMN payments.payment_expires_at IS 'When the payment link expires (2h after creation)';
COMMENT ON COLUMN payments.icount_doctype IS 'iCount document type generated (invrec, receipt, etc)';
COMMENT ON COLUMN payments.icount_docnum IS 'iCount document number';
COMMENT ON COLUMN payments.icount_doc_url IS 'URL to view iCount document';
