import { it,expect,vi } from 'vitest';
import { normalizeUrl,publicAddress,extractSource,readWeb,transcriptSource,checkAllowed,checkDns } from '../src/worker/source.js';
import { localEnv } from './fixtures.js';
it.each(['http://recipes.example/','file:///etc/passwd','https://user:pass@recipes.example/','https://127.0.0.1/','https://[::1]/','https://recipes.example:444/','https://recipes.example/?token=private'])('weist unsichere URL ab: %s',url=>expect(()=>normalizeUrl(url)).toThrow());
it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])('sperrt private/reservierte IP %s',ip=>expect(publicAddress(ip)).toBe(false));
it('erlaubt nur exakte Hosts, nicht ähnlich benannte Subdomains',()=>{
  const env=localEnv({} as D1Database);expect(()=>checkAllowed(normalizeUrl('https://recipes.example.evil.test'),env)).toThrow();
  expect(()=>checkAllowed(normalizeUrl('https://recipes.example'),env)).not.toThrow();
});
it('erlaubt ohne optionale Hostliste unterschiedliche öffentliche Rezeptanbieter',()=>{
  const env={...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''};
  for(const value of ['https://new-recipes.example/soup','https://another.example/pasta','https://recipes.account.workers.dev/cake'])expect(()=>checkAllowed(normalizeUrl(value),env)).not.toThrow();
});
it.each(['https://recipes.local/','https://host.internal/','https://host.home.arpa/','https://test.cloudflareaccess.com/','https://app.example/'])('sperrt lokale, eigene und Anmeldeziele auch ohne Hostliste: %s',value=>{
  expect(()=>checkAllowed(normalizeUrl(value),{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:'',APP_ORIGIN:'https://app.example'})).toThrow();
});
it('folgt öffentlichen Redirects zu neuen Anbietern ohne vorherige Freigabe',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
    return url.startsWith('https://first.example')?new Response(null,{status:302,headers:{Location:'https://second.example/recipe'}}):new Response('<p>Ein Rezept mit 200 g Tomaten.</p>',{headers:{'content-type':'text/html'}});
  });
  expect((await readWeb('https://first.example/recipe',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},fetcher as typeof fetch)).text).toContain('200 g Tomaten');
  expect(fetcher.mock.calls.filter(c=>String(c[0]).includes('dns-query'))).toHaveLength(4);
});
it('sperrt einen auf private IP auflösenden Redirect vor dem Seitenabruf',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:url.includes('name=second.example')?'10.0.0.1':'93.184.216.34'}]});
    return new Response(null,{status:302,headers:{Location:'https://second.example/recipe'}});
  });
  await expect(readWeb('https://first.example/recipe',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},fetcher as typeof fetch)).rejects.toMatchObject({code:'SOURCE_PRIVATE'});
  expect(fetcher.mock.calls.some(c=>String(c[0]).startsWith('https://second.example/'))).toBe(false);
});
it('lehnt gemischte öffentliche/private DNS-Antworten sowie DNS-Redirects ab',async()=>{
  for(const response of [Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'},{type:28,data:'::1'}]}),new Response(null,{status:302,headers:{Location:'https://elsewhere.example/'}})]) {
    const fetcher=vi.fn(async()=>response.clone());
    await expect(checkDns('recipes.example',fetcher as typeof fetch)).rejects.toBeDefined();
    expect(fetcher.mock.calls).toHaveLength(2);
  }
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
