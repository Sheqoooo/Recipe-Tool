import {z} from 'zod';
import {AppError} from '../shared/errors.js';
import type {BringList} from '../shared/types.js';
import type {Env} from './env.js';
const uuid=z.uuid();
const listsSchema=z.object({lists:z.array(z.object({listUuid:uuid,name:z.string().trim().min(1).max(100)})).max(100)});
const authSchema=z.object({uuid,publicUuid:uuid,access_token:z.string().min(1).max(8192).regex(/^[A-Za-z0-9._~-]+$/),token_type:z.literal('Bearer')});
const API='https://api.getbring.com/rest/';
export type BringItem={name:string;quantity:string};
export function bringEnabled(env:Env):boolean{return Boolean(env.BRING_EMAIL&&env.BRING_PASSWORD&&env.BRING_CLIENT_KEY);}
export class BringClient {
  private headers:Record<string,string>={'Accept':'application/json','Accept-Language':'de-DE'};
  constructor(private env:Env,private transport:typeof fetch=fetch){}
  private async request(path:string,init:RequestInit={},json=true):Promise<unknown>{
    const stage=path==='v2/bringauth'?'LOGIN':json?'LISTS':'WRITE';
    const action=stage==='LOGIN'?'bei der Anmeldung':stage==='LISTS'?'beim Laden der Listen':'beim Übertragen';
    const failure=(kind:string,message:string,status=503)=>new AppError('BRING_'+stage+'_'+kind,message+' (BRING_'+stage+'_'+kind+').',status);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const headers=new Headers(this.headers);new Headers(init.headers).forEach((value,key)=>headers.set(key,value));
      const response=await this.transport(API+path,{...init,headers,redirect:'manual',signal:controller.signal});
      if(!response.ok){
        await response.body?.cancel().catch(()=>{});
        if(response.status>=300&&response.status<400)throw failure('REDIRECT','Bring! hat '+action+' eine nicht erlaubte Weiterleitung geliefert');
        if(response.status===401||response.status===403||stage==='LOGIN'&&response.status===400)throw new AppError('BRING_AUTH','Die Bring!-Anmeldung wurde nicht bestätigt. Bitte Bring!-E-Mail, Bring!-Passwort und Clientschlüssel in Cloudflare prüfen.',503);
        if(response.status===429)throw new AppError('BRING_RATE_LIMIT','Bring! nimmt gerade keine weiteren Anfragen an. Bitte später erneut versuchen.',503);
        throw failure('HTTP','Bring! ist '+action+' gerade nicht verfügbar');
      }
      if(!json){await response.body?.cancel().catch(()=>{});return undefined;}
      const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
      // Allow legacy JSON labeled as plain text, but never accept HTML/XML;
      // size, JSON parsing and the endpoint schema remain mandatory.
      if(type&&!/^(application\/(?:[a-z0-9.+-]+\+)?json|text\/plain)$/.test(type)){
        await response.body?.cancel().catch(()=>{});
        throw failure('FORMAT','Bring! hat '+action+' kein unterstütztes Antwortformat geliefert');
      }
      const reader=response.body?.getReader();if(!reader)throw failure('EMPTY','Bring! hat '+action+' eine leere Antwort geliefert');
      const chunks:Uint8Array[]=[];let size=0;
      try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)throw failure('SIZE','Die Bring!-Antwort ist '+action+' zu groß');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
      const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
      try{return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));}
      catch{throw failure('JSON','Bring! hat '+action+' keine lesbaren JSON-Daten geliefert');}
    }catch(error){
      if(error instanceof AppError)throw error;
      if(controller.signal.aborted)throw failure('TIMEOUT','Bring! hat '+action+' nicht rechtzeitig geantwortet');
      throw failure('NETWORK','Die Verbindung zu Bring! wurde '+action+' unterbrochen. ');
    }finally{clearTimeout(timer);}
  }
  async login():Promise<void>{
    if(!bringEnabled(this.env)||this.env.APP_ENV==='preview')throw new AppError('BRING_CONFIGURATION','Bring! ist noch nicht eingerichtet.',503);
    const email=this.env.BRING_EMAIL!.trim(),clientKey=this.env.BRING_CLIENT_KEY!.trim();
    if(!email||!clientKey||!/^[\x21-\x7e]{1,256}$/.test(clientKey)||/["']/.test(clientKey))throw new AppError('BRING_CONFIGURATION','Bitte bei BRING_CLIENT_KEY nur den Schlüsselwert ohne Anführungszeichen oder Feldnamen eintragen.',503);
    // The upstream app client key is supplied as a Worker Secret, never embedded.
    const value=await this.request('v2/bringauth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password:this.env.BRING_PASSWORD!}).toString()});
    const result=authSchema.safeParse(value);if(!result.success)throw new AppError('BRING_AUTH','Die Bring!-Anmeldung konnte nicht bestätigt werden.',503);
    this.headers={'Accept':'application/json','Accept-Language':'de-DE','Authorization':'Bearer '+result.data.access_token,'X-BRING-USER-UUID':result.data.uuid,'X-BRING-PUBLIC-USER-UUID':result.data.publicUuid,'X-BRING-API-KEY':clientKey,'X-BRING-CLIENT':'android','X-BRING-APPLICATION':'bring','X-BRING-COUNTRY':'DE'};
  }
  async lists():Promise<BringList[]>{
    const id=uuid.parse(this.headers['X-BRING-USER-UUID']);
    const result=listsSchema.safeParse(await this.request('bringusers/'+id+'/lists'));
    if(!result.success)throw new AppError('BRING_RESPONSE','Die Bring!-Listen konnten nicht gelesen werden.',503);
    return result.data.lists.map(l=>({id:l.listUuid,name:l.name}));
  }
  async add(listId:string,items:BringItem[],requestId:string):Promise<void>{
    if(!uuid.safeParse(listId).success||!uuid.safeParse(requestId).success||!items.length||items.length>200)throw new AppError('BRING_INPUT','Ungültige Bring!-Übertragung.');
    // One batch only. Never retry a write whose outcome may be ambiguous.
    await this.request('v2/bringlists/'+listId+'/items',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:items.map((i,n)=>({itemId:i.name,spec:i.quantity,uuid:stableItemUuid(requestId,n),operation:'TO_PURCHASE',accuracy:'0.0',altitude:'0.0',latitude:'0.0',longitude:'0.0'})),sender:''})},false);
  }
}
function stableItemUuid(requestId:string,index:number):string{
  // Request IDs are random UUIDs; each item gets a distinct stable suffix.
  return requestId.slice(0,-4)+index.toString(16).padStart(4,'0');
}
