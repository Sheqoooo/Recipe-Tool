-- Optional shared Bring integration: secrets and access tokens are never stored here.
CREATE TABLE bring_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  list_id TEXT NOT NULL,
  list_name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bring_requests (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT UNIQUE,
  actor_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('lists','configure','export')),
  state TEXT NOT NULL CHECK(state IN ('running','completed','failed','uncertain')),
  created_at INTEGER NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  list_name TEXT NOT NULL DEFAULT ''
);
CREATE INDEX bring_requests_limits ON bring_requests(created_at,state);
