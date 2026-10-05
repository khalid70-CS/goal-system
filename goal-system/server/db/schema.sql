
CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('idea', 'active', 'completed', 'archived')),
  priority    TEXT NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('high', 'medium', 'low')),
  tags        TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  start_date  TEXT,
  target_date TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'inactive'
              CHECK (status IN ('active', 'inactive', 'completed')),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  date         TEXT NOT NULL,
  duration     INTEGER,
  stop_point   TEXT NOT NULL DEFAULT '',
  next_step    TEXT NOT NULL DEFAULT '',
  summary      TEXT NOT NULL DEFAULT '',
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'completed')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'link'
              CHECK (type IN ('link', 'course', 'book', 'video', 'article', 'file')),
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

-- A note can be free-standing (both ids NULL), attached to a goal, or to a session.
-- Deleting a goal deletes its notes. Deleting only a session keeps the note
-- (it stays on the goal), so session_id is set to NULL instead.
CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT REFERENCES goals(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_goal      ON plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_sessions_goal   ON sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session   ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_resources_goal  ON resources(goal_id);
CREATE INDEX IF NOT EXISTS idx_notes_goal      ON notes(goal_id);
CREATE INDEX IF NOT EXISTS idx_notes_session   ON notes(session_id);
