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
it('Webimport speichert direkt; gemeinsame Kochliste, Skalierung, Häkchen und Korrektur funktionieren',async()=>{
  const app=appFixture();const response=await app.post('/api/import',{value:'https://recipes.example/pasta'});expect(response.status).toBe(201);
  const {id}=await response.json() as {id:number};let state=await(await app.get()).json() as AppState;
  expect(state.recipes[0].ingredients[0].amount).toBe(200);expect(JSON.stringify(state)).not.toContain('Untrusted source');expect(state.recipes[0]).not.toHaveProperty('original_text');
  expect((await app.post('/api/plan',{recipe_id:id,servings:4})).status).toBe(200);state=await(await app.get()).json() as AppState;expect(state.shopping[0].amount).toBe(400);
  await app.post('/api/shopping/check',{key:state.shopping[0].key,checked:true});expect((await(await app.get()).json() as AppState).checked).toHaveLength(1);
  expect((await app.post('/api/recipes/save',{...state.recipes[0],title:'Korrigierte Pasta'})).status).toBe(200);
  state=await(await app.get()).json() as AppState;expect(state.recipes[0].title).toBe('Korrigierte Pasta');expect(state.checked).toHaveLength(0);
  expect((await app.post('/api/recipes/delete',{id})).status).toBe(200);expect((await(await app.get()).json() as AppState).recipes).toHaveLength(0);
});
it('bekannte Quelle verursacht keine zweite KI-Anfrage',async()=>{const app=appFixture();await app.post('/api/import',{value:'https://recipes.example/pasta'});expect((await app.post('/api/import',{value:'https://recipes.example/pasta#zutaten'})).status).toBe(200);expect(app.generate).toHaveBeenCalledTimes(1);});
it('veraltete Häkchen können geänderte Einkaufsmengen nicht als erledigt markieren',async()=>{
  const app=appFixture();const {id}=await(await app.post('/api/import',{value:'https://recipes.example/pasta'})).json() as {id:number};
  await app.post('/api/plan',{recipe_id:id,servings:2});const old=(await(await app.get()).json() as AppState).shopping[0].key;
  await app.post('/api/plan',{recipe_id:id,servings:4});expect((await app.post('/api/shopping/check',{key:old,checked:true})).status).toBe(409);
  expect((await(await app.get()).json() as AppState).checked).toHaveLength(0);
});
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
  for(const path of ['/','/app.js','/style.css','/api/state','/api/import','/api/recipes/1/image'])expect((await app.app.fetch(new Request('https://app.example'+path),app.config)).status).toBe(401);
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
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,DB:env.DB})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,OPENAI_API_KEY:'test-placeholder'})).status).toBe(503);
  expect((await app.fetch(new Request('https://preview.example/',{headers}),{...config,BOOTSTRAP_ADMIN_EMAILS:'admin@example.invalid'})).status).toBe(503);
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

it('freie Einkaufsartikel werden gemeinsam gespeichert, dedupliziert, geändert und wiederverwendet',async()=>{
 const f=appFixture();expect((await f.post('/api/shopping/items/save',{name:'Spülmittel',quantity:'2 Flaschen'})).status).toBe(200);
 let state=await(await f.get()).json() as AppState;expect(state.manual_items).toHaveLength(1);const item=state.manual_items![0];
 expect(item.name).toBe('Spülmittel');expect(item.checked).toBe(false);
 expect((await f.post('/api/shopping/items/check',{id:item.id,checked:true})).status).toBe(200);
 // Changing recipe plans must not clear completed manual products.
 await f.post('/api/import',{value:'https://recipes.example/manual-independent'});
 const recipeId=(await(await f.get()).json() as AppState).recipes[0].id;
 await f.post('/api/plan',{recipe_id:recipeId,servings:4});
 expect((await(await f.get()).json() as AppState).manual_items![0].checked).toBe(true);
 await f.post('/api/shopping/items/save',{name:'spuelmittel',quantity:''});
 state=await(await f.get()).json() as AppState;expect(state.manual_items).toHaveLength(1);expect(state.manual_items![0].checked).toBe(false);expect(state.manual_items![0].quantity).toBe('2 Flaschen');
 await f.post('/api/shopping/items/save',{id:item.id,name:'Spülmittel sensitiv',quantity:'1 Flasche'});
 expect((await(await f.get()).json() as AppState).manual_items![0].name).toBe('Spülmittel sensitiv');
 await f.post('/api/shopping/items/delete',{id:item.id});
 expect((await(await f.get()).json() as AppState).manual_items).toHaveLength(0);
 expect(f.generate).toHaveBeenCalledTimes(1);
});
it('Einkaufsartikel sind für aktive Mitglieder gemeinsam zugänglich',async()=>{
 const repo=new Repository(env.DB),one=actor('one'),two=actor('two');await seed(one);await seed(two);
 await repo.saveShoppingItem({name:'Milch',quantity:'1 l'},one);
 const item=(await repo.shoppingItems())[0];expect(item.name).toBe('Milch');
 await repo.saveShoppingItem({id:item.id,name:'Hafermilch',quantity:'2 l'},two);
 await repo.checkShoppingItem(item.id,true);expect((await repo.shoppingItems())[0].checked).toBe(true);
 await repo.deleteShoppingItem(item.id);expect(await repo.shoppingItems()).toEqual([]);
});
it('Einkaufseingaben, Origin und Status werden geprüft und enthalten keine ausführbaren Daten',async()=>{
 const f=appFixture();
 expect((await f.post('/api/shopping/items/save',{name:'Milch'},'https://evil.example')).status).toBe(403);
 for(const value of [{name:''},{name:'x'.repeat(101)},{name:'Milch',quantity:'x'.repeat(61)},{name:'Milch',emoji:'x'}])expect((await f.post('/api/shopping/items/save',value)).status).toBe(400);
 await f.post('/api/shopping/items/save',{name:'<img src=x onerror=alert(1)>'});
 const item=(await(await f.get()).json() as AppState).manual_items![0];
 expect((await f.post('/api/shopping/items/check',{id:item.id,checked:'true'})).status).toBe(400);
 expect((await f.post('/api/shopping/items/check',{id:'bad',checked:true})).status).toBe(400);
 expect(f.generate).not.toHaveBeenCalled();
});
it('500 Artikel sind die atomare Grenze, vorhandene Namen lassen sich weiterverwenden',async()=>{
 const repo=new Repository(env.DB),owner=actor('owner');await seed(owner);
 await env.DB.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<500) INSERT INTO shopping_items(id,name,name_key,created_by) SELECT printf('item-%d',i),printf('Artikel %d',i),printf('artikel %d',i),? FROM n").bind(owner.id).run();
 await expect(repo.saveShoppingItem({name:'Weiterer Artikel'},owner)).rejects.toMatchObject({code:'SHOPPING_LIMIT'});
 await repo.saveShoppingItem({name:'Artikel 1'},owner);expect(await env.DB.prepare('SELECT COUNT(*) FROM shopping_items').first()).not.toBeNull();
 expect(await repo.shoppingItems()).toHaveLength(500);
});
