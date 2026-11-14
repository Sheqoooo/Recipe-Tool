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
  private headers:Record<string,string>={};
  constructor(private env:Env,private transport:typeof fetch=fetch){}
  private async request(path:string,init:RequestInit={},json=true):Promise<unknown>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await this.transport(API+path,{...init,headers:{...this.headers,...init.headers},redirect:'error',signal:controller.signal});
      if(!response.ok){
        await response.body?.cancel();
        if(response.status===401||response.status===403)throw new AppError('BRING_AUTH','Die Bring!-Verbindung konnte nicht bestätigt werden. Bitte den Administrator informieren.',503);
        if(response.status===429)throw new AppError('BRING_RATE_LIMIT','Bring! nimmt gerade keine weiteren Anfragen an. Bitte später erneut versuchen.',503);
        throw new AppError('BRING_UNAVAILABLE','Bring! ist gerade nicht erreichbar.',503);
      }
      if(!json){await response.body?.cancel();return undefined;}
      if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('response type');
      const reader=response.body?.getReader();if(!reader)throw new Error('empty');
      const chunks:Uint8Array[]=[];let size=0;
      try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)throw new Error('response limit');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
      const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(error){if(error instanceof AppError)throw error;throw new AppError('BRING_UNAVAILABLE','Die Bring!-Antwort konnte nicht sicher verarbeitet werden.',503);}
    finally{clearTimeout(timer);}
  }
  async login():Promise<void>{
    if(!bringEnabled(this.env)||this.env.APP_ENV==='preview')throw new AppError('BRING_CONFIGURATION','Bring! ist noch nicht eingerichtet.',503);
    // The upstream app client key is supplied as a Worker Secret, never embedded.
    const value=await this.request('v2/bringauth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:this.env.BRING_EMAIL!,password:this.env.BRING_PASSWORD!}).toString()});
    const result=authSchema.safeParse(value);if(!result.success)throw new AppError('BRING_AUTH','Die Bring!-Anmeldung konnte nicht bestätigt werden.',503);
    this.headers={'Authorization':'Bearer '+result.data.access_token,'X-BRING-USER-UUID':result.data.uuid,'X-BRING-PUBLIC-USER-UUID':result.data.publicUuid,'X-BRING-API-KEY':this.env.BRING_CLIENT_KEY!,'X-BRING-CLIENT':'android','X-BRING-APPLICATION':'bring','X-BRING-COUNTRY':'DE'};
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
