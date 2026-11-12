-- Separate image storage: collection queries only read metadata, never all image bytes.
CREATE TABLE recipe_images (
  recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  content BLOB NOT NULL CHECK(length(content)>0 AND length(content)<=1048576),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
  original_url TEXT NOT NULL,
  source_page TEXT NOT NULL,
  credit TEXT NOT NULL DEFAULT '' CHECK(length(credit)<=240)
);
