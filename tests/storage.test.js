import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../app/storage.js';
import { recipe } from './fixtures.js';

test('Rezepte, Portionen und Häkchen bleiben nach Neustart erhalten; Löschen kaskadiert', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rezeptwerk-'));
  let storage = new Storage(directory, {});
  try {
    const id = storage.saveRecipe(recipe({ source_url: 'https://example.com/' }));
    storage.setPlan(id, 4);
    storage.check('test', true);
    storage.close();
    storage = new Storage(directory, {});
    assert.equal(storage.plan()[0].servings, 4);
    assert.deepEqual(storage.checked(), ['test']);
    assert.equal(storage.findSource('https://example.com/').id, id);
    storage.saveRecipe(recipe(), id);
    assert.deepEqual(storage.checked(), []);
    storage.deleteRecipe(id);
    assert.deepEqual(storage.plan(), []);
  } finally { storage.close(); rmSync(directory, { recursive: true }); }
});

test('Key-Datei ist privat; Umgebungs-Key hat Vorrang', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rezeptwerk-'));
  const env = {};
  const storage = new Storage(directory, env);
  try {
    storage.saveKey('sk-local');
    assert.equal(statSync(join(directory, 'settings.json')).mode & 0o777, 0o600);
    assert.equal(storage.settings().api_key, 'sk-local');
    env.OPENAI_API_KEY = 'sk-environment';
    assert.equal(storage.settings().api_key, 'sk-environment');
    storage.saveKey('');
    assert.equal(storage.settings().api_key, 'sk-environment');
  } finally { storage.close(); rmSync(directory, { recursive: true }); }
});
