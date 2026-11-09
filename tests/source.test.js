import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSource, normalizeUrl, isPublicAddress, resolvePublic, fetchPublicPage, readSource } from '../app/source.js';

test('öffentliche URLs werden normalisiert; private Protokolle, Zugangsdaten und Ports gesperrt', () => {
  assert.equal(normalizeUrl('https://example.com/rezept#zutaten').href, 'https://example.com/rezept');
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'http://example.com:9999', 'kein link']) {
    assert.throws(() => normalizeUrl(url));
  }
});

test('private, reservierte, IPv6- und gemappte Adressen werden gesperrt', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', 'kein ip']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('93.184.216.34'), true);
});

test('gemischte DNS-Antworten mit internen IPs werden vollständig abgewiesen', async () => {
  await assert.rejects(resolvePublic(new URL('https://example.com'), async () => [
    { address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 },
  ]), /interne/);
});

test('jede Weiterleitung wird neu geprüft und die geprüfte Adresse übergeben', async () => {
  const visited = [];
  const resolver = async host => [{ address: host === 'internal.example' ? '127.0.0.1' : '93.184.216.34', family: 4 }];
  await assert.rejects(fetchPublicPage('https://example.com', { resolver, request: async (url, address) => {
    visited.push({ host: url.hostname, address });
    return { redirect: 'http://internal.example/secret' };
  } }), /interne/);
  assert.equal(visited.length, 1);
  assert.equal(visited[0].address.address, '93.184.216.34');
});

test('Redirect-Schleifen werden begrenzt', async () => {
  await assert.rejects(fetchPublicPage('https://example.com', {
    resolver: async () => [{ address: '93.184.216.34', family: 4 }], request: async () => ({ redirect: '/loop' }),
  }), /häufig/);
});

test('verschachtelte schema.org-Rezepte werden gegenüber Seiten-Navigation bevorzugt', () => {
  const document = { '@graph': [{ '@type': 'WebSite' }, { '@type': ['Thing', 'Recipe'], name: 'Pasta', recipeIngredient: ['200 g Tomaten'] }] };
  const source = extractSource(`<nav>Werbung</nav><script type="application/ld+json">${JSON.stringify(document)}</script><p>Andere Inhalte</p>`, 'https://example.com/');
  assert.equal(source.recipe.name, 'Pasta');
  assert.equal(JSON.parse(source.text).name, 'Pasta');
  assert.equal(source.url, 'https://example.com/');
});

test('sichtbarer Text dient als Fallback; Skripte und Styles bleiben draußen', () => {
  const source = extractSource('<script type="application/ld+json">broken</script><style>secret</style><h1>Suppe &amp; Brot</h1><p>200 g Tomaten</p>', 'https://example.com/');
  assert.equal(source.recipe, null);
  assert.match(source.text, /Suppe & Brot/);
  assert.doesNotMatch(source.text, /secret|broken/);
  assert.throws(() => extractSource('<script>empty</script>', 'https://example.com/'), /kein Rezeptinhalt/);
  assert.throws(() => extractSource('<p>' + 'a'.repeat(40001) + '</p>', 'https://example.com/'), /zu viel Text/);
});

test('Instagram bleibt ausdrücklich zurückgestellt', async () => {
  await assert.rejects(readSource('https://www.instagram.com/reel/test'), /folgen später/);
});
