import {it,expect,vi} from 'vitest';
import {instagramPlayback,instagramPagePlayback,tiktokPlayback,playbackUrl,mp4Duration,limitedBytes,readPublicVideo} from '../src/worker/public-video.js';
import {preparePublicVideo,generateVideoRecipe,videoReservationCost,extractVideoImage} from '../src/worker/video-analysis.js';
import type {Source} from '../src/shared/types.js';
import type {VideoMediaBinding} from '../src/worker/env.js';
import {localEnv,recipe} from './fixtures.js';
import {readWeb} from '../src/worker/source.js';

export function mp4(seconds=50):Uint8Array<ArrayBuffer>{
 const bytes=new Uint8Array(52),view=new DataView(bytes.buffer);
 const box=(at:number,size:number,name:string)=>{view.setUint32(at,size);bytes.set(new TextEncoder().encode(name),at+4);};
 box(0,16,'ftyp');box(16,36,'moov');box(24,28,'mvhd');view.setUint32(44,1000);view.setUint32(48,seconds*1000);return bytes;
}
const videoSource=():Source=>({kind:'web',url:'https://www.instagram.com/reel/test/',text:'Öffentliche Beschreibung ohne Mengen.',provenance:'public_video',video:{bytes:mp4(),duration:50}});
function fixture(){
 const transform=vi.fn(async(mode:string)=>new Response(mode==='audio'?new Uint8Array([0,1,2]):new Uint8Array([255,216,255,192,0,17,8,1,224,2,128,3,1,17,0,2,17,0,3,17,0,255,217]),{headers:{'Content-Type':mode==='audio'?'audio/mp4':'image/jpeg'}}));
 const media={input:vi.fn(()=>({transform:()=>({output:(options:{mode:string})=>({response:()=>transform(options.mode)})}),output:(options:{mode:string})=>({response:()=>transform(options.mode)})}))} as unknown as VideoMediaBinding;
 return {media,transform,config:{...localEnv({} as D1Database),VIDEO_ANALYSIS_ENABLED:'true',MEDIA:media}};
}
it('liest öffentliche Instagram-Playerdaten mit begrenzter JSON-Entschachtelung',()=>{
 const data=JSON.stringify({video_url:'https://scontent.cdninstagram.com/clip.mp4?sig=synthetic'});
 expect(instagramPlayback(data).hostname).toBe('scontent.cdninstagram.com');
 expect(instagramPlayback(JSON.stringify(JSON.stringify(data))).hostname).toBe('scontent.cdninstagram.com');
 expect(()=>instagramPlayback(data+data)).toThrow();
 expect(()=>instagramPlayback('script requiring eval')).toThrow();
});
const reelJson=(items:unknown)=>'<script type="application/json" data-sjs>'+JSON.stringify({require:[['RelayPrefetchedStreamCache','next',[],[{__bbox:{result:{data:{items}}}}]]]}).replaceAll('<','\\u003c')+'</script>';
const reelItem=(code='DfZugRbMuDa',url='https://scontent.cdninstagram.com/reel.mp4?sig=SYNTHETIC_SECRET')=>({code,video_versions:[{width:720,height:1280,url}]});
it('liest moderne öffentliche Reel-JSON-Daten und wählt eine begrenzte Auflösung',()=>{
 const item=reelItem();item.video_versions.push({width:480,height:854,url:'https://scontent.cdninstagram.com/small.mp4'});
 expect(instagramPagePlayback(reelJson([reelItem('recommendation'),item]),item.code).pathname).toBe('/small.mp4');
 expect(instagramPagePlayback(reelJson([{shortcode:item.code,video_url:item.video_versions[0].url}]),item.code).hostname).toBe('scontent.cdninstagram.com');
 // The observed public page exposes type + url without per-rendition dimensions.
 expect(instagramPagePlayback(reelJson([{code:item.code,video_versions:[{type:101,url:item.video_versions[0].url},{type:102,url:'https://scontent.cdninstagram.com/second.mp4'}]}]),item.code).pathname).toBe('/reel.mp4');
});
it('verwirft fremde oder mehrdeutige Reels, ausführbare Scripts und unsichere Adressen',()=>{
 for(const html of [reelJson([reelItem('other')]),reelJson([reelItem(),reelItem()]),'<script>'+JSON.stringify(reelItem())+'</script>',reelJson([reelItem('DfZugRbMuDa','https://evil.example/video.mp4?sig=SYNTHETIC_SECRET')]),reelJson([reelItem('DfZugRbMuDa','https://127.0.0.1/video.mp4')])]){
  let error:unknown;try{instagramPagePlayback(html,'DfZugRbMuDa');}catch(e){error=e;}
  expect(error).toMatchObject({code:'VIDEO_SOURCE_REQUIRED'});expect(String(error)).not.toContain('SYNTHETIC_SECRET');
 }
 expect(()=>instagramPagePlayback('x'.repeat(2000001),'DfZugRbMuDa')).toThrow();
 let deep:unknown=reelItem();for(let i=0;i<70;i++)deep={child:deep};
 expect(()=>instagramPagePlayback(reelJson(deep),'DfZugRbMuDa')).toThrow();
});
it('verwendet passende Reel-Seitendaten ohne Einbettungsabruf, KI-Aufruf oder gespeicherte CDN-Adresse',async()=>{
 const {config}=fixture();config.RECIPE_ALLOWED_HOSTS='';
 const f=vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{
  const url=String(input);expect(options?.redirect).toBe('manual');
  if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
  if(url.includes('cdninstagram.com'))return new Response(mp4(51),{headers:{'Content-Type':'video/mp4'}});
  expect(url).toBe('https://www.instagram.com/reel/DfZugRbMuDa/');
  return new Response(reelJson([reelItem()]),{headers:{'Content-Type':'text/html'}});
 });
 const source=await readWeb('https://www.instagram.com/reel/DfZugRbMuDa/?psln=tracking',config,f as typeof fetch);
 expect(source.provenance).toBe('public_video');expect(source.video?.duration).toBe(51);
 expect(source.url).toBe('https://www.instagram.com/reel/DfZugRbMuDa/');expect(source.text).not.toContain('SYNTHETIC_SECRET');
 expect(f.mock.calls.some(([url])=>String(url).includes('/embed/')||String(url).includes('api.openai.com'))).toBe(false);
});
it.each(['http://scontent.cdninstagram.com/a','https://scontent.cdninstagram.com.attacker.example/a','https://127.0.0.1/a','https://user:pass@scontent.cdninstagram.com/a','https://scontent.cdninstagram.com:8443/a'])('verwirft unsichere Medienadressen %s',url=>expect(()=>playbackUrl(url,'instagram')).toThrow());
it('bindet TikTok-Playerdaten an die erwartete Video-ID',()=>{
 const html='<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{itemInfo:{itemStruct:{id:'123',video:{playAddr:'https://v16-webapp-prime.tiktok.com/test.mp4?synthetic=1'}}}}}})+'</script>';
 expect(tiktokPlayback(html,'123').hostname).toBe('v16-webapp-prime.tiktok.com');expect(()=>tiktokPlayback(html,'456')).toThrow();
});
it('prüft die echte MP4-Länge statt HTML-Angaben und verwirft defekte oder zu lange Dateien',()=>{
 expect(mp4Duration(mp4(51))).toBe(51);expect(()=>mp4Duration(mp4(91))).toThrow();expect(()=>mp4Duration(mp4(0))).toThrow();
 expect(()=>mp4Duration(mp4().subarray(0,40))).toThrow();const bad=mp4();new DataView(bad.buffer).setUint32(16,99999999);expect(()=>mp4Duration(bad)).toThrow();
});
it('begrenzt auch Antworten ohne verlässlichen Content-Length',async()=>{
 await expect(limitedBytes(new Response(new Uint8Array(11)),10)).rejects.toMatchObject({code:'VIDEO_SIZE'});
 await expect(limitedBytes(new Response('a',{headers:{'Content-Length':'100'}}),10)).rejects.toMatchObject({code:'VIDEO_SIZE'});
});
it('verfolgt signierte CDN-Redirects nicht und gibt deren Geheimnisse niemals aus',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input);if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
  if(url.endsWith('/embed/'))return new Response(JSON.stringify({video_url:'https://scontent.cdninstagram.com/x.mp4?sig=SYNTHETIC_SECRET'}),{headers:{'Content-Type':'text/html'}});
  return new Response(null,{status:302,headers:{Location:'https://evil.example/?sig=SYNTHETIC_SECRET'}});
 });
 const {config}=fixture();let error:unknown;try{await readPublicVideo(new URL(videoSource().url),new URL(videoSource().url),'',config,f as typeof fetch,Date.now()+10000);}catch(e){error=e;}
 expect(error).toMatchObject({code:'VIDEO_SOURCE_REQUIRED'});expect(String(error)).not.toContain('SYNTHETIC_SECRET');expect(f.mock.calls.some(c=>String(c[0]).includes('evil.example'))).toBe(false);
});
it('sperrt private DNS-Adressen vor dem Medienabruf',async()=>{
 const {config}=fixture();const f=vi.fn(async()=>Response.json({Status:0,Answer:[{type:1,data:'127.0.0.1'}]}));
 await expect(readPublicVideo(new URL(videoSource().url),new URL(videoSource().url),'',config,f as typeof fetch,Date.now()+10000)).rejects.toMatchObject({code:'SOURCE_PRIVATE'});
 expect(f).toHaveBeenCalledTimes(2);
});
it('fällt automatisch von unzureichender Beschreibung auf öffentliche Einbettung und MP4 zurück',async()=>{
 const {config}=fixture();config.RECIPE_ALLOWED_HOSTS='';
 const f=vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{
  const url=String(input);
  if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
  expect(options?.redirect).toBe('manual');expect(options?.headers).not.toHaveProperty('Cookie');expect(options?.headers).not.toHaveProperty('Authorization');
  if(url.includes('cdninstagram.com'))return new Response(mp4(51),{headers:{'Content-Type':'video/mp4'}});
  return new Response(url.endsWith('/embed/')?JSON.stringify({video_url:'https://scontent.cdninstagram.com/clip.mp4?sig=SYNTHETIC_SECRET'}):'<meta name="description" content="Easy tofu dinner, watch the video for the recipe.">',{headers:{'Content-Type':'text/html'}});
 });
 const source=await readWeb('https://www.instagram.com/reel/test/?igsh=tracking',config,f as typeof fetch);
 expect(source.provenance).toBe('public_video');expect(source.video?.duration).toBe(51);expect(source.url).toBe('https://www.instagram.com/reel/test/');expect(source.text).not.toContain('SYNTHETIC_SECRET');
});
it('extrahiert sechs Bilder und Audio über separate Media-Eingänge, ohne Browserupload',async()=>{
 const {config,media}=fixture();const result=await preparePublicVideo(videoSource(),config);
 expect(result.frames).toHaveLength(6);expect(result.duration).toBe(50);expect(result.audio.type).toBe('audio/mp4');expect(media.input).toHaveBeenCalledTimes(7);
 await expect(preparePublicVideo(videoSource(),{...config,VIDEO_ANALYSIS_ENABLED:'false'})).rejects.toMatchObject({code:'VIDEO_CONFIGURATION'});
});
it('nutzt ausschließlich OpenAI Audio und Responses mit Bildern und strukturierten Rezeptdaten',async()=>{
 const {config}=fixture();const f=vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{
  if(String(input).includes('/audio/transcriptions'))return Response.json({text:'Tomaten (200 g) zehn Minuten kochen.',usage:{input_tokens:100,output_tokens:20}});
  if(String(input)==='data:,')return new Response('');
  expect(String(input)).toBe('https://api.openai.com/v1/responses');
  const body=JSON.parse(String(options?.body));expect(body.model).toBe('gpt-6.1-terra');expect(body.store).toBe(false);expect(body.text.format.strict).toBe(true);
  expect(body.input[1].content.filter((part:{type:string})=>part.type==='input_image')).toHaveLength(6);
  expect(JSON.stringify(body)).not.toContain('scontent.cdninstagram');expect(body.text.format.schema.required).toContain('cover_frame_index');expect(JSON.parse(body.input.at(-1).content)).toEqual({requested_adaptation:'Hackfleisch durch Halloumi ersetzen'});
  return Response.json({id:'mock',object:'response',status:'completed',model:'gpt-6.1-terra',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({is_recipe:true,recipe,cover_frame_index:4}),annotations:[]}]}],usage:{input_tokens:2000,output_tokens:1500,total_tokens:3500}});
 });
 const source=videoSource();source.adaptation='Hackfleisch durch Halloumi ersetzen';
 const result=await generateVideoRecipe(source,config,'mock-import',f as typeof fetch);
 expect(f.mock.calls.filter(c=>String(c[0]).startsWith('https://api.openai.com/'))).toHaveLength(2);expect(result.recipe.warnings[0]).toContain('sechs Einzelbilder');expect(result.usage.input_tokens).toBe(2100);
 expect(result.image).toMatchObject({mime:'image/jpeg',original_url:videoSource().url,credit:'Standbild aus dem Originalvideo'});
 expect(result.usage.estimated_cost_microusd).toBe(12000);expect(videoReservationCost(config)).toBe(239000);
});
it('beendet Audiofehler ohne Bild-KI-Aufruf und ohne vertrauliche Anbieterfehler',async()=>{
 const {config}=fixture();const f=vi.fn(async(input:RequestInfo|URL)=>String(input)==='data:,'?new Response(''):Response.json({error:{message:'SYNTHETIC_SECRET',type:'rate_limit_error'}},{status:429}));
 await expect(generateVideoRecipe(videoSource(),config,'mock-import',f as typeof fetch)).rejects.toMatchObject({code:'AI_LIMIT'});expect(f.mock.calls.filter(c=>String(c[0]).startsWith('https://api.openai.com/'))).toHaveLength(1);
});
it('zu lange Videos und ausgeschaltete Funktion verursachen keine OpenAI-Anfrage',async()=>{
 const {config}=fixture();const f=vi.fn();const source=videoSource();source.video!.bytes=mp4(91);
 await expect(generateVideoRecipe(source,config,'mock-import',f)).rejects.toMatchObject({code:'VIDEO_LIMIT'});
 await expect(generateVideoRecipe(videoSource(),{...config,VIDEO_ANALYSIS_ENABLED:'false'},'mock-import',f)).rejects.toMatchObject({code:'VIDEO_CONFIGURATION'});expect(f).not.toHaveBeenCalled();
});
it('erfasst Audioaufwand auch bei abgelehntem Rezept und setzt keine Retries ab',async()=>{
 const {config}=fixture();const f=vi.fn(async(input:RequestInfo|URL)=>String(input)==='data:,'?new Response(''):String(input).includes('/audio/transcriptions')?Response.json({text:'Nur Musik.'}):Response.json({id:'mock',object:'response',status:'completed',model:'gpt-6.1-terra',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({is_recipe:false,recipe:null,cover_frame_index:null}),annotations:[]}]}],usage:{input_tokens:100,output_tokens:20,total_tokens:120}}));
 await expect(generateVideoRecipe(videoSource(),config,'mock-import',f as typeof fetch)).rejects.toMatchObject({code:'NO_RECIPE',usage:{estimated_cost_microusd:2700}});expect(f.mock.calls.filter(c=>String(c[0]).startsWith('https://api.openai.com/'))).toHaveLength(2);
});
it('extrahiert ein Vorschaubild mit Original-Seitenverhältnis, echter Quelle und ohne KI-Aufruf',async()=>{
 const {config,media}=fixture();const image=await extractVideoImage(videoSource(),config,4);
 expect(media.input).toHaveBeenCalledTimes(1);expect(image.mime).toBe('image/jpeg');expect(image.bytes.byteLength).toBeGreaterThan(0);
 expect(image.original_url).toBe(videoSource().url);
 await expect(extractVideoImage(videoSource(),config,6)).rejects.toMatchObject({code:'VIDEO_FRAMES'});
});
it('verwirft ungültige und übergroße Vorschaubilder statt sie zu speichern',async()=>{
 const {config,transform}=fixture();
 for(const bytes of [new Uint8Array([255,216,255,1]),new Uint8Array(1048577)]){
  transform.mockImplementation(async()=>new Response(bytes,{headers:{'Content-Type':'image/jpeg'}}));
  await expect(extractVideoImage(videoSource(),config)).rejects.toBeDefined();
 }
});
it('ein fehlgeschlagenes optionales Vorschaubild verwirft kein korrektes Rezept',async()=>{
 const {config,transform}=fixture();let frames=0;
 transform.mockImplementation(async mode=>new Response(mode==='audio'?new Uint8Array([0,1,2]):++frames>6?new Uint8Array([0]):new Uint8Array([255,216,255,1]),{headers:{'Content-Type':mode==='audio'?'audio/mp4':'image/jpeg'}}));
 const f=vi.fn(async(input:RequestInfo|URL)=>String(input)==='data:,'?new Response(''):String(input).includes('/audio/transcriptions')?Response.json({text:'Tomaten (200 g) kochen.'}):Response.json({id:'mock',object:'response',status:'completed',model:'gpt-6.1-terra',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({is_recipe:true,recipe,cover_frame_index:4}),annotations:[]}]}],usage:{input_tokens:100,output_tokens:20,total_tokens:120}}));
 const result=await generateVideoRecipe(videoSource(),config,'optional-image',f as typeof fetch);
 expect(result.recipe.title).toBe(recipe.title);expect(result.image).toBeUndefined();expect(frames).toBe(7);
});
