import {z} from 'zod';
import OpenAI from 'openai';
import {AppError} from '../shared/errors.js';
import type {Source,Generated,Usage,MediaPayload} from '../shared/types.js';
import type {Env} from './env.js';
import {generateRecipe,prices} from './openai.js';
const payload:z.ZodType<MediaPayload>=z.object({audio:z.string().max(7800000),frames:z.array(z.string().max(270000)).min(1).max(6)}).strict();
function bytes(value:string,max:number):Uint8Array{
 if(value.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new AppError('MEDIA_INVALID','Ungültige Mediendaten.',422);
 let raw:string;try{raw=atob(value);}catch{throw new AppError('MEDIA_INVALID','Ungültige Mediendaten.',422);}
 if(raw.length>max)throw new AppError('MEDIA_LIMIT','Die Mediendaten sind zu groß.',413);
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export function wavDuration(audio:Uint8Array):number{
 const v=new DataView(audio.buffer,audio.byteOffset,audio.byteLength),text=(at:number,n:number)=>String.fromCharCode(...audio.subarray(at,at+n));
 if(audio.length<46||text(0,4)!=='RIFF'||text(8,4)!=='WAVE'||text(12,4)!=='fmt '||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==16000||v.getUint32(28,true)!==32000||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||text(36,4)!=='data'||v.getUint32(4,true)!==audio.length-8||v.getUint32(40,true)!==audio.length-44||(audio.length-44)%2)throw new AppError('MEDIA_INVALID','Die Tonspur muss im vorbereiteten WAV-Format vorliegen.',422);
 const seconds=(audio.length-44)/32000;if(seconds<=0||seconds>180)throw new AppError('VIDEO_LIMIT','Videoimporte sind auf drei Minuten begrenzt.',422);return seconds;
}
export function jpegDimensions(data:Uint8Array):{width:number;height:number}{
 if(data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217)throw new AppError('MEDIA_INVALID','Ungültiges Einzelbild.',422);
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 for(let at=2;at+9<data.length&&at<65536;){
  if(data[at++]!==255)break;const marker=data[at++];if(marker===255){at--;continue;}
  const length=v.getUint16(at);if(length<2||at+length>data.length)break;
  if([192,193,194].includes(marker)){const height=v.getUint16(at+3),width=v.getUint16(at+5);if(width>0&&height>0&&width<=1280&&height<=1280)return {width,height};break;}at+=length;
 }
 throw new AppError('MEDIA_INVALID','Einzelbilder dürfen höchstens 1280 Pixel pro Seite haben.',422);
}
export function mediaSource(raw:unknown,url:string,authorized:unknown):Source{
 if(authorized!==true)throw new AppError('AUTHORIZATION_REQUIRED','Bitte bestätigen, dass du das Video verwenden darfst.',422);
 const parsed=payload.safeParse(raw);if(!parsed.success)throw new AppError('MEDIA_LIMIT','Bitte ein Video mit Ton und höchstens sechs Einzelbildern bereitstellen.',422);
 const audio=bytes(parsed.data.audio,5760044),duration_seconds=wavDuration(audio);
 const frames=parsed.data.frames.map(frame=>{const prefix='data:image/jpeg;base64,';if(!frame.startsWith(prefix))throw new AppError('MEDIA_INVALID','Nur vorbereitete JPEG-Einzelbilder sind erlaubt.',422);jpegDimensions(bytes(frame.slice(prefix.length),200000));return frame;});
 return {kind:'web',url,text:'Vom Nutzer bereitgestelltes Video. Nur die Tonspur und die beigefügten Einzelbilder auswerten. Nicht sichtbare oder nicht genannte Mengen niemals schätzen.',provenance:'provided_media',media:{audio,frames,duration_seconds}};
}
function mediaEnv(env:Env):Env{
 const model=env.OPENAI_VIDEO_MODEL||'gpt-6.1-terra',known=model==='gpt-6.1-terra'?['1','5']:model==='gpt-6.1-sol'?['2','10']:undefined;
 if(!known&&(!env.VIDEO_MODEL_INPUT_USD_PER_MILLION||!env.VIDEO_MODEL_OUTPUT_USD_PER_MILLION))throw new AppError('MODEL_PRICING','Für das Videomodell müssen Tokenpreise konfiguriert werden.',503);
 const result={...env,OPENAI_MODEL:model,MODEL_INPUT_USD_PER_MILLION:env.VIDEO_MODEL_INPUT_USD_PER_MILLION||known?.[0],MODEL_OUTPUT_USD_PER_MILLION:env.VIDEO_MODEL_OUTPUT_USD_PER_MILLION||known?.[1]};prices(result);return result;
}
function audioModel(env:Env):string{const model=env.OPENAI_AUDIO_MODEL||'gpt-4o-mini-transcribe';if(!['gpt-4o-mini-transcribe','gpt-4o-transcribe'].includes(model))throw new AppError('AUDIO_CONFIGURATION','Das Audiomodell ist nicht unterstützt.',503);return model;}
export function mediaReservationCost(env:Env):number{const p=prices(mediaEnv(env));return Math.ceil((6*64000+30000)*p.input+6000*p.output+(audioModel(env)==='gpt-4o-mini-transcribe'?100000:200000));}
export async function generateMediaRecipe(source:Source,env:Env,id:string,fetcher?:typeof fetch):Promise<Generated>{
 if(!source.media)throw new AppError('MEDIA_INVALID','Mediendaten fehlen.',422);
 if(!env.OPENAI_API_KEY)throw new AppError('AI_CONFIGURATION','Der Administrator muss das OpenAI-Secret einrichten.',503);
 const selectedAudio=audioModel(env),selectedEnv=mediaEnv(env);
 const client=new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0,timeout:45000,...(fetcher?{fetch:fetcher}:{})});
 let transcript:string,audioInput=0,audioOutput=0;
 try{
  const result=await client.audio.transcriptions.create({model:selectedAudio,file:new File([source.media.audio.slice().buffer],'audio.wav',{type:'audio/wav'}),response_format:'json'},{headers:{'Idempotency-Key':id+'-audio'}});
  transcript=result.text;const usage=(result as unknown as {usage?:{input_tokens?:number;output_tokens?:number}}).usage;if(usage&&Number.isSafeInteger(usage.input_tokens)&&Number.isSafeInteger(usage.output_tokens)&&usage.input_tokens!>=0&&usage.output_tokens!>=0){audioInput=usage.input_tokens!;audioOutput=usage.output_tokens!;}
 }catch(error){
  if(error instanceof OpenAI.AuthenticationError||error instanceof OpenAI.PermissionDeniedError)throw new AppError('AUDIO_CONFIGURATION','Der Administrator muss für den OpenAI-Key den Zugriff auf Audio-Transkriptionen freigeben.',503);
  if(error instanceof OpenAI.RateLimitError)throw new AppError('AI_LIMIT','OpenAI hat die Audioanfrage wegen einer Begrenzung abgelehnt. Bitte API-Abrechnung und Limits prüfen.',503);
  throw new AppError('AUDIO_UNAVAILABLE','Die Tonspur konnte nicht ausgewertet werden. Es wurde kein Rezept gespeichert.',502);
 }
 const cost=Math.ceil(source.media.duration_seconds*(selectedAudio==='gpt-4o-mini-transcribe'?50:100));
 const audioUsage:Usage={model:selectedAudio,input_tokens:audioInput,output_tokens:audioOutput,estimated_cost_microusd:cost};
 try{
  if(typeof transcript!=='string'||new TextEncoder().encode(transcript).length>20000)throw new AppError('TRANSCRIPT_LIMIT','Das Audiotranskript überschreitet das Textlimit.',413);
  const result=await generateRecipe({...source,text:source.text+'\nAudiotranskript:\n'+transcript},selectedEnv,id+'-vision',fetcher);
  result.usage={...result.usage,input_tokens:result.usage.input_tokens+audioInput,output_tokens:result.usage.output_tokens+audioOutput,model:selectedAudio+' + '+result.usage.model,estimated_cost_microusd:result.usage.estimated_cost_microusd+cost};
  if(result.recipe.warnings.length<20)result.recipe.warnings.push('Tonspur und bis zu sechs Einzelbilder ausgewertet; kurze Einblendungen zwischen Bildern können fehlen. Audiokosten sind anhand der WAV-Dauer geschätzt.');
  return result;
 }catch(error){
  if(error instanceof AppError)error.usage=error.usage?{...error.usage,input_tokens:error.usage.input_tokens+audioInput,output_tokens:error.usage.output_tokens+audioOutput,model:selectedAudio+' + '+error.usage.model,estimated_cost_microusd:error.usage.estimated_cost_microusd+cost}:audioUsage;
  throw error;
 }
}
