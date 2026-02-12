-- Chat shortcuts: per-user quick message buttons for WhatsApp chat
CREATE TABLE IF NOT EXISTS chat_shortcuts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  message text NOT NULL,
  emoji text DEFAULT '',
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS: each user can only see/manage their own shortcuts
ALTER TABLE chat_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shortcuts" ON chat_shortcuts
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_chat_shortcuts_user_id ON chat_shortcuts(user_id);
