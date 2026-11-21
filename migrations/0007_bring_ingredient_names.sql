ALTER TABLE ingredients ADD COLUMN bring_name TEXT CHECK (bring_name IS NULL OR length(bring_name) BETWEEN 1 AND 100);
