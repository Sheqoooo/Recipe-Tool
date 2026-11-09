import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRecipe } from '../app/importer.js';
const source = { kind: 'url', url: 'https://example.com/rezept', text: 'Untrusted recipe source' };

test('KI-Aufruf verwendet festes Schema, store:false und liefert die Quelle mit', async () => {
  const result = await prepareRecipe(source, 'sk-test', { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer sk-test');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.messages[1].content, source.text);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ title: 'Suppe' }) } }] });
  } });
  assert.equal(result.title, 'Suppe');
  assert.equal(result.original_text, source.text);
});

test('ohne API-Key wird kein Modell aufgerufen', async () => {
  await assert.rejects(prepareRecipe(source, '', { fetchImpl: () => assert.fail('kein Aufruf') }), /API-Key/);
});

test('API-Fehler enthalten keine Anbieter-Antworten oder Geheimnisse', async () => {
  for (const status of [401, 429, 500]) {
    await assert.rejects(prepareRecipe(source, 'sk-secret', {
      fetchImpl: async () => new Response('secret error sk-secret', { status }),
    }), error => !error.message.includes('sk-secret') && error.status === 502);
  }
});

test('abgebrochene, verweigerte und ungültige KI-Antworten werden abgewiesen', async () => {
  for (const choice of [{ finish_reason: 'length', message: {} },
    { finish_reason: 'stop', message: { refusal: 'Nein' } },
    { finish_reason: 'stop', message: { content: 'not JSON' } },
    { finish_reason: 'stop', message: { content: 'null' } }]) {
    await assert.rejects(prepareRecipe(source, 'sk-test', { fetchImpl: async () => Response.json({ choices: [choice] }) }), /nichts gespeichert/);
  }
});
