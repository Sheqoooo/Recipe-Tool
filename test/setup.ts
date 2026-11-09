import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeAll,afterEach,vi } from 'vitest';
beforeAll(async()=>{
  await applyD1Migrations(env.DB,env.TEST_MIGRATIONS);
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Network disabled in tests');}));
});
afterEach(()=>vi.clearAllMocks());
