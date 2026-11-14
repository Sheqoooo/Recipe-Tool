import {test,expect} from '@playwright/test';
async function fixture(page,role='admin'){
 const response=await page.request.get('/api/state'),state=await response.json();
 const recipe={id:77,owner_id:'test',title:'Gesten-Pasta',description:'Browser-Test',servings:2,prep_minutes:5,cook_minutes:10,ingredients:[{name:'Tomaten',amount:200,unit:'g',note:''}],steps:[{text:'Tomaten (200 g) garen.',ingredient_indices:[0]}],warnings:[],source_url:'https://recipes.example/gestures',source_kind:'web',revision:1,created_at:'2026-11-14T12:00:00Z',updated_at:'2026-11-14T12:00:00Z',can_edit:true,can_delete:role==='admin'};
 let calls=0;const deletes=[];let failRefresh=false,holdRefresh=null;
 await page.route('**/api/state',async route=>{
   calls++;if(calls>1&&holdRefresh)await holdRefresh;
   if(calls>1&&failRefresh)return route.fulfill({status:503,json:{error:'Test: Aktualisieren fehlgeschlagen.',code:'TEST'}});
   await route.fulfill({json:{...state,user:{...state.user,role},recipes:deletes.length?[]:[{...recipe,title:calls>1?'Aktualisierte Pasta':recipe.title}]}});
 });
 await page.route('**/api/recipes/delete',async route=>{deletes.push(route.request().postDataJSON());await route.fulfill({json:{ok:true}});});
 await page.goto('/?gesture-role='+role+'#collection');await expect(page.locator('.recipe-title')).toBeVisible();
 return {calls:()=>calls,deletes,setFailure:()=>{failRefresh=true;},hold:p=>{holdRefresh=p;}};
}
async function pull(page,dx=0,dy=170){
 return page.evaluate(({dx,dy})=>{
   const target=document.querySelector('#view-collection h1');
   const touch=(x,y)=>new Touch({identifier:1,target,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y});
   const first=touch(100,150),last=touch(100+dx,150+dy);
   target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[first],changedTouches:[first]}));
   const move=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[last],changedTouches:[last]});target.dispatchEvent(move);
   target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[last]}));
   return move.defaultPrevented;
 },{dx,dy});
}
test('Rezepttitel öffnet per Klick und Tastatur; Zusatzzeile entfällt',async({page},info)=>{
 await fixture(page);await page.getByRole('button',{name:'Gesten-Pasta öffnen'}).click();
 await expect(page.locator('#recipe-dialog')).toBeVisible();await expect(page.locator('.detail-kicker')).toHaveCount(0);
 await expect(page.locator('#dialog-content')).not.toContainText('AUS DEINEM KOCHBUCH');
 await page.screenshot({path:info.outputPath('recipe-without-kicker.png')});
 await page.getByRole('button',{name:'Schließen',exact:true}).click();
 await page.locator('.recipe-title').focus();await page.keyboard.press('Enter');await expect(page.locator('#recipe-dialog')).toBeVisible();
});
test('langes Drücken auf Bild oder Titel fordert Bestätigung; Loslassen öffnet kein Rezept',async({page},info)=>{
 const f=await fixture(page);
 for(const selector of ['.recipe-cover','.recipe-title']){
   const box=await page.locator(selector).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await expect(page.locator('#delete-dialog')).toBeVisible();await page.mouse.up();
   await expect(page.locator('#recipe-dialog')).not.toBeVisible();expect(f.deletes).toHaveLength(0);
   const sheet=await page.locator('#delete-dialog').boundingBox();expect(sheet.height).toBeLessThan(page.viewportSize().height*.75);
   await page.screenshot({path:info.outputPath('delete-confirmation.png')});
   await page.getByRole('button',{name:'Abbrechen',exact:true}).click();await expect(page.locator('.recipe-card')).toHaveCount(1);
 }
 await page.locator('.recipe-title').dispatchEvent('contextmenu');
 await page.getByRole('button',{name:'Rezept löschen',exact:true}).click();
 await expect(page.locator('.recipe-card')).toHaveCount(0);expect(f.deletes).toEqual([{id:77}]);
});
test('Bewegung und fehlende Löschrechte verhindern den Löschdialog',async({page})=>{
 await fixture(page);
 const target=page.locator('.recipe-title');
 await target.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:100,clientY:200});
 await target.dispatchEvent('pointermove',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:100,clientY:235});
 await page.waitForTimeout(700);await target.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:100,clientY:235});
 await expect(page.locator('#delete-dialog')).not.toBeVisible();
 await fixture(page,'member');await page.locator('.recipe-title').dispatchEvent('contextmenu');await expect(page.locator('#delete-dialog')).not.toBeVisible();
});
test('Herunterziehen aktualisiert einmal, behält Filter und verhindert parallele Aktualisierungen',async({page})=>{
 const f=await fixture(page);await page.locator('#search').fill('Tomaten');
 expect(await pull(page,100,15)).toBe(false);expect(await pull(page,0,30)).toBe(true);
 await page.waitForTimeout(100);expect(f.calls()).toBe(1);
 let release;f.hold(new Promise(r=>{release=r;}));
 expect(await pull(page)).toBe(true);
 await expect(page.locator('#collection-refresh')).toContainText('Wird aktualisiert');await expect.poll(f.calls).toBe(2);
 await pull(page);expect(f.calls()).toBe(2);release();
 await expect(page.locator('.recipe-title')).toHaveText('Aktualisierte Pasta');await expect(page.locator('#search')).toHaveValue('Tomaten');
 await expect(page.locator('#collection-refresh')).toBeHidden();
 await page.getByRole('button',{name:/Meine Rezepte/}).click();await expect.poll(f.calls).toBe(3);
});
test('fehlgeschlagenes Aktualisieren behält Rezepte und entsperrt die Oberfläche',async({page})=>{
 const f=await fixture(page);f.setFailure();await pull(page);
 await expect(page.locator('#notice')).toContainText('Aktualisieren fehlgeschlagen');
 await expect(page.locator('.recipe-title')).toHaveText('Gesten-Pasta');await expect(page.locator('#collection-refresh')).toBeHidden();
 await expect(page.locator('#view-collection')).not.toHaveAttribute('aria-busy','true');
});
test('abgebrochene Touch-Gesten und Scrollposition unterhalb des Anfangs lösen keinen Abruf aus',async({page})=>{
 const f=await fixture(page);
 await page.evaluate(()=>{document.querySelector('#recipe-grid').style.minHeight='1800px';window.scrollTo(0,200);});await page.waitForTimeout(100);await pull(page);expect(f.calls()).toBe(1);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.evaluate(()=>{
  const target=document.querySelector('#view-collection h1'),t=new Touch({identifier:1,target,clientX:100,clientY:150});
  target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t]}));
  target.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,touches:[]}));
  target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));
 });await page.waitForTimeout(100);expect(f.calls()).toBe(1);
});
