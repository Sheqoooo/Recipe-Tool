import { parse } from 'parse5';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { AppError } from './errors.js';

const MAX_BYTES = 2_000_000;

export function normalizeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new AppError('Bitte einen vollständigen Rezeptlink mit https:// eingeben.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) {
    throw new AppError('Bitte einen öffentlichen HTTP- oder HTTPS-Rezeptlink ohne Zugangsdaten eingeben.');
  }
  url.hash = '';
  return url;
}

export function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

export async function resolvePublic(url, resolver = lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try { addresses = await resolver(hostname, { all: true, verbatim: true }); }
  catch { throw new AppError('Die Rezeptseite ist nicht erreichbar.', 502); }
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw new AppError('Lokale und interne Adressen können nicht importiert werden.');
  }
  return addresses[0];
}

function requestPage(url, address) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      agent: false, autoSelectFamily: false,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Rezeptwerk/0.2 (personal recipe importer)',
        Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        resolve({ redirect: response.headers.location });
        response.destroy();
        return;
      }
      if (response.statusCode !== 200) {
        reject(new AppError(`Die Rezeptseite lässt sich nicht auslesen (HTTP ${response.statusCode}).`, 422));
        response.destroy(); return;
      }
      const type = response.headers['content-type'] || '';
      if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type)) {
        reject(new AppError('Dieser Link liefert keine Rezept-Webseite.')); response.destroy(); return;
      }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        reject(new AppError('Das Format dieser Rezeptseite wird noch nicht unterstützt.')); response.destroy(); return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          reject(new AppError('Diese Webseite ist zu groß für den Rezeptimport.')); response.destroy(); return;
        }
        chunks.push(chunk);
      });
      response.on('error', () => reject(new AppError('Die Verbindung zur Rezeptseite wurde unterbrochen.', 502)));
      response.on('end', () => {
        try {
          const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1] || 'utf-8';
          resolve({ html: new TextDecoder(charset).decode(Buffer.concat(chunks)) });
        } catch { reject(new AppError('Die Zeichenkodierung dieser Seite wird nicht unterstützt.')); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('timeout')), 20000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', () => reject(new AppError('Die Rezeptseite ist nicht erreichbar oder antwortet zu langsam.', 502)));
  });
}

export async function fetchPublicPage(value, { resolver = lookup, request = requestPage } = {}) {
  let url = normalizeUrl(value);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const address = await resolvePublic(url, resolver);
    const response = await request(url, address);
    if (response.html !== undefined) return response.html;
    if (!response.redirect) throw new AppError('Die Rezeptseite liefert eine ungültige Weiterleitung.');
    url = normalizeUrl(new URL(response.redirect, url).href);
  }
  throw new AppError('Die Rezeptseite leitet zu häufig weiter.');
}

function findRecipe(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 60) return null;
  if (!Array.isArray(value)) {
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('Recipe')) return value;
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      const found = findRecipe(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function extractSource(html, url) {
  const document = parse(html);
  const scripts = [];
  const visible = [];
  function walk(node, hidden = false) {
    if (node.tagName === 'script' && node.attrs?.some(a => a.name === 'type' && a.value.toLowerCase().trim() === 'application/ld+json')) {
      scripts.push((node.childNodes || []).map(child => child.value || '').join(''));
    }
    hidden ||= ['script', 'style', 'noscript', 'svg', 'nav', 'footer'].includes(node.tagName);
    if (!hidden && node.nodeName === '#text' && node.value.trim()) visible.push(node.value.trim());
    for (const child of node.childNodes || []) walk(child, hidden);
  }
  walk(document);
  let recipe = null;
  for (const script of scripts) {
    try { recipe = findRecipe(JSON.parse(script)); } catch { continue; }
    if (recipe) break;
  }
  let text = recipe ? JSON.stringify(recipe) : visible.join('\n');
  // Decode entities and strip markup from structured strings later in the model.
  if (!text.trim()) throw new AppError('Auf dieser Seite wurde kein Rezeptinhalt gefunden.', 422);
  if (text.length > 40000) throw new AppError('Die Seite enthält zu viel Text. Ein direkter Link zum einzelnen Rezept hilft.', 422);
  return { kind: 'url', url, text, recipe };
}

export async function readSource(value) {
  const url = normalizeUrl(value);
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    throw new AppError('Instagram- und Videoimporte folgen später. Aktuell werden Rezept-Webseiten unterstützt.', 422);
  }
  return extractSource(await fetchPublicPage(url.href), url.href);
}
