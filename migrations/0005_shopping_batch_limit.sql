-- Enforce the existing 500-row cap for atomic multi-ingredient imports as well.
CREATE TRIGGER shopping_items_capacity BEFORE INSERT ON shopping_items
WHEN NOT EXISTS(SELECT 1 FROM shopping_items WHERE name_key=NEW.name_key)
AND (SELECT COUNT(*) FROM shopping_items)>=500
BEGIN
 SELECT RAISE(ABORT,'SHOPPING_LIMIT');
END;
