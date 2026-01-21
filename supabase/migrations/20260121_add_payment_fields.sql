-- Migration: Add payment tracking fields to orders and contacts
-- Date: 2026-01-21

-- =============================================
-- Payment status enum
-- =============================================
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',           -- En attente de paiement
        'deposit_paid',      -- Acompte payé
        'fully_paid',        -- Payé intégralement
        'card_authorized',   -- Carte pré-autorisée (empreinte J5)
        'refunded',          -- Remboursé
        'failed'             -- Échec de paiement
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Add payment fields to orders table
-- =============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS total_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ILS',
-- iCount payment tracking
ADD COLUMN IF NOT EXISTS icount_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS icount_confirmation_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS icount_j5_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS cc_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS cc_type VARCHAR(50),
-- Payment metadata
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50), -- 'card', 'cash', 'transfer', 'check'
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP WITH TIME ZONE;

-- =============================================
-- Add card token storage to contacts table
-- For storing tokenized card info per client
-- =============================================
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS icount_client_id INTEGER,
ADD COLUMN IF NOT EXISTS icount_cc_token_id INTEGER,
ADD COLUMN IF NOT EXISTS cc_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS cc_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS cc_validity VARCHAR(10),
ADD COLUMN IF NOT EXISTS cc_holder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(5) DEFAULT NULL;

-- =============================================
-- Create payments table for payment history
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Payment details
    amount numeric(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ILS',
    payment_type VARCHAR(50) NOT NULL, -- 'full', 'deposit', 'balance', 'refund'
    payment_method VARCHAR(50) NOT NULL, -- 'card', 'cash', 'transfer', 'check'

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'

    -- iCount data
    icount_transaction_id VARCHAR(100),
    icount_confirmation_code VARCHAR(100),
    icount_document_id VARCHAR(100), -- Lien vers le document généré (reçu/facture)
    icount_document_type VARCHAR(50), -- 'receipt', 'invoice', 'receipt_invoice'

    -- Card info (masked)
    cc_last4 VARCHAR(4),
    cc_type VARCHAR(50),

    -- For check payments
    check_number VARCHAR(50),
    check_bank VARCHAR(100),
    check_date DATE,

    -- For transfer payments
    transfer_reference VARCHAR(100),

    -- Metadata
    notes TEXT,
    processed_by UUID REFERENCES auth.users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- =============================================
-- RLS Policies for payments table
-- =============================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Super admin can see all payments
CREATE POLICY "Super admin can manage all payments" ON payments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Branch admin and agents can see payments for their branches
CREATE POLICY "Branch users can view payments" ON payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_branches
            WHERE user_branches.user_id = auth.uid()
            AND user_branches.branch_id = payments.branch_id
        )
    );

-- Branch admin can insert/update payments for their branches
CREATE POLICY "Branch admin can manage payments" ON payments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN user_branches ub ON ub.user_id = p.id
            WHERE p.id = auth.uid()
            AND p.role IN ('super_admin', 'branch_admin')
            AND ub.branch_id = payments.branch_id
        )
    );

-- =============================================
-- Update trigger for payments
-- =============================================
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payments_updated_at ON payments;
CREATE TRIGGER trigger_update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON COLUMN orders.payment_status IS 'Current payment status of the order';
COMMENT ON COLUMN orders.total_amount IS 'Total amount to be paid for the order';
COMMENT ON COLUMN orders.deposit_amount IS 'Required deposit amount';
COMMENT ON COLUMN orders.paid_amount IS 'Amount already paid';
COMMENT ON COLUMN orders.icount_j5_code IS 'J5 preapproval code for card authorization (empreinte)';
COMMENT ON COLUMN orders.payment_deadline IS 'Deadline for payment before auto-cancellation';

COMMENT ON TABLE payments IS 'Payment history and transactions for orders';
COMMENT ON COLUMN payments.payment_type IS 'Type: full, deposit, balance, or refund';
COMMENT ON COLUMN payments.payment_method IS 'Method: card, cash, transfer, or check';
