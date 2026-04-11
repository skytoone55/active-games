-- Add order_notification_emails to branch_settings
-- Array of email addresses that receive a notification for every new order
ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS order_notification_emails JSONB DEFAULT '[]'::jsonb;
