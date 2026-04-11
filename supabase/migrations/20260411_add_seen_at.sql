-- Add generic seen_at / seen_by to orders
-- Replaces aborted_seen_at with a universal "seen" tracking for all statuses
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seen_by UUID REFERENCES profiles(id);

-- Mark all existing orders as seen so nothing lights up retroactively
UPDATE orders SET seen_at = NOW() WHERE seen_at IS NULL;

-- Index for fast unseen count queries per branch
CREATE INDEX IF NOT EXISTS idx_orders_branch_unseen
  ON orders(branch_id)
  WHERE seen_at IS NULL;
