import OpenAI from 'openai';
import type {Env} from './env.js';
import type {Source,Generated,Usage} from '../shared/types.js';
import {AppError} from '../shared/errors.js';
import {generateRecipe,prices,reservationCost} from './openai.js';
import {limitedBytes,MAX_VIDEO_SECONDS,mp4Duration,MAX_VIDEO_BYTES} from './public-video.js';

export function videoModelEnv(env:Env):Env{
 const model=env.OPENAI_VIDEO_MODEL||'gpt-6.1-terra';
 return {...env,OPENAI_MODEL:model,
  MODEL_INPUT_USD_PER_MILLION:env.VIDEO_INPUT_USD_PER_MILLION||(model==='gpt-6.1-terra'?'1.00':undefined),
  MODEL_OUTPUT_USD_PER_MILLION:env.VIDEO_OUTPUT_USD_PER_MILLION||(model==='gpt-6.1-terra'?'5.00':undefined)};
}
export function videoReservationCost(env:Env):number{
 const p=prices(videoModelEnv(env));
 // Conservative envelope for <=20KB description + <=20KB transcript + six 720px frames.
 // Audio estimate reserves a 2x margin over the published per-minute approximation.
 return Math.max(reservationCost(env),Math.ceil(200000*p.input+6000*p.output+MAX_VIDEO_SECONDS/60*6000));
}
function stream(bytes:Uint8Array):ReadableStream<Uint8Array>{return new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}});}
async function deadline<T>(work:Promise<T>,milliseconds:number):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AppError('VIDEO_TIMEOUT','Die Videoverarbeitung hat zu lange gedauert. Es wurde kein Rezept gespeichert.',504)),milliseconds);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
function dataUrl(bytes:Uint8Array):string{
 let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
 return 'data:image/jpeg;base64,'+btoa(binary);
}
export async function preparePublicVideo(source:Source,env:Env):Promise<{audio:File;frames:string[];duration:number}>{
 if(env.VIDEO_ANALYSIS_ENABLED!=='true'||!env.MEDIA||env.APP_ENV==='preview'||!source.video||source.provenance!=='public_video')throw new AppError('VIDEO_CONFIGURATION','Die automatische Videoanalyse ist noch nicht freigeschaltet.',503);
 const bytes=source.video.bytes;
 if(bytes.length>MAX_VIDEO_BYTES)throw new AppError('VIDEO_SIZE','Das Video überschreitet das Größenlimit.',413);
 const duration=mp4Duration(bytes),media=env.MEDIA;
 // Independent streams: a Media input cannot be reused for another transformation.
 return deadline((async()=>{
  const outputs=await Promise.all([
   (async()=>{const response=await media.input(stream(bytes)).output({mode:'audio',time:'0s',duration:duration+'s',format:'m4a'}).response();
    if(!response.ok||!/^audio\/(?:mp4|x-m4a)\b/i.test(response.headers.get('content-type')||''))throw new AppError('VIDEO_AUDIO','Die Tonspur konnte nicht zuverlässig verarbeitet werden.',422);
    const audio=await limitedBytes(response,2*1024*1024);return new File([audio],'audio.m4a',{type:'audio/mp4'});})(),
   ...[.05,.23,.41,.59,.77,.95].map(async fraction=>{
    const response=await media.input(stream(bytes)).transform({width:720,height:720,fit:'contain'}).output({mode:'frame',time:(duration*fraction).toFixed(3)+'s',format:'jpg'}).response();
    if(!response.ok||!/^image\/jpeg\b/i.test(response.headers.get('content-type')||''))throw new AppError('VIDEO_FRAMES','Die Videobilder konnten nicht zuverlässig verarbeitet werden.',422);
    const image=await limitedBytes(response,512*1024);
    if(image[0]!==255||image[1]!==216||image[2]!==255)throw new AppError('VIDEO_FRAMES','Ein Videobild ist ungültig.',422);
    return dataUrl(image);
   })
  ]);
  return {audio:outputs[0] as File,frames:outputs.slice(1) as string[],duration};
 })(),25000);
}
export async function generateVideoRecipe(source:Source,env:Env,id:string,fetcher?:typeof fetch):Promise<Generated>{
 if(!env.OPENAI_API_KEY)throw new AppError('AI_CONFIGURATION','Der Administrator muss die OpenAI-Anbindung einrichten.',503);
 const modelEnv=videoModelEnv(env);prices(modelEnv); // Validate configuration before any billable call.
 let prepared:Awaited<ReturnType<typeof preparePublicVideo>>;
 try{prepared=await preparePublicVideo(source,env);}catch(error){if(error instanceof AppError)throw error;throw new AppError('VIDEO_PROCESSING','Das Videoformat konnte nicht zuverlässig verarbeitet werden.',422);}
 const client=new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0,timeout:20000,...(fetcher?{fetch:fetcher}:{})});
 let transcript;
 try{transcript=await client.audio.transcriptions.create({model:'gpt-4o-mini-transcribe',file:prepared.audio,response_format:'json'}, {headers:{'Idempotency-Key':id+'-audio'}});}
 catch(error){
  if(error instanceof OpenAI.RateLimitError)throw new AppError('AI_LIMIT','OpenAI hat die Audioanfrage begrenzt. Bitte API-Guthaben und Limits prüfen.',503);
  if(error instanceof OpenAI.AuthenticationError||error instanceof OpenAI.PermissionDeniedError)throw new AppError('AI_AUDIO_CONFIGURATION','Der API-Key benötigt zusätzlich Schreibzugriff auf Audio-Transkriptionen.',503);
  throw new AppError('AI_AUDIO_UNAVAILABLE','Die Tonspur konnte momentan nicht ausgewertet werden.',502);
 }
 const audioUsage:Usage={input_tokens:0,output_tokens:0,model:'gpt-4o-mini-transcribe',estimated_cost_microusd:Math.ceil(prepared.duration/60*3000)};
 // Audio usage is optional in the provider response; keep it when provided.
 const reported=(transcript as unknown as {usage?:{input_tokens?:number;output_tokens?:number}}).usage;
 if(reported&&Number.isSafeInteger(reported.input_tokens)&&(reported.input_tokens??-1)>=0)audioUsage.input_tokens=reported.input_tokens!;
 if(reported&&Number.isSafeInteger(reported.output_tokens)&&(reported.output_tokens??-1)>=0)audioUsage.output_tokens=reported.output_tokens!;
 const combined=(usage?:Usage):Usage=>({model:(usage?.model||modelEnv.OPENAI_MODEL)+' + '+audioUsage.model,
  input_tokens:(usage?.input_tokens||0)+audioUsage.input_tokens,output_tokens:(usage?.output_tokens||0)+audioUsage.output_tokens,
  estimated_cost_microusd:(usage?.estimated_cost_microusd||0)+audioUsage.estimated_cost_microusd});
 try{
  if(typeof transcript.text!=='string'||new TextEncoder().encode(transcript.text).length>20000)throw new AppError('VIDEO_TRANSCRIPT_LIMIT','Die Tonspur überschreitet das Textlimit.',422);
  const generated=await generateRecipe({kind:'web',url:source.url,provenance:'public_video',
   text:JSON.stringify({description:source.text,transcript:transcript.text,frame_times:prepared.frames.map((_,i)=>Number((prepared.duration*[.05,.23,.41,.59,.77,.95][i]).toFixed(3)))}),frames:prepared.frames},modelEnv,id,fetcher);
  return {...generated,usage:combined(generated.usage)};
 }catch(error){if(error instanceof AppError)error.usage=combined(error.usage);throw error;}
}
