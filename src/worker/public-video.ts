import type {Env} from './env.js';
import {AppError} from '../shared/errors.js';
import {videoPlatform} from '../shared/video-platform.js';
import {checkDns,limitedText} from './source.js';
import {parse,type DefaultTreeAdapterMap} from 'parse5';

export const MAX_VIDEO_BYTES=16*1024*1024;
export const MAX_VIDEO_SECONDS=90;
const unavailable=()=>new AppError('VIDEO_SOURCE_REQUIRED','Für diesen Link konnte keine öffentlich abrufbare Videodatei erkannt werden. Das bedeutet nicht, dass das Reel privat ist. Eine Beschreibung oder ein Transkript kann weiterhin verwendet werden.',422);

/** Signed playback URLs are ephemeral capabilities, never recipe source URLs. */
export function playbackUrl(value:string,platform:'instagram'|'tiktok'):URL{
 let url:URL;try{url=new URL(value);}catch{throw unavailable();}
 const host=url.hostname.toLowerCase();
 const allowed=platform==='instagram'?(host==='scontent.cdninstagram.com'||/^scontent[-.][a-z0-9.-]+\.cdninstagram\.com$/.test(host)):
   /^v[0-9]+[-a-z0-9.]*\.tiktok\.com$/.test(host);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.href.length>8192||!allowed)throw unavailable();
 return url;
}

/** Parse only data exposed in public playback pages; never execute platform JS. */
export function instagramPlayback(html:string):URL{
 if(html.length>2000000)throw unavailable();
 let text=html;
 for(let level=0;level<4;level++){
  const matches=[...text.matchAll(/"video_url"\s*:\s*("(?:[^"\\]|\\.)*")/g)];
  if(matches.length===1){try{return playbackUrl(JSON.parse(matches[0][1]) as string,'instagram');}catch{/* Try the next escaping layer. */}}
  text=text.replace(/\\(["\\/])/g,'$1');
 }
 throw unavailable();
}

/** Public JSON only. Bind media to the requested reel, never recommendations. */
export function instagramPagePlayback(html:string,code:string):URL{
 if(html.length>2000000||!/^[-\w]{1,100}$/.test(code))throw unavailable();
 type Node=DefaultTreeAdapterMap['node'];
 const nodes:Node[]=[parse(html)],values:{value:unknown;depth:number}[]=[],matches:URL[]=[];
 let visited=0;
 while(nodes.length){
  if(++visited>50000)throw unavailable();
  const node=nodes.pop()!;
  if('tagName'in node&&node.tagName==='script'&&node.attrs.some(a=>a.name==='type'&&a.value.toLowerCase()==='application/json')){
   const raw=node.childNodes.filter(n=>n.nodeName==='#text').map(n=>'value'in n?n.value:'').join('');
   try{values.push({value:JSON.parse(raw),depth:0});}catch{/* No evaluation of executable scripts. */}
  }
  if('childNodes'in node)for(const child of node.childNodes)nodes.push(child);
 }
 while(values.length){
  if(++visited>50000)throw unavailable();
  const {value,depth}=values.pop()!;if(depth>64)throw unavailable();
  if(!value||typeof value!=='object')continue;
  if(Array.isArray(value)){for(const entry of value)values.push({value:entry,depth:depth+1});continue;}
  const record=value as Record<string,unknown>;
  if((record.code===code||record.shortcode===code)&&('video_versions'in record||'video_url'in record)){
   const variants=Array.isArray(record.video_versions)?record.video_versions:[];
   // Prefer the smallest >=480px rendition to conserve the existing byte budget.
   const candidates=variants.filter((v):v is {url:string;width?:number}=>!!v&&typeof v==='object'&&typeof v.url==='string'&&(v.width===undefined||(Number.isInteger(v.width)&&v.width>0&&v.width<=16384)))
    .map(v=>({url:playbackUrl(v.url,'instagram'),width:v.width}));
   const rank=(width:number|undefined)=>width===undefined?2:width>=480?0:1;
   candidates.sort((a,b)=>rank(a.width)-rank(b.width)||(a.width!==undefined&&b.width!==undefined?(a.width>=480?a.width-b.width:b.width-a.width):0));
   if(candidates.length)matches.push(candidates[0].url);
   else if(typeof record.video_url==='string')matches.push(playbackUrl(record.video_url,'instagram'));
  }
  for(const entry of Object.values(record))values.push({value:entry,depth:depth+1});
 }
 if(matches.length!==1)throw unavailable();
 return matches[0];
}
export function tiktokPlayback(html:string,videoId:string):URL{
 if(html.length>2000000)throw unavailable();
 const match=html.match(/<script\b[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!match)throw unavailable();
 try{
  const data=JSON.parse(match[1]);
  const item=data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
  if(String(item?.id)!==videoId||typeof item?.video?.playAddr!=='string')throw unavailable();
  return playbackUrl(item.video.playAddr,'tiktok');
 }catch{throw unavailable();}
}
export async function limitedBytes(response:Response,limit:number):Promise<Uint8Array<ArrayBuffer>>{
 const declared=response.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>limit)){await response.body?.cancel();throw new AppError('VIDEO_SIZE','Das Video überschreitet das Größenlimit.',413);}
 if(!response.body)throw unavailable();
 const reader=response.body.getReader(),buffer=new Uint8Array(limit);let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;if(next.value.length>limit-size)throw new AppError('VIDEO_SIZE','Das Video überschreitet das Größenlimit.',413);buffer.set(next.value,size);size+=next.value.length;}}
 finally{await reader.cancel().catch(()=>{});}
 if(!size)throw unavailable();
 return buffer.subarray(0,size);
}

/** Bounded ISO-BMFF metadata parser. Reject unbounded/live/fragment-only input. */
export function mp4Duration(bytes:Uint8Array):number{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let boxes=0,seconds:number|undefined;
 const walk=(start:number,end:number,insideMoov=false)=>{
  for(let offset=start;offset<end;){
   if(++boxes>10000||end-offset<8)throw unavailable();
   let size=view.getUint32(offset),header=8;
   if(size===1){if(end-offset<16)throw unavailable();const big=view.getBigUint64(offset+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))throw unavailable();size=Number(big);header=16;}
   if(size===0)size=end-offset;
   if(size<header||size>end-offset)throw unavailable();
   const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),at=offset+header,stop=offset+size;
   if(type==='moov'&&!insideMoov)walk(at,stop,true);
   if(type==='mvhd'&&insideMoov){
    if(seconds!==undefined||stop-at<20)throw unavailable();
    const version=view.getUint8(at);let scale:number,ticks:number;
    if(version===0){scale=view.getUint32(at+12);ticks=view.getUint32(at+16);if(ticks===0xffffffff)throw unavailable();}
    else if(version===1&&stop-at>=32){scale=view.getUint32(at+20);const big=view.getBigUint64(at+24);if(big>BigInt(Number.MAX_SAFE_INTEGER))throw unavailable();ticks=Number(big);}
    else throw unavailable();
    seconds=ticks/scale;
   }
   offset=stop;
  }
 };
 if(bytes.length<16||String.fromCharCode(...bytes.subarray(4,8))!=='ftyp')throw unavailable();
 walk(0,bytes.length);
 if(seconds===undefined||!Number.isFinite(seconds)||seconds<=0||seconds>MAX_VIDEO_SECONDS)throw new AppError('VIDEO_LIMIT','Automatische Videoanalyse unterstützt derzeit vollständige MP4-Videos bis 90 Sekunden.',422);
 return seconds;
}

export async function readPublicVideo(source:URL,pageUrl:URL,html:string,env:Env,fetcher:typeof fetch,deadline:number):Promise<{bytes:Uint8Array<ArrayBuffer>;duration:number}>{
 if(env.VIDEO_ANALYSIS_ENABLED!=='true'||!env.MEDIA||env.APP_ENV==='preview')throw unavailable();
 const platform=videoPlatform(source);if(platform!=='instagram'&&platform!=='tiktok')throw unavailable();
 const request=async(url:URL,accept:string)=>{
  if(Date.now()>=deadline)throw new AppError('SOURCE_TIMEOUT','Die Videoquelle antwortet zu langsam.',504);
  await checkDns(url.hostname,fetcher);
  const remaining=deadline-Date.now();if(remaining<=0)throw unavailable();
  return fetcher(url.href,{redirect:'manual',headers:{Accept:accept},signal:AbortSignal.timeout(Math.min(15000,remaining))});
 };
 let playback:URL;
 if(platform==='instagram'){
  const code=source.pathname.match(/^\/(?:reel|p)\/([-\w]+)\/?$/)?.[1];
  if(!code)throw unavailable();
  try{playback=instagramPagePlayback(html,code);}catch(error){
   if(!(error instanceof AppError)||error.code!=='VIDEO_SOURCE_REQUIRED')throw error;
  const embed=new URL(source.pathname.replace(/\/$/,'')+'/embed/',source.origin);
  const response=await request(embed,'text/html');
  if(!response.ok||!/^text\/html\b/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw unavailable();}
  playback=instagramPlayback(await limitedText(response,2000000));
  }
 }else{
  if(videoPlatform(pageUrl)!=='tiktok')throw unavailable();
  const id=pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/)?.[1];if(!id)throw unavailable();
  playback=tiktokPlayback(html,id);
 }
 // No redirects on signed CDN capabilities. No cookies, credentials, referer or origin headers.
 const response=await request(playback,'video/mp4');
 if(response.status!==200||!/^video\/mp4\b/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw unavailable();}
 const bytes=await limitedBytes(response,MAX_VIDEO_BYTES),duration=mp4Duration(bytes);
 return {bytes,duration};
}
