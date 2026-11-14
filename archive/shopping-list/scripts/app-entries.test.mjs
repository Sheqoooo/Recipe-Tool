import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appDefinitions,appManifest,appHtml,appIconPath} from './app-entries.mjs';
import {iconPng} from './app-icons.mjs';
test('separate install entries keep unique identities, starts and Apple icons',()=>{
 const manifests=appDefinitions.map(appManifest);
 assert.notEqual(manifests[0].id,manifests[1].id);assert.equal(manifests[1].start_url,'/shopping/');
 for(const app of appDefinitions){const html=appHtml('<head><title>Futterluke · Dein Kochbuch</title></head><link href="./style.css"><script src="./app.js"></script>',app);assert.ok(html.includes(appIconPath(app,180)));assert.ok(html.includes('/'+app.key+'.webmanifest'));assert.ok(html.includes('href="/style.css"'));assert.ok(html.includes('src="/app.js"'));}
});
test('lemon and filled shopping-bag icons have different formats and preserve dimensions',()=>{
 const lemon=iconPng('recipes',180),cart=iconPng('shopping',180);
 assert.equal(lemon.readUInt32BE(16),180);assert.equal(lemon.readUInt32BE(20),180);assert.equal(lemon[25],2);assert.equal(cart[25],6);assert.notDeepEqual(lemon,cart);
 assert.deepEqual([...cart.subarray(0,8)],[137,80,78,71,13,10,26,10]);
});

test('lemon artwork stays byte-identical and shopping has transparent/light/dark appearances',async()=>{
 const {createHash}=await import('node:crypto'),{inflateSync}=await import('node:zlib');
 assert.equal(createHash('sha256').update(iconPng('recipes',180)).digest('hex'),'238d519b13ad548660fa999bfcba925f74e7e069a3e554bbf6a812aa2ced13a4');
 const pixels=png=>{let at=8;const chunks=[];while(at<png.length){const length=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8);if(type==='IDAT')chunks.push(png.subarray(at+8,at+8+length));at+=length+12;}return inflateSync(Buffer.concat(chunks));};
 assert.deepEqual([...pixels(iconPng('shopping',180)).subarray(1,5)],[0,0,0,0]);
 assert.deepEqual([...pixels(iconPng('shopping',180,'light')).subarray(1,4)],[255,255,255]);
 assert.deepEqual([...pixels(iconPng('shopping',180,'dark')).subarray(1,4)],[30,32,29]);
 const dark={...appDefinitions[1],iconAppearance:'dark'};assert.equal(appManifest(dark).id,'/shopping/');assert.equal(appManifest(dark).start_url,'/shopping/dark/');assert.ok(appHtml('<head></head>',dark).includes('/shopping-dark.webmanifest'));
});
