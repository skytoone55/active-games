-- Add aborted_seen_at column to orders table
-- This tracks when an admin has "seen" an aborted order from the website
ALTER TABLE orders ADD COLUMN IF NOT EXISTS aborted_seen_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS aborted_seen_by UUID REFERENCES profiles(id);

-- Index for fast unseen aborted count queries per branch
CREATE INDEX IF NOT EXISTS idx_orders_branch_aborted_unseen
  ON orders(branch_id, status)
  WHERE status = 'aborted' AND aborted_seen_at IS NULL;
