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
    headers: { 'X-Rezeptwerk-Token': state.token }, data: { id: recipe.id },
  });
  await page.goto('/');
  await expect(page.locator('#key-hint')).toBeHidden();
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
  await page.locator('#shopping-list input[type="checkbox"]').first().check();
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
