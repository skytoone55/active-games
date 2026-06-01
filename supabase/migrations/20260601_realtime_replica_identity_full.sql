-- Realtime: enable full row image on old records so that DELETE/UPDATE events
-- carry branch_id, which the client subscriptions filter on (branch_id=eq.xxx).
-- Without this, deletes/cancellations were silently dropped client-side,
-- forcing manual page refreshes in the admin agenda.
-- Previously only `orders` had REPLICA IDENTITY FULL.
ALTER TABLE public.bookings         REPLICA IDENTITY FULL;
ALTER TABLE public.game_sessions    REPLICA IDENTITY FULL;
ALTER TABLE public.booking_slots    REPLICA IDENTITY FULL;
ALTER TABLE public.booking_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.contacts         REPLICA IDENTITY FULL;
