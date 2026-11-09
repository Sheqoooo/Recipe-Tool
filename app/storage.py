import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get('REZEPTWERK_DATA', ROOT / 'data'))


@contextmanager
def database():
    DATA.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DATA / 'recipes.sqlite3'), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize():
    with database() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY, document TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS plan (
            recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
            servings REAL NOT NULL CHECK(servings > 0));
        CREATE TABLE IF NOT EXISTS checked_items (key TEXT PRIMARY KEY);
        PRAGMA user_version = 1;
        ''')


def recipes():
    with database() as db:
        return [dict(json.loads(row['document']), id=row['id'], created_at=row['created_at'])
                for row in db.execute('SELECT * FROM recipes ORDER BY id DESC')]


def save_recipe(document, recipe_id=None):
    with database() as db:
        if recipe_id is None:
            recipe_id = db.execute('INSERT INTO recipes(document) VALUES (?)',
                                   (json.dumps(document, ensure_ascii=False),)).lastrowid
        else:
            cursor = db.execute('UPDATE recipes SET document=? WHERE id=?',
                                (json.dumps(document, ensure_ascii=False), recipe_id))
            if not cursor.rowcount:
                raise ValueError('Das Rezept wurde nicht gefunden.')
        db.execute('DELETE FROM checked_items')
    return recipe_id


def plan():
    with database() as db:
        return [{'recipe_id': row['recipe_id'], 'servings': row['servings'],
                 'recipe': dict(json.loads(row['document']), id=row['recipe_id'])}
                for row in db.execute('SELECT plan.*, recipes.document FROM plan JOIN recipes ON recipes.id=plan.recipe_id ORDER BY recipe_id')]


def settings():
    path = DATA / 'settings.json'
    saved = json.loads(path.read_text()) if path.exists() else {}
    return {'api_key': os.environ.get('OPENAI_API_KEY') or saved.get('api_key', '')}


def save_key(key):
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / 'settings.json'
    descriptor = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as handle:
        json.dump({'api_key': key}, handle)
    path.chmod(0o600)
