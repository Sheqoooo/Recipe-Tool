import {test,expect} from '@playwright/test';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
test('aktive Build-Artefakte enthalten weder Einkaufsarchiv noch Kataloge oder Einkaufslogik',async()=>{
 const root=resolve('dist/client'),walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
 const paths=walk(root).map(p=>p.slice(root.length+1));
 expect(paths.filter(p=>/shopping|catalog|archive/.test(p))).toEqual([]);
 const app=readFileSync(resolve(root,'app.js'),'utf8'),css=readFileSync(resolve(root,'style.css'),'utf8'),html=readFileSync(resolve(root,'index.html'),'utf8');
 expect(app+css+html).not.toMatch(/shopping-suggestions|shopping-dock|\/api\/shopping|\/api\/plan|Spülmittel|grocery-grid|data-bring-export|data-ingredients-add/);
 const worker=readFileSync(resolve('.runtime/worker/index.js'),'utf8');
 expect(worker).not.toMatch(/shopping_items|checked_items|FROM plan|INTO plan/);
 expect(existsSync(resolve('archive/shopping-list/web/shopping-dock.ts'))).toBe(true);
 expect(existsSync(resolve('archive/shopping-list/data/catalog/search.json'))).toBe(true);
});
