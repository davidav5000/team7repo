-- Core MVP schema (project plan §4). Apply with `npm run db:init`; safe to re-run.
-- Tables are ordered so every REFERENCES target already exists.
-- The `session` table is managed by connect-pg-simple; don't define it here.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  username      VARCHAR(30)  NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,30}$'),
  contact       VARCHAR(255),                    -- private: never return in API responses
  password_hash TEXT         NOT NULL,           -- bcrypt hash only
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: "Corbin" and "corbin" are the same user.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_id  INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       VARCHAR(120) NOT NULL CHECK (length(trim(title)) > 0),
  starts_at   TIMESTAMPTZ  NOT NULL,
  location    VARCHAR(200) NOT NULL CHECK (length(trim(location)) > 0),
  description TEXT         NOT NULL,
  latitude    DOUBLE PRECISION CHECK (latitude  BETWEEN -90  AND 90),
  longitude   DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),  -- set by the app on edit
  CHECK ((latitude IS NULL) = (longitude IS NULL))   -- coords: both or neither
);

CREATE INDEX IF NOT EXISTS activities_starts_at_idx ON activities (starts_at);
CREATE INDEX IF NOT EXISTS activities_creator_id_idx ON activities (creator_id);

CREATE TABLE IF NOT EXISTS attendance (
  user_id     INTEGER     NOT NULL REFERENCES users (id)      ON DELETE CASCADE,
  activity_id INTEGER     NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'withdrawn')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)               -- one row per user per activity
);

CREATE INDEX IF NOT EXISTS attendance_activity_id_idx ON attendance (activity_id);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id INTEGER     NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  author_id   INTEGER     NOT NULL REFERENCES users (id)      ON DELETE CASCADE,
  message     TEXT        NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_activity_id_idx ON comments (activity_id, created_at);
