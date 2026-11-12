-- Futterluke: Schema-Erweiterung der vorhandenen recipe-prod.
-- Vorher Backup/Time-Travel-Punkt sichern und fehlende Migrationen 0003-0005 prüfen.
-- Nur für den verifizierten Ausgangsstand 0001/0002. Nicht blind erneut ausführen.
-- Keine vorhandenen Rezept-/Einkaufsdaten werden gelöscht.

-- 0003_recipe_images.sql
-- Separate image storage: collection queries only read metadata, never all image bytes.
CREATE TABLE recipe_images (
  recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  content BLOB NOT NULL CHECK(length(content)>0 AND length(content)<=1048576),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
  original_url TEXT NOT NULL,
  source_page TEXT NOT NULL,
  credit TEXT NOT NULL DEFAULT '' CHECK(length(credit)<=240)
);

INSERT INTO d1_migrations(name) VALUES('0003_recipe_images.sql');

-- 0004_shopping_items.sql
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

INSERT INTO d1_migrations(name) VALUES('0004_shopping_items.sql');

-- 0005_shopping_batch_limit.sql
-- Enforce the existing 500-row cap for atomic multi-ingredient imports as well.
CREATE TRIGGER shopping_items_capacity BEFORE INSERT ON shopping_items
WHEN NOT EXISTS(SELECT 1 FROM shopping_items WHERE name_key=NEW.name_key)
AND (SELECT COUNT(*) FROM shopping_items)>=500
BEGIN
 SELECT RAISE(ABORT,'SHOPPING_LIMIT');
END;

INSERT INTO d1_migrations(name) VALUES('0005_shopping_batch_limit.sql');
