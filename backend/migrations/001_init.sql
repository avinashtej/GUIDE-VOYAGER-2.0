CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'tourist' CHECK (role IN ('tourist','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS destinations (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','inactive')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS content_drafts_status_idx ON content_drafts(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_versions (
  id bigserial PRIMARY KEY,
  version text NOT NULL UNIQUE,
  destinations jsonb NOT NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_versions_published_idx ON content_versions(published_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE,
  destination_id text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_destination_idx ON feedback(destination_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_retention_idx ON analytics_events(occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_type_time_idx ON analytics_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, destination_id)
);

CREATE TABLE IF NOT EXISTS user_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 80),
  destination_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_itineraries_user_idx ON user_itineraries(user_id, updated_at DESC);
