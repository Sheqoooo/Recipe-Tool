CREATE TABLE shopping_items (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 name_key TEXT NOT NULL UNIQUE,
 quantity TEXT NOT NULL DEFAULT '' CHECK(length(quantity)<=60),
 checked INTEGER NOT NULL DEFAULT 0 CHECK(checked IN (0,1)),
 created_by TEXT NOT NULL REFERENCES members(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX shopping_items_order ON shopping_items(checked,updated_at DESC,id);
