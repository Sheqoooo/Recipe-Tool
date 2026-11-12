import {buildAppIcons} from './app-icons.mjs';
import {appDefinitions,appManifest,appHtml} from './app-entries.mjs';
import { build } from 'esbuild';
import { mkdir,copyFile,readFile,writeFile } from 'node:fs/promises';
const demo=process.argv.includes('--demo');
const output=demo?'.runtime/demo':'dist/client';
await mkdir(output,{recursive:true});
for(const file of ['index.html','style.css'])await copyFile('web/'+file,output+'/'+file);
await build({entryPoints:['web/app.ts'],outfile:output+'/app.js',bundle:true,format:'esm',target:'es2022',minify:true,define:{__REZEPTWERK_DEMO__:String(demo)}});
if(demo){
  // A portable, offline single-file preview; kept outside the production assets directory.
  const html=await readFile(output+'/index.html','utf8');
  const css=await readFile(output+'/style.css','utf8'),js=await readFile(output+'/app.js','utf8');
  await writeFile(output+'/rezeptwerk-demo.html',html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css.replaceAll('</style','<\\/style')+'</style>').replace('<script src="./app.js" defer></script>',()=>'<script type="module">'+js.replaceAll('</script','<\\/script')+'</script>'));
}

await buildAppIcons(output);
if(!demo){
 const html=await readFile('web/index.html','utf8');
 for(const app of appDefinitions){
  await mkdir(output+'/'+app.key,{recursive:true});
  await writeFile(output+'/'+app.key+'/index.html',appHtml(html,app));
  await writeFile(output+'/'+app.key+'.webmanifest',JSON.stringify(appManifest(app),null,2));
 }
 await writeFile(output+'/index.html',appHtml(html,appDefinitions[0]));
}

if(!demo){await mkdir(output+'/catalog',{recursive:true});for(const file of ['bls.json','open-food-facts.json','search.json','SOURCES.json','LICENSE.md','README.md'])await copyFile('data/catalog/'+file,output+'/catalog/'+file);}
