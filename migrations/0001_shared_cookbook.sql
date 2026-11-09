PRAGMA foreign_keys = ON;
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  access_sub TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES members(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  servings REAL CHECK(servings > 0 AND servings <= 1000),
  prep_minutes REAL CHECK(prep_minutes >= 0),
  cook_minutes REAL CHECK(cook_minutes >= 0),
  source_url TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('web', 'youtube_transcript')),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(warnings_json)),
  revision INTEGER NOT NULL DEFAULT 1,
  write_token TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX recipes_source ON recipes(source_url);
CREATE TABLE ingredients (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL, amount REAL CHECK(amount >= 0), unit TEXT NOT NULL, note TEXT NOT NULL,
  PRIMARY KEY(recipe_id, position)
);
CREATE TABLE steps (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  ingredient_indices_json TEXT NOT NULL CHECK(json_valid(ingredient_indices_json)),
  PRIMARY KEY(recipe_id, position)
);
CREATE TABLE plan (
  recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  servings REAL NOT NULL CHECK(servings > 0 AND servings <= 1000)
);
CREATE TABLE checked_items (key TEXT PRIMARY KEY);
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES members(id),
  source_url TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('web', 'youtube_transcript')),
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
  error_code TEXT,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  lease_expires_at INTEGER NOT NULL,
  reserved_cost_microusd INTEGER NOT NULL CHECK(reserved_cost_microusd >= 0),
  input_tokens INTEGER, output_tokens INTEGER, model TEXT,
  estimated_cost_microusd INTEGER
);
CREATE UNIQUE INDEX imports_active_source ON imports(source_url) WHERE status='running';
CREATE INDEX imports_limits ON imports(created_at, owner_id, status);
