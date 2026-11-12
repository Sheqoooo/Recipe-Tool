import {installShoppingDock} from './shopping-dock.js';
declare const __REZEPTWERK_DEMO__:boolean;
import type { AppState,Recipe,RecipeData } from '../src/shared/types.js';
import {groupShopping} from '../src/shared/shopping-order.js';
import {productFor,productSuggestions} from '../src/shared/products.js';
import {stepInstruction} from '../src/shared/step-quantities.js';
type Ingredient=RecipeData['ingredients'][number];
type Step=RecipeData['steps'][number];
let state:AppState={recipes:[],plan:[],shopping:[],checked:[],members:[],imports:[],has_key:false,read_only:true,user:{id:'',email:'',role:'member',active:0}};
let draft:Recipe|null=null;
let shoppingEditId:string|undefined;
let shoppingSaving=false;
let suggestionNames:string[]=[];
let suggestionIndex=-1;
let personalProducts:string[]=[];
function $<T extends HTMLElement=HTMLElement>(selector:string):T{const element=document.querySelector<T>(selector);if(!element)throw new Error('Oberflächenelement fehlt');return element;}
const input=(s:string)=>$<HTMLInputElement>(s);
const dialog=()=>$<HTMLDialogElement>('#recipe-dialog');
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number|null)=>v===null?'':v.toLocaleString('de-DE',{maximumFractionDigits:2});
const quantity=(i:{amount:number|null;unit:string})=>[fmt(i.amount),i.unit].filter(Boolean).join(' ');
const preview=location.protocol==='file:'||new URLSearchParams(location.search).get('preview')==='1';
let timer:ReturnType<typeof setTimeout>|undefined;
let refreshDock=()=>{};
function notify(message:string,error=false){$('#notice').textContent=message;$('#notice').hidden=false;$('#notice').classList.toggle('error',error);clearTimeout(timer);timer=setTimeout(()=>{$('#notice').hidden=true;},error?15000:6000);}
async function api<T>(path:string,data?:unknown):Promise<T>{
  if(__REZEPTWERK_DEMO__){const {demoApi}=await import('./demo.js');return demoApi<T>(path,data);}
  if(preview)throw new Error('Diese statische Vorschau ist nicht mit der privaten App verbunden.');
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify(data)});
  if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Die Access-Anmeldung ist abgelaufen. Bitte neu laden.');
  const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Anfrage fehlgeschlagen.');return result as T;
}
function showView(view:string){
  if(!['import','collection','shopping','settings'].includes(view))view='import';
  if(!__REZEPTWERK_DEMO__&&!preview){
    const area=location.pathname.startsWith('/shopping/')?'shopping':location.pathname.startsWith('/recipes/')?'recipes':'home';
    if(view==='shopping'&&area!=='shopping'){location.assign('/shopping/');return;}
    if(['import','collection'].includes(view)&&area==='shopping'){location.assign('/recipes/#'+view);return;}
  }
  document.body.dataset.view=view;
  $('#area-label').textContent=view==='shopping'?'Deine Einkaufsliste':view==='settings'?'Einstellungen':'Dein Kochbuch';
  document.querySelectorAll<HTMLElement>('.view').forEach(e=>{e.hidden=e.id!=='view-'+view;});
  $('#app-header').hidden=view==='import';$('#app-navigation').hidden=view==='import';
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(e=>{const active=e.dataset.view===view;e.classList.toggle('active',active);if(active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
  history.replaceState(null,'','#'+view);window.scrollTo(0,0);refreshDock();
}
function presentation(r:Recipe):[string,string]{
  const title=r.title.toLowerCase();
  if(/zitrone/.test(title))return ['🍋','lemon'];
  if(/salat|bowl/.test(title))return ['🥗','mint'];
  if(/curry/.test(title))return ['🍛','peach'];
  if(/pfannkuchen|pancake/.test(title))return ['🥞','lilac'];
  if(/suppe/.test(title))return ['🍲','blue'];
  if(/pasta|nudel|spaghetti/.test(title))return ['🍝','rose'];
  return ['🍽️','mint'];
}
function cookingTime(r:Recipe):string{
  if(r.prep_minutes!==null&&r.cook_minutes!==null)return fmt(r.prep_minutes+r.cook_minutes)+' Min.';
  if(r.cook_minutes!==null)return fmt(r.cook_minutes)+' Min. Kochzeit';
  if(r.prep_minutes!==null)return fmt(r.prep_minutes)+' Min. Vorbereitung';
  return 'Zeit offen';
}
const empty=(title:string,text:string)=>`<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
function recipeImage(r:Recipe):string{
  const value=r.image?.url||'';
  return value==='/api/recipes/'+r.id+'/image'||(__REZEPTWERK_DEMO__&&value.startsWith('data:image/svg+xml,'))?value:'';
}
function imageMarkup(r:Recipe):string{const src=recipeImage(r);return src?'<img class="recipe-photo" src="'+esc(src)+'" alt="'+esc(r.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'';}
function imageCredit(r:Recipe):string{
  if(!recipeImage(r))return '';
  let link='';try{const url=new URL(r.image!.source_url);if(url.protocol==='https:')link='<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">Bildquelle ↗</a>';}catch{}
  return '<p class="image-credit">'+[esc(r.image!.credit),link].filter(Boolean).join(' · ')+'</p>';
}
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&event.target.classList.contains('recipe-photo'))event.target.remove();},true);
function renderRecipes(){
  const search=input('#search').value.toLowerCase();
  const recipes=state.recipes.filter(r=>(r.title+' '+r.ingredients.map(i=>i.name).join(' ')).toLowerCase().includes(search));
  $('#recipe-grid').innerHTML=recipes.length?recipes.map(r=>{const [emoji,tone]=presentation(r);return `<article class="recipe-card"><button class="recipe-cover tone-${tone}" data-open="${r.id}" aria-label="${esc(r.title)} ansehen"><span aria-hidden="true">${emoji}</span>${imageMarkup(r)}</button><div class="recipe-content">${r.warnings.length?'<div class="warning-label">Hinweise zur Prüfung</div>':''}<h2>${esc(r.title)}</h2><p class="recipe-meta"><span>◷ ${esc(cookingTime(r))}</span><span>${r.servings===null?'Portionen offen':fmt(r.servings)+' Portionen'}</span></p></div><footer><button class="secondary" data-add="${r.id}" ${state.read_only||r.servings===null?'disabled':''}>${state.plan.some(p=>p.recipe_id===r.id)?'✓ Auf der Kochliste':'+ Zur Kochliste'}</button></footer></article>`;}).join(''):empty(search?'Kein Treffer.':'Dein Kochbuch wartet auf dich.',search?'Versuche einen anderen Namen oder eine Zutat.':'Füge deinen ersten Rezeptlink ein.');
}
function hideSuggestions(){input('#shopping-name').setAttribute('aria-expanded','false');input('#shopping-name').removeAttribute('aria-activedescendant');$('#shopping-suggestions').hidden=true;suggestionIndex=-1;}
function renderSuggestions(){
  const name=input('#shopping-name').value;
  $('#shopping-emoji').textContent=productFor(name).emoji;
  const suggestions=productSuggestions(name,personalProducts);suggestionNames=suggestions.map(p=>p.name);suggestionIndex=-1;
  $('#shopping-suggestions').innerHTML=suggestions.map((p,n)=>'<button type="button" role="option" aria-selected="false" id="product-option-'+n+'" data-product-index="'+n+'"><span aria-hidden="true">'+p.emoji+'</span><span>'+esc(p.name)+'</span><span class="suggestion-arrow" aria-hidden="true">↖</span></button>').join('');
  $('#shopping-suggestions').hidden=!suggestions.length;input('#shopping-name').setAttribute('aria-expanded',String(Boolean(suggestions.length)));input('#shopping-name').removeAttribute('aria-activedescendant');
}
async function saveShoppingEntry(name:string){
 if(shoppingSaving||state.read_only)return;
 shoppingSaving=true;hideSuggestions();
 const submit=$('#shopping-form').querySelector<HTMLButtonElement>('[type="submit"]')!;
 submit.disabled=true;input('#shopping-name').disabled=true;input('#shopping-quantity').disabled=true;
 try{
  await api('/api/shopping/items/save',{...(shoppingEditId?{id:shoppingEditId}:{}),name,quantity:input('#shopping-quantity').value});
  resetShoppingForm();await refresh();notify('Auf deiner Einkaufsliste.');
 }finally{shoppingSaving=false;submit.disabled=state.read_only;input('#shopping-name').disabled=state.read_only;input('#shopping-quantity').disabled=state.read_only;}
}
async function selectProduct(index:number){
 const name=suggestionNames[index];if(!name)return;
 input('#shopping-name').value=name;$('#shopping-emoji').textContent=productFor(name).emoji;
 await saveShoppingEntry(name);
}
function resetShoppingForm(){shoppingEditId=undefined;$<HTMLFormElement>('#shopping-form').reset();$('#shopping-edit-hint').hidden=true;$('#cancel-shopping-edit').hidden=true;$('#shopping-emoji').textContent='🛍️';hideSuggestions();}
function manualTile(i:NonNullable<AppState['manual_items']>[number],tone:string):string{
 const p=productFor(i.name);return '<article class="grocery-tile tone-'+tone+'"><label class="grocery-check"><input type="checkbox" data-manual-check="'+esc(i.id)+'" aria-label="'+esc(i.name)+' erledigt"><span class="grocery-emoji" aria-hidden="true">'+p.emoji+'</span><strong>'+esc(i.name)+'</strong><small>'+esc(i.quantity)+'</small></label><details class="grocery-menu"><summary aria-label="Aktionen für '+esc(i.name)+'">⋯</summary><div class="grocery-tile-tools"><button type="button" data-manual-edit="'+esc(i.id)+'" aria-label="'+esc(i.name)+' bearbeiten">Bearbeiten</button><button type="button" data-manual-delete="'+esc(i.id)+'" aria-label="'+esc(i.name)+' entfernen">Entfernen</button></div></details></article>';
}
function recipeTile(i:AppState['shopping'][number],tone:string):string{
 const p=productFor(i.name);return '<label class="shopping-row grocery-tile tone-'+tone+' '+(state.checked.includes(i.key)?'checked':'')+'"><input type="checkbox" data-check="'+esc(i.key)+'" '+(state.checked.includes(i.key)?'checked':'')+'><span><span class="grocery-emoji" aria-hidden="true">'+p.emoji+'</span><strong>'+esc(i.name)+'</strong><small>'+esc(quantity(i))+'</small><small>'+esc(i.note)+'</small><small>Aus Rezept: '+esc(i.recipes.join(' · '))+(i.amount===null?' · Menge bitte prüfen':'')+'</small></span></label>';
}
function activeShopping(){
 return [...(state.manual_items||[]).filter(i=>!i.checked).map(item=>({name:item.name,manual:item,recipe:undefined})),
 ...state.shopping.filter(i=>!state.checked.includes(i.key)).map(item=>({name:item.name,manual:undefined,recipe:item}))];
}
function renderManualShopping(){
 const manual=state.manual_items||[],recent=manual.filter(i=>i.checked).slice(0,12),pending=activeShopping();
 $('#manual-count').textContent=String(pending.length);
 const groups=groupShopping(pending);
 $('#manual-shopping-list').innerHTML=groups.length?groups.map(group=>'<section class="shopping-department" data-department="'+group.id+'"><h3><span aria-hidden="true">'+group.emoji+'</span> '+esc(group.name)+' <span class="count">'+group.items.length+'</span></h3><div class="grocery-grid">'+group.items.map(i=>i.manual?manualTile(i.manual,group.tone):recipeTile(i.recipe!,group.tone)).join('')+'</div></section>').join(''):'<p class="grocery-empty">Noch etwas vergessen? Einfach oben eintragen.</p>';
 const done=state.shopping.filter(i=>state.checked.includes(i.key));
 if(done.length)$('#manual-shopping-list').insertAdjacentHTML('beforeend','<section class="shopping-department completed-ingredients"><h3>✓ Erledigte Rezeptzutaten</h3><div class="grocery-grid">'+done.map(i=>recipeTile(i,productFor(i.name).tone)).join('')+'</div></section>');
 $('#recent-shopping-section').hidden=!recent.length;
 $('#recent-shopping-list').innerHTML=recent.map(i=>{const p=productFor(i.name);return '<article class="grocery-tile recent-tile"><button type="button" class="recent-product" data-recent="'+esc(i.id)+'" aria-label="'+esc(i.name)+' erneut hinzufügen"><span class="grocery-emoji" aria-hidden="true">'+p.emoji+'</span><strong>'+esc(i.name)+'</strong><small>'+esc(i.quantity)+'</small><span class="recent-plus" aria-hidden="true">+</span></button><details class="grocery-menu"><summary aria-label="Aktionen für '+esc(i.name)+'">⋯</summary><div class="grocery-tile-tools"><button type="button" data-manual-delete="'+esc(i.id)+'" aria-label="'+esc(i.name)+' aus Verlauf entfernen">Entfernen</button></div></details></article>';}).join('');
 input('#shopping-name').disabled=state.read_only;input('#shopping-quantity').disabled=state.read_only;
 $('#shopping-form').querySelector<HTMLButtonElement>('[type="submit"]')!.disabled=state.read_only||shoppingSaving;
 document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('#manual-shopping-list button,#manual-shopping-list input,#recent-shopping-list button').forEach(e=>e.disabled=state.read_only);
}
function renderShopping(){
  renderManualShopping();
  $('#recipe-shopping').hidden=!state.plan.length;
  $('#plan-list').innerHTML=state.plan.length?state.plan.map(p=>`<article class="plan-card"><h3>${esc(p.recipe.title)}</h3><div class="portion-control"><label class="sr-only" for="portion-${p.recipe_id}">Portionen für ${esc(p.recipe.title)}</label><input id="portion-${p.recipe_id}" type="number" min="0.01" max="1000" step="any" value="${p.servings}" data-portions="${p.recipe_id}"><span>Portionen</span><button class="text-button danger" data-remove="${p.recipe_id}">Entfernen</button></div></article>`).join(''):empty('Was möchtet ihr kochen?','Wählt Gerichte aus eurer Sammlung.');
  input('#copy-list').disabled=!state.shopping.some(i=>!state.checked.includes(i.key))&&!(state.manual_items||[]).some(i=>!i.checked);
}
function render(){
  const personal=new Set((state.manual_items||[]).map(i=>i.name));
  outer:for(const recipe of state.recipes)for(const ingredient of recipe.ingredients){if(personal.size>=1000)break outer;personal.add(ingredient.name);}
  personalProducts=[...personal];
  $('#home-shopping-count').textContent=String(state.shopping.filter(i=>!state.checked.includes(i.key)).length+(state.manual_items||[]).filter(i=>!i.checked).length);
  $('#recipe-count').textContent=String(state.recipes.length);$('#plan-count').textContent=String(state.shopping.filter(i=>!state.checked.includes(i.key)).length+(state.manual_items||[]).filter(i=>!i.checked).length);$('#key-hint').hidden=state.has_key||state.read_only;
  $('#key-status').textContent=__REZEPTWERK_DEMO__?'Demo mit Beispieldaten. Importe werden simuliert und verursachen keine KI-Kosten.':state.read_only?'Geschützte, schreibgeschützte Vorschau ohne produktive Daten oder KI.':state.has_key?'OpenAI-Secret auf dem Worker vorhanden.':'OPENAI_API_KEY ist noch nicht als Worker Secret eingerichtet.';
  $('#identity').textContent=state.user.email?`${state.user.email} · ${state.user.role==='admin'?'Administrator':'Mitglied'}`:'';
  $('#members-panel').hidden=__REZEPTWERK_DEMO__||state.read_only||state.user.role!=='admin';input('#import-submit').disabled=state.read_only;
  $('#member-list').innerHTML=state.members.map(m=>`<div class="member-row"><span>${esc(m.email)} · ${esc(m.role)} · ${m.active?'aktiv':'gesperrt'}</span>${m.id!==state.user.id?`<button class="text-button" data-member="${esc(m.id)}" data-active="${m.active?0:1}">${m.active?'Sperren':'Aktivieren'}</button>`:''}</div>`).join('');
  $('#import-history').innerHTML=state.imports.length?state.imports.map(i=>`<p class="field-help">${esc(new Date(i.created_at).toLocaleString('de-DE'))} · ${esc(i.status==='completed'?'Gespeichert':i.status==='running'?'Läuft':'Fehlgeschlagen')}${i.error_code?' · '+esc(i.error_code):''}${i.estimated_cost_microusd!==null?' · ca. '+(i.estimated_cost_microusd/1e6).toFixed(4)+' USD':''}</p>`).join(''):'<p class="field-help">Noch keine Importe.</p>';
  renderRecipes();renderShopping();
}
async function refresh(){state=await api<AppState>('/api/state');render();}
function sourceLink(value:string){try{const url=new URL(value);if(url.protocol==='https:')return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Originalquelle öffnen ↗</a>`;}catch{}return '';}
function openRecipe(id:number){const r=state.recipes.find(r=>r.id===id);if(!r)return;
  $('#dialog-caption').textContent='AUS EUREM KOCHBUCH';
  const [emoji,tone]=presentation(r);
  $('#dialog-content').innerHTML=`<div class="detail-hero tone-${tone}"><div class="detail-hero-art" aria-hidden="true">${emoji}${imageMarkup(r)}</div><div class="detail-hero-copy"><span class="detail-kicker">AUS DEINEM KOCHBUCH</span><h2>${esc(r.title)}</h2><p class="recipe-description">${esc(r.description)}</p></div></div>${imageCredit(r)}<div class="recipe-facts"><div><span>⏱️ Vorbereitung</span><strong>${r.prep_minutes===null?'Unbekannt':fmt(r.prep_minutes)+' Min.'}</strong></div><div><span>🍳 Kochzeit</span><strong>${r.cook_minutes===null?'Unbekannt':fmt(r.cook_minutes)+' Min.'}</strong></div><div><span>🍽️ Portionen</span><strong>${r.servings===null?'Unbekannt':fmt(r.servings)}</strong></div><div><span>👩‍🍳 Zubereitung</span><strong>${r.steps.length} Schritte</strong></div></div><div class="recipe-columns"><section><div class="ingredient-heading"><h3>Zutaten</h3><button class="text-button" data-ingredients-add="${r.id}" ${state.read_only?'disabled':''}>Alle Zutaten hinzufügen 🛒</button></div><ul class="ingredient-view">${r.ingredients.map((i,n)=>`<li><label class="ingredient-check"><input type="checkbox" aria-label="${esc(i.name)} vorbereitet"><span>${esc(i.name)}<small>${esc(i.note)}</small></span><strong>${esc(quantity(i))||'Menge offen'}</strong></label><button class="ingredient-add" data-ingredients-add="${r.id}" data-ingredient-index="${n}" aria-label="${esc(i.name)} zur Einkaufsliste hinzufügen" ${state.read_only?'disabled':''}>＋</button></li>`).join('')}</ul><div class="detail-source">${sourceLink(r.source_url)}</div></section><section><h3>Zubereitung</h3><ol class="method-list">${r.steps.map((s,n)=>{return `<li><span class="step-number" aria-hidden="true">${n+1}</span><p>${esc(stepInstruction(r,n))}</p></li>`;}).join('')}</ol></section></div><div class="detail-actions"><button class="primary compact" data-add="${r.id}" ${r.servings===null||state.read_only?'disabled':''}>+ Zur Kochliste</button>${r.can_edit?`<button class="secondary" data-edit="${r.id}">Bearbeiten</button>`:''}${r.can_delete?`<button class="text-button danger" data-delete="${r.id}">Löschen</button>`:''}</div>${r.warnings.length?`<footer class="recipe-notes" aria-label="Hinweise zum Rezept"><p>Hinweise zum Rezept</p><ul>${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></footer>`:''}`;
  if(!dialog().open)dialog().showModal();
}
function ingredientRow(i:Partial<Ingredient>={}){return `<div class="ingredient-edit"><input type="number" data-amount min="0" max="1000000" step="any" aria-label="Menge" value="${i.amount??''}"><input data-unit aria-label="Einheit" maxlength="30" value="${esc(i.unit||'')}"><input data-name aria-label="Zutat" required maxlength="300" value="${esc(i.name||'')}"><button type="button" class="icon-button danger" data-delete-row aria-label="Zutat entfernen">×</button><input class="ingredient-note" data-note aria-label="Hinweis" maxlength="300" value="${esc(i.note||'')}"></div>`;}
function stepRow(s:Partial<Step>={}){return `<div class="step-edit"><label>Arbeitsschritt<textarea data-step-text rows="3" required maxlength="3000">${esc(s.text||'')}</textarea></label><label>Zutatennummern, z. B. 1, 3<input data-step-refs value="${(s.ingredient_indices||[]).map(i=>i+1).join(', ')}"></label><button class="text-button danger" type="button" data-delete-step>Schritt entfernen</button></div>`;}
function openEditor(r:Recipe){if(!r.can_edit)return;draft=structuredClone(r);$('#dialog-caption').textContent='GESPEICHERTES REZEPT KORRIGIEREN';
  $('#dialog-content').innerHTML=`<form id="editor-form"><div id="editor-error" class="dialog-error" hidden role="alert"></div><label>Rezeptname<input id="edit-title" required maxlength="200" value="${esc(r.title)}"></label><label>Beschreibung<input id="edit-description" maxlength="1500" value="${esc(r.description)}"></label><div class="editor-grid"><label>Portionen (leer = unbekannt)<input id="edit-servings" type="number" min="0.01" max="1000" step="any" value="${r.servings??''}"></label><label>Vorbereitung (Min.)<input id="edit-prep" type="number" min="0" max="10080" step="any" value="${r.prep_minutes??''}"></label><label>Kochzeit (Min.)<input id="edit-cook" type="number" min="0" max="10080" step="any" value="${r.cook_minutes??''}"></label></div><div class="editor-head"><h3>Zutaten</h3><button type="button" id="add-ingredient" class="text-button">+ Zutat</button></div><p class="field-help">Die Reihenfolge bestimmt die Zutatennummern. Bei Entfernen die Zuordnungen korrigieren.</p><div id="ingredient-rows">${r.ingredients.map(ingredientRow).join('')}</div><div class="editor-head"><h3>Zubereitung</h3><button type="button" id="add-step" class="text-button">+ Schritt</button></div><div id="step-rows">${r.steps.map(stepRow).join('')}</div><label>Prüfhinweise, einer je Zeile<textarea id="edit-warnings" rows="3">${esc(r.warnings.join('\n'))}</textarea></label><div class="detail-actions"><button class="primary compact" type="submit">Rezept speichern ✓</button><button type="button" id="cancel-edit" class="secondary">Abbrechen</button></div></form>`;
}
async function saveEditor(){if(!draft)return;
  const nullable=(s:string)=>input(s).value===''?null:Number(input(s).value);
  const ingredients=[...document.querySelectorAll<HTMLElement>('.ingredient-edit')].map(row=>({name:row.querySelector<HTMLInputElement>('[data-name]')!.value,amount:row.querySelector<HTMLInputElement>('[data-amount]')!.value===''?null:Number(row.querySelector<HTMLInputElement>('[data-amount]')!.value),unit:row.querySelector<HTMLInputElement>('[data-unit]')!.value,note:row.querySelector<HTMLInputElement>('[data-note]')!.value}));
  const steps=[...document.querySelectorAll<HTMLElement>('.step-edit')].map(row=>({text:row.querySelector<HTMLTextAreaElement>('[data-step-text]')!.value,ingredient_indices:row.querySelector<HTMLInputElement>('[data-step-refs]')!.value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>Number(s)-1)}));
  const recipe:RecipeData={title:input('#edit-title').value,description:input('#edit-description').value,servings:nullable('#edit-servings'),prep_minutes:nullable('#edit-prep'),cook_minutes:nullable('#edit-cook'),ingredients,steps,warnings:$<HTMLTextAreaElement>('#edit-warnings').value.split('\n').filter(Boolean)};
  await api('/api/recipes/save',{...recipe,id:draft.id,revision:draft.revision});await refresh();dialog().close();showView('collection');notify('Die Korrektur wurde gespeichert.');
}
document.addEventListener('click',async event=>{
  if(!(event.target instanceof Element))return;const b=event.target.closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
  try{
    if(b.dataset.view)showView(b.dataset.view);
    if(b.dataset.productIndex!==undefined){await selectProduct(Number(b.dataset.productIndex));return;}
    if(b.id==='cancel-shopping-edit'){resetShoppingForm();return;}
    if(b.dataset.manualEdit){const item=state.manual_items?.find(i=>i.id===b.dataset.manualEdit);if(item){shoppingEditId=item.id;input('#shopping-name').value=item.name;input('#shopping-quantity').value=item.quantity;$('#shopping-emoji').textContent=productFor(item.name).emoji;$('#shopping-edit-hint').hidden=false;$('#cancel-shopping-edit').hidden=false;input('#shopping-name').focus({preventScroll:true});if(matchMedia('(min-width:1001px), (min-width:700px) and (pointer:fine)').matches)$('#shopping-form').scrollIntoView({block:'center',behavior:'smooth'});refreshDock();}return;}
    if(b.dataset.manualDelete){await api('/api/shopping/items/delete',{id:b.dataset.manualDelete});if(shoppingEditId===b.dataset.manualDelete)resetShoppingForm();await refresh();notify('Artikel entfernt.');return;}
    if(b.dataset.recent){b.disabled=true;try{await api('/api/shopping/items/check',{id:b.dataset.recent,checked:false});await refresh();notify('Wieder auf deiner Einkaufsliste.');}finally{b.disabled=false;}return;}
    if(b.dataset.ingredientsAdd){
      b.disabled=true;
      try{await api('/api/shopping/from-recipe',{recipe_id:Number(b.dataset.ingredientsAdd),...(b.dataset.ingredientIndex!==undefined?{ingredient_indices:[Number(b.dataset.ingredientIndex)]}:{})});await refresh();notify(b.dataset.ingredientIndex!==undefined?'Zutat auf deiner Einkaufsliste.':'Alle Zutaten auf deiner Einkaufsliste.');}
      finally{b.disabled=state.read_only;}return;
    }
    if(b.dataset.open)openRecipe(Number(b.dataset.open));
    if(b.dataset.edit){const r=state.recipes.find(r=>r.id===Number(b.dataset.edit));if(r)openEditor(r);}
    if(b.dataset.add){const id=Number(b.dataset.add),r=state.recipes.find(r=>r.id===id);if(!r||r.servings===null)return;if(state.plan.some(p=>p.recipe_id===id)){dialog().close();showView('shopping');return;}await api('/api/plan',{recipe_id:id,servings:r.servings});await refresh();dialog().close();notify('Zur gemeinsamen Kochliste hinzugefügt.');}
    if(b.dataset.remove){await api('/api/plan',{recipe_id:Number(b.dataset.remove),remove:true});await refresh();}
    if(b.dataset.delete&&confirm('Dieses Rezept löschen?')){await api('/api/recipes/delete',{id:Number(b.dataset.delete)});await refresh();dialog().close();}
    if(b.hasAttribute('data-delete-row'))b.closest('.ingredient-edit')?.remove();
    if(b.hasAttribute('data-delete-step'))b.closest('.step-edit')?.remove();
    if(b.id==='add-ingredient')$('#ingredient-rows').insertAdjacentHTML('beforeend',ingredientRow());
    if(b.id==='add-step')$('#step-rows').insertAdjacentHTML('beforeend',stepRow());
    if(['close-dialog','cancel-edit'].includes(b.id))dialog().close();
    if(b.dataset.member){await api('/api/members/update',{id:b.dataset.member,active:Number(b.dataset.active)});await refresh();}
    if(b.id==='copy-list'){await navigator.clipboard.writeText([...state.shopping.filter(i=>!state.checked.includes(i.key)).map(i=>`☐ ${quantity(i)} ${i.name} ${i.note}`),...(state.manual_items||[]).filter(i=>!i.checked).map(i=>'☐ '+[i.quantity,i.name].filter(Boolean).join(' '))].join('\n'));notify('Offene Zutaten kopiert.');}
    if(b.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,recipes:state.recipes},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rezeptwerk.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){notify(e instanceof Error?e.message:'Anfrage fehlgeschlagen.',true);}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();const b=form.querySelector<HTMLButtonElement>('[type="submit"]');if(b)b.disabled=true;
  try{
    if(form.id==='shopping-form'){
      await saveShoppingEntry(input('#shopping-name').value);
    }else if(form.id==='import-form'){
      if(b){b.textContent='…';b.setAttribute('aria-busy','true');}$('#import-progress').hidden=false;const video=!$('#transcript-panel').hidden;
      const result=await api<{id:number;existing:boolean}>('/api/import',{value:input('#source').value,...(video?{transcript:$<HTMLTextAreaElement>('#transcript').value,authorized:input('#transcript-authorized').checked,duration_seconds:Number(input('#video-duration').value)*60}:{})});
      await refresh();showView('collection');notify(result.existing?'Das Rezept ist bereits gespeichert.':'Das Rezept wurde automatisch gespeichert.');
    }else if(form.id==='editor-form')await saveEditor();
    else if(form.id==='member-form'){await api('/api/members',{email:input('#member-email').value,role:$<HTMLSelectElement>('#member-role').value});await refresh();input('#member-email').value='';notify('Kochbuch-Zugriff erlaubt. Auch die Access-Richtlinie muss die Person zulassen.');}
  }catch(e){const message=e instanceof Error?e.message:'Anfrage fehlgeschlagen.';if(form.id==='editor-form'){$('#editor-error').textContent=message;$('#editor-error').hidden=false;}else notify(message,true);}
  finally{if(b){b.disabled=state.read_only;if(form.id==='import-form'){b.textContent='→';b.removeAttribute('aria-busy');$('#import-progress').hidden=true;}}}
});
document.addEventListener('change',async event=>{const e=event.target;if(!(e instanceof HTMLInputElement))return;
  try{if(e.dataset.manualCheck){e.disabled=true;await api('/api/shopping/items/check',{id:e.dataset.manualCheck,checked:e.checked});await refresh();notify(e.checked?'Erledigt. Unter „Zuletzt verwendet“ findest du den Artikel wieder.':'Wieder auf der Liste.');}if(e.dataset.portions){if(!e.reportValidity())return;await api('/api/plan',{recipe_id:Number(e.dataset.portions),servings:Number(e.value)});await refresh();}if(e.dataset.check!==undefined){await api('/api/shopping/check',{key:e.dataset.check,checked:e.checked});await refresh();}}
  catch(error){notify(error instanceof Error?error.message:'Anfrage fehlgeschlagen.',true);await refresh().catch(()=>{});}
});
input('#shopping-name').addEventListener('input',renderSuggestions);
input('#shopping-name').addEventListener('focus',renderSuggestions);
input('#shopping-name').addEventListener('keydown',event=>{
  if(event.key==='Escape'){hideSuggestions();return;}
  if($('#shopping-suggestions').hidden)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();suggestionIndex=(suggestionIndex+(event.key==='ArrowDown'?1:-1)+suggestionNames.length)%suggestionNames.length;
    $('#shopping-suggestions').querySelectorAll<HTMLElement>('[role="option"]').forEach((e,n)=>e.setAttribute('aria-selected',String(n===suggestionIndex)));
    input('#shopping-name').setAttribute('aria-activedescendant','product-option-'+suggestionIndex);
  }else if(event.key==='Enter'&&suggestionIndex>=0){event.preventDefault();selectProduct(suggestionIndex).catch(error=>notify(error instanceof Error?error.message:'Artikel konnte nicht gespeichert werden.',true));}
});
document.addEventListener('click',event=>{if(event.target instanceof Node&&!$('#shopping-form').contains(event.target))hideSuggestions();});
input('#search').addEventListener('input',renderRecipes);
input('#source').addEventListener('input',()=>{try{$('#transcript-panel').hidden=!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(new URL(input('#source').value).hostname);}catch{$('#transcript-panel').hidden=true;}});
refreshDock=installShoppingDock();
showView(location.hash.slice(1)||(location.pathname.startsWith('/shopping/')?'shopping':'import'));
if(__REZEPTWERK_DEMO__){$('#demo-banner').hidden=false;refresh().catch(e=>notify(e.message,true));}
else if(preview){render();notify('Statische Vorschau ohne private Datenbank oder KI.');clearTimeout(timer);}
else refresh().catch(e=>notify(e instanceof Error?e.message:'Die App ist nicht erreichbar.',true));
