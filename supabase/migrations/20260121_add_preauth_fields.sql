-- Migration: Add preauthorization (J5) tracking fields to orders
-- Date: 2026-01-21

-- =============================================
-- Add preauth fields to orders table
-- For tracking J5 preauthorizations (card imprint/caution)
-- =============================================

-- Rename existing j5 code to preauth_code for consistency
ALTER TABLE orders
RENAME COLUMN icount_j5_code TO preauth_code;

-- Add additional preauth tracking fields
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS preauth_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS preauth_cc_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS preauth_cc_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS preauth_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preauth_created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS preauth_cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preauth_cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS preauth_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preauth_used_by UUID REFERENCES auth.users(id);

-- Add column to contacts for cc_expiry (was added as cc_validity but API expects cc_expiry)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS cc_expiry VARCHAR(10);

-- Copy existing cc_validity to cc_expiry if it exists
UPDATE contacts SET cc_expiry = cc_validity WHERE cc_validity IS NOT NULL AND cc_expiry IS NULL;

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON COLUMN orders.preauth_code IS 'J5 preauthorization confirmation code';
COMMENT ON COLUMN orders.preauth_amount IS 'Amount preauthorized on the card';
COMMENT ON COLUMN orders.preauth_cc_last4 IS 'Last 4 digits of preauthorized card';
COMMENT ON COLUMN orders.preauth_cc_type IS 'Type of preauthorized card (Visa, MasterCard, etc)';
COMMENT ON COLUMN orders.preauth_created_at IS 'When the preauthorization was created';
COMMENT ON COLUMN orders.preauth_created_by IS 'Who created the preauthorization';
COMMENT ON COLUMN orders.preauth_cancelled_at IS 'When the preauthorization was cancelled';
COMMENT ON COLUMN orders.preauth_used_at IS 'When the preauthorization was used for payment';
