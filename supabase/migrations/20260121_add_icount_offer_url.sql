-- Migration: Add icount_offer_url to bookings
-- This stores the URL to view/download the iCount offer document

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS icount_offer_url TEXT;

COMMENT ON COLUMN bookings.icount_offer_url IS 'URL to view the iCount offer document online';
