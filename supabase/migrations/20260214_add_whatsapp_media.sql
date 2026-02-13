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

-- 2. Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
-- Service role can upload (webhook + admin API run server-side)
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'whatsapp-media');

-- Public read access (admin chat loads media client-side, URLs are unguessable UUIDs)
CREATE POLICY "Public read access for whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');
