import { build } from 'esbuild';
import { mkdir,copyFile } from 'node:fs/promises';
await mkdir('dist/client',{recursive:true});
for(const file of ['index.html','style.css'])await copyFile('web/'+file,'dist/client/'+file);
await build({entryPoints:['web/app.ts'],outfile:'dist/client/app.js',bundle:true,format:'esm',target:'es2022',minify:true});
