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
  await expect(page.getByRole('button')).toHaveCount(3);
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
  await expect(page.locator('.step-quantity')).toHaveCount(0);
  await expect(page.locator('.recipe-facts')).toContainText('20 Min.');
  await page.screenshot({path:info.outputPath('design-recipe.png')});
  await page.locator('.method-list').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('design-steps.png')});
  await page.locator('#close-dialog').click();
  await page.locator('#search').fill('Curry');await expect(page.locator('.recipe-card')).toHaveCount(1);
  await page.locator('[data-add]').first().click();await page.getByRole('button',{name:/Einkaufsliste/}).click();
  const portion=page.locator('[data-portions]').first();await portion.fill('4');await portion.press('Tab');
  await expect(page.locator('#shopping-list')).toContainText('800 ml');
  await page.locator('#shopping-list input[data-check]').first().click();await expect(page.locator('.shopping-row.checked')).toHaveCount(1);
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

test('Einkaufskacheln: Vorschläge, Mengen, Emoji, Bearbeiten und Wiederverwenden ohne Netz',async({page},info)=>{
 const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(demo);await page.getByRole('button',{name:/Meine Einkaufsliste/}).click();
 const name=page.locator('#shopping-name');await name.fill('Spül');await expect(page.getByRole('option',{name:/Spülmittel/})).toBeVisible();
 await page.locator('#shopping-quantity').fill('2 Flaschen');await name.press('ArrowDown');await name.press('Enter');await expect(name).toHaveValue('');await expect(page.locator('#shopping-suggestions')).toBeHidden();
 const tile=page.locator('#manual-shopping-list .grocery-tile').filter({hasText:'Spülmittel'});
 await expect(tile).toContainText('2 Flaschen');await expect(tile.locator('.grocery-emoji')).toHaveText('🧼');
 await tile.getByRole('checkbox').click();await expect(page.getByRole('button',{name:'Spülmittel erneut hinzufügen',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Spülmittel erneut hinzufügen',exact:true}).click();
 await page.getByRole('button',{name:'Spülmittel bearbeiten',exact:true}).click();await name.fill('Spülmittel sensitiv');await page.locator('#shopping-quantity').fill('1 Flasche');await page.getByRole('button',{name:'Artikel hinzufügen',exact:true}).click();
 await expect(page.locator('#manual-shopping-list')).toContainText('Spülmittel sensitiv');
 await name.fill('Mein Spezialprodukt');await page.locator('#shopping-quantity').fill('1 Packung');await page.getByRole('button',{name:'Artikel hinzufügen',exact:true}).click();
 const custom=page.locator('#manual-shopping-list .grocery-tile').filter({hasText:'Mein Spezialprodukt'});await expect(custom.locator('.grocery-emoji')).toHaveText('🛒');
 await page.screenshot({path:info.outputPath('shopping-tiles.png'),fullPage:true});
 if(info.project.name==='mobile'){await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(requests).toEqual([]);
});
test('freie Artikel werden als Text ausgegeben und nicht als HTML ausgeführt',async({page})=>{
 await page.goto(demo);await page.getByRole('button',{name:/Meine Einkaufsliste/}).click();
 await page.locator('#shopping-name').fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Artikel hinzufügen',exact:true}).click();
 await expect(page.locator('#manual-shopping-list')).toContainText('<img src=x onerror=alert(1)>');await expect(page.locator('#manual-shopping-list img')).toHaveCount(0);
});

test('Vorschlag antippen speichert sofort und Rezeptzutaten teilen denselben Einkaufsweg',async({page},info)=>{
 await page.goto(demo);await page.getByRole('button',{name:/Meine Rezepte/}).click();
 await page.locator('.recipe-card').filter({hasText:'Zitronenpasta mit Parmesan'}).locator('[data-add]').click();
 await page.getByRole('button',{name:/Einkaufsliste/}).click();
 await page.locator('#shopping-name').fill('Zucch');await page.getByRole('option',{name:'Zucchini',exact:true}).click();
 await expect(page.locator('[data-department="produce"]')).toContainText('Zucchini');
 await expect(page.locator('#shopping-name')).toHaveValue('');
 await expect(page.locator('[data-department="produce"]')).toContainText('Zitrone');
 await expect(page.locator('[data-department="pantry"]')).toContainText('Spaghetti');
 await expect(page.locator('[data-department="chilled"]')).toContainText('Parmesan');
 await page.locator('#shopping-name').fill('TK Erbsen');await page.getByRole('button',{name:'Artikel hinzufügen',exact:true}).click();
 await expect(page.locator('.shopping-department').last()).toHaveAttribute('data-department','frozen');
 const departments=await page.locator('.shopping-department[data-department]').evaluateAll(nodes=>nodes.map(n=>n.dataset.department));
 expect(departments).toEqual(['produce','pantry','household','chilled','frozen']);
 await page.screenshot({path:info.outputPath('shopping-departments.png'),fullPage:true});
 if(info.project.name==='mobile'){await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('einzelne oder alle Zutaten per Klick auf die unabhängige Einkaufsliste',async({page})=>{
 await page.goto(demo);await page.getByRole('button',{name:/Meine Rezepte/}).click();await page.getByRole('button',{name:'Zitronenpasta mit Parmesan ansehen'}).click();
 await page.getByRole('button',{name:'Spaghetti zur Einkaufsliste hinzufügen',exact:true}).click();
 await expect(page.locator('#notice')).toContainText('Zutat auf deiner Einkaufsliste');
 await page.getByRole('button',{name:'Alle Zutaten hinzufügen 🛒',exact:true}).click();await expect(page.locator('#notice')).toContainText('Alle Zutaten');
 await page.locator('#close-dialog').click();await page.getByRole('button',{name:/Einkaufsliste/}).click();
 await expect(page.locator('[data-department="pantry"]')).toContainText('Spaghetti');await expect(page.locator('[data-department="pantry"]')).toContainText('200 g');
 await expect(page.locator('[data-department="produce"]')).toContainText('Zitrone');await expect(page.locator('[data-department="chilled"]')).toContainText('Parmesan');
 await expect(page.locator('[data-portions]')).toHaveCount(0);
});

test('importierte Lebensmittelvorschläge funktionieren lokal und zeigen Herkunft',async({page})=>{
 const network=[];page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(demo);await page.getByRole('button',{name:/Meine Einkaufsliste/}).click();
 await page.locator('#shopping-name').fill('Pastinak');await expect(page.getByRole('option').first()).toContainText(/Pastinak/i);
 await page.getByRole('option').first().click();await expect(page.locator('#manual-shopping-list')).toContainText(/Pastinak/i);
 await expect(page.locator('.catalog-attribution')).toContainText('BLS 4.0');await expect(page.locator('.catalog-attribution')).toContainText('Open Food Facts');
 expect(network).toEqual([]);
});

test('mobile Einkaufseingabe bleibt unten, Vorschläge öffnen nach oben und Tastatur wird berücksichtigt',async({page},info)=>{
 await page.goto(demo);await page.getByRole('button',{name:/Meine Einkaufsliste/}).click();
 const form=page.locator('#shopping-form'),nav=page.locator('#app-navigation');
 if(info.project.name==='desktop'){await expect(form).toHaveCSS('position','relative');return;}
 await expect(form).toHaveCSS('position','fixed');
 await expect.poll(async()=>{const f=await form.boundingBox(),n=await nav.boundingBox();return Math.abs(f.y+f.height-n.y);}).toBeLessThan(3);
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
 await expect.poll(async()=>{const f=await form.boundingBox(),n=await nav.boundingBox();return Math.abs(f.y+f.height-n.y);}).toBeLessThan(3);
 await page.locator('#shopping-name').fill('Spül');
 await expect(page.locator('#shopping-suggestions')).toBeVisible();
 const f=await form.boundingBox(),s=await page.locator('#shopping-suggestions').boundingBox();expect(s.y+s.height).toBeLessThanOrEqual(f.y);
 await page.screenshot({path:info.outputPath('mobile-shopping-dock.png')});
 await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>420});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,get:()=>0});visualViewport.dispatchEvent(new Event('resize'));});
 await expect(page.locator('body')).toHaveAttribute('data-grocery-keyboard','true');await expect(nav).toBeHidden();
 await expect.poll(async()=>{const box=await form.boundingBox();return Math.abs(box.y+box.height-420);}).toBeLessThan(3);
 await page.getByRole('option',{name:'Spülmittel',exact:true}).click();await expect(page.locator('#shopping-name')).toHaveValue('');
 await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight});visualViewport.dispatchEvent(new Event('resize'));});
 await expect(nav).toBeVisible();
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
