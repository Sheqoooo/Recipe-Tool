import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync('data/catalog/'+name,'utf8'));
test('imported catalogs retain provenance, licenses, identifiers and bounded safe names',()=>{
 const meta=read('SOURCES.json'),bls=read('bls.json'),off=read('open-food-facts.json'),search=read('search.json');
 assert.equal(meta.sources[0].entries,bls.length);assert.equal(meta.sources[1].entries,off.length);assert.equal(meta.search_entries,search.length);
 assert.equal(meta.sources[0].license,'CC-BY-4.0');assert.equal(meta.sources[1].license,'ODbL-1.0');
 const departments=new Set(['produce','bakery','pantry','drinks','household','other','chilled','meat','frozen']);
 for(const row of [...bls,...off]){assert.ok(row.id);assert.ok(row.name.length>=2&&row.name.length<=100);assert.ok(!/[<>{}\u0000-\u001f]/.test(row.name));assert.ok(departments.has(row.department));assert.ok(row.aliases.length<=6);}
 for(const row of search){assert.equal(row.length,3);assert.ok(departments.has(row[2]));}
 assert.ok(bls.some(row=>/Pastinake/i.test(row.name)));assert.ok(off.some(row=>/Karamellsirup/i.test(row.name)));
 assert.ok(!off.some(row=>/Imazalil/i.test(row.name)));
});

test('only public snapshots are unignored; local sources and private records stay excluded',async()=>{
 const {spawnSync}=await import('node:child_process');
 for(const path of ['.dev.vars','.env','.runtime/catalog-sources/bls.zip','data/catalog/private.sqlite','data/catalog/private.json','data/recipes.json'])assert.equal(spawnSync('git',['check-ignore','--no-index','-q',path]).status,0,path);
 for(const path of ['data/catalog/bls.json','data/catalog/open-food-facts.json','data/catalog/search.json','data/catalog/SOURCES.json','data/catalog/LICENSE.md','data/catalog/README.md'])assert.equal(spawnSync('git',['check-ignore','--no-index','-q',path]).status,1,path);
});
