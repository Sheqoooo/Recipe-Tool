import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync, openSync, writeFileSync, closeSync, chmodSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { AppError } from './errors.js';

export class Storage {
  constructor(directory = process.env.REZEPTWERK_DATA || './data', env = process.env) {
    this.directory = resolve(directory);
    this.env = env;
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(this.directory, 'recipes.sqlite3'));
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) { this.db.close(); throw new Error('Unbekannte Datenbankversion.'); }
    // Schema v1 is compatible with the original Python application.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipes (id INTEGER PRIMARY KEY, document TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS plan (recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
        servings REAL NOT NULL CHECK(servings > 0));
      CREATE TABLE IF NOT EXISTS checked_items (key TEXT PRIMARY KEY);
      PRAGMA user_version = 1;
    `);
  }

  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  recipes() {
    return this.db.prepare('SELECT * FROM recipes ORDER BY id DESC').all().map(row => ({
      ...JSON.parse(row.document), id: row.id, created_at: row.created_at,
    }));
  }

  findSource(url) {
    const row = this.db.prepare("SELECT * FROM recipes WHERE json_extract(document, '$.source_url') = ? ORDER BY id DESC LIMIT 1").get(url);
    return row ? { ...JSON.parse(row.document), id: row.id, created_at: row.created_at } : null;
  }

  saveRecipe(document, id = null) {
    return this.transaction(() => {
      let recipeId = id;
      if (id === null) {
        recipeId = Number(this.db.prepare('INSERT INTO recipes(document) VALUES (?)').run(JSON.stringify(document)).lastInsertRowid);
      } else if (!this.db.prepare('UPDATE recipes SET document=? WHERE id=?').run(JSON.stringify(document), id).changes) {
        throw new AppError('Das Rezept wurde nicht gefunden.', 404);
      }
      this.db.exec('DELETE FROM checked_items');
      return recipeId;
    });
  }

  deleteRecipe(id) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM recipes WHERE id=?').run(id);
      this.db.exec('DELETE FROM checked_items');
    });
  }

  plan() {
    return this.db.prepare('SELECT plan.*, recipes.document FROM plan JOIN recipes ON recipes.id=plan.recipe_id ORDER BY recipe_id').all()
      .map(row => ({ recipe_id: row.recipe_id, servings: row.servings, recipe: { ...JSON.parse(row.document), id: row.recipe_id } }));
  }

  setPlan(id, targetServings, remove = false) {
    this.transaction(() => {
      if (remove) this.db.prepare('DELETE FROM plan WHERE recipe_id=?').run(id);
      else {
        if (!this.db.prepare('SELECT id FROM recipes WHERE id=?').get(id)) throw new AppError('Das Rezept wurde nicht gefunden.', 404);
        this.db.prepare('INSERT INTO plan VALUES (?, ?) ON CONFLICT(recipe_id) DO UPDATE SET servings=excluded.servings').run(id, targetServings);
      }
      this.db.exec('DELETE FROM checked_items');
    });
  }

  checked() { return this.db.prepare('SELECT key FROM checked_items').all().map(row => row.key); }

  check(key, checked) {
    this.db.prepare(checked ? 'INSERT OR IGNORE INTO checked_items VALUES (?)' : 'DELETE FROM checked_items WHERE key=?').run(key);
  }

  settings() {
    const file = join(this.directory, 'settings.json');
    const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    return { api_key: this.env.OPENAI_API_KEY || saved.api_key || '', env_key: Boolean(this.env.OPENAI_API_KEY) };
  }

  saveKey(key) {
    const path = join(this.directory, 'settings.json');
    const temporary = path + '.' + randomBytes(8).toString('hex');
    const fd = openSync(temporary, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify({ api_key: key })); }
    finally { closeSync(fd); }
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
  }

  close() { this.db.close(); }
}
