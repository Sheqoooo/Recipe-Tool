import {env} from 'cloudflare:workers';
import {beforeEach,it,expect,vi} from 'vitest';
import {BringClient,type BringItem} from '../src/worker/bring-client.js';
import {BringService} from '../src/worker/bring.js';
import {Repository} from '../src/worker/db.js';
import {createApp} from '../src/worker/index.js';
import {localEnv,recipe,generated} from './fixtures.js';
import type {Env} from '../src/worker/env.js';
import type {Member,AppState} from '../src/shared/types.js';
const listId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
const config=():Env=>({...localEnv(env.DB),BRING_EMAIL:'bring@example.invalid',BRING_PASSWORD:'TEST_PASSWORD_ONLY',BRING_CLIENT_KEY:'TEST_CLIENT_KEY_ONLY'});
const admin:Member={id:'bring-admin',email:'bring-admin@example.invalid',role:'admin',active:1};
const member:Member={id:'bring-member',email:'bring-member@example.invalid',role:'member',active:1};
const fake=()=>({login:vi.fn(async()=>{}),lists:vi.fn(async()=>[{id:listId,name:'Zuhause'}]),add:vi.fn(async(_listId:string,_items:BringItem[],_requestId:string)=>{})});
beforeEach(async()=>{
 await env.DB.batch(['DELETE FROM bring_requests','DELETE FROM bring_settings','DELETE FROM imports','DELETE FROM checked_items','DELETE FROM plan','DELETE FROM steps','DELETE FROM ingredients','DELETE FROM recipe_images','DELETE FROM recipes','DELETE FROM members'].map(s=>env.DB.prepare(s)));
 for(const m of [admin,member])await env.DB.prepare('INSERT INTO members(id,email,role) VALUES(?,?,?)').bind(m.id,m.email,m.role).run();
});
async function savedRecipe(){const repo=new Repository(env.DB),source={url:'https://recipes.example/bring',kind:'web' as const};const job=await repo.reserve(admin,source,config(),50000);return repo.save(recipe,admin,source,job,generated.usage);}
async function configured(){const client=fake(),service=new BringService(config(),env.DB,()=>client);await service.configure(admin,{list_id:listId});return {client,service};}
it('verbindet nur eigene Listen durch Admins und gibt Mitgliederstatus ohne Zugangsdaten aus',async()=>{
 const {client,service}=await configured();expect(await service.status()).toEqual({enabled:true,ready:true,list_name:'Zuhause',revision:1});
 await expect(service.configure(member,{list_id:listId})).rejects.toMatchObject({status:403});
 await expect(service.lists(member)).rejects.toMatchObject({status:403});
 await expect(service.configure(admin,{list_id:userId})).rejects.toMatchObject({code:'BRING_LIST'});
 expect(client.add).not.toHaveBeenCalled();
 expect(JSON.stringify(await service.status())).not.toMatch(/TEST_PASSWORD|TEST_CLIENT|11111111|bring@example/);
});
it('überträgt gespeicherte Zutaten samt Mengen einmal, auch bei parallelem Doppelklick',async()=>{
 const id=await savedRecipe(),{client,service}=await configured();
 const input={recipe_id:id,revision:1,target_revision:1};
 const results=await Promise.allSettled([service.send(member,input),service.send(admin,input)]);
 expect(results.filter(r=>r.status==='fulfilled').length).toBeGreaterThan(0);
 expect(client.add).toHaveBeenCalledTimes(1);
 expect(client.add.mock.calls[0]?.[1]).toEqual([{name:'Tomaten',quantity:'200 g'}]);
 const repeated=await service.send(member,input);expect(repeated.existing).toBe(true);expect(client.add).toHaveBeenCalledTimes(1);
});
it('unsicheres Schreibergebnis wird weder automatisch noch durch erneuten Klick wiederholt',async()=>{
 const id=await savedRecipe(),{client,service}=await configured();
 client.add.mockRejectedValue(new Error('TEST_PASSWORD_ONLY'));
 const input={recipe_id:id,revision:1,target_revision:1};
 await expect(service.send(member,input)).rejects.toMatchObject({code:'BRING_UNCERTAIN'});
 await expect(service.send(admin,input)).rejects.toMatchObject({code:'BRING_PENDING'});
 expect(client.add).toHaveBeenCalledTimes(1);
 expect((await env.DB.prepare("SELECT state FROM bring_requests WHERE kind='export'").first<{state:string}>())?.state).toBe('uncertain');
});
it('prüft Ziel- und Rezeptrevision vor externem Zugriff und sperrt veränderte Ziele',async()=>{
 const id=await savedRecipe(),{client,service}=await configured();client.login.mockClear();
 await expect(service.send(member,{recipe_id:id,revision:2,target_revision:1})).rejects.toMatchObject({code:'EDIT_CONFLICT'});
 await expect(service.send(member,{recipe_id:id,revision:1,target_revision:2})).rejects.toMatchObject({code:'BRING_CHANGED'});
 await expect(service.send(member,{recipe_id:id,revision:1,target_revision:1,list_id:userId})).rejects.toMatchObject({code:'BRING_INPUT'});
 expect(client.login).not.toHaveBeenCalled();expect(client.add).not.toHaveBeenCalled();
});
it('begrenzt Verbindungsanfragen persistent und entfernt keine Bring-Artikel',async()=>{
 const client=fake(),service=new BringService(config(),env.DB,()=>client);
 for(let i=0;i<5;i++)await service.lists(admin);
 await expect(service.lists(admin)).rejects.toMatchObject({status:429});
 expect(client.login).toHaveBeenCalledTimes(5);expect(client.add).not.toHaveBeenCalled();
});
it('fehlende Secrets deaktivieren Bring ohne Fremdanfragen; Preview ist gesperrt',async()=>{
 const client=fake(),service=new BringService(localEnv(env.DB),env.DB,()=>client);
 expect((await service.status()).enabled).toBe(false);await expect(service.lists(admin)).rejects.toMatchObject({code:'BRING_CONFIGURATION'});
 await expect(new BringService({...config(),APP_ENV:'preview'},env.DB,()=>client).send(member,{})).rejects.toMatchObject({code:'BRING_CONFIGURATION'});
 expect(client.login).not.toHaveBeenCalled();
});
it('Loginfehler vor dem Schreiben erlauben bewussten neuen Versuch, kein automatisches Retry',async()=>{
 const id=await savedRecipe(),{client,service}=await configured();client.login.mockRejectedValueOnce(new Error('mock-login-error'));
 const input={recipe_id:id,revision:1,target_revision:1};
 await expect(service.send(member,input)).rejects.toThrow();expect(client.add).not.toHaveBeenCalled();
 expect((await service.send(member,input)).ok).toBe(true);expect(client.add).toHaveBeenCalledTimes(1);
});
it('API erzwingt Origin, aktive Anmeldung und Adminrechte; Zustand enthält keine Bring-Secrets',async()=>{
 const client=fake(),cfg=config(),app=createApp({bring:()=>client});
 const get=()=>app.fetch(new Request('http://localhost/api/state'),cfg);
 const state=await(await get()).json() as AppState;expect(JSON.stringify(state)).not.toMatch(/TEST_PASSWORD|TEST_CLIENT_KEY|bring@example/);
 const post=(path:string,data:unknown,origin='http://localhost')=>app.fetch(new Request('http://localhost'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify(data)}),cfg);
 expect((await post('/api/bring/lists',{},'https://evil.example')).status).toBe(403);
 expect((await post('/api/bring/lists',{})).status).toBe(200);
 expect(client.add).not.toHaveBeenCalled();
});
it('Client verwendet feste HTTPS-Ziele, begrenzte Antworten und ein einziges Batch-PUT ohne Secrets-Ausgabe',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const transport=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   calls.push({url:String(url),init:init!});
   if(String(url).endsWith('/v2/bringauth'))return Response.json({uuid:userId,publicUuid:userId,access_token:'TEST_TOKEN_ONLY',token_type:'Bearer'});
   if(String(url).endsWith('/lists'))return Response.json({lists:[{listUuid:listId,name:'Zuhause'}]});
   return new Response(null,{status:204});
 });
 const client=new BringClient(config(),transport as typeof fetch);await client.login();expect(await client.lists()).toEqual([{id:listId,name:'Zuhause'}]);
 await client.add(listId,[{name:'Tomaten',quantity:'200 g'},{name:'Salz',quantity:'Menge offen'}],userId);
 expect(calls.every(c=>c.url.startsWith('https://api.getbring.com/rest/')&&c.init.redirect==='manual'&&new Headers(c.init.headers).get('Accept')==='application/json')).toBe(true);
 expect(calls[0].init.body).toContain('TEST_PASSWORD_ONLY');
 const put=calls.at(-1)!;expect(put.init.method).toBe('PUT');const changes=JSON.parse(String(put.init.body)).changes;
 expect(changes[0]).toMatchObject({itemId:'Tomaten',spec:'200 g',operation:'TO_PURCHASE'});
 expect(changes[0].uuid).not.toBe(changes[1].uuid);
 expect(String(put.init.body)).not.toMatch(/TEST_PASSWORD|TEST_CLIENT_KEY|TEST_TOKEN/);
});
it.each([401,403,429,500])('Client begrenzt Fehler %s und gibt keine Provider-Rohantwort aus',async status=>{
 const transport=vi.fn(async()=>new Response('TEST_PASSWORD_ONLY TEST_TOKEN_ONLY',{status}));
 const client=new BringClient(config(),transport as typeof fetch);
 try{await client.login();throw new Error('expected');}catch(error){expect(String(error)).not.toMatch(/TEST_PASSWORD|TEST_TOKEN/);}
 expect(transport).toHaveBeenCalledTimes(1);
});
it('Client lehnt fremde Redirects, übergroße und ungültige Antworten ohne Wiederholung ab',async()=>{
 for(const response of [new Response('',{status:302,headers:{Location:'https://evil.example'}}),new Response('x'.repeat(131073),{headers:{'Content-Type':'application/json'}}),Response.json({access_token:'TEST_TOKEN_ONLY'})]){
   const transport=vi.fn(async()=>response);await expect(new BringClient(config(),transport as typeof fetch).login()).rejects.toMatchObject({status:503});expect(transport).toHaveBeenCalledTimes(1);
 }
});

it('Client bricht langsame Anfragen ab und startet keinen neuen Versuch',async()=>{
 vi.useFakeTimers();
 try{
   const transport=vi.fn((_url:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
     init?.signal?.addEventListener('abort',()=>reject(new Error('TEST_TOKEN_ONLY')),{once:true});
   }));
   const operation=new BringClient(config(),transport as typeof fetch).login();
   const assertion=expect(operation).rejects.toMatchObject({code:'BRING_LOGIN_TIMEOUT',status:503});
   await vi.advanceTimersByTimeAsync(10001);await assertion;expect(transport).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers();}
});

it.each(['text/plain; charset=utf-8','Application/JSON; charset=UTF-8','application/problem+json',null])('verarbeitet gültiges streng validiertes JSON bei abweichender Kennzeichnung %s',async contentType=>{
 const transport=vi.fn(async(url:RequestInfo|URL)=>{
   const data=String(url).endsWith('/v2/bringauth')?{uuid:userId,publicUuid:userId,access_token:'TEST_TOKEN_ONLY',token_type:'Bearer'}:{lists:[{listUuid:listId,name:'Zuhause'}]};
   const response=new Response(new TextEncoder().encode(JSON.stringify(data)));
   if(contentType)response.headers.set('Content-Type',contentType);
   return response;
 });
 const client=new BringClient(config(),transport as typeof fetch);await client.login();
 expect(await client.lists()).toEqual([{id:listId,name:'Zuhause'}]);
 expect(transport).toHaveBeenCalledTimes(2);
});
it.each(['text/html','application/xml'])('lehnt %s selbst mit JSON-Inhalt ab',async type=>{
 const transport=vi.fn(async()=>new Response(JSON.stringify({uuid:userId}),{headers:{'Content-Type':type}}));
 await expect(new BringClient(config(),transport as typeof fetch).login()).rejects.toMatchObject({code:'BRING_LOGIN_FORMAT'});
 expect(transport).toHaveBeenCalledTimes(1);
});
it('unterscheidet Netzwerk-, Parse-, Größen- und Listenfehler ohne vertrauliche Rohdaten',async()=>{
 const cases=[
   {response:()=>new Response('TEST_TOKEN_ONLY',{headers:{'Content-Type':'text/plain'}}),code:'BRING_LOGIN_JSON'},
   {response:()=>new Response('TEST_TOKEN_ONLY'.repeat(12000),{headers:{'Content-Type':'text/plain'}}),code:'BRING_LOGIN_SIZE'},
   {response:()=>{throw new Error('TEST_PASSWORD_ONLY TEST_TOKEN_ONLY');},code:'BRING_LOGIN_NETWORK'}
 ];
 for(const test of cases){
   const transport=vi.fn(async()=>test.response());
   try{await new BringClient(config(),transport as typeof fetch).login();throw new Error('expected');}
   catch(error){expect(error).toMatchObject({code:test.code,status:503});expect(String(error)).not.toMatch(/TEST_TOKEN|TEST_PASSWORD/);}
 }
 const transport=vi.fn(async(url:RequestInfo|URL)=>String(url).endsWith('/v2/bringauth')?Response.json({uuid:userId,publicUuid:userId,access_token:'TEST_TOKEN_ONLY',token_type:'Bearer'}):new Response('<html>TEST_TOKEN_ONLY</html>',{headers:{'Content-Type':'text/html'}}));
 const client=new BringClient(config(),transport as typeof fetch);await client.login();
 await expect(client.lists()).rejects.toMatchObject({code:'BRING_LISTS_FORMAT'});
});
it('falsch kopierter Clientschlüssel verursacht vor jedem Fremdabruf einen sicheren Konfigurationsfehler',async()=>{
 for(const value of ['"TEST_CLIENT_KEY_ONLY"','bad\nkey']){
   const transport=vi.fn(async()=>Response.json({}));
   await expect(new BringClient({...config(),BRING_CLIENT_KEY:value},transport as typeof fetch).login()).rejects.toMatchObject({code:'BRING_CONFIGURATION'});
   expect(transport).not.toHaveBeenCalled();
 }
});

it('Text-Kennzeichnung umgeht weder Login-Schema noch Tokenprüfung',async()=>{
 const transport=vi.fn(async()=>new Response(JSON.stringify({uuid:userId,publicUuid:userId,access_token:'BAD\\nTOKEN',token_type:'Bearer'}),{headers:{'Content-Type':'text/plain'}}));
 await expect(new BringClient(config(),transport as typeof fetch).login()).rejects.toMatchObject({code:'BRING_AUTH'});
 expect(transport).toHaveBeenCalledTimes(1);
});

it('konstruiert Bring-Anfragen mit dem echten Workers-Request und blockiert Redirects ohne Folgeabruf',async()=>{
 const urls:string[]=[];
 const transport=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   // Native workerd Request construction catches unsupported redirect modes.
   const request=new Request(url,init);expect(request.redirect).toBe('manual');urls.push(request.url);
   return new Response(null,{status:302,headers:{Location:'https://untrusted.example/?token=TEST_TOKEN_ONLY'}});
 });
 try{await new BringClient(config(),transport as typeof fetch).login();throw new Error('expected');}
 catch(error){expect(error).toMatchObject({code:'BRING_LOGIN_REDIRECT'});expect(String(error)).not.toContain('TEST_TOKEN_ONLY');}
 expect(urls).toEqual(['https://api.getbring.com/rest/v2/bringauth']);
 expect(transport).toHaveBeenCalledTimes(1);
});
