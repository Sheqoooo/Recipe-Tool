import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('GitHub-Pages-Einstieg zeigt die gestaltete Vorschau ohne API-Aufrufe', async ({ page }, testInfo) => {
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()); });
  // Emulate a Pages project path with only static files, never the Node API.
  await page.route('**/Recipe-Tool/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const files = {
      '/Recipe-Tool/': ['index.html', 'text/html'],
      '/Recipe-Tool/static/index.html': ['static/index.html', 'text/html'],
      '/Recipe-Tool/static/style.css': ['static/style.css', 'text/css'],
      '/Recipe-Tool/static/app.js': ['static/app.js', 'text/javascript'],
    };
    const file = files[path];
    if (!file) return route.fulfill({ status: 404 });
    return route.fulfill({ path: resolve(file[0]), contentType: file[1] });
  });
  await page.goto('/Recipe-Tool/');
  await expect(page.locator('#notice')).toContainText('GitHub-Pages-Vorschau');
  await expect(page.locator('#import-submit')).toBeDisabled();
  await expect(page.locator('#api-key')).toBeDisabled();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 248, 243)');
  await page.screenshot({ path: testInfo.outputPath('pages-preview.png'), fullPage: true });
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('direkt geöffnete HTML-Datei zeigt gestaltete Vorschau und Startanleitung', async ({ page }, testInfo) => {
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()); });
  await page.goto(pathToFileURL(resolve('static/index.html')).href);
  await expect(page.locator('#notice')).toContainText('Dateivorschau');
  await expect(page.locator('#notice')).toContainText('npm start');
  await expect(page.locator('#import-submit')).toBeDisabled();
  await expect(page.locator('#api-key')).toBeDisabled();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 248, 243)');
  await page.screenshot({ path: testInfo.outputPath('file-preview.png'), fullPage: true });
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('abgelaufene API-Anmeldung bietet einen bleibenden Link zur erneuten Anmeldung',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/state',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Die Access-Anmeldung ist ungültig oder abgelaufen.',code:'UNAUTHENTICATED'})}));
  await page.goto('/');
  const recovery=page.locator('#access-recovery');
  await expect(recovery).toBeVisible();await expect(recovery).toContainText('erneut an');
  await expect(recovery.getByRole('link',{name:'Erneut anmelden'})).toHaveAttribute('href','/cdn-cgi/access/logout');
  await expect(recovery).toContainText('andere Apps dieses Teams');
  await page.screenshot({path:info.outputPath('access-recovery.png'),fullPage:true});
  expect(errors).toEqual([]);
});


test('Rezepte importieren, öffnen und korrigieren ohne interne Einkaufsliste',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#source').fill('https://example.com/recipe-only-'+info.project.name);await page.locator('#import-submit').click();
 await expect(page.locator('#view-collection')).toBeVisible();await expect(page.locator('[data-view="shopping"]')).toHaveCount(0);
 await page.locator('[data-open]').first().click();await expect(page.locator('#recipe-dialog')).toBeVisible();
 await page.getByRole('button',{name:'Bearbeiten',exact:true}).click();await page.locator('#edit-title').fill('Korrigiertes Rezept');
 await page.getByRole('button',{name:'Rezept speichern ✓'}).click();
 await expect(page.locator('#recipe-grid')).toContainText('Korrigiertes Rezept');
 await page.screenshot({path:info.outputPath('recipe-only-collection.png'),fullPage:true});expect(errors).toEqual([]);
});
test('Bring-Zielliste einrichten und einzelne Zutaten über Plus senden',async({page},info)=>{
 const requests=[],errors=[],payloads=[];let ready=false,inFlight=0,maxInFlight=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('getbring.com'))requests.push(r.url());});
 const imported=await page.request.post('/api/import',{headers:{Origin:'http://127.0.0.1:8877','X-Rezeptwerk-Request':'1'},data:{value:'https://example.com/bring-single-'+info.project.name}});expect(imported.ok()).toBe(true);const {id}=await imported.json();
 const state=await(await page.request.get('/api/state')).json(),recipe=state.recipes.find(r=>r.id===id);
 const saved=await page.request.post('/api/recipes/save',{headers:{Origin:'http://127.0.0.1:8877','X-Rezeptwerk-Request':'1'},data:{...recipe,ingredients:[...recipe.ingredients,{name:'Salz',amount:null,unit:'',note:'nach Geschmack'}]}});
 expect(saved.ok()).toBe(true);
 await page.route('**/api/state',async route=>{const response=await route.fetch(),state=await response.json();state.bring={enabled:true,ready,list_name:ready?'Zuhause':null,revision:ready?1:0};await route.fulfill({response,json:state});});
 await page.route('**/api/bring/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path.endsWith('/lists'))return route.fulfill({json:{lists:[{id:'11111111-1111-4111-8111-111111111111',name:'Zuhause'}]}});
   if(path.endsWith('/configure')){ready=true;return route.fulfill({json:{ok:true}});}
   const body=route.request().postDataJSON();payloads.push(body);expect(body.recipe_id).toBe(id);expect([0,1]).toContain(body.ingredient_index);expect(body.target_revision).toBe(1);
   inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(r=>setTimeout(r,150));inFlight--;
   await route.fulfill({json:{ok:true,existing:false,count:1,list_name:'Zuhause'}});
 });
 await page.goto('/#settings');await page.locator('#bring-load-lists').click();await page.locator('#bring-list').selectOption('11111111-1111-4111-8111-111111111111');await page.locator('#bring-form button').click();await expect(page.locator('#bring-status')).toContainText('Zuhause');
 await page.getByRole('button',{name:/Meine Rezepte/}).click();await page.locator('.recipe-cover[data-open="'+id+'"]').click();
 await expect(page.getByRole('button',{name:'Zutaten an Bring! senden'})).toHaveCount(0);
 const plus=page.locator('[data-bring-ingredient="0"]');await expect(plus).toHaveAttribute('aria-label','Tomaten an Bring! senden');await plus.click();await page.locator('[data-bring-ingredient="1"]').click();await expect(plus).toHaveText('✓');await expect(page.locator('[data-bring-ingredient="1"]')).toHaveText('✓');
 expect(payloads.map(p=>p.ingredient_index)).toEqual([0,1]);expect(maxInFlight).toBe(1);expect(payloads).toHaveLength(2);expect(requests).toEqual([]);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('bring-recipe-plus.png'),fullPage:true});
});
test('alte Einkaufslinks führen zum Kochbuch; nur Futterluke bleibt installierbar',async({page})=>{
 await page.goto('/shopping/');await expect(page.locator('#view-collection')).toBeVisible();expect(new URL(page.url()).pathname).toBe('/recipes/');
 const manifest=await(await page.request.get('/recipes.webmanifest')).json();expect(manifest.name).toBe('Futterluke');
 await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/icons/recipes-180.png');
 for(const path of ['/shopping.webmanifest','/shopping-dark.webmanifest','/catalog/search.json','/archive/shopping-list/web/app.ts'])expect((await page.request.get(path)).status()).toBe(404);
});
