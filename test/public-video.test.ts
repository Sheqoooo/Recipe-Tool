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
 expect(media.input).toHaveBee…2332 tokens truncated…tdaten noch Fehlermeldungen. Wechselnde Instagram-Antworten können beide Erkennungswege verhindern; fehlende Erkennung beweist keinen privaten Beitrag.

`Source.provenance` kennzeichnet die flüchtige Grundlage (`description`, `provided_text` oder `public_video`). Die Generierung ergänzt daraus entsprechende Hinweise am Rezept. D1 speichert weiterhin den generischen Quelltyp `web` bzw. den historischen YouTube-Texttyp; keine Migration nötig. `VIDEO_SOURCE_REQUIRED` öffnet erst nach gescheitertem automatischem Import die optionale Textbereitstellung. Keine Uploads. Der automatisch aufgelöste Medienpfad in `public-video.ts` und `video-analysis.ts` ist mit Featureflag plus MEDIA-Binding doppelt gesperrt. Er validiert CDN-Host/DNS, vollständige MP4-Dauer (90 s) und Größe (16 MiB), extrahiert Audio/sechs Bilder nativ und nutzt ausschließlich OpenAI Audio/Responses. Zusätzliche Budgetreservierung erfolgt atomar vor Medien-/KI-Verarbeitung; keine Migration. Ton/Bilder sind Stichproben und keine Garantie eines vollständigen Rezepts. Produktionslaufzeit ist noch nicht geprüft. [Grenzen/Modelle](docs/OPENAI-VIDEO.md).

## Begrenzungen

Die Sammlung liefert derzeit maximal 500 Rezepte je Zustandsantwort. Rezeptauswahl, Zutaten und Schritte werden in einem D1-Batch aus derselben begrenzten Auswahl gelesen; Detailtabellen verwenden ihre Rezept-ID-Indizes statt sämtliche Details zurückzugeben. Die Zuordnung im Worker erfolgt einmal über Maps statt wiederholter Vollfilter. Der Listenindex unterstützt die sortierte Auswahl. Eine paginierte Suche ist weiterhin offen; Die frühere Planung und ihre Häkchen sind archiviert. Keine Favoriten/Tags, keine automatische Synonym-/Packungsgrößenauflösung und kein JSON-Reimport. Die Preview ist standardmäßig authentifiziert und ohne DB/Secret schreibgeschützt; produktionsnahe Preview-Daten sind absichtlich nicht vorbereitet.

## Schutz der Quell-URLs

Gemeinsame URL-Validierung in `src/shared/source-url.ts`: bekannte Zugangsschlüssel-Namen, case-/trennzeichen-/kodierungsvarianten und verschachtelte URL-Parameter werden abgewiesen. Sie greift vor dem Abruf, bei Redirects, nach Quellenadaptern sowie direkt im Repository vor Reservierung/Speicherung. API-Sammlung und Importhistorie blenden unzulässige historische Quell-URLs aus, ohne DB-Werte eigenständig zu ändern. Nicht sensible Rezeptparameter bleiben erhalten. Grenzen der heuristischen Erkennung stehen in SECURITY.md.

Live-Nachweis: [manuelle Checkliste](docs/SMOKE-TEST.md), noch nicht ausgeführt. Der automatische YouTube-Videoimport bleibt ein langfristiges Produktziel; Transkriptverarbeitung ist nur ein Zwischenstand.

### Optionale Rezeptbilder
`source-image.ts` extrahiert Bildmetadaten getrennt vom KI-Text. `image.ts` lädt höchstens einen Kandidaten über die vorhandenen URL-/DNS-/Redirect-Schutzregeln. Nach erfolgreicher Rezeptvalidierung wird das Bild im selben D1-Batch wie das Rezept in `recipe_images` gespeichert. Die Sammlung lädt nur Bildmetadaten, keine BLOBs. Ein authentifizierter GET `/api/recipes/:id/image` liefert die Bytes. Migration `0003_recipe_images.sql` erweitert die bestehende D1; keine weitere Ressource.

### Importierte Suchdaten
`data/catalog/bls.json` und `open-food-facts.json` sind getrennte, öffentlich lizenzierte Auszüge. `search.json` ist die deduplizierte Suchprojektion; `SOURCES.json` enthält Versionen, Hashes und Zählungen. `scripts/import-product-data.py` erzeugt sie deterministisch aus lokal bereitgestellten offiziellen Quelldateien, ohne Netz- oder Datenbankzugriff. Die Anwendung lädt die Suchprojektion im Bundle. Exakte Namens-/Synonymzuordnung verwendet Maps, beschreibende Zusätze kurze Wortgruppen; keine wiederholte Volltextklassifizierung aller 5.000 Begriffe pro Artikel. Kategorien sind Heuristiken. Produktionsbuild enthält zusätzlich herunterladbare, geschützte `/catalog/`-Kopien. Private Nutzerdaten bleiben ausschließlich in D1.


### Ausgewählte Video-Standbilder
Der Video-Responses-Umschlag erweitert ausschließlich den Medienpfad um `cover_frame_index` (0–5 oder null). Die Auswahl wird im selben strukturierten Rezeptaufruf validiert; der normale Textvertrag bleibt unverändert. `extractVideoImage` extrahiert den gewählten Zeitpunkt erneut aus den vorübergehend vorhandenen Originalbytes mit nur einer Zielbreite (960 px), damit kein quadratischer Rand in das Foto eingebrannt wird. Header/Dimensionen und höchstens 1 MiB JPEG werden geprüft. Ein Bildfehler verwirft kein gültiges Rezept. `Generated.image` bleibt ein serverinterner Übergabewert; D1 speichert nur das eine Bild in der bereits vorhandenen `recipe_images`-Tabelle.

POST `/api/recipes/video-image` ergänzt nur fehlende Bilder eigener Rezepte bzw. aller Rezepte für Admins. Der explizite Bildpfad kann die Videoquelle auch bei ausreichender Beschreibung laden, ohne Rezept-KI aufzurufen. Für diese Nachladung und den Bildfallback nach Beschreibungsimport wird ein früher Frame bei 5 % verwendet, keine behauptete KI-Auswahl. Identität, Origin, Besitzer, Plattform, Freischaltung und persistentes Anfragekontingent werden vor dem Abruf geprüft. Die Reservierung begrenzt Missbrauch und bleibt bestehen; verbuchter OpenAI-Verbrauch beträgt null. Vorhandene Bilder bleiben über `ON CONFLICT DO NOTHING` erhalten, auch bei konkurrierenden Anfragen. Keine Migration oder Neuerstellung alter Rezepttexte.

Die Oberfläche setzt das Importformular unmittelbar nach erfolgreicher API-Antwort zurück, bevor die Sammlung erneut geladen wird. Ein gescheiterter Import behält die Eingabe. Optionale Texte und Zustimmung werden gemeinsam mit dem Link gelöscht.

### Optionale kulinarische Importwünsche
`src/shared/adaptation.ts` normalisiert und validiert das optionale API-Feld `adaptation` (höchstens 400 UTF-16-Codeeinheiten; unzulässige Steuerzeichen abweisen, NFC und Leerraum normalisieren). Der Worker prüft es vor Quellenabruf, Reservierung und KI. `Source.adaptation` bleibt über Text-, Transkript- und Videoaufbereitung erhalten. Die zusätzliche letzte Nutzernachricht enthält ausschließlich den validierten Wunsch; Quelldaten bleiben eine getrennte unzuverlässige Nachricht. Feste Entwickleranweisungen erlauben nur kulinarische Änderungen, konsistente Zutaten-/Schrittreferenzen und keine erfundenen numerischen Mengen/Zeiten/Temperaturen. Das bestehende Structured-Outputs-Schema und serverseitige Validierung bleiben unverändert.

Die vorhandene menschlich lesbare Warnung `Nach Nutzerwunsch angepasst: …` dient zugleich als Variantenkennzeichnung. Keine versteckten Hashes, Queryparameter oder neue Tabellenspalte. `Repository.bySource` filtert über den bestehenden Quellenindex und parametrisierte `json_each(warnings_json)`-Prüfungen: Originale ohne Kennzeichnung, Varianten mit exakt passendem normalisiertem Hinweis. KI-generierte Kennzeichnungen werden vor dem Speichern entfernt und ausschließlich aus der validierten Eingabe neu gesetzt. `Repository.edit` erhält die einmal gesetzte Kennzeichnung und erlaubt keine Fälschung über das frei editierbare Warnungsfeld. Dies ist eine bewusste kompatible Lösung ohne Migration; bei späteren komplexeren Variantenbeziehungen wäre eine dedizierte Metadatentabelle sinnvoll.

Reservierung berücksichtigt die zusätzliche Wunsch-/Anweisungslänge vor jedem KI-Aufruf. Kein zweiter Generierungsschritt. Das bestehende Quellen-Parallelitätslimit gilt auch für verschiedene Varianten desselben Links. Die nachträgliche Änderung des Variantenwunsches ist kein Editorfeature; dafür erneut mit anderem Wunsch importieren. Semantische Kochqualität wird durch Modellanweisungen unterstützt, aber nicht durch die formale Schema-/Indexvalidierung bewiesen.

## Optionale Bring!-Anbindung

Futterluke kann jeweils eine Zutat eines gespeicherten Rezepts über deren Plus-Schaltfläche direkt an eine gemeinsame Bring!-Liste senden. Diese Anbindung ist **inoffiziell** und kann durch Änderungen bei Bring! ausfallen. Es gibt keine automatische Synchronisation, keinen Import fremder Bring!-Listeninhalte und keine Lösch-/Abhakfunktion für Bring!. Die frühere interne Einkaufsliste ist ausschließlich im Quellcodearchiv erhalten und wird nicht ausgeliefert. Übertragen werden die Mengen des gespeicherten Rezepts, ohne automatische Portionsskalierung. Zutaten ohne zuverlässige Mengen bleiben „Menge offen“. Unbekannte Artikelnamen können als eigene Bring!-Artikel erscheinen; es erfolgt keine zusätzliche KI-Auswertung.

Ein gemeinsames Bring!-Konto für dieses Kochbuch wird ausschließlich serverseitig über Worker Secrets angebunden. Administratoren laden in Einstellungen → Bring! die verfügbaren Listen und wählen die gemeinsame Zielliste. Normale freigegebene Mitglieder können danach Rezeptzutaten senden; sie können weder die Zielliste ändern noch weitere Bring!-Listen abrufen. Alle Mitglieder nutzen dieselbe Bring!-Verbindung. Es werden Zutaten/Mengen an Bring! übermittelt, keine Rezeptquelle, keine Arbeitsschritte und keine Cloudflare-Nutzer-E-Mail.

Ein PUT mit genau einer Zutat pro Export, keine automatischen Schreibwiederholungen. Identische Rezeptfassung/Zielliste/Zutatenposition werden haushaltsweit zehn Minuten dedupliziert, auch bei parallelen Klicks. Bei unklarem Ergebnis muss die Bring!-Liste geprüft werden; für zehn Minuten erfolgt kein erneutes Senden. Das ist keine garantierte Exactly-once-Zustellung über zwei unabhängige Dienste. Nach Ablauf des Schutzfensters ist ein bewusster neuer Export möglich; Bring! kann dann weitere gleichnamige Artikel anlegen. Namen/Mengen werden nicht mit vorhandenen Bring!-Artikeln zusammengeführt.

Maximal 30 einzelne Zutatenexporte sowie jeweils fünf Aktionen je Einrichtungstyp pro Minute für das gemeinsame Konto, höchstens eine laufende Aktion (60 Sekunden Sperrfenster) und 128 KiB JSON-Antworten. Die Oberfläche reiht schnelle Klicks ohne automatische Wiederholung nacheinander ein. Zehn Sekunden Timeout pro Bring!-HTTP-Anfrage, feste HTTPS-API-Adresse, UUID-validierte Pfade, keine Redirects, keine frei wählbaren Zielhosts. Login-Tokens bleiben nur im Arbeitsspeicher der einzelnen Aktion; kein Token-/Passwort-Logging und keine Browser- oder D1-Speicherung. Die D1-Migration `0006_bring_exports.sql` enthält ausschließlich Ziellistenkonfiguration und kurzlebige Anfragestatus (sieben Tage Aufbewahrung), keine Zugangsdaten. Ein fehlendes Schema deaktiviert die Bring!-Einrichtung, ohne die übrige App zu blockieren.

Quellen/Protokollstand geprüft am 14.11.2026: [bring-api, inoffizieller Client](https://github.com/miaucl/bring-api), [Bring!-Anmeldung in Home Assistant](https://www.home-assistant.io/integrations/bring/). Der TypeScript-Adapter verwendet Workers-fetch direkt; kein Python-Dienst und keine zusätzliche Laufzeitabhängigkeit.

## Archivierte interne Einkaufsliste (14.11.2026)

Der frühere Einkaufsbereich und die Kochplanung wurden aus aktiven HTML-/TypeScript-/CSS-, Worker- und Build-Einstiegen entfernt. Der eingefrorene Quellstand samt Tests und Kataloglizenzen liegt unter `archive/shopping-list/` (Baseline `d9589a0698b99d17dc1bb555980a2f9bc9911c53`). Keine aktiven Imports, keine Auslieferung des Archivs und keine Kopie von Katalogen oder Einkaufsicons in `dist/client`. Der Build reinigt vor jeder Erstellung ausschließlich seinen festen generierten Zielordner, damit keine alten Assets übrig bleiben.

Nur Futterluke hat noch ein Manifest und das unveränderte Zitronensymbol. Alte `/shopping/`- und `/shopping/dark/`-Aufrufe führen nach Authentifizierung per 302 zu `/recipes/#collection`; alte Einkaufsmanifeste, Icons, Kataloge und `/archive/` liefern 404. Frühere `/api/shopping/*` und `/api/plan` bleiben nach Authentifizierung 404. `/api/state` enthält keine Koch-/Einkaufslistenfelder und fragt die alten Tabellen nicht ab.

Plus neben einer Rezeptzutat sendet `recipe_id`, `revision`, `target_revision` und den einzelnen `ingredient_index` an `POST /api/bring/export`. Ein fehlender Index/Bulk-Aufruf wird vor Fremdzugriff abgewiesen. Die Zutat samt Menge stammt ausschließlich aus der gespeicherten passenden Rezeptrevision. Deduplizierung berücksichtigt die Zutatenposition; andere Zutaten desselben Rezepts können sofort danach übertragen werden. Keine Sammelschaltfläche, keine Katalog-/Emoji-Funktion im Bundle. Schnelle Klicks werden clientseitig seriell abgearbeitet; serverseitig 30 Exporte/Minute und weiterhin ein laufender Vorgang. Keine automatische Schreibwiederholung.

Keine neue SQL-Migration. Historische Tabellen `shopping_items`, `plan` und `checked_items` und deren Daten bleiben erhalten; die aktive App liest oder bearbeitet sie nicht. Historische Migrationen bleiben vollständig für reproduzierbare D1-Neuinstallationen bestehen. Ein Wiederherstellen des Archivs ist eine bewusste spätere Entwicklungsentscheidung mit separatem Branch, Tests und Freigabe, kein Laufzeit-Schalter.
