import {it,expect,vi} from 'vitest';
import {mediaSource,wavDuration,jpegDimensions,mediaReservationCost,generateMediaRecipe} from '../src/worker/media.js';
import {videoLink,videoPlatform} from '../src/shared/video-platform.js';
import {socialDescription} from '../src/worker/social-description.js';
import {readWeb,transcriptSource} from '../src/worker/source.js';
import {localEnv,recipe} from './fixtures.js';
function wav(seconds=1){const b=new Uint8Array(44+seconds*32000),v=new DataView(b.buffer);const word=(at:number,s:string)=>{for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);};word(0,'RIFF');v.setUint32(4,b.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,b.length-44,true);return b;}
function base64(b:Uint8Array){let s='';for(let at=0;at<b.length;at+=8192)s+=String.fromCharCode(...b.subarray(at,at+8192));return btoa(s);}
const frame='data:image/jpeg;base64,'+base64(new Uint8Array([255,216,255,192,0,11,8,0,16,0,16,1,1,17,0,255,217]));
const payload=()=>({audio:base64(wav()),frames:[frame]});
it.each(['https://www.youtube.com/shorts/abcdefghijk','https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk'])('normalisiert YouTube %s',url=>expect(videoLink(url).href).toBe('https://www.youtube.com/watch?v=abcdefghijk'));
it('erkennt nur explizite Plattformhosts und entfernt Tracking erst nach Secret-Prüfung',()=>{
 expect(videoPlatform(new URL('https://www.instagram.com/reel/abc/'))).toBe('instagram');
 expect(videoLink('https://www.instagram.com/reel/abc/?igsh=tracking').search).toBe('');
 expect(videoPlatform(new URL('https://instagram.com.attacker.example/reel/abc/'))).toBeUndefined();
 expect(()=>videoLink('https://www.instagram.com/reel/abc/?access_token=private')).toThrow();
});
it('liest nur sichtbare Metadaten ohne Script-Ausführung und fordert bei Login-/Leertext eine Alternative',()=>{
 const caption='Zutaten: 200 g Tomaten, 100 g Reis. Den Reis kochen und die Tomaten würfeln. Alles mischen und servieren.';
 expect(socialDescription('<meta property="og:description" content="'+caption+'"><script>throw Error()</script>')).toBe(caption);
 expect(()=>socialDescription('<meta name="description" content="Log in to Instagram">')).toThrow();
});
it('prüft Quellen-DNS und Redirects auch für Kurzvideo-Links',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('<meta name="description" content="Zutaten: 200 g Tomaten und 100 g Reis. Alles kochen, abschmecken und in einer großen Schüssel servieren.">',{headers:{'content-type':'text/html'}}));
 const source=await readWeb('https://www.instagram.com/reel/abc/',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},f as typeof fetch);
 expect(source.provenance).toBe('description');expect(source.text).toContain('200 g');
});
it('akzeptiert ausdrücklich bereitgestellte Beschreibungen aller drei Plattformen',()=>{
 expect(transcriptSource('https://www.instagram.com/reel/abc/','Zutaten: 200 g Tomaten. In Stücke schneiden und kochen.',true,60).provenance).toBe('provided_text');
 expect(()=>transcriptSource('https://www.tiktok.com/@cook/video/123','x'.repeat(80),false,60)).toThrow();
});
it('validiert echte PCM-Dauer, Dateilängen, Bildgrößen und Einwilligung vor KI-Aufrufen',()=>{
 expect(wavDuration(wav(1))).toBe(1);const b=wav();b[40]=1;expect(()=>wavDuration(b)).toThrow();
 expect(()=>wavDuration(wav(181))).toThrow();expect(()=>mediaSource(payload(),'https://www.instagram.com/reel/abc/',false)).toThrow();
 expect(()=>mediaSource({...payload(),frames:Array(7).fill(frame)},'https://www.instagram.com/reel/abc/',true)).toThrow();
 expect(()=>mediaSource({...payload(),frames:['https://internal.example/private']},'https://www.instagram.com/reel/abc/',true)).toThrow();
 expect(()=>jpegDimensions(new Uint8Array([255,216,255,217]))).toThrow();
 expect(mediaSource(payload(),'https://www.instagram.com/reel/abc/',true).media?.duration_seconds).toBe(1);
});
it('reserviert konservativ und sperrt ein unbekanntes Videomodell ohne Preise',()=>{
 const env=localEnv({} as D1Database);expect(mediaReservationCost(env)).toBeGreaterThan(500000);
 expect(()=>mediaReservationCost({...env,OPENAI_VIDEO_MODEL:'unknown'})).toThrow();
});
it('nutzt Audio und Vision mit Mocks, speichert keine Datei und zählt beide Stufen',async()=>{
 const calls:string[]=[];
 const f=vi.fn(async(url:RequestInfo|URL,options?:RequestInit)=>{
  calls.push(String(url));
  if(String(url).includes('/audio/transcriptions'))return Response.json({text:'200 g Tomaten schneiden und zehn Minuten kochen.',usage:{input_tokens:12,output_tokens:8}});
  const body=JSON.parse(String(options?.body));expect(body.model).toBe('gpt-6.1-terra');expect(body.store).toBe(false);expect(body.input[1].content[1]).toMatchObject({type:'input_image',image_url:frame});expect(body.text.format.strict).toBe(true);
  return Response.json({id:'resp_mock',status:'completed',object:'response',model:'gpt-6.1-terra',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({is_recipe:true,recipe}),annotations:[]}]}],usage:{input_tokens:1000,output_tokens:500,total_tokens:1500}});
 });
 const source=mediaSource(payload(),'https://www.instagram.com/reel/abc/',true),result=await generateMediaRecipe(source,localEnv({} as D1Database),'mock-media',f as typeof fetch);
 expect(calls).toHaveLength(2);expect(result.usage.input_tokens).toBe(1012);expect(result.usage.estimated_cost_microusd).toBe(3550);expect(result.recipe.warnings.join(' ')).toContain('Einzelbilder');
});
it('meldet fehlende Audio-Berechtigung ohne private Anbieterdetails',async()=>{
 const f=vi.fn(async()=>Response.json({error:{message:'PRIVATE_TOKEN',type:'permission_error'}},{status:403}));
 await expect(generateMediaRecipe(mediaSource(payload(),'https://www.instagram.com/reel/abc/',true),localEnv({} as D1Database),'denied',f as typeof fetch)).rejects.toMatchObject({code:'AUDIO_CONFIGURATION'});
 expect(f).toHaveBeenCalledTimes(1);
});
