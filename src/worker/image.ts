import {AppError} from '../shared/errors.js';
import {normalizeUrl,checkAllowed,checkDns} from './source.js';
import type {Env} from './env.js';
import type {RecipeImageData} from '../shared/types.js';
export const MAX_IMAGE_BYTES=1048576;
const invalid=()=>new AppError('IMAGE_TYPE','Das Rezeptbild hat kein unterstütztes Bildformat.',422);
export function imageDimensions(bytes:Uint8Array,mime:string):[number,number]{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  if(mime==='image/png'&&bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&text(12,4)==='IHDR')return [view.getUint32(16),view.getUint32(20)];
  if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){
    let at=2;
    while(at+4<=bytes.length){
      if(bytes[at++]!==255)throw invalid();while(bytes[at]===255)at++;
      const marker=bytes[at++];if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||marker>=0xd0&&marker<=0xd8)continue;
      if(at+2>bytes.length)break;const size=view.getUint16(at);if(size<2||at+size>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7)return [view.getUint16(at+5),view.getUint16(at+3)];
      at+=size;
    }
  }
  if(mime==='image/webp'&&bytes.length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
    const type=text(12,4);
    if(type==='VP8X')return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];
    if(type==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return [view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff];
    if(type==='VP8L'&&bytes[20]===0x2f)return [1+bytes[21]+((bytes[22]&0x3f)<<8),1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)];
  }
  throw invalid();
}
export async function fetchRecipeImage(candidate:{url:string;credit:string},env:Env,fetcher:typeof fetch=fetch):Promise<RecipeImageData>{
  let url=normalizeUrl(candidate.url);
  const original=url.href;
  for(let redirects=0;redirects<=2;redirects++){
    checkAllowed(url,env);await checkDns(url.hostname,fetcher);
    const response=await fetcher(url.href,{redirect:'manual',headers:{Accept:'image/jpeg,image/png,image/webp'},signal:AbortSignal.timeout(5000)});
    if([301,302,303,307,308].includes(response.status)){
      const next=response.headers.get('location');await response.body?.cancel();if(!next)throw invalid();url=normalizeUrl(new URL(next,url).href);continue;
    }
    const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(mime||'')||!response.body){await response.body?.cancel();throw invalid();}
    const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{
      if(Number(response.headers.get('content-length'))>MAX_IMAGE_BYTES)throw new AppError('IMAGE_LIMIT','Das Rezeptbild ist zu groß.',413);
      while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>MAX_IMAGE_BYTES)throw new AppError('IMAGE_LIMIT','Das Rezeptbild ist zu groß.',413);chunks.push(next.value);}
    }finally{await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const [width,height]=imageDimensions(bytes,mime!);
    if(width<32||height<32||width>8192||height>8192||width*height>16000000)throw new AppError('IMAGE_DIMENSIONS','Das Rezeptbild hat keine geeignete Bildgröße.',422);
    return {bytes:bytes.buffer,mime:mime as RecipeImageData['mime'],original_url:original,credit:typeof candidate.credit==='string'?candidate.credit.trim().slice(0,240):''};
  }
  throw new AppError('IMAGE_REDIRECT','Zu viele Bildweiterleitungen.',422);
}
