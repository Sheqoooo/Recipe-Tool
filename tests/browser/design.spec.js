import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const demo=pathToFileURL(resolve('.runtime/demo/rezeptwerk-demo.html')).href;

test('reduzierter Start und Offline-Demo ohne HTTP- oder API-Aufrufe',async({page},info)=>{
  const requests=[],errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(demo);await expect(page.locator('#demo-banner')).toBeVisible();await expect(page.locator('#import-submit')).toBeEnabled();
  await expect(page.locator('#app-header')).toBeHidden();await expect(page.locator('#app-navigation')).toBeHidden();
  await expect(page.getByRole('button')).toHaveCount(2);
  await page.screenshot({path:info.outputPath('design-start.png'),fullPage:true});
  await page.locator('#source').fill('https://example.com/offline-recipe');await page.locator('#import-submit').click();
  await expect(page.locator('#recipe-grid')).toContainText('Dein importiertes Beispielrezept');
  expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('Sammlung, Rezeptlayout und Mengen funktionieren mit Beispieldaten',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(demo);await page.getByRole('button',{name:/Meine Rezepte/}).click();
  await expect(page.locator('.recipe-card')).toHaveCount(6);
  await page.screenshot({path:info.outputPath('design-collection.png'),fullPage:true});
  await page.getByRole('button',{name:'Cremiges Gemüse-Curry ansehen'}).click();
  await expect(page.locator('#recipe-dialog')).toBeVisible();
  await expect(page.locator('.method-list')).toContainText('Paprikapulver hinzufügen (1 TL)');
  await expect(page.locator('.recipe-facts')).toContainText('20 Min.');
  await page.screenshot({path:info.outputPath('design-recipe.png')});
  await page.locator('.method-list').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('design-steps.png')});
  await page.locator('#close-dialog').click();
  await page.locator('#search').fill('Curry');await expect(page.locator('.recipe-card')).toHaveCount(1);
  await page.locator('[data-add]').first().click();await page.getByRole('button',{name:/Einkaufsliste/}).click();
  const portion=page.locator('[data-portions]').first();await portion.fill('4');await portion.press('Tab');
  await expect(page.locator('#shopping-list')).toContainText('800 ml');
  await page.locator('#shopping-list input').first().check();await expect(page.locator('.shopping-row.checked')).toHaveCount(1);
  await page.screenshot({path:info.outputPath('design-shopping.png'),fullPage:true});
  if(info.project.name==='mobile'){await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect(errors).toEqual([]);
});

test('Produktionsbundle enthält keine Demo-Daten und URL-Parameter schaltet Demo nicht frei',async({page})=>{
  const bundle=readFileSync('dist/client/app.js','utf8');
  expect(bundle).not.toContain('demo@example.invalid');expect(bundle).not.toContain('Knackiger Kichererbsensalat');
  await page.goto('/?demo=1');await expect(page.locator('#demo-banner')).toBeHidden();
});

test('Futterluke zeigt Bild, Nachweis und Emoji-Fallback offline',async({page},info)=>{
  await page.goto(demo);await expect(page.locator('.wordmark')).toContainText('Futterluke');await expect(page.locator('.start-caption')).toHaveText('Umwandlung von Rezepten');
  await page.getByRole('button',{name:/Meine Rezepte/}).click();
  const photo=page.locator('.recipe-photo').first();await expect(photo).toBeVisible();await expect.poll(()=>photo.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  await page.getByRole('button',{name:'Zitronenpasta mit Parmesan ansehen'}).click();
  await expect(page.locator('.image-credit')).toContainText('Demo-Illustration · Futterluke');
  await page.screenshot({path:info.outputPath('design-photo.png')});
  await page.locator('#recipe-dialog .recipe-photo').evaluate(e=>e.dispatchEvent(new Event('error')));
  await expect(page.locator('#recipe-dialog .recipe-photo')).toHaveCount(0);await expect(page.locator('.detail-hero-art')).toContainText('🍋');
});
