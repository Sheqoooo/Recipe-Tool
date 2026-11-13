import type { Env } from "./env.js";
import type { Source,Generated,Member,AppState,RecipeImageData } from '../shared/types.js';
import { AppError } from '../shared/errors.js';
import { recipeSchema,validateRecipe,shoppingList } from '../shared/recipe.js';
import { Repository } from './db.js';
import { authenticate,verifyIdentity } from './auth.js';
import { normalizeUrl,readWeb,transcriptSource } from './source.js';
import {videoPlatform,videoLink} from '../shared/video-platform.js';
import { generateRecipe,reservationCost } from './openai.js';
import {generateVideoRecipe,videoReservationCost} from './video-analysis.js';
import { fetchRecipeImage } from './image.js';

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
  image?:typeof fetchRecipeImage;
  generate?:(source:Source,env:Env,id:string)=>Promise<Generated>;
  generateVideo?:typeof generateVideoRecipe;
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
        if(env.DB||env.OPENAI_API_KEY||env.BOOTSTRAP_ADMIN_EMAILS||env.MEDIA||env.VIDEO_ANALYSIS_ENABLED==='true')throw new AppError('PREVIEW_ISOLATION','Die Vorschau ist wegen unsicherer Ressourcenbindung gesperrt.',503);
        if(request.method!=='GET')throw new AppError('PREVIEW_READ_ONLY','Diese Vorschau ist schreibgeschützt.',403);
        if(path==='/api/state')return json({recipes:[],plan:[],shopping:[],checked:[],members:[],imports:[],has_key:false,read_only:true,user:{id:identity.sub,email:identity.email,role:'member',active:1}} satisfies AppState);
        if(path.startsWith('/api/'))throw new AppError('NOT_FOUND','Nicht gefunden.',404);
        return protect(await env.ASSETS.fetch(request));
      }
      if(!env.DB)throw new AppError('DB_CONFIGURATION','Die Datenbank ist noch nicht eingerichtet.',503);
      const repo=new Repository(env.DB),actor=await authenticate(request,env,repo);
      if(request.method==='GET'){
        const imageMatch=path.match(/^\/api\/recipes\/([1-9][0-9]*)\/image$/);
        if(imageMatch){const image=await repo.image(id(Number(imageMatch[1])));if(!image)throw new AppError('NOT_FOUND','Kein Rezeptbild vorhanden.',404);return protect(new Response(new Uint8Array(image.content),{headers:{'Content-Type':image.mime_type}}));}
        if(path==='/api/state'){
          const recipes=await repo.recipes(actor),plan=await repo.plan(recipes);
          return json({recipes,plan,shopping:shoppingList(plan),manual_items:await repo.shoppingItems(),checked:await repo.checked(),user:actor,
            members:actor.role==='admin'?await repo.members():[],imports:await repo.history(actor),has_key:Boolean(env.OPENAI_API_KEY),read_only:false} satisfies AppState);
        }
        if(path.startsWith('/api/'))throw new AppError('NOT_FOUND','Nicht gefunden.',404);
        return protect(await env.ASSETS.fetch(request));
      }
      if(request.method!=='POST')throw new AppError('METHOD','Methode nicht erlaubt.',405);
      assertWrite(request);const data=await body(request);
      if(path==='/api/shopping/from-recipe'){await repo.recipeToShopping(id(data.recipe_id),data.ingredient_indices,actor);return json({ok:true});}
      if(path==='/api/shopping/items/save'){await repo.saveShoppingItem(data,actor);return json({ok:true});}
      if(path==='/api/shopping/items/check'){await repo.checkShoppingItem(data.id,data.checked);return json({ok:true});}
      if(path==='/api/shopping/items/delete'){await repo.deleteShoppingItem(data.id);return json({ok:true});}
      if(path==='/api/import'){
        const url=normalizeUrl(data.value),platform=videoPlatform(url);
        let canonical=url.href;if(platform){try{canonical=videoLink(data.value).href;}catch{throw new AppError('INVALID_VIDEO','Bitte einen gültigen Video-Link angeben.',422);}}
        if(data.media!==undefined)throw new AppError('INVALID_SOURCE','Video-Uploads werden nicht unterstützt.',422);
        let source:Source|undefined;
        if(data.transcript){if(!platform)throw new AppError('INVALID_SOURCE','Bereitgestellte Videotexte benötigen einen Video-Link.',422);source=transcriptSource(data.value,data.transcript,data.authorized,data.duration_seconds);}
        const existing=await repo.bySource(canonical);if(existing)return json({id:existing.id,existing:true});
        if(!env.OPENAI_API_KEY)throw new AppError('AI_CONFIGURATION','Der Administrator muss OPENAI_API_KEY als Worker Secret hinterlegen.',503);
        const importId=await repo.reserve(actor,{url:canonical,kind:source?.kind||'web'},env,reservationCost(env));
        try{
          source||=await(deps.read||readWeb)(canonical,env);
          source.url=normalizeUrl(source.url).href;
          if(source.provenance==='public_video')await repo.reserveVideoBudget(importId,env,videoReservationCost(env));
          const generated=source.provenance==='public_video'?await(deps.generateVideo||generateVideoRecipe)(source,env,importId):await(deps.generate||generateRecipe)(source,env,importId);
          const recipe=validateRecipe(generated.recipe);
          let image:RecipeImageData|undefined;
          if(source.kind==='web'&&source.image){try{image=await(deps.image||fetchRecipeImage)(source.image,env);}catch{/* An optional image must not discard a valid recipe. */}}
          const recipeId=await repo.save(recipe,actor,source,importId,generated.usage,image);
          return json({id:recipeId,existing:false},201);
        }catch(error){await repo.fail(importId,error instanceof AppError?error.code:'IMPORT_FAILED',error instanceof AppError?error.usage:undefined);if(platform&&error instanceof AppError&&['SOURCE_UNAVAILABLE','SOURCE_TYPE','SOURCE_EMPTY','NO_RECIPE'].includes(error.code))throw new AppError('VIDEO_SOURCE_REQUIRED','Das Rezept ist aus dem Video-Link nicht ausreichend auslesbar. Bitte Beschreibung oder Transkript bereitstellen.',422);throw error;}
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
