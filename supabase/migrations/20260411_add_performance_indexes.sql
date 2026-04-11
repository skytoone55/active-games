-- Performance indexes for frequently queried columns
-- Run this migration to speed up order/booking/contact queries

-- orders: most queried filters in the admin and booking API
CREATE INDEX IF NOT EXISTS idx_orders_branch_status        ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_branch_date          ON orders(branch_id, requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_status_created       ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone                ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_seen_at              ON orders(seen_at) WHERE seen_at IS NULL;

-- bookings: heavily filtered by branch + status + date
CREATE INDEX IF NOT EXISTS idx_bookings_branch_status      ON bookings(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_datetime     ON bookings(start_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_date        ON bookings(branch_id, start_datetime);

-- contacts: looked up by phone + branch on every order creation
CREATE INDEX IF NOT EXISTS idx_contacts_branch_phone       ON contacts(branch_id_main, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_phone              ON contacts(phone);

-- game_sessions: queried by booking_id and for overlap detection
CREATE INDEX IF NOT EXISTS idx_game_sessions_booking       ON game_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_branch_area   ON game_sessions(branch_id, game_area, start_datetime, end_datetime);

-- booking_slots: cleaned up on rollback, joined on booking_id
CREATE INDEX IF NOT EXISTS idx_booking_slots_booking       ON booking_slots(booking_id);

-- booking_contacts: joined on booking_id
CREATE INDEX IF NOT EXISTS idx_booking_contacts_booking    ON booking_contacts(booking_id);

-- branch_settings: looked up on every order creation
CREATE INDEX IF NOT EXISTS idx_branch_settings_branch      ON branch_settings(branch_id);

-- email_logs: queried by entity for display in order detail
CREATE INDEX IF NOT EXISTS idx_email_logs_entity           ON email_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_branch_created   ON email_logs(branch_id, created_at DESC);
