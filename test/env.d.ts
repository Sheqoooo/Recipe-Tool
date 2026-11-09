import type { Env as WorkerEnv } from '../src/shared/types.js';
declare module 'cloudflare:workers' {
  interface ProvidedEnv extends WorkerEnv {DB:D1Database;TEST_MIGRATIONS:{name:string;queries:string[]}[]}
}
