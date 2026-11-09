import { test, expect } from '@playwright/test';

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
