import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appDefinitions,appManifest,appHtml,appIconPath} from './app-entries.mjs';
import {iconPng} from './app-icons.mjs';
test('Futterluke is the only active install entry',()=>{
 assert.deepEqual(appDefinitions.map(a=>a.key),['recipes']);
 const app=appDefinitions[0],manifest=appManifest(app);
 assert.equal(manifest.id,'/recipes/');assert.equal(manifest.start_url,'/recipes/');
 const html=appHtml('<head><title>Futterluke · Dein Kochbuch</title></head><link href="./style.css"><script src="./app.js"></script>',app);
 assert.ok(html.includes(appIconPath(app,180)));assert.ok(html.includes('/recipes.webmanifest'));
 assert.ok(html.includes('href="/style.css"'));assert.ok(html.includes('src="/app.js"'));
 assert.ok(!html.includes('shopping'));assert.equal(manifest.icons.length,3);
});
test('Futterluke lemon icon remains byte-identical',()=>{
 const png=iconPng('recipes',180);
 assert.equal(png.readUInt32BE(16),180);assert.equal(png.readUInt32BE(20),180);
 assert.equal(createHash('sha256').update(png).digest('hex'),'238d519b13ad548660fa999bfcba925f74e7e069a3e554bbf6a812aa2ced13a4');
 assert.throws(()=>iconPng('shopping',180));
});
