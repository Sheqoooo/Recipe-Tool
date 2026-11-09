// Only the local browser fixture uses these adapters. Production imports src/worker/index.ts.
import { createApp } from '../src/worker/index.js';
import { generated } from './fixtures.js';
export default createApp({
  read:async url=>({kind:'web',url,text:'Offline browser fixture'}),
  generate:async()=>structuredClone(generated),
});
