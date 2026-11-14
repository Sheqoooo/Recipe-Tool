import {z} from 'zod';
import {AppError} from '../shared/errors.js';
import type {Member,BringStatus,BringExportResult} from '../shared/types.js';
import {shoppingEntriesFromIngredients} from '../shared/shopping-entry.js';
import type {Env} from './env.js';
import {BringClient,bringEnabled} from './bring-client.js';
import {Repository} from './db.js';
type Settings={list_id:string;list_name:string;revision:number};
type Job={id:string;state:string;item_count:number;list_name:string};
export type BringFactory=(env:Env)=>Pick<BringClient,'login'|'lists'|'add'>;
export class BringService {
  constructor(private env:Env,private db:D1Database,private factory:BringFactory=env=>new BringClient(env)){}
  private async settings():Promise<Settings|null>{
    try{return await this.db.prepare('SELECT list_id,list_name,revision FROM bring_settings WHERE id=1').first<Settings>();}
    catch{throw new AppError('BRING_SCHEMA','Bring! benötigt noch die freigegebene Datenbank-Erweiterung 0006.',503);}
  }
  async status():Promise<BringStatus>{
    if(!bringEnabled(this.env))return {enabled:false,ready:false,list_name:null,revision:0};
    let settings:Settings|null;try{settings=await this.settings();}catch(error){if(error instanceof AppError&&error.code==='BRING_SCHEMA')return {enabled:true,ready:false,list_name:null,revision:0,setup_required:true};throw error;}
    return {enabled:true,ready:Boolean(settings),list_name:settings?.list_name??null,revision:settings?.revision??0};
  }
  private async reserve(actor:Member,kind:'lists'|'configure'|'export',key:string|null,count=0,listName=''):Promise<{id:string;existing?:Job}>{
    const now=Math.floor(Date.now()/1000),id=crypto.randomUUID();
    await this.db.batch([
      this.db.prepare('DELETE FROM bring_requests WHERE created_at<?').bind(now-7*86400),
      this.db.prepare('UPDATE bring_requests SET dedupe_key=NULL WHERE created_at<? AND dedupe_key IS NOT NULL').bind(now-600),
      this.db.prepare(`INSERT OR IGNORE INTO bring_requests(id,dedupe_key,actor_id,kind,state,created_at,item_count,list_name)
        SELECT ?,?,?,?,'running',?,?,? WHERE (SELECT COUNT(*) FROM bring_requests WHERE created_at>?)<5
        AND NOT EXISTS(SELECT 1 FROM bring_requests WHERE state='running' AND created_at>?)`).bind(id,key,actor.id,kind,now,count,listName,now-60,now-60)
    ]);
    const own=await this.db.prepare('SELECT id FROM bring_requests WHERE id=?').bind(id).first();
    if(own)return {id};
    const existing=key?await this.db.prepare('SELECT id,state,item_count,list_name FROM bring_requests WHERE dedupe_key=?').bind(key).first<Job>():null;
    if(existing)return {id:existing.id,existing};
    throw new AppError('BRING_LIMIT','Die Bring!-Verbindung ist gerade beschäftigt. Bitte in einer Minute erneut versuchen.',429);
  }
  private async finish(id:string,state:'completed'|'failed'|'uncertain'){await this.db.prepare('UPDATE bring_requests SET state=? WHERE id=?').bind(state,id).run();}
  private enabled(){if(!bringEnabled(this.env)||this.env.APP_ENV==='preview')throw new AppError('BRING_CONFIGURATION','Bring! ist noch nicht eingerichtet.',503);}
  async lists(actor:Member){
    this.enabled();if(actor.role!=='admin')throw new AppError('FORBIDDEN','Nur Administratoren dürfen die Bring!-Zielliste einrichten.',403);
    await this.settings();const job=await this.reserve(actor,'lists',null);
    try{const client=this.factory(this.env);await client.login();const lists=await client.lists();await this.finish(job.id,'completed');return {lists};}
    catch(error){await this.finish(job.id,'failed');throw error;}
  }
  async configure(actor:Member,input:unknown){
    this.enabled();if(actor.role!=='admin')throw new AppError('FORBIDDEN','Nur Administratoren dürfen die Bring!-Zielliste ändern.',403);
    const result=z.object({list_id:z.uuid()}).strict().safeParse(input);
    if(!result.success)throw new AppError('BRING_INPUT','Bitte eine gültige Bring!-Liste auswählen.');
    await this.settings();const job=await this.reserve(actor,'configure',null);
    try{
      const client=this.factory(this.env);await client.login();const list=(await client.lists()).find(l=>l.id===result.data.list_id);
      if(!list)throw new AppError('BRING_LIST','Diese Liste gehört nicht zur eingerichteten Bring!-Verbindung.',403);
      await this.db.prepare(`INSERT INTO bring_settings(id,list_id,list_name) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET list_id=excluded.list_id,list_name=excluded.list_name,revision=bring_settings.revision+1,updated_at=CURRENT_TIMESTAMP`).bind(list.id,list.name).run();
      await this.finish(job.id,'completed');return {ok:true};
    }catch(error){await this.finish(job.id,'failed');throw error;}
  }
  async send(actor:Member,input:unknown):Promise<BringExportResult>{
    this.enabled();
    const parsed=z.object({recipe_id:z.number().int().positive(),revision:z.number().int().positive(),target_revision:z.number().int().positive()}).strict().safeParse(input);
    if(!parsed.success)throw new AppError('BRING_INPUT','Bitte ein gespeichertes Rezept auswählen.');
    const settings=await this.settings();
    if(!settings)throw new AppError('BRING_CONFIGURATION','Bitte zuerst in den Einstellungen eine Bring!-Liste auswählen.',409);
    if(parsed.data.target_revision!==settings.revision)throw new AppError('BRING_CHANGED','Die Bring!-Zielliste wurde geändert. Bitte neu laden und erneut auswählen.',409);
    const recipe=await new Repository(this.db).byId(parsed.data.recipe_id);
    if(!recipe)throw new AppError('NOT_FOUND','Rezept nicht gefunden.',404);
    if(recipe.revision!==parsed.data.revision)throw new AppError('EDIT_CONFLICT','Das Rezept wurde geändert. Bitte neu laden.',409);
    const ingredients=(await this.db.prepare('SELECT name,amount,unit FROM ingredients WHERE recipe_id=? ORDER BY position LIMIT 201').bind(recipe.id).all<{name:string;amount:number|null;unit:string}>()).results;
    if(ingredients.length>200)throw new AppError('BRING_INPUT','Höchstens 200 Zutaten pro Übertragung.');
    const items=shoppingEntriesFromIngredients(ingredients);
    if(items.length>200)throw new AppError('BRING_INPUT','Höchstens 200 Zutaten pro Übertragung.');
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([settings.list_id,recipe.id,recipe.revision,items])));
    const key=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    const job=await this.reserve(actor,'export',key,items.length,settings.list_name);
    if(job.existing){
      if(job.existing.state==='completed')return {ok:true,existing:true,count:job.existing.item_count,list_name:job.existing.list_name};
      throw new AppError('BRING_PENDING','Diese Übertragung läuft oder ihr Ergebnis ist unklar. Bitte zuerst die Bring!-Liste prüfen; zehn Minuten lang wird nicht erneut gesendet.',409);
    }
    let writing=false;
    try{
      const client=this.factory(this.env);await client.login();
      if(!(await client.lists()).some(l=>l.id===settings.list_id))throw new AppError('BRING_LIST','Der Zugriff auf die Bring!-Zielliste ist nicht mehr möglich.',409);
      writing=true;await client.add(settings.list_id,items,job.id);await this.finish(job.id,'completed');
      return {ok:true,existing:false,count:items.length,list_name:settings.list_name};
    }catch(error){
      await this.finish(job.id,writing?'uncertain':'failed');
      if(writing)throw new AppError('BRING_UNCERTAIN','Bring! hat die Übertragung nicht bestätigt. Bitte die Bring!-Liste prüfen; zehn Minuten lang wird nicht erneut gesendet.',503);
      // Before any write was attempted it is safe to allow a later manual retry.
      await this.db.prepare('UPDATE bring_requests SET dedupe_key=NULL WHERE id=?').bind(job.id).run();
      throw error;
    }
  }
}
