-- Supports the bounded collection and its ingredient/step subqueries.
CREATE INDEX recipes_listing ON recipes(created_at DESC, id DESC);
