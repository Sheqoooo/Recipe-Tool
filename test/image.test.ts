import {it,expect,vi} from 'vitest';
import {extractSourceImage} from '../src/worker/source-image.js';
import {fetchRecipeImage,MAX_IMAGE_BYTES} from '../src/worker/image.js';
import {localEnv} from './fixtures.js';
const config={...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''};
function png(width=640,height=480){const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
function network(response:()=>Response){return vi.fn(async(input:RequestInfo|URL)=>String(input).includes('dns-query')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):response());}
it('bevorzugt Recipe-Bild mit Urheber und löst relative Pfade auf',()=>{
  const html='<meta property="og:image" content="/fallback.png"><script type="application/ld+json">'+JSON.stringify({'@type':'Recipe',image:{'@type':'ImageObject',contentUrl:'../food.png',creditText:'Foto: Beispiel'}})+'</script>';
  expect(extractSourceImage(html,'https://recipes.example/path/page')).toEqual({url:'https://recipes.example/food.png',credit:'Foto: Beispiel'});
});
it('nutzt Metadaten-Fallback, ignoriert beliebige Bilder und geheime URLs',()=>{
  expect(extractSourceImage('<img src="/avatar.png">','https://recipes.example')).toBeUndefined();
  expect(extractSourceImage('<meta property="og:image" content="/food.png?apikey=SECRET"><meta name="twitter:image" content="/safe.png">','https://recipes.example')).toEqual({url:'https://recipes.example/safe.png',credit:''});
});
it('lädt begrenztes Bild mit geprüften Dimensionen ohne Zugangsdaten',async()=>{
  const fetcher=network(()=>new Response(png(),{headers:{'Content-Type':'image/png'}}));
  const result=await fetchRecipeImage({url:'https://images.example/food.png',credit:'Foto'},config,fetcher as typeof fetch);
  expect(result.mime).toBe('image/png');expect(result.bytes.byteLength).toBe(32);
  expect(fetcher.mock.calls.some(c=>String(c[0]).includes('images.example'))).toBe(true);
});
it.each(['image/svg+xml','text/html'])('blockiert ausführbare oder ungeeignete Bildtypen: %s',async mime=>{
  await expect(fetchRecipeImage({url:'https://images.example/a',credit:''},config,network(()=>new Response('<svg/>',{headers:{'Content-Type':mime}})) as typeof fetch)).rejects.toBeDefined();
});
it('blockiert falsche Signatur, Trackingpixel, übergroße Dimensionen und Daten',async()=>{
  for(const data of [new Uint8Array(32),png(1,1),png(8000,8000),new Uint8Array(MAX_IMAGE_BYTES+1)]){
    await expect(fetchRecipeImage({url:'https://images.example/a',credit:''},config,network(()=>new Response(data,{headers:{'Content-Type':'image/png'}})) as typeof fetch)).rejects.toBeDefined();
  }
});
it.each(['https://127.0.0.1/a','https://images.example/a?X-Amz-Signature=SECRET'])('blockiert unsichere Bildredirects vor Abruf: %s',async destination=>{
  const fetcher=network(()=>new Response(null,{status:302,headers:{Location:destination}}));
  await expect(fetchRecipeImage({url:'https://images.example/a',credit:''},config,fetcher as typeof fetch)).rejects.toBeDefined();
  expect(fetcher.mock.calls.some(c=>String(c[0])===destination)).toBe(false);
});
