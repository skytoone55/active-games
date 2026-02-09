-- Create contact_requests table for public contact form leads
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_by UUID REFERENCES profiles(id),
  read_at TIMESTAMPTZ,
  contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread count queries per branch
CREATE INDEX idx_contact_requests_branch_unread ON contact_requests(branch_id, is_read) WHERE is_read = false;
CREATE INDEX idx_contact_requests_branch_created ON contact_requests(branch_id, created_at DESC);

-- RLS policies
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role)
CREATE POLICY "Service role full access on contact_requests"
  ON contact_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read contact requests for their branches
CREATE POLICY "Authenticated users can read contact_requests"
  ON contact_requests
  FOR SELECT
  TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM user_branches WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
