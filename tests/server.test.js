import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication, configuration } from '../server.js';
import { Storage } from '../app/storage.js';
import { AppError } from '../app/errors.js';
import { recipe } from './fixtures.js';

async function application(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'rezeptwerk-'));
  const storage = new Storage(directory, options.env ?? { OPENAI_API_KEY: 'sk-test' });
  const calls = { source: 0, model: 0 };
  const server = createApplication({ storage, config: options.config || configuration({ PORT: '0' }),
    readSource: options.readSource || (async url => { calls.source++; return { kind: 'url', url, text: 'Originaltext' }; }),
    prepareRecipe: options.prepareRecipe || (async () => { calls.model++; return recipe(); }),
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const state = async headers => (await fetch(base + '/api/state', { headers })).json();
  const token = options.config?.password ? null : (await state()).token;
  const post = async (path, body, headers = {}) => fetch(base + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Rezeptwerk-Token': token || '', ...headers }, body: JSON.stringify(body) });
  return { server, storage, base, state, post, token, calls };
}

test('Linkimport speichert direkt; Einkaufsliste skaliert; Korrektur und Löschen funktionieren', async t => {
  const app = await application(t);
  const response = await app.post('/api/import', { value: 'https://example.com/rezept' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  let state = await app.state();
  assert.equal(state.recipes.length, 1);
  assert.equal(state.recipes[0].original_text, 'Originaltext');
  assert.equal(state.recipes[0].source_url, 'https://example.com/rezept');
  assert.equal((await app.post('/api/plan', { recipe_id: saved.id, servings: 4 })).status, 200);
  state = await app.state();
  assert.equal(state.shopping[0].amount, 400);
  await app.post('/api/shopping/check', { key: state.shopping[0].key, checked: true });
  assert.equal((await app.state()).checked.length, 1);
  await app.post('/api/recipes/save', { ...state.recipes[0], title: 'Korrigierte Pasta' });
  state = await app.state();
  assert.equal(state.recipes[0].title, 'Korrigierte Pasta');
  assert.equal(state.checked.length, 0);
  await app.post('/api/recipes/delete', { id: saved.id });
  assert.deepEqual((await app.state()).shopping, []);
});

test('gleicher Link mit Fragment erzeugt keinen zweiten Datensatz oder KI-Aufruf', async t => {
  const app = await application(t);
  const first = await (await app.post('/api/import', { value: 'https://example.com/rezept' })).json();
  const second = await (await app.post('/api/import', { value: 'https://example.com/rezept#zutaten' })).json();
  assert.equal(second.id, first.id); assert.equal(second.existing, true);
  assert.equal(app.calls.model, 1); assert.equal(app.calls.source, 1);
});

test('gleichzeitige Importe desselben Links teilen einen KI-Aufruf', async t => {
  let calls = 0;
  const app = await application(t, { prepareRecipe: async () => {
    calls++; await new Promise(resolve => setTimeout(resolve, 30)); return recipe();
  } });
  const responses = await Promise.all([app.post('/api/import', { value: 'https://example.com/rezept' }), app.post('/api/import', { value: 'https://example.com/rezept' })]);
  assert.equal(calls, 1);
  const ids = await Promise.all(responses.map(async response => (await response.json()).id));
  assert.equal(ids[0], ids[1]);
  assert.equal((await app.state()).recipes.length, 1);
});

test('fehlender API-Key stoppt den Import bereits vor dem Abruf', async t => {
  const app = await application(t, { env: {} });
  assert.equal((await app.post('/api/import', { value: 'https://example.com/' })).status, 409);
  assert.equal(app.calls.source, 0);
  assert.deepEqual((await app.state()).recipes, []);
});

test('Abruf- und Modellfehler hinterlassen keine leeren Datensätze', async t => {
  for (const options of [
    { readSource: async () => { throw new AppError('Quelle blockiert', 422); } },
    { prepareRecipe: async () => { throw new AppError('KI nicht erreichbar', 502); } },
    { prepareRecipe: async () => ({ title: 'Kein Rezept', servings: 2, ingredients: [], steps: [] }) },
  ]) {
    const app = await application(t, options);
    assert.ok((await app.post('/api/import', { value: 'https://example.com/' })).status >= 400);
    assert.deepEqual((await app.state()).recipes, []);
  }
});

test('Textimport und manuelles Neuanlegen sind nicht verfügbar', async t => {
  const app = await application(t);
  assert.equal((await app.post('/api/import', { kind: 'text', value: 'Ein Rezept' })).status, 400);
  assert.equal((await app.post('/api/recipes/save', recipe())).status, 400);
  assert.deepEqual((await app.state()).recipes, []);
});

test('Sitzungstoken, Host- und Origin-Prüfung sperren fremde Schreibzugriffe', async t => {
  const app = await application(t);
  assert.equal((await app.post('/api/import', { value: 'https://example.com/' }, { 'X-Rezeptwerk-Token': '' })).status, 403);
  assert.equal((await app.post('/api/import', { value: 'https://example.com/' }, { Origin: 'https://evil.example' })).status, 403);
  // fetch normalizes Host, so use a raw HTTP client to exercise a foreign Host.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    http.get(app.base + '/api/state', { headers: { Host: 'evil.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal(app.calls.source, 0);
});

test('API-Key verlässt den Server nicht; Umgebungs-Key lässt sich nicht überschreiben', async t => {
  const app = await application(t);
  assert.equal(JSON.stringify(await app.state()).includes('sk-test'), false);
  assert.equal((await app.post('/api/settings', { api_key: 'sk-new' })).status, 409);
});

test('Passwort schützt Oberfläche und API, Healthcheck bleibt erreichbar', async t => {
  const password = 'langes-test-passwort';
  const app = await application(t, { config: configuration({ APP_PASSWORD: password }) });
  assert.equal((await fetch(app.base + '/')).status, 401);
  assert.equal((await fetch(app.base + '/api/state')).status, 401);
  const Authorization = 'Basic ' + Buffer.from(`rezeptwerk:${password}`).toString('base64');
  const state = await app.state({ Authorization });
  assert.equal(typeof state.token, 'string');
  assert.equal((await fetch(app.base + '/health')).status, 200);
});

test('öffentliches Hosting verweigert unsichere Konfiguration', () => {
  assert.throws(() => configuration({ HOST: '0.0.0.0' }), /Hosting/);
  assert.throws(() => configuration({ NODE_ENV: 'production', APP_URL: 'http://example.com', APP_PASSWORD: 'langes-test-passwort' }), /Hosting/);
  assert.throws(() => configuration({ APP_URL: 'https://example.com/unterpfad' }), /Unterpfad/);
  assert.throws(() => configuration({ APP_PASSWORD: 'kurz' }), /16 Zeichen/);
  assert.equal(configuration({ HOST: '0.0.0.0', APP_URL: 'https://example.com', APP_PASSWORD: 'langes-test-passwort' }).publicOrigin, 'https://example.com');
});

test('statische Dateien haben Sicherheitsheader; persönliche Dateien sind nicht abrufbar', async t => {
  const app = await application(t);
  const response = await fetch(app.base + '/');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await response.text();
  assert.doesNotMatch(html, /source-text|manual-create|data-mode=/);
  assert.equal((await fetch(app.base + '/data/settings.json')).status, 404);
  assert.equal((await fetch(app.base + '/.env')).status, 404);
});
