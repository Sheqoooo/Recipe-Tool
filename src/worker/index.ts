import type { Env } from "./env.js";
import type { Source,Generated,Member,AppState } from '../shared/types.js';
import { AppError } from '../shared/errors.js';
import { recipeSchema,validateRecipe,shoppingList } from '../shared/recipe.js';
import { Repository } from './db.js';
import { authenticate,verifyIdentity } from './auth.js';
import { normalizeUrl,isYouTube,youtubeUrl,readWeb,transcriptSource } from './source.js';
import { generateRecipe,reservationCost } from './openai.js';

const security={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
function json(body:unknown,status=200):Response{return Response.json(body,{status,headers:security});}
function id(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)throw new AppError('INVALID_ID','Ungültige Rezept-ID.');return value;}
async function body(request:Request):Promise<Record<string,unknown>>{
  if(!/^application\/json(;|$)/i.test(request.headers.get('Content-Type')||''))throw new AppError('JSON_REQUIRED','JSON-Eingabe erwartet.',415);
  const reader=request.body?.getReader();if(!reader)throw new AppError('JSON_REQUIRED','Die Eingabe ist leer.');
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const value=await reader.read();if(value.done)break;size+=value.value.byteLength;if(size>100000)throw new AppError('REQUEST_LIMIT','Die Eingabe ist zu groß.',413);chunks.push(value.value);}}
  finally{await reader.cancel().catch(()=>{});}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  try{const result=JSON.parse(new TextDecoder().decode(data));if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();return result as Record<string,unknown>;}
  catch{throw new AppError('INVALID_JSON','Die Eingabe ist ungültig.');}
}
function assertWrite(request:Request):void{
  if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('X-Rezeptwerk-Request')!=='1'||request.headers.get('Sec-Fetch-Site')==='cross-site') {
    throw new AppError('ORIGIN','Schreibzugriffe müssen aus der eigenen Anwendung kommen.',403);
  }
}
function admin(actor:Member):void{if(actor.role!=='admin')throw new AppError('FORBIDDEN','Nur Administratoren dürfen diese Aktion ausführen.',403);}
export interface Dependencies {
  generate?:(source:Source,env:Env,id:string)=>Promise<Generated>;
  read?:(url:string,env:Env)=>Promise<Source>;
}
export function createApp(deps:Dependencies={}){
  return {async fetch(request:Request,env:Env):Promise<Response>{
    try{
      const url=new URL(request.url),path=url.pathname;
      if(env.APP_ENV==='production'&&(!env.APP_ORIGIN||!env.APP_ORIGIN.startsWith('https://')))throw new AppError('HOST_CONFIGURATION','Die produktive App-Adresse ist noch nicht eingerichtet.',503);
      if(env.APP_ENV!=='local'&&env.APP_ORIGIN&&url.origin!==env.APP_ORIGIN&&env.APP_ENV!=='preview')throw new AppError('HOST','Ungültige App-Adresse.',403);
      // Authentication runs before every asset AND API response.
      if(env.APP_ENV==='preview'){
        const identity=await verifyIdentity(request,env);
        if(env.DB||env.OPENAI_API_KEY||env.BOOTSTRAP_ADMIN_EMAILS)throw new AppError('PREVIEW_ISOLATION','Die Vorschau ist wegen unsicherer Ressourcenbindung gesperrt.',503);
        if(request.method!=='GET')throw new AppError('PREVIEW_READ_ONLY','Diese Vorschau ist schreibgeschützt.',403);
        if(path==='/api/state')return json({recipes:[],plan:[],shopping:[],checked:[],members:[],imports:[],has_key:false,read_only:true,user:{id:identity.sub,email:identity.email,role:'member',active:1}} satisfies AppState);
        if(path.startsWith('/api/'))throw new AppError('NOT_FOUND','Nicht gefunden.',404);
        return protect(await env.ASSETS.fetch(request));
      }
      if(!env.DB)throw new AppError('DB_CONFIGURATION','Die Datenbank ist noch nicht eingerichtet.',503);
      const repo=new Repository(env.DB),actor=await authenticate(request,env,repo);
      if(request.method==='GET'){
        if(path==='/api/state'){
          const recipes=await repo.recipes(actor),plan=await repo.plan(recipes);
          return json({recipes,plan,shopping:shoppingList(plan),checked:await repo.checked(),user:actor,
            members:actor.role==='admin'?await repo.members():[],imports:await repo.history(actor),has_key:Boolean(env.OPENAI_API_KEY),read_only:false} satisfies AppState);
        }
        if(path.startsWith('/api/'))throw new AppError('NOT_FOUND','Nicht gefunden.',404);
        return protect(await env.ASSETS.fetch(request));
      }
      if(request.method!=='POST')throw new AppError('METHOD','Methode nicht erlaubt.',405);
      assertWrite(request);const data=await body(request);
      if(path==='/api/import'){
        const url=normalizeUrl(data.value);
        let source:Source|undefined;
        if(isYouTube(url)){
          if(!data.transcript)throw new AppError('TRANSCRIPT_REQUIRED','Für YouTube ein rechtmäßig bereitgestelltes Transkript hinzufügen.',422);
          source=transcriptSource(data.value,data.transcript,data.authorized,data.duration_seconds);
        }else if(data.transcript)throw new AppError('INVALID_SOURCE','Transkriptimporte benötigen einen YouTube-Link.');
        const canonical=source?.url||url.href;
        const existing=await repo.bySource(canonical);if(existing)return json({id:existing.id,existing:true});
        if(!env.OPENAI_API_KEY)throw new AppError('AI_CONFIGURATION','Der Administrator muss OPENAI_API_KEY als Worker Secret hinterlegen.',503);
        const importId=await repo.reserve(actor,{url:canonical,kind:source?.kind||'web'},env,reservationCost(env));
        try{
          source||=await(deps.read||readWeb)(canonical,env);
          source.url=normalizeUrl(source.url).href;
          const generated=await(deps.generate||generateRecipe)(source,env,importId);
          const recipe=validateRecipe(generated.recipe);
          const recipeId=await repo.save(recipe,actor,source,importId,generated.usage);
          return json({id:recipeId,existing:false},201);
        }catch(error){await repo.fail(importId,error instanceof AppError?error.code:'IMPORT_FAILED',error instanceof AppError?error.usage:undefined);throw error;}
      }
      if(path==='/api/recipes/save'){
        const recipe=Object.fromEntries(Object.keys(recipeSchema.shape).map(key=>[key,data[key]]));
        await repo.edit(id(data.id),id(data.revision),validateRecipe(recipe),actor);return json({id:data.id});
      }
      if(path==='/api/recipes/delete'){await repo.delete(id(data.id),actor);return json({ok:true});}
      if(path==='/api/plan'){await repo.setPlan(id(data.recipe_id),data.servings,data.remove===true);return json({ok:true});}
      if(path==='/api/shopping/check'){
        if(typeof data.key!=='string'||data.key.length>8000||typeof data.checked!=='boolean')throw new AppError('INVALID_ITEM','Ungültige Einkaufsposition.');
        if(!shoppingList(await repo.plan(await repo.recipes(actor))).some(i=>i.key===data.key))throw new AppError('STALE_ITEM','Die Einkaufsliste hat sich geändert. Bitte neu laden.',409);
        await repo.check(data.key,data.checked);return json({ok:true});
      }
      if(path==='/api/members'){
        admin(actor);if(typeof data.email!=='string'||data.email.length>254||!/^\S+@\S+\.\S+$/.test(data.email)||!['admin','member'].includes(String(data.role)))throw new AppError('INVALID_MEMBER','E-Mail und Rolle prüfen.');
        await repo.invite(data.email.trim().toLowerCase(),data.role as 'admin'|'member');return json({ok:true});
      }
      if(path==='/api/members/update'){
        admin(actor);if(typeof data.id!=='string'||![0,1].includes(Number(data.active))||typeof data.active!=='number'||(data.role!==undefined&&!['admin','member'].includes(String(data.role))))throw new AppError('INVALID_MEMBER','Mitgliedsangaben prüfen.');
        await repo.updateMember(data.id,data.active,data.role as 'admin'|'member'|undefined,actor);return json({ok:true});
      }
      throw new AppError('NOT_FOUND','Nicht gefunden.',404);
    }catch(error){return json({error:error instanceof AppError?error.message:'Ein interner Fehler ist aufgetreten.',code:error instanceof AppError?error.code:'INTERNAL'},error instanceof AppError?error.status:500);}
  }};
}
function protect(response:Response):Response{
  const result=new Response(response.body,response);for(const[k,v]of Object.entries(security))result.headers.set(k,v);return result;
}
export default createApp();
