import { it,expect,vi } from 'vitest';
import { normalizeUrl,publicAddress,extractSource,readWeb,transcriptSource,checkAllowed } from '../src/worker/source.js';
import { localEnv } from './fixtures.js';
it.each(['http://recipes.example/','file:///etc/passwd','https://user:pass@recipes.example/','https://127.0.0.1/','https://[::1]/','https://recipes.example:444/','https://recipes.example/?token=private'])('weist unsichere URL ab: %s',url=>expect(()=>normalizeUrl(url)).toThrow());
it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])('sperrt private/reservierte IP %s',ip=>expect(publicAddress(ip)).toBe(false));
it('erlaubt nur exakte Hosts, nicht ähnlich benannte Subdomains',()=>{
  const env=localEnv({} as D1Database);expect(()=>checkAllowed(normalizeUrl('https://recipes.example.evil.test'),env)).toThrow();
  expect(()=>checkAllowed(normalizeUrl('https://recipes.example'),env)).not.toThrow();
});
it('erkennt schema.org, ignoriert Skripte und löst HTML-Entities auf',()=>{
  const schema={'@graph':[{'@type':'Recipe',name:'Pasta',recipeIngredient:['200 g Tomaten']}]};
  expect(JSON.parse(extractSource(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`,'https://recipes.example').text).name).toBe('Pasta');
  expect(extractSource('<script>bad</script><p>Suppe &amp; Brot</p>','https://recipes.example').text).toBe('Suppe & Brot');
});
it('prüft jeden Redirect erneut und ruft interne/unerlaubte Ziele nicht ab',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('',{status:302,headers:{Location:'https://internal.example/'}}));
  await expect(readWeb('https://recipes.example',localEnv({} as D1Database),fetcher as typeof fetch)).rejects.toMatchObject({code:'SOURCE_NOT_ALLOWED'});
  expect(fetcher.mock.calls.some(c=>String(c[0]).includes('https://internal.example'))).toBe(false);
});
it('YouTube nur als ausdrücklich autorisiertes begrenztes Transkript',()=>{
  expect(()=>transcriptSource('https://youtu.be/abcdefghijk','x'.repeat(100),false,60)).toThrow();
  expect(()=>transcriptSource('https://youtu.be/abcdefghijk','x'.repeat(100),true,1201)).toThrow();
  expect(transcriptSource('https://youtu.be/abcdefghijk','x'.repeat(100),true,60).url).toBe('https://www.youtube.com/watch?v=abcdefghijk');
});
