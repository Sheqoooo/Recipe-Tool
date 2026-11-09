import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication, configuration } from '../server.js';
import { Storage } from '../app/storage.js';
import { recipe } from './fixtures.js';
const directory = mkdtempSync(join(tmpdir(), 'rezeptwerk-browser-'));
const server = createApplication({ storage: new Storage(directory, { OPENAI_API_KEY: 'sk-offline-test' }),
  config: configuration({}),
  readSource: async url => ({ kind: 'url', url, text: 'Testrezept: 200 g Tomaten für zwei Portionen.' }),
  prepareRecipe: async () => recipe(),
});
server.listen(8877, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.closeAllConnections();
  server.close(() => { rmSync(directory, { recursive: true }); process.exit(0); });
});
