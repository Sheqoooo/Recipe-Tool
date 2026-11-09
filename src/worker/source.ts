import type { Env } from "./env.js";
import { parse,type DefaultTreeAdapterMap } from 'parse5';
import ipaddr from 'ipaddr.js';
import { AppError } from '../shared/errors.js';
import type {  Source } from '../shared/types.js';

export const MAX_SOURCE_BYTES=20000;
export function normalizeUrl(value:unknown):URL {
  if(typeof value!=='string'||value.length>2000)throw new AppError('INVALID_URL','Bitte einen gültigen Rezeptlink angeben.');
  let url:URL;try{url=new URL(value);}catch{throw new AppError('INVALID_URL','Bitte einen vollständigen HTTPS-Link angeben.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||url.hostname.endsWith('.')||ipaddr.isValid(url.hostname.replace(/^\[|\]$/g,''))) {
    throw new AppError('INVALID_URL','Nur öffentliche HTTPS-Links ohne Zugangsdaten oder Sonderport sind erlaubt.');
  }
  if([...url.searchParams.keys()].some(k=>/^(token|key|api_key|auth|password|signature)$/i.test(k)))throw new AppError('PRIVATE_URL','Bitte keine Links mit Zugangsschlüsseln verwenden.');
  url.hash='';return url;
}
export function isYouTube(url:URL):boolean{return ['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname);}
export function youtubeUrl(value:unknown):URL {
  const url=normalizeUrl(value);
  const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
  if(!isYouTube(url)||!id||!/^[-\w]{11}$/.test(id))throw new AppError('INVALID_VIDEO','Bitte einen gültigen YouTube-Video-Link angeben.');
  return new URL('https://www.youtube.com/watch?v='+id);
}
export function publicAddress(ip:string):boolean{try{return ipaddr.process(ip).range()==='unicast';}catch{return false;}}
export async function limitedText(response:Response,limit:number):Promise<string>{
  if(!response.body)throw new AppError('SOURCE_EMPTY','Die Quelle ist leer.',422);
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
    if(size>limit)throw new AppError('SOURCE_TOO_LARGE','Der Inhalt überschreitet das Importlimit.',413);chunks.push(next.value);}}
  finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  const charset=response.headers.get('content-type')?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]||'utf-8';
  try{return new TextDecoder(charset).decode(bytes);}catch{throw new AppError('SOURCE_ENCODING','Die Zeichenkodierung ist nicht unterstützt.',422);}
}
export async function checkDns(host:string,fetcher:typeof fetch=fetch):Promise<void>{
  const records=await Promise.all(['A','AAAA'].map(async type=>{
    const response=await fetcher('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,
      {headers:{Accept:'application/dns-json'},redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new AppError('SOURCE_DNS','Die Quelladresse konnte nicht sicher geprüft werden.',502);
    const body=JSON.parse(await limitedText(response,16000)) as {Status:number;Answer?:{type:number;data:string}[]};
    if(body.Status!==0)throw new AppError('SOURCE_DNS','Die Quelladresse konnte nicht aufgelöst werden.',422);
    return (body.Answer||[]).filter(r=>r.type===1||r.type===28).map(r=>r.data);
  }));
  const all=records.flat();if(!all.length||all.some(ip=>!publicAddress(ip)))throw new AppError('SOURCE_PRIVATE','Interne oder nicht öffentliche Quelladressen sind gesperrt.',422);
}
export function checkAllowed(url:URL,env:Env):void{
  const hosts=(env.RECIPE_ALLOWED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!hosts.includes(url.hostname)||url.origin===env.APP_ORIGIN||url.hostname.endsWith('.cloudflareaccess.com')||url.hostname.endsWith('.workers.dev')) {
    throw new AppError('SOURCE_NOT_ALLOWED','Diese Rezept-Domain ist noch nicht vom Administrator freigegeben.',422);
  }
}
export function extractSource(html:string,url:string):Source{
  const tree=parse(html);const scripts:string[]=[],text:string[]=[];
  const stack:{node:DefaultTreeAdapterMap['node'];hidden:boolean}[]=[{node:tree,hidden:false}];
  while(stack.length){const current=stack.pop()!;const node=current.node;
    const tag='tagName'in node?node.tagName:'';
    if(tag==='script'&&'attrs'in node&&node.attrs.some(a=>a.name==='type'&&a.value.trim().toLowerCase()==='application/ld+json')&&'childNodes'in node){
      scripts.push(node.childNodes.map(n=>'value'in n?n.value:'').join(''));
    }
    const hidden=current.hidden||['script','style','noscript','svg','nav','footer'].includes(tag);
    if(!hidden&&'value'in node&&node.value.trim())text.push(node.value.trim());
    if('childNodes'in node)for(let i=node.childNodes.length-1;i>=0;i--)stack.push({node:node.childNodes[i],hidden});
  }
  function find(value:unknown,depth=0):unknown{
    if(!value||typeof value!=='object'||depth>40)return null;
    const obj=value as Record<string,unknown>,type=obj['@type'];
    if(type==='Recipe'||Array.isArray(type)&&type.includes('Recipe'))return obj;
    for(const child of Object.values(obj)){const found=find(child,depth+1);if(found)return found;}return null;
  }
  let structured:unknown=null;for(const script of scripts){try{structured=find(JSON.parse(script));}catch{continue;}if(structured)break;}
  const content=structured?JSON.stringify(structured):text.join('\n');
  if(!content.trim())throw new AppError('NO_RECIPE','Kein lesbarer Rezeptinhalt gefunden.',422);
  if(new TextEncoder().encode(content).byteLength>MAX_SOURCE_BYTES)throw new AppError('SOURCE_TOO_LARGE','Der Rezeptinhalt überschreitet das Textlimit.',413);
  return {kind:'web',url,text:content};
}
export async function readWeb(value:string,env:Env,fetcher:typeof fetch=fetch):Promise<Source>{
  let url=normalizeUrl(value);
  if(isYouTube(url))throw new AppError('TRANSCRIPT_REQUIRED','Für YouTube bitte ein rechtmäßig bereitgestelltes Transkript importieren.',422);
  for(let redirects=0;redirects<=3;redirects++){
    checkAllowed(url,env);await checkDns(url.hostname,fetcher);
    const response=await fetcher(url.href,{redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(15000)});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');await response.body?.cancel();
      if(!location)throw new AppError('SOURCE_REDIRECT','Ungültige Weiterleitung.',422);
      url=normalizeUrl(new URL(location,url).href);continue;
    }
    if(!response.ok)throw new AppError('SOURCE_UNAVAILABLE','Die Rezeptseite ist momentan nicht auslesbar.',422);
    if(!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(response.headers.get('content-type')||''))throw new AppError('SOURCE_TYPE','Der Link liefert keine Rezept-Webseite.',422);
    return extractSource(await limitedText(response,2000000),value);
  }
  throw new AppError('SOURCE_REDIRECT','Zu viele Weiterleitungen.',422);
}
export function transcriptSource(value:unknown,transcript:unknown,authorized:unknown,duration:unknown):Source{
  const url=youtubeUrl(value);
  if(authorized!==true)throw new AppError('AUTHORIZATION_REQUIRED','Bitte bestätigen, dass du das Transkript rechtmäßig verwenden darfst.');
  if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0||duration>1200)throw new AppError('VIDEO_LIMIT','Transkriptimporte sind auf Videos bis 20 Minuten begrenzt.');
  if(typeof transcript!=='string'||transcript.trim().length<30||new TextEncoder().encode(transcript).byteLength>MAX_SOURCE_BYTES)throw new AppError('TRANSCRIPT_LIMIT','Bitte ein Transkript mit 30 Zeichen bis 20 KB bereitstellen.');
  return {kind:'youtube_transcript',url:url.href,text:transcript.trim()};
}
