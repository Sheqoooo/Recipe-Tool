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
  await expect(page.locator('#adaptation-options')).toBeVisible();await expect(page.locator('#adaptation')).toBeHidden();
  await page.screenshot({path:info.outputPath('design-start.png'),fullPage:true});
  await page.locator('#source').fill('https://example.com/offline-recipe');await page.locator('#import-submit').click();
  await expect(page.locator('#recipe-grid')).toContainText('Dein importiertes Beispielrezept');
  await page.getByRole('button',{name:/Link einfügen/}).click();
  await expect(page.locator('#source')).toHaveValue('');await expect(page.locator('#transcript-panel')).toBeHidden();
  await page.locator('#source').fill('https://recipes.example/demo/1');await page.locator('#import-submit').click();
  await expect(page.locator('#notice')).toContainText('bereits gespeichert');await page.getByRole('button',{name:/Link einfügen/}).click();await expect(page.locator('#source')).toHaveValue('');
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
  await expect(page.locator('.step-quantity')).toHaveCount(0);
  await expect(page.locator('.recipe-facts')).toContainText('20 Min.');
  await page.screenshot({path:info.outputPath('design-recipe.png')});
  await page.locator('.method-list').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('design-steps.png')});
  await page.locator('#close-dialog').click();
  await page.locator('#search').fill('Curry');await expect(page.locator('.recipe-card')).toHaveCount(1);
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
test('optionaler Rezeptwunsch bleibt unaufdringlich, erzeugt eine Variante und wird zurückgesetzt',async({page},info)=>{
 const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(demo);await expect(page.locator('#adaptation')).toBeHidden();
 await page.locator('#adaptation-options summary').click();await expect(page.locator('#adaptation')).toBeVisible();
 await page.locator('#adaptation').fill('Testwunsch');await page.locator('#clear-adaptation').click();await expect(page.locator('#adaptation')).toHaveValue('');await expect(page.locator('#adaptation-active')).toBeHidden();
 await page.locator('#adaptation').fill('Hackfleisch durch Halloumi ersetzen');await expect(page.locator('#adaptation-active')).toBeVisible();
 await page.locator('#adaptation-options summary').click();await expect(page.locator('#adaptation')).toBeHidden();await expect(page.locator('#adaptation-active')).toBeVisible();await page.locator('#adaptation-options summary').click();
 await page.locator('#source').fill('https://recipes.example/demo/1');await page.screenshot({path:info.outputPath('import-adaptation.png'),animations:'disabled'});
 await page.locator('#source').fill('https://www.instagram.com/reel/adaptation-demo/');await page.locator('#import-submit').click();await expect(page.locator('#transcript-panel')).toBeVisible();await expect(page.locator('#adaptation')).toHaveValue('Hackfleisch durch Halloumi ersetzen');
 await page.locator('#source').fill('https://recipes.example/demo/1');await page.locator('#import-submit').click();
 await expect(page.locator('#recipe-grid')).toContainText('Deine angepasste Rezeptvariante');await expect(page.locator('.recipe-card')).toHaveCount(7);
 await page.getByRole('button',{name:'Deine angepasste Rezeptvariante ansehen'}).click();await expect(page.locator('.ingredient-view')).toContainText('Halloumi');await expect(page.locator('.method-list')).toContainText('Halloumi (200 g) würfeln');await expect(page.locator('.recipe-notes')).toContainText('Hackfleisch durch Halloumi ersetzen');
 await page.locator('#close-dialog').click();await page.getByRole('button',{name:/Link einfügen/}).click();await expect(page.locator('#source')).toHaveValue('');await expect(page.locator('#adaptation')).toHaveValue('');await expect(page.locator('#adaptation')).toBeHidden();
 await page.locator('#source').fill('https://recipes.example/demo/1');await page.locator('#import-submit').click();await expect(page.locator('.recipe-card')).toHaveCount(7);await expect(page.locator('#notice')).toContainText('bereits gespeichert');expect(requests).toEqual([]);
});
test('Videobild nachladen, Hochkantdarstellung und leere Importmaske ohne echte API',async({page},info)=>{
 const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(demo);await page.locator('#source').fill('https://www.instagram.com/reel/demo/');await page.locator('#import-submit').click();
 await expect(page.locator('#transcript-panel')).toBeVisible();await expect(page.locator('#source')).toHaveValue('https://www.instagram.com/reel/demo/');
 await page.locator('#transcript').fill('Zutaten: Tomaten (200 g). Zehn Minuten kochen und servieren.');await page.locator('#transcript-authorized').check();await page.locator('#import-submit').click();
 await expect(page.locator('#view-collection')).toBeVisible();await expect(page.locator('#source')).toHaveValue('');await expect(page.locator('#transcript')).toHaveValue('');await expect(page.locator('#transcript-authorized')).not.toBeChecked();
 await page.getByRole('button',{name:'Dein importiertes Beispielrezept ansehen'}).click();await expect(page.locator('#recipe-dialog .recipe-photo')).toHaveCount(0);
 await page.getByRole('button',{name:'Videovorschaubild laden'}).click();const photo=page.locator('#recipe-dialog .video-still');await expect(photo).toBeVisible();
 await expect.poll(()=>photo.evaluate(e=>e.complete&&e.naturalHeight>e.naturalWidth)).toBe(true);await expect(photo).toBeInViewport({ratio:.95});
 await expect(page.locator('.image-credit')).toContainText('Demo-Illustration');await expect(page.getByRole('button',{name:'Videovorschaubild laden'})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('video-cover-portrait.png')});expect(requests).toEqual([]);
});

test('Videolink versucht erst automatisch den Import und bietet danach Text als Alternative',async({page})=>{
 await page.goto(demo);await page.locator('#source').fill('https://www.instagram.com/reel/demo/');
 await expect(page.locator('#transcript-panel')).toBeHidden();
 await page.locator('#import-submit').click();await expect(page.locator('#transcript-panel')).toBeVisible();
 await page.locator('#transcript').fill('Zutaten: 200 g Tomaten und 100 g Reis. Reis kochen und Tomaten würfeln. Alles zusammen servieren.');
 await page.locator('#transcript-authorized').check();await page.locator('#import-submit').click();
 await expect(page.locator('#recipe-grid')).toContainText('Dein importiertes Beispielrezept');
});


test('Plus überträgt einzelne Zutaten an Bring und die Einkaufsliste ist nicht mehr Teil der App',async({page},info)=>{
 const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(demo);
 await expect(page.locator('[data-view="shopping"]')).toHaveCount(0);await expect(page.locator('#view-shopping')).toHaveCount(0);
 await page.getByRole('button',{name:/Meine Rezepte/}).click();
 await page.getByRole('button',{name:'Cremiges Gemüse-Curry ansehen'}).click();
 await expect(page.getByRole('button',{name:/Alle Zutaten|Zutaten an Bring! senden|Zur Kochliste/})).toHaveCount(0);
 const first=page.locator('[data-bring-ingredient="0"]'),second=page.locator('[data-bring-ingredient="1"]');
 await first.click();await second.click();
 await expect(first).toHaveText('✓');await expect(second).toHaveText('✓');
 await expect(page.locator('[data-bring-ingredient="2"]')).toHaveText('＋');
 await page.screenshot({path:info.outputPath('bring-single-ingredient.png')});
 expect(requests).toEqual([]);
});
