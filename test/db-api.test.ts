import { env } from 'cloudflare:workers';
import { beforeEach,it,expect,vi } from 'vitest';
import { Repository } from '../src/worker/db.js';
import { createApp } from '../src/worker/index.js';
import { AppError } from '../src/shared/errors.js';
import { recipe,generated,localEnv } from './fixtures.js';
import type { AppState,Member } from '../src/shared/types.js';
import { generateKeyPair,exportJWK,SignJWT } from 'jose';

beforeEach(async()=>{await env.DB.batch(['DELETE FROM shopping_items','DELETE FROM imports','DELETE FROM checked_items','DELETE FROM plan','DELETE FROM steps','DELETE FROM ingredients','DELETE FROM recipes','DELETE FROM members'].map(s=>env.DB.prepare(s)));});
const actor=(id:string,role:'admin'|'member'='member'):Member=>({id,email:id+'@example.invalid',role,active:1});
async function seed(member:Member){await env.DB.prepare('INSERT INTO members(id,email,role) VALUES(?,?,?)').bind(member.id,member.email,member.role).run();}
function appFixture(){const config=localEnv(env.DB);const read=vi.fn(async(url:string)=>({kind:'web' as const,url,text:'Untrusted source'}));const generate=vi.fn(async()=>structuredClone(generated));const app=createApp({read,generate});
  const get=()=>app.fetch(new Request('http://localhost/api/state'),config);
  const post=(path:string,data:unknown,origin='http://localhost')=>app.fetch(new Request('http://localhost'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify(data)}),config);
  return {config,app,read,generate,get,post};
}
it('Webimport speichert direkt; gemeinsame Sammlung und Korrektur funktionieren',async()=>{
 const app=appFixture(),response=await app.post('/api/import',{value:'https://recipes.example/pasta'});expect(response.status).toBe(201);
 const {id}=await response.json() as {id:number};let state=await(await app.get()).json() as AppState;
 expect(state.recipes[0].ingredients[0].amount).toBe(200);expect(JSON.stringify(state)).not.toContain('Untrusted source');
 expect((await app.post('/api/recipes/save',{...state.recipes[0],title:'Korrigierte Pasta'})).status).toBe(200);
 state=await(await app.get()).json() as AppState;expect(state.recipes[0].title).toBe('Korrigierte Pasta');
 expect((await app.post('/api/recipes/delete',{id})).status).toBe(200);expect((await(await app.get()).json() as AppState).recipes).toHaveLength(0);
});
it('bekannte Quelle verursacht keine zweite KI-Anfrage',async()=>{const app=appFixture();await app.post('/api/import',{value:'https://recipes.example/pasta'});expect((await app.post('/api/import',{value:'https://recipes.example/pasta#zutaten'})).status).toBe(200);expect(app.generate).toHaveBeenCalledTimes(1);});
it('fehlender Key, falsche Origin und ungültige Mengen verursachen keine KI-Kosten',async()=>{
  const app=appFixture();app.config.OPENAI_API_KEY=undefined;expect((await app.post('/api/import',{value:'https://recipes.example/pasta'})).status).toBe(503);expect((await app.post('/api/import',{value:'https://recipes.example/pasta'},'https://evil.example')).status).toBe(403);expect(app.generate).not.toHaveBeenCalled();
});
it('Importfehler werden ohne Rohdaten protokolliert und behalten Kostenreservierung',async()=>{
  const app=appFixture();app.generate.mockRejectedValue(new AppError('AI_RATE_LIMIT','Momentan nicht verfügbar',503));
  expect((await app.post('/api/import',{value:'https://recipes.example/pasta'})).status).toBe(503);const state=await(await app.get()).json() as AppState;
  expect(state.recipes).toHaveLength(0);expect(state.imports[0].error_code).toBe('AI_RATE_LIMIT');expect((await env.DB.prepare('SELECT reserved_cost_microusd FROM imports').first<{reserved_cost_microusd:number}>())!.reserved_cost_microusd).toBeGreaterThan(0);
});
it('Mitglied darf eigene Rezepte, aber nicht fremde bearbeiten oder löschen',async()=>{
  const repo=new Repository(env.DB),owner=actor('owner'),other=actor('other');await seed(owner);await seed(other);
  const source={url:'https://recipes.example/pasta',kind:'web' as const};const config=localEnv(env.DB);const job=await repo.reserve(owner,source,config,50000);const id=await repo.save(recipe,owner,source,job,generated.usage);
  await expect(repo.edit(id,1,{...recipe,title:'Fremd'},other)).rejects.toMatchObject({status:403});await expect(repo.delete(id,owner)).rejects.toMatchObject({status:403});
  await repo.edit(id,1,{...recipe,title:'Eigenes Rezept'},owner);expect((await repo.byId(id))!.title).toBe('Eigenes Rezept');
  await expect(repo.edit(id,1,{...recipe,title:'Veraltet'},owner)).rejects.toMatchObject({code:'EDIT_CONFLICT'});expect((await repo.recipes(owner))[0].ingredients).toHaveLength(1);
});
it('atomare D1-Grenzen schützen vor parallelen Anfragen und Budgetüberschreitung',async()=>{
  const repo=new Repository(env.DB),member=actor('member');await seed(member);const config={...localEnv(env.DB),MAX_PARALLEL_IMPORTS:'1',DAILY_BUDGET_MICROUSD:'50000'};
  const results=await Promise.allSettled([repo.reserve(member,{url:'https://recipes.example/a',kind:'web'},config,50000),repo.reserve(member,{url:'https://recipes.example/b',kind:'web'},config,50000)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const row=await env.DB.prepare('SELECT id FROM imports').first<{id:string}>();await repo.fail(row!.id,'TEST_FAILED');
  await expect(repo.reserve(member,{url:'https://recipes.example/c',kind:'web'},config,50000)).rejects.toMatchObject({status:429});
});
it('gesperrte/nicht eingeladene Identitäten werden abgewiesen',async()=>{
  const repo=new Repository(env.DB);await expect(repo.admit('unknown@example.invalid','subject',[])).rejects.toMatchObject({status:403});await seed({...actor('member'),active:0});await env.DB.prepare('UPDATE members SET active=0').run();await expect(repo.admit('member@example.invalid','subject',[])).rejects.toMatchObject({status:403});
});
it('Assets und API werden vor Auslieferung authentifiziert',async()=>{
  const app=appFixture();app.config.APP_ENV='production';app.config.AUTH_MODE='access';app.config.APP_ORIGIN='https://app.example';app.config.ACCESS_ISSUER='https://recipe-test.cloudflareaccess.com';app.config.ACCESS_AUD='test';
  const asset=vi.fn(async()=>new Response('private'));app.config.ASSETS={fetch:asset} as Fetcher;
  for(const path of ['/','/app.js','/style.css','/api/state','/api/import','/api/recipes/1/image','/recipes/','/shopping/','/shopping.webmanifest','/icons/shopping-180.png'])expect((await app.app.fetch(new Request('https://app.example'+path),app.config)).status).toBe(401);
  expect(asset).not.toHaveBeenCalled();expect(app.generate).not.toHaveBeenCalled();
});
it('abgelaufene Import-Lease kann keine späte Speicherung verursachen',async()=>{
  const repo=new Repository(env.DB),owner=actor('owner');await seed(owner);const source={url:'https://recipes.example/late',kind:'web' as const};
  const job=await repo.reserve(owner,source,localEnv(env.DB),50000);await env.DB.prepare('UPDATE imports SET lease_expires_at=0 WHERE id=?').bind(job).run();
  await expect(repo.save(recipe,owner,source,job,generated.usage)).rejects.toThrow();expect(await repo.bySource(source.url)).toBeNull();
});
it('Mitgliederverwaltung ist Admin-only und kann eigenen Adminzugang nicht sperren',async()=>{
  const app=appFixture();await app.get();const state=await(await app.get()).json() as AppState;
  expect((await app.post('/api/members',{email:'new@example.invalid',role:'member'})).status).toBe(200);
  expect((await app.post('/api/members/update',{id:state.user.id,active:0})).status).toBe(403);
  const repo=new Repository(env.DB);await expect(repo.updateMember(state.user.id,0,undefined,actor('normal'))).rejects.toMatchObject({status:403});
});
it('signierte Preview bleibt ohne DB/KI lesbar, aber Schreibzugriffe und unsichere Bindings sind gesperrt',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='preview';
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL)=>{
    if(String(url)==='https://preview-tests.cloudflareaccess.com/cdn-cgi/access/certs')return Response.json({keys:[jwk]});
    throw new Error('Network disabled');
  }));
  const token=await new SignJWT({email:'reviewer@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'preview'}).setSubject('reviewer').setIssuer('https://preview-tests.cloudflareaccess.com').setAudience('preview-aud').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const config={...localEnv(env.DB),APP_ENV:'preview' as const,AUTH_MODE:'access' as const,DB:undefined,OPENAI_API_KEY:undefined,ACCESS_ISSUER:'https://preview-tests.cloudflareaccess.com',ACCESS_AUD:'preview-aud'};
  const app=createApp(),headers={'Cf-Access-Jwt-Assertion':token};
  expect((await app.fetch(new Request('https://preview.example/api/state',{headers}),config)).status).toBe(200);
  expect((await app.fetch(new Request('https://preview.example/api/import',{method:'POST',headers}),config)).status).toBe(403);
  for(const key of ['BRING_EMAIL','BRING_PASSWORD','BRING_CLIENT_KEY'])expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,[key]:'test-placeholder'})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,DB:env.DB})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,OPENAI_API_KEY:'test-placeholder'})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,BOOTSTRAP_ADMIN_EMAILS:'admin@example.invalid'})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,VIDEO_ANALYSIS_ENABLED:'true'})).status).toBe(503);
});
it.each(['access_token','apikey','X-Amz-Signature','%2561ccess_token'])('sensible Import-URLs erreichen weder Abruf, KI noch Importhistorie: %s',async key=>{
  const app=appFixture();const response=await app.post('/api/import',{value:'https://recipes.example/pasta?'+key+'=DO_NOT_EXPOSE'});
  expect(response.status).toBe(400);expect(await response.text()).not.toContain('DO_NOT_EXPOSE');
  expect(app.read).not.toHaveBeenCalled();expect(app.generate).not.toHaveBeenCalled();
  const state=await(await app.get()).json() as AppState;expect(state.imports).toHaveLength(0);expect(state.recipes).toHaveLength(0);
});
it('Repository lehnt sensible Quell-URLs auch bei direkter Nutzung ab',async()=>{
  const repo=new Repository(env.DB),owner=actor('owner');await seed(owner);
  const source={url:'https://recipes.example/pasta',kind:'web' as const};
  const unsafe={...source,url:source.url+'?apikey=DO_NOT_EXPOSE'};
  await expect(repo.reserve(owner,unsafe,localEnv(env.DB),100)).rejects.toMatchObject({code:'PRIVATE_URL'});
  const job=await repo.reserve(owner,source,localEnv(env.DB),100);
  await expect(repo.save(recipe,owner,unsafe,job,generated.usage)).rejects.toMatchObject({code:'PRIVATE_URL'});
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM recipes').first('n')).toBe(0);
  expect((await repo.history(owner))[0].source_url).toBe(source.url);
});
it('historisch gespeicherte sensible Quell-URLs werden in Sammlung und Historie nicht ausgegeben',async()=>{
  const app=appFixture();await app.post('/api/import',{value:'https://recipes.example/pasta'});
  const unsafe='https://recipes.example/pasta?X-Amz-Signature=DO_NOT_EXPOSE';
  await env.DB.batch([env.DB.prepare('UPDATE recipes SET source_url=?').bind(unsafe),env.DB.prepare('UPDATE imports SET source_url=?').bind(unsafe)]);
  const response=await app.get(),state=await response.json() as AppState;
  expect(state.recipes[0].source_url).toBe('');expect(state.imports[0].source_url).toBe('');expect(JSON.stringify(state)).not.toContain('DO_NOT_EXPOSE');
  // Reading redacts the API output, but never silently mutates historical production data.
  expect(await env.DB.prepare('SELECT source_url FROM recipes').first('source_url')).toBe(unsafe);
});
it('ein Adapter kann vor dem KI-Aufruf keine sensible Quell-URL einschleusen',async()=>{
  const app=appFixture();app.read.mockImplementation(async()=>({kind:'web',url:'https://recipes.example/?access_token=DO_NOT_EXPOSE',text:'source'}));
  const response=await app.post('/api/import',{value:'https://recipes.example/pasta'});
  expect(response.status).toBe(400);expect(app.generate).not.toHaveBeenCalled();expect(await response.text()).not.toContain('DO_NOT_EXPOSE');
  expect(JSON.stringify((await(await app.get()).json() as AppState).imports)).not.toContain('DO_NOT_EXPOSE');
});
it('große Sammlungen laden nur Details der gewählten 500 Rezepte mit stabiler Reihenfolge',async()=>{
  const owner=actor('owner');await seed(owner);
  await env.DB.batch([
    env.DB.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<505) INSERT INTO recipes(id,owner_id,title,source_url,source_kind,created_at) SELECT i,?,printf('Rezept %d',i),printf('https://recipes.example/%d',i),'web','2026-01-01' FROM n").bind(owner.id),
    env.DB.prepare("INSERT INTO ingredients SELECT id,0,title,1,'g','' FROM recipes"),
    env.DB.prepare("INSERT INTO steps SELECT id,0,title,'[0]' FROM recipes"),
  ]);
  let counts:number[]=[];
  const db={prepare:(sql:string)=>env.DB.prepare(sql),batch:async(statements:D1PreparedStatement[])=>{const result=await env.DB.batch(statements);counts=result.map(r=>r.results.length);return result;}} as unknown as D1Database;
  const recipes=await new Repository(db).recipes(owner);
  expect(counts).toEqual([500,500,500,0]);expect(recipes).toHaveLength(500);
  expect(recipes[0].id).toBe(505);expect(recipes[499].id).toBe(6);
  expect(recipes[0].ingredients[0].name).toBe('Rezept 505');expect(recipes[499].steps[0].text).toBe('Rezept 6');
  const plan=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT id FROM recipes ORDER BY created_at DESC,id DESC LIMIT 500').all<{detail:string}>();
  expect(plan.results.some(row=>row.detail.includes('recipes_listing'))).toBe(true);
});

it('Rezeptbilder werden separat gespeichert, authentifiziert ausgeliefert und mit dem Rezept gelöscht',async()=>{
  const f=appFixture();
  const app=createApp({read:async(url)=>({kind:'web',url,text:'Recipe',image:{url:'https://images.example/food.png',credit:'Foto: Test'}}),generate:async()=>structuredClone(generated),
    image:async()=>({bytes:new Uint8Array([1,2,3]).buffer,mime:'image/png',original_url:'https://images.example/food.png',credit:'Foto: Test'})});
  const response=await app.fetch(new Request('http://localhost/api/import',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({value:'https://recipes.example/photo'})}),f.config);
  expect(response.status).toBe(201);const {id}=await response.json() as {id:number};
  const state=await(await app.fetch(new Request('http://localhost/api/state'),f.config)).json() as AppState;
  expect(state.recipes[0].image).toEqual({url:'/api/recipes/'+id+'/image',source_url:'https://recipes.example/photo',credit:'Foto: Test'});
  expect(JSON.stringify(state)).not.toContain('https://images.example');
  const picture=await app.fetch(new Request('http://localhost/api/recipes/'+id+'/image'),f.config);
  expect(picture.status).toBe(200);expect(picture.headers.get('Content-Type')).toBe('image/png');expect(picture.headers.get('Cache-Control')).toContain('private');
  expect([...new Uint8Array(await picture.arrayBuffer())]).toEqual([1,2,3]);
  await f.post('/api/recipes/delete',{id});expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM recipe_images').first('n')).toBe(0);
});
it('fehlerhafter Bildabruf verhindert keinen erfolgreichen Rezeptimport',async()=>{
  const f=appFixture();const image=vi.fn(async()=>{throw new Error('Private details');});
  const app=createApp({read:async(url)=>({kind:'web',url,text:'Recipe',image:{url:'https://images.example/food.png',credit:''}}),generate:async()=>structuredClone(generated),image});
  const response=await app.fetch(new Request('http://localhost/api/import',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({value:'https://recipes.example/no-photo'})}),f.config);
  expect(response.status).toBe(201);expect(await response.text()).not.toContain('Private details');expect(image).toHaveBeenCalledTimes(1);
});

it('importiert autorisierten Videotext aller Plattformen ohne Seitenabruf und speichert keine Rohdaten',async()=>{
 const f=appFixture();const response=await f.post('/api/import',{value:'https://www.instagram.com/reel/mock/',transcript:'Zutaten: 200 g Tomaten. Zehn Minuten kochen und servieren.',authorized:true,duration_seconds:60});
 expect(response.status).toBe(201);expect(f.read).not.toHaveBeenCalled();expect(f.generate).toHaveBeenCalledTimes(1);
 expect(f.generate.mock.calls[0][0]).toMatchObject({provenance:'provided_text',kind:'web'});
 const state=await(await f.get()).json() as AppState;expect(JSON.stringify(state)).not.toContain('Zehn Minuten kochen und servieren.');expect(state.recipes[0].source_url).toBe('https://www.instagram.com/reel/mock/');
});
it('reserviert das zusätzliche Videobudget atomar und lässt höchstens eine Videoanalyse zu',async()=>{
 const repo=new Repository(env.DB),owner=actor('owner');await seed(owner);const config=localEnv(env.DB);
 const one=await repo.reserve(owner,{kind:'web',url:'https://www.instagram.com/reel/one/'},config,50000);
 const two=await repo.reserve(owner,{kind:'web',url:'https://www.instagram.com/reel/two/'},config,50000);
 const results=await Promise.allSettled([repo.reserveVideoBudget(one,config,239000),repo.reserveVideoBudget(two,config,239000)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const rows=await env.DB.prepare('SELECT reserved_cost_microusd FROM imports ORDER BY reserved_cost_microusd').all<{reserved_cost_microusd:number}>();
 expect(rows.results.map(r=>r.reserved_cost_microusd)).toEqual([50000,239000]);
});
it('Kostenlimit verhindert den Video-KI-Aufruf und speichert keine Medien-Rohdaten',async()=>{
 const generateVideo=vi.fn(async()=>structuredClone(generated));
 const app=createApp({read:async url=>({kind:'web',url,text:'Public caption',provenance:'public_video',video:{bytes:new Uint8Array([1,2,3]),duration:50}}),generateVideo});
 const config={...localEnv(env.DB),DAILY_BUDGET_MICROUSD:'200000'};
 const request=()=>new Request('http://localhost/api/import',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({value:'https://www.instagram.com/reel/test/'})});
 expect((await app.fetch(request(),config)).status).toBe(429);expect(generateVideo).not.toHaveBeenCalled();
 expect(await env.DB.prepare('SELECT COUNT(*) FROM recipes').first('COUNT(*)')).toBe(0);
 config.DAILY_BUDGET_MICROUSD='2000000';expect((await app.fetch(request(),config)).status).toBe(201);
 const response=await app.fetch(new Request('http://localhost/api/state'),config),text=await response.text();
 expect(text).not.toContain('Public caption');expect(text).not.toContain('"bytes"');expect(text).not.toContain('"video"');expect(generateVideo).toHaveBeenCalledTimes(1);
});
it('ein ausgewähltes Videostandbild wird mit dem importierten Rezept gespeichert',async()=>{
 const f=appFixture();const image={bytes:new Uint8Array([1,2,3]).buffer,mime:'image/jpeg' as const,original_url:'https://www.instagram.com/reel/photo/',credit:'Standbild aus dem Originalvideo'};
 const app=createApp({read:async url=>({kind:'web',url,text:'public video',provenance:'public_video'}),generateVideo:async()=>({...structuredClone(generated),image})});
 const response=await app.fetch(new Request('http://localhost/api/import',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({value:image.original_url})}),f.config);
 expect(response.status).toBe(201);const state=await(await app.fetch(new Request('http://localhost/api/state'),f.config)).json() as AppState;
 expect(state.recipes[0].image).toMatchObject({credit:image.credit,source_url:image.original_url});expect(await env.DB.prepare('SELECT original_url FROM recipe_images').first('original_url')).toBe(image.original_url);
});
it('ergänzt ein fehlendes Videobild ohne erneute Rezept-KI und ersetzt vorhandene Bilder nicht',async()=>{
 const f=appFixture();const value='https://www.instagram.com/reel/existing/';const {id}=await(await f.post('/api/import',{value})).json() as {id:number};
 const readVideo=vi.fn(async url=>({kind:'web' as const,url,text:'Only public video',provenance:'public_video' as const}));
 const image={bytes:new Uint8Array([1,2,3]).buffer,mime:'image/jpeg' as const,original_url:value,credit:'Standbild aus dem Originalvideo'};
 const videoImage=vi.fn(async()=>image),generate=vi.fn();const app=createApp({readVideo,videoImage,generate});
 const config={...f.config,VIDEO_ANALYSIS_ENABLED:'true',MEDIA:{} as NonNullable<typeof f.config.MEDIA>,OPENAI_API_KEY:undefined};
 const post=(origin='http://localhost')=>app.fetch(new Request('http://localhost/api/recipes/video-image',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({recipe_id:id})}),config);
 expect((await post('https://evil.example')).status).toBe(403);expect(readVideo).not.toHaveBeenCalled();
 expect((await post()).status).toBe(200);expect((await post()).status).toBe(200);expect(readVideo).toHaveBeenCalledTimes(1);expect(videoImage).toHaveBeenCalledTimes(1);expect(generate).not.toHaveBeenCalled();
 expect(await env.DB.prepare('SELECT COUNT(*) FROM recipes').first('COUNT(*)')).toBe(1);
 const state=await(await app.fetch(new Request('http://localhost/api/state'),config)).json() as AppState;
 expect(state.recipes[0].image?.credit).toBe(image.credit);expect(JSON.stringify(state)).not.toContain('Only public video');
 const job=await env.DB.prepare("SELECT model,estimated_cost_microusd FROM imports WHERE model='cloudflare-media-frame'").first<{model:string;estimated_cost_microusd:number}>();expect(job?.estimated_cost_microusd).toBe(0);
});
it('Videobilder respektieren Besitzerrechte und behalten bestehende Bilder',async()=>{
 const repo=new Repository(env.DB),owner=actor('owner'),other=actor('other');await seed(owner);await seed(other);
 const source={kind:'web' as const,url:'https://www.instagram.com/reel/owned/'},config=localEnv(env.DB);
 const job=await repo.reserve(owner,source,config,100),id=await repo.save(recipe,owner,source,job,generated.usage);
 const image={bytes:new Uint8Array([1]).buffer,mime:'image/jpeg' as const,original_url:source.url,credit:'Original'};
 const imageJob=await repo.reserve(owner,source,config,100);
 await expect(repo.addVideoImage(id,other,image,imageJob)).rejects.toMatchObject({code:'FORBIDDEN'});expect(await repo.hasImage(id)).toBe(false);
 await repo.addVideoImage(id,owner,image,imageJob);expect(await repo.hasImage(id)).toBe(true);
});
it('reiner Beschreibungsimport ergänzt ein frühes Videobild ohne weitere Rezept-KI',async()=>{
 const f=appFixture(),value='https://www.instagram.com/reel/caption/';
 const generate=vi.fn(async()=>structuredClone(generated)),readVideo=vi.fn(async url=>({kind:'web' as const,url,text:'public',provenance:'public_video' as const}));
 const videoImage=vi.fn(async()=>({bytes:new Uint8Array([1,2,3]).buffer,mime:'image/jpeg' as const,original_url:value,credit:'Standbild aus dem Originalvideo'}));
 const app=createApp({read:async url=>({kind:'web',url,text:'complete recipe caption',provenance:'description'}),generate,readVideo,videoImage});
 const config={...f.config,VIDEO_ANALYSIS_ENABLED:'true',MEDIA:{} as NonNullable<typeof f.config.MEDIA>};
 const response=await app.fetch(new Request('http://localhost/api/import',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify({value})}),config);
 expect(response.status).toBe(201);expect(generate).toHaveBeenCalledTimes(1);expect(readVideo).toHaveBeenCalledTimes(1);expect(videoImage).toHaveBeenCalledTimes(1);
 const state=await(await app.fetch(new Request('http://localhost/api/state'),config)).json() as AppState;expect(state.recipes[0].image).not.toBeNull();
});
it('Original und gewünschte Variante sind getrennt und identische Wünsche werden dedupliziert',async()=>{
 const f=appFixture(),value='https://recipes.example/adapt',adaptation='Hackfleisch durch Halloumi ersetzen';
 await f.post('/api/import',{value});const original=(await(await f.get()).json() as AppState).recipes[0];
 f.generate.mockResolvedValue({...structuredClone(generated),recipe:{...recipe,title:'Halloumi-Pfanne',ingredients:[{name:'Halloumi',amount:200,unit:'g',note:''}],steps:[{text:'Halloumi (200 g) würfeln und goldbraun anbraten.',ingredient_indices:[0]}]}});
 expect((await f.post('/api/import',{value,adaptation})).status).toBe(201);
 expect(f.generate.mock.calls[1][0].adaptation).toBe(adaptation);
 expect((await f.post('/api/import',{value,adaptation:'  Hackfleisch\n durch Halloumi ersetzen  '})).status).toBe(200);
 const normal=await(await f.post('/api/import',{value})).json() as {id:number};expect(normal.id).toBe(original.id);expect(f.generate).toHaveBeenCalledTimes(2);
 const state=await(await f.get()).json() as AppState;expect(state.recipes).toHaveLength(2);expect(state.recipes.find(r=>r.id===original.id)?.title).toBe(original.title);
 const variant=state.recipes.find(r=>r.id!==original.id)!;expect(variant.warnings[0]).toContain(adaptation);
 await f.post('/api/recipes/save',{...variant,warnings:[]});const saved=(await(await f.get()).json() as AppState).recipes.find(r=>r.id===variant.id)!;expect(saved.warnings[0]).toContain(adaptation);
});
it('eine zuerst importierte Variante wird später nicht als Original zurückgegeben',async()=>{
 const f=appFixture(),value='https://recipes.example/variant-first';await f.post('/api/import',{value,adaptation:'Vegetarisch anpassen'});
 expect((await f.post('/api/import',{value})).status).toBe(201);expect(f.generate).toHaveBeenCalledTimes(2);
});
it('ungültige Anpassung wird vor Abruf, Reservierung und KI abgewiesen',async()=>{
 const f=appFixture();for(const adaptation of [{},'x'.repeat(401)])expect((await f.post('/api/import',{value:'https://recipes.example/a',adaptation})).status).toBe(400);
 expect(f.read).not.toHaveBeenCalled();expect(f.generate).not.toHaveBeenCalled();expect((await(await f.get()).json() as AppState).imports).toHaveLength(0);
});

it('bietet bei ungültiger Anmeldung eine eigenständige HTML-Seite, aber keine privaten Assets oder API-Daten',async()=>{
  const fixture=appFixture(),config={...fixture.config,APP_ENV:'production' as const,AUTH_MODE:'access' as const,APP_ORIGIN:'https://app.example',ACCESS_ISSUER:'https://recipe-test.cloudflareaccess.com',ACCESS_AUD:'test'};
  const asset=vi.fn(async()=>new Response('PRIVATE_ASSET'));config.ASSETS={fetch:asset} as Fetcher;
  for(const path of ['/','/recipes/','/shopping/']){
    const response=await fixture.app.fetch(new Request('https://app.example'+path,{headers:{Accept:'text/html'}}),config);
    expect(response.status).toBe(401);expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const html=await response.text();expect(html).toContain('Erneut anmelden');expect(html).toContain('href="/cdn-cgi/access/logout"');expect(html).toContain('charset="utf-8"');expect(html).not.toContain('PRIVATE_ASSET');expect(html).not.toContain('<script');
  }
  const response=await fixture.app.fetch(new Request('https://app.example/api/state',{headers:{Accept:'text/html'}}),config);
  expect(response.status).toBe(401);expect(response.headers.get('Content-Type')).toContain('application/json');
  expect(await response.json()).toMatchObject({code:'UNAUTHENTICATED'});
  expect(asset).not.toHaveBeenCalled();expect(fixture.generate).not.toHaveBeenCalled();
});

it('die aktive API lädt keine archivierten Einkaufsdaten und bietet keine alten Schreibwege',async()=>{
 const app=appFixture();await app.get();
 const state=await(await app.get()).json() as Record<string,unknown>;
 for(const key of ['shopping','plan','checked','manual_items'])expect(state).not.toHaveProperty(key);
 for(const path of ['/api/shopping/from-recipe','/api/shopping/items/save','/api/shopping/items/check','/api/shopping/items/delete','/api/shopping/check','/api/plan'])expect((await app.post(path,{})).status).toBe(404);
 expect(app.generate).not.toHaveBeenCalled();
 const old=await app.app.fetch(new Request('http://localhost/shopping/'),app.config);
 expect(old.status).toBe(302);expect(old.headers.get('Location')).toBe('http://localhost/recipes/#collection');
 for(const path of ['/catalog/search.json','/archive/shopping-list/web/app.ts','/shopping.webmanifest','/icons/shopping-bag-auto-180-v2.png'])expect((await app.app.fetch(new Request('http://localhost'+path),app.config)).status).toBe(404);
});
it('Sammlungszugriff liest keine alten Listen-Tabellen',async()=>{
 const app=appFixture();await app.get();
 const prepare=vi.spyOn(env.DB,'prepare');await app.get();
 expect(prepare.mock.calls.map(([sql])=>sql).join('\n')).not.toMatch(/\b(shopping_items|checked_items|plan)\b/);
 prepare.mockRestore();
});
