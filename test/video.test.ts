import {it,expect,vi} from 'vitest';
import {videoLink,videoPlatform} from '../src/shared/video-platform.js';
import {socialDescription} from '../src/worker/social-description.js';
import {readWeb,transcriptSource} from '../src/worker/source.js';
import {localEnv} from './fixtures.js';
it.each(['https://www.youtube.com/shorts/abcdefghijk','https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk'])('normalisiert YouTube %s',url=>expect(videoLink(url).href).toBe('https://www.youtube.com/watch?v=abcdefghijk'));
it('erkennt explizite Hosts, gültige Pfade und entfernt Tracking erst nach Secret-Prüfung',()=>{
 expect(videoPlatform(new URL('https://www.instagram.com/reel/abc/'))).toBe('instagram');
 expect(videoLink('https://www.instagram.com/reel/abc/?igsh=tracking').search).toBe('');
 expect(videoPlatform(new URL('https://instagram.com.attacker.example/reel/abc/'))).toBeUndefined();
 expect(()=>videoLink('https://www.instagram.com/reel/abc/?access_token=private')).toThrow();
 expect(()=>videoLink('https://www.tiktok.com/@cook')).toThrow();
 expect(videoLink('https://vm.tiktok.com/Example/').hostname).toBe('vm.tiktok.com');
});
it('liest Metadaten ohne Script-Ausführung und fordert bei Login-/Leertext eine Alternative',()=>{
 const caption='Zutaten: 200 g Tomaten, 100 g Reis. Den Reis kochen und die Tomaten würfeln. Alles mischen und servieren.';
 expect(socialDescription('<meta property="og:description" content="'+caption+'"><script>throw Error()</script>')).toBe(caption);
 expect(()=>socialDescription('<meta name="description" content="Log in to Instagram">')).toThrow();
});
const dns=()=>Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
it('liest eine öffentliche Rezeptbeschreibung nach DNS-Prüfung',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?dns():new Response('<meta name="description" content="Zutaten: 200 g Tomaten und 100 g Reis. Alles kochen, abschmecken und in einer großen Schüssel servieren.">',{headers:{'content-type':'text/html'}}));
 const source=await readWeb('https://www.instagram.com/reel/abc/',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},f as typeof fetch);
 expect(source.provenance).toBe('description');expect(source.text).toContain('200 g');
});
it('folgt höchstens einer externen Rezeptseite mit identischen SSRF-Prüfungen',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input);if(url.includes('dns-query'))return dns();
  return new Response(url.includes('instagram.com')?'<meta name="description" content="Rezept: https://recipes.example/pasta">':'<h1>Pasta</h1><p>200 g Tomaten kochen.</p>',{headers:{'content-type':'text/html'}});
 });
 const source=await readWeb('https://www.instagram.com/reel/abc/',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},f as typeof fetch);
 expect(source.url).toBe('https://www.instagram.com/reel/abc/');expect(source.text).toContain('200 g Tomaten');
 expect(f.mock.calls.filter(c=>String(c[0]).includes('dns-query'))).toHaveLength(4);
});
it('sperrt private und geheime Weiterleitungen ohne deren Inhalt im Fehler zu wiederholen',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?dns():new Response(null,{status:302,headers:{Location:'https://recipes.example/path?access_token=PRIVATE_VALUE'}}));
 await expect(readWeb('https://vm.tiktok.com/Example/',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},f as typeof fetch)).rejects.toMatchObject({code:'PRIVATE_URL'});
 expect(f.mock.calls.some(c=>String(c[0]).includes('PRIVATE_VALUE'))).toBe(false);
});
it('erzeugt bei fehlender Beschreibung eine klare Alternative statt vorgetäuschter Videoanalyse',async()=>{
 const f=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?dns():new Response('<p>Log in</p>',{headers:{'content-type':'text/html'}}));
 await expect(readWeb('https://www.youtube.com/shorts/abcdefghijk',{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''},f as typeof fetch)).rejects.toMatchObject({code:'VIDEO_SOURCE_REQUIRED'});
});
it('akzeptiert ausdrücklich bereitgestellten Text aller drei Plattformen und prüft die Bestätigung',()=>{
 expect(transcriptSource('https://www.instagram.com/reel/abc/','Zutaten: 200 g Tomaten. In Stücke schneiden und kochen.',true,60).provenance).toBe('provided_text');
 expect(transcriptSource('https://www.tiktok.com/@cook/video/123','Zutaten: 200 g Tomaten. In Stücke schneiden und kochen.',true,60).kind).toBe('web');
 expect(()=>transcriptSource('https://www.tiktok.com/@cook/video/123','x'.repeat(80),false,60)).toThrow();
});
