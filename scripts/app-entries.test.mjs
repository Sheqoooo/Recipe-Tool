import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appDefinitions,appManifest,appHtml} from './app-entries.mjs';
import {iconPng} from './app-icons.mjs';
test('separate install entries keep unique identities, starts and Apple icons',()=>{
 const manifests=appDefinitions.map(appManifest);
 assert.notEqual(manifests[0].id,manifests[1].id);assert.equal(manifests[1].start_url,'/shopping/');
 for(const app of appDefinitions){const html=appHtml('<head><title>Futterluke · Dein Kochbuch</title></head><link href="./style.css"><script src="./app.js"></script>',app);assert.ok(html.includes('/icons/'+app.key+'-180.png'));assert.ok(html.includes('/'+app.key+'.webmanifest'));assert.ok(html.includes('href="/style.css"'));assert.ok(html.includes('src="/app.js"'));}
});
test('original lemon and cart icons are distinct white-background RGB PNGs',()=>{
 const lemon=iconPng('recipes',180),cart=iconPng('shopping',180);
 assert.equal(lemon.readUInt32BE(16),180);assert.equal(lemon.readUInt32BE(20),180);assert.equal(lemon[25],2);assert.notDeepEqual(lemon,cart);
 assert.deepEqual([...cart.subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
