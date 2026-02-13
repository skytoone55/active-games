-- Add media support to WhatsApp messages (bidirectional: inbound + outbound)
-- Stores media files in Supabase Storage bucket 'whatsapp-media'

-- 1. Add media columns to whatsapp_messages
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_mime_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_filename text DEFAULT NULL;

COMMENT ON COLUMN whatsapp_messages.media_url IS 'Public URL to media file in Supabase Storage';
COMMENT ON COLUMN whatsapp_messages.media_type IS 'Media type: image, audio, video, document';
COMMENT ON COLUMN whatsapp_messages.media_mime_type IS 'MIME type: image/jpeg, audio/ogg, video/mp4, etc.';
COMMENT ON COLUMN whatsapp_messages.media_filename IS 'Original filename (documents only)';

-- Bucket 'whatsapp-media' is created manually via Supabase dashboard
-- Access: service_role for upload (server-side), public read (bucket is public)
