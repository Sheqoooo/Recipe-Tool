import {test,expect} from '@playwright/test';
async function fixture(page,{ready=true,readOnly=false,fail=false}={}){
 const state=await(await page.request.get('/api/state')).json();
 const recipe={id:78,owner_id:'test',title:'Bring-Auswahl',description:'Browser-Test',servings:2,prep_minutes:5,cook_minutes:10,ingredients:['Tomaten','Reis','Salz'].map((name,n)=>({name,amount:n===2?null:200,unit:n===2?'':'g',note:n===2?'nach Geschmack':''})),steps:[{text:'Tomaten (200 g) garen.',ingredient_indices:[0]}],warnings:[],source_url:'https://recipes.example/selection',source_kind:'web',revision:3,created_at:'2026-11-14T12:00:00Z',updated_at:'2026-11-14T12:00:00Z',can_edit:true,can_delete:true};
 const calls=[];let inFlight=0,maxInFlight=0,failed=false;
 await page.route('**/api/state',route=>route.fulfill({json:{...state,recipes:[recipe],read_only:readOnly,bring:{enabled:true,ready,list_name:'Zuhause',revision:2}}}));
 await page.route('**/api/bring/export',async route=>{
  const body=route.request().postDataJSON();calls.push(body);inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  await new Promise(r=>setTimeout(r,100));inFlight--;
  if(fail&&body.ingredient_index===1&&!failed){failed=true;return route.fulfill({status:503,json:{error:'Test: Verbindung unterbrochen.',code:'BRING_UNCERTAIN'}});}
  return route.fulfill({json:{ok:true,existing:false,count:1,list_name:'Zuhause'}});
 });
 await page.goto('/?bring-selection-test=1#collection');await page.locator('.recipe-title').click();
 return {calls,max:()=>maxInFlight};
}
test('Kreuz schließt Zutat aus; Auswahl wird seriell gesendet und danach zurückgesetzt',async({page},info)=>{
 const f=await fixture(page),exclude=page.locator('[data-bring-exclude="1"]'),all=page.locator('[data-bring-selection]');
 await exclude.check();await expect(page.locator('[data-bring-ingredient="1"]')).toBeDisabled();
 await expect(all).toHaveText('An Bring! senden (2)');
 await page.locator('.bring-selection').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('bring-excluded-ingredient.png')});
 await all.click();await expect(all).toBeDisabled();
 await expect(page.locator('#notice')).toContainText('2 Zutaten an Bring! gesendet.');
 expect(f.calls.map(c=>c.ingredient_index)).toEqual([0,2]);expect(f.max()).toBe(1);
 expect(f.calls.every(c=>c.recipe_id===78&&c.revision===3&&c.target_revision===2)).toBe(true);
 await expect(exclude).not.toBeChecked();await expect(all).toHaveText('An Bring! senden (3)');
 for(let n=0;n<3;n++){await expect(page.locator('[data-bring-ingredient="'+n+'"]')).toHaveText('＋');await expect(page.locator('[data-bring-ingredient="'+n+'"]')).toBeEnabled();}
});
test('alles ausgeschlossen sendet nichts; Ausschluss funktioniert mit Tastatur',async({page})=>{
 const f=await fixture(page),boxes=page.locator('[data-bring-exclude]');
 for(let n=0;n<3;n++)await boxes.nth(n).check();
 await expect(page.locator('[data-bring-selection]')).toBeDisabled();expect(f.calls).toEqual([]);
 await boxes.first().focus();await page.keyboard.press('Space');
 await expect(boxes.first()).not.toBeChecked();await expect(page.locator('[data-bring-selection]')).toHaveText('An Bring! senden (1)');
});
test('Teilfehler stoppt ohne Retry; bestätigte Zutaten werden beim bewussten Fortsetzen übersprungen',async({page})=>{
 const f=await fixture(page,{fail:true}),all=page.locator('[data-bring-selection]');
 await page.locator('[data-bring-exclude="2"]').check();await all.click();
 await expect(page.locator('#notice')).toContainText('1 von 2 Zutaten bestätigt.');
 expect(f.calls.map(c=>c.ingredient_index)).toEqual([0,1]);
 await expect(page.locator('[data-bring-ingredient="0"]')).toHaveText('✓');
 await expect(page.locator('[data-bring-exclude="2"]')).toBeChecked();await expect(all).toHaveText('An Bring! senden (1)');
 await all.click();await expect(page.locator('#notice')).toContainText('1 Zutat an Bring! gesendet.');
 expect(f.calls.map(c=>c.ingredient_index)).toEqual([0,1,1]);
 await expect(page.locator('[data-bring-exclude="2"]')).not.toBeChecked();
});
test('ohne Verbindung oder in schreibgeschützter Vorschau wird nichts gesendet',async({page})=>{
 const f=await fixture(page,{ready:false,readOnly:true});
 await expect(page.locator('[data-bring-selection]')).toBeDisabled();
 for(let n=0;n<3;n++){await expect(page.locator('[data-bring-ingredient="'+n+'"]')).toBeDisabled();await expect(page.locator('[data-bring-exclude="'+n+'"]')).toBeDisabled();}
 expect(f.calls).toEqual([]);
});
