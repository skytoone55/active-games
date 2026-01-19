-- Migration: Create payment_credentials table for iCount API credentials per branch
-- Date: 2026-01-19

-- Create payment_credentials table
CREATE TABLE IF NOT EXISTS payment_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'icount',

    -- iCount credentials (encrypted in application layer)
    cid VARCHAR(255) NOT NULL,           -- Company ID
    username VARCHAR(255) NOT NULL,       -- API username/email
    password VARCHAR(255) NOT NULL,       -- API password (should be encrypted)

    -- Connection status
    is_active BOOLEAN DEFAULT true,
    last_connection_test TIMESTAMPTZ,
    last_connection_status BOOLEAN,
    last_connection_error TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),

    -- Unique constraint: one credential per branch per provider
    UNIQUE(branch_id, provider)
);

-- Enable RLS
ALTER TABLE payment_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can manage payment credentials"
    ON payment_credentials
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Index for faster lookups
CREATE INDEX idx_payment_credentials_branch ON payment_credentials(branch_id);
CREATE INDEX idx_payment_credentials_provider ON payment_credentials(provider);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payment_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_credentials_updated_at
    BEFORE UPDATE ON payment_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_credentials_updated_at();

-- Comment on table
COMMENT ON TABLE payment_credentials IS 'Stores payment provider API credentials per branch';
COMMENT ON COLUMN payment_credentials.cid IS 'iCount Company ID';
COMMENT ON COLUMN payment_credentials.username IS 'iCount API username (email)';
COMMENT ON COLUMN payment_credentials.password IS 'iCount API password';
