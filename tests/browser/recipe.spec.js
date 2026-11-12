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

test('Link eingeben, automatisch speichern, einkaufen und erst danach korrigieren', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await (await page.request.get('/api/state')).json();
  for (const recipe of state.recipes) await page.request.post('/api/recipes/delete', {
    headers: { Origin: 'http://127.0.0.1:8877', 'X-Rezeptwerk-Request': '1' }, data: { id: recipe.id },
  });
  await page.goto('/');
  await expect(page.locator('#key-hint')).toBeHidden();
  await expect(page.locator('#api-key')).toHaveCount(0);
  await expect(page.locator('#source-text')).toHaveCount(0);
  await expect(page.locator('#manual-create')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('import.png'), fullPage: true });
  await page.locator('#source').fill(`https://example.com/rezept-${testInfo.project.name}`);
  await page.locator('#import-submit').click();
  await expect(page.locator('#view-collection')).toBeVisible();
  await expect(page.locator('#recipe-dialog')).not.toBeVisible();
  const card = page.locator('.recipe-card').first();
  await expect(card).toContainText('Tomatenpasta');
  await card.locator('[data-add]').click();
  await page.getByRole('button', { name: /Einkaufsliste/ }).click();
  const portion = page.locator('[data-portions]').first();
  await portion.fill('4');
  await portion.press('Tab');
  await expect(page.locator('#shopping-list')).toContainText('400 g');
  await page.locator('#shopping-list input[data-check]').first().click();
  await expect(page.locator('.shopping-row.checked')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.shopping-row.checked')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('shopping.png'), fullPage: true });
  await page.getByRole('button', { name: /Meine Rezepte/ }).click();
  await page.locator('[data-open]').first().click();
  await expect(page.locator('#recipe-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.locator('#edit-title').fill('Korrigierte Tomatenpasta');
  await page.getByRole('button', { name: /Rezept speichern/ }).click();
  await expect(page.locator('#recipe-dialog')).not.toBeVisible();
  await expect(page.locator('#recipe-grid')).toContainText('Korrigierte Tomatenpasta');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('eigene Einkaufseinträge bleiben nach Neuladen gespeichert',async({page},info)=>{
 const name='Spülmittel '+info.project.name;
 await page.goto('/#shopping');await page.locator('#shopping-name').fill(name);await page.locator('#shopping-quantity').fill('2 Flaschen');await page.getByRole('button',{name:'Artikel hinzufügen',exact:true}).click();
 await expect(page.locator('#manual-shopping-list')).toContainText(name);await page.reload();await expect(page.locator('#manual-shopping-list')).toContainText(name);
 await page.locator('#manual-shopping-list .grocery-tile').filter({hasText:name}).getByRole('checkbox').click();
 await page.reload();await expect(page.getByRole('button',{name:name+' erneut hinzufügen',exact:true})).toBeVisible();
 await page.getByRole('button',{name:name+' erneut hinzufügen',exact:true}).click();await page.getByRole('button',{name:name+' entfernen',exact:true}).click();
 await expect(page.locator('#manual-shopping-list')).not.toContainText(name);
});

test('Rezepte und Einkaufsliste sind direkt erreichbar und getrennt auf iOS installierbar',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Meine Einkaufsliste/}).click();
 await expect(page).toHaveURL(/\/shopping\//);await expect(page.locator('#view-shopping')).toBeVisible();
 for(const key of ['recipes','shopping']){
  const response=await page.request.get('/'+key+'/');const html=await response.text();expect(html).toContain('/'+key+'.webmanifest');expect(html).toContain(key==='shopping'?'/icons/shopping-bag-auto-180-v2.png':'/icons/recipes-180.png');
  const manifest=await(await page.request.get('/'+key+'.webmanifest')).json();expect(manifest.id).toBe('/'+key+'/');expect(manifest.start_url).toBe('/'+key+'/');expect(manifest.display).toBe('standalone');
  const icon=await page.request.get('/icons/'+key+'-180.png');expect(icon.status()).toBe(200);expect([...((await icon.body()).subarray(0,8))]).toEqual([137,80,78,71,13,10,26,10]);
 }
 await page.getByRole('button',{name:/Meine Rezepte/}).click();await expect(page).toHaveURL(/\/recipes\/#collection/);
});

test('shopping icon metadata uses the filled bag and offers an explicit dark installation entry',async({page})=>{
 const normal=await(await page.request.get('/shopping/')).text(),dark=await(await page.request.get('/shopping/dark/')).text();
 expect(normal).toContain('shopping-bag-auto-180-v2.png');expect(dark).toContain('shopping-bag-dark-180-v2.png');expect(dark).toContain('/shopping-dark.webmanifest');
 const manifest=await(await page.request.get('/shopping-dark.webmanifest')).json();expect(manifest.id).toBe('/shopping/');expect(manifest.start_url).toBe('/shopping/dark/');
 const icon=await(await page.request.get('/icons/shopping-bag-auto-180-v2.png')).body();expect(icon[25]).toBe(6);
});
