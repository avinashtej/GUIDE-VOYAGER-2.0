ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS analytics_events_user_time_idx
  ON analytics_events(user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_guest_time_idx
  ON analytics_events(guest_id, occurred_at DESC)
  WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_session_time_idx
  ON analytics_events(session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;
