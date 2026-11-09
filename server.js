import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { Storage } from './app/storage.js';
import { AppError } from './app/errors.js';
import { validateRecipe, shoppingList, servings } from './app/recipes.js';
import { readSource as defaultReadSource, normalizeUrl } from './app/source.js';
import { prepareRecipe as defaultPrepareRecipe } from './app/importer.js';

function equal(a, b) {
  const hash = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function configuration(env = process.env) {
  const host = env.HOST || '127.0.0.1';
  const port = Number(env.PORT || 8765);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT ist ungültig.');
  const password = env.APP_PASSWORD || '';
  let publicOrigin = null;
  if (env.APP_URL) {
    const url = new URL(env.APP_URL);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/') throw new Error('APP_URL muss eine vollständige Domain ohne Unterpfad sein.');
    publicOrigin = url.origin;
  }
  const exposed = !['127.0.0.1', 'localhost', '::1'].includes(host) || env.NODE_ENV === 'production';
  if (password && (password.length < 16 || password.includes(':'))) throw new Error('APP_PASSWORD muss mindestens 16 Zeichen lang sein und darf keinen Doppelpunkt enthalten.');
  if (exposed && (!publicOrigin?.startsWith('https://') || password.length < 16)) {
    throw new Error('Für Hosting sind APP_URL=https://… und APP_PASSWORD (mindestens 16 Zeichen) erforderlich.');
  }
  return { host, port, password, publicOrigin };
}

function jsonBody(request) {
  return new Promise((resolveBody, reject) => {
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
      request.resume(); reject(new AppError('JSON-Eingabe erwartet.', 415)); return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    request.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > 300000) { failed = true; chunks.length = 0; reject(new AppError('Die Eingabe ist zu groß.', 413)); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (failed) return;
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
        resolveBody(data);
      } catch { reject(new AppError('Die Eingabe ist kein gültiges JSON-Objekt.')); }
    });
    request.on('error', () => reject(new AppError('Die Anfrage wurde unterbrochen.')));
  });
}

function id(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new AppError('Ungültige Rezept-ID.');
  return value;
}

export function createApplication({ storage = new Storage(), config = configuration(),
  readSource = defaultReadSource, prepareRecipe = defaultPrepareRecipe } = {}) {
  const token = randomBytes(32).toString('base64url');
  const imports = new Map();
  const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
  const server = http.createServer(async (request, response) => {
    const send = (status, payload, type = 'application/json; charset=utf-8', extra = {}) => {
      const body = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
      response.writeHead(status, {
        'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        ...extra,
      });
      response.end(body);
    };
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      // Container health checks expose no user data and do not need credentials.
      if (path === '/health' && request.method === 'GET') return send(200, { ok: true });
      const host = request.headers.host;
      const localPort = server.address()?.port;
      const allowedHosts = config.publicOrigin ? [new URL(config.publicOrigin).host] : [`127.0.0.1:${localPort}`, `localhost:${localPort}`, `[::1]:${localPort}`];
      if (!allowedHosts.includes(host)) throw new AppError('Ungültiger Host.', 403);
      if (config.password) {
        const expected = `Basic ${Buffer.from(`rezeptwerk:${config.password}`).toString('base64')}`;
        if (!equal(request.headers.authorization || '', expected)) {
          request.resume();
          return send(401, { error: 'Bitte mit deinem Rezeptwerk-Passwort anmelden.' }, undefined,
            { 'WWW-Authenticate': 'Basic realm="Rezeptwerk", charset="UTF-8"' });
        }
      }
      if (request.method === 'GET') {
        if (path === '/api/state') {
          const settings = storage.settings();
          const plan = storage.plan();
          return send(200, { recipes: storage.recipes(), plan, shopping: shoppingList(plan), checked: storage.checked(),
            has_key: Boolean(settings.api_key), env_key: settings.env_key, token });
        }
        if (files.has(path)) {
          const [file, type] = files.get(path);
          return send(200, await readFile(new URL(`./static/${file}`, import.meta.url)), `${type}; charset=utf-8`);
        }
        throw new AppError('Nicht gefunden.', 404);
      }
      if (request.method !== 'POST') return send(405, { error: 'Methode nicht erlaubt.' }, undefined, { Allow: 'GET, POST' });
      if (!equal(request.headers['x-rezeptwerk-token'] || '', token)) throw new AppError('Bitte die Anwendung neu laden.', 403);
      const origin = config.publicOrigin || `http://${host}`;
      if (request.headers.origin && request.headers.origin !== origin) throw new AppError('Ungültiger Ursprung.', 403);
      const data = await jsonBody(request);
      if (path === '/api/import') {
        if (data.kind !== undefined && data.kind !== 'url') throw new AppError('Bitte einen Rezeptlink importieren.');
        const url = normalizeUrl(typeof data.value === 'string' ? data.value.trim() : '').href;
        const existing = storage.findSource(url);
        if (existing) return send(200, { id: existing.id, existing: true });
        const key = storage.settings().api_key;
        if (!key) throw new AppError('Bitte zuerst unter Einstellungen deinen OpenAI-API-Key hinterlegen.', 409);
        if (!imports.has(url)) {
          if (imports.size >= 2) throw new AppError('Es laufen bereits zwei Importe. Bitte kurz warten.', 429);
          const work = (async () => {
            const source = await readSource(url);
            const prepared = await prepareRecipe(source, key);
            // Trust only the actual source for provenance, not the model response.
            const recipe = validateRecipe({ ...prepared, source_url: url, source_kind: source.kind, original_text: source.text });
            return storage.saveRecipe(recipe);
          })();
          imports.set(url, work);
          work.finally(() => imports.delete(url)).catch(() => {});
        }
        const recipeId = await imports.get(url);
        return send(201, { id: recipeId, existing: false });
      }
      if (path === '/api/recipes/save') {
        // Only saved recipes may be corrected; there is no manual-create endpoint.
        const recipeId = id(data.id);
        const previous = storage.recipes().find(recipe => recipe.id === recipeId);
        if (!previous) throw new AppError('Das Rezept wurde nicht gefunden.', 404);
        const recipe = validateRecipe({ ...data, source_kind: previous.source_kind, original_text: previous.original_text });
        storage.saveRecipe(recipe, recipeId);
        return send(200, { id: recipeId });
      }
      if (path === '/api/recipes/delete') { storage.deleteRecipe(id(data.id)); return send(200, { ok: true }); }
      if (path === '/api/plan') {
        storage.setPlan(id(data.recipe_id), data.remove === true ? null : servings(data.servings), data.remove === true);
        return send(200, { ok: true });
      }
      if (path === '/api/shopping/check') {
        if (typeof data.key !== 'string' || data.key.length > 2000 || typeof data.checked !== 'boolean') throw new AppError('Ungültige Einkaufsposition.');
        if (!shoppingList(storage.plan()).some(item => item.key === data.key)) throw new AppError('Diese Einkaufsposition existiert nicht mehr.');
        storage.check(data.key, data.checked);
        return send(200, { ok: true });
      }
      if (path === '/api/settings') {
        if (storage.settings().env_key) throw new AppError('Der API-Key wird über das Hosting verwaltet.', 409);
        const key = typeof data.api_key === 'string' ? data.api_key.trim() : '';
        if (key && (!key.startsWith('sk-') || key.length > 500 || /\s/.test(key))) throw new AppError('Bitte einen gültigen OpenAI-API-Key eingeben.');
        storage.saveKey(key);
        return send(200, { ok: true });
      }
      throw new AppError('Nicht gefunden.', 404);
    } catch (error) {
      if (!response.headersSent) send(error instanceof AppError ? error.status : 500,
        { error: error instanceof AppError ? error.message : 'Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen.' });
    }
  });
  server.requestTimeout = 130000;
  server.headersTimeout = 15000;
  server.on('close', () => storage.close());
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const config = configuration();
  const server = createApplication({ config });
  server.listen(config.port, config.host, () => console.log(`Rezeptwerk läuft auf ${config.host}:${server.address().port}`));
  server.on('error', error => { console.error(`Start fehlgeschlagen (${error.code || 'Serverfehler'}).`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
