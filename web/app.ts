import {installCollectionGestures} from './collection-gestures.js';
import {videoPlatform} from '../src/shared/video-platform.js';
declare const __REZEPTWERK_DEMO__:boolean;
import type { AppState,Recipe,RecipeData,BringList,BringExportResult } from '../src/shared/types.js';
import {stepInstruction} from '../src/shared/step-quantities.js';
type Ingredient=RecipeData['ingredients'][number];
type Step=RecipeData['steps'][number];
let state:AppState={recipes:[],members:[],imports:[],has_key:false,read_only:true,user:{id:'',email:'',role:'member',active:0}};
let draft:Recipe|null=null;
let pendingDelete:number|null=null;
let deleting=false;
let bringQueue:Promise<void>=Promise.resolve();
function $<T extends HTMLElement=HTMLElement>(selector:string):T{const element=document.querySelector<T>(selector);if(!element)throw new Error('Oberflächenelement fehlt');return element;}
const input=(s:string)=>$<HTMLInputElement>(s);
const dialog=()=>$<HTMLDialogElement>('#recipe-dialog');
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number|null)=>v===null?'':v.toLocaleString('de-DE',{maximumFractionDigits:2});
const quantity=(i:{amount:number|null;unit:string})=>[fmt(i.amount),i.unit].filter(Boolean).join(' ');
const preview=location.protocol==='file:'||new URLSearchParams(location.search).get('preview')==='1';
let timer:ReturnType<typeof setTimeout>|undefined;
function notify(message:string,error=false){$('#notice').textContent=message;$('#notice').hidden=false;$('#notice').classList.toggle('error',error);clearTimeout(timer);timer=setTimeout(()=>{$('#notice').hidden=true;},error?15000:6000);}
function offerSignIn(){
  if(document.querySelector('#access-recovery'))return;
  const panel=document.createElement('aside');panel.id='access-recovery';panel.className='panel';panel.setAttribute('role','alert');
  const message=document.createElement('p');message.textContent='Deine Anmeldung konnte nicht bestätigt werden. Bitte melde dich erneut an.';
  const link=document.createElement('a');link.href='/cdn-cgi/access/logout';link.className='primary compact';link.textContent='Erneut anmelden';
  const help=document.createElement('p');help.className='field-help';help.textContent='Dies beendet deine Cloudflare-Access-Sitzung, gegebenenfalls auch für andere Apps dieses Teams. Öffne Futterluke danach nach etwa 30 Sekunden erneut.';
  panel.append(message,link,help);$('#notice').after(panel);
}
async function api<T>(path:string,data?:unknown):Promise<T>{
  if(__REZEPTWERK_DEMO__){const {demoApi}=await import('./demo.js');return demoApi<T>(path,data);}
  if(preview)throw new Error('Diese statische Vorschau ist nicht mit der privaten App verbunden.');
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify(data)});
  if(response.status===401||response.redirected)offerSignIn();
  if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Die Access-Anmeldung ist abgelaufen. Bitte neu laden.');
  const result=await response.json() as {error?:string;code?:string};if(!response.ok)throw Object.assign(new Error(result.error||'Anfrage fehlgeschlagen.'),{code:result.code});return result as T;
}
function showView(view:string){
  if(!['import','collection','settings'].includes(view))view='import';
  document.body.dataset.view=view;document.documentElement.dataset.view=view;
  $('#area-label').textContent=view==='settings'?'Einstellungen':'Dein Kochbuch';
  document.querySelectorAll<HTMLElement>('.view').forEach(e=>{e.hidden=e.id!=='view-'+view;});
  $('#app-header').hidden=view==='import';$('#app-navigation').hidden=view==='import';
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(e=>{const active=e.dataset.view===view;e.classList.toggle('active',active);if(active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
  history.replaceState(null,'','#'+view);window.scrollTo(0,0);
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
function canLoadVideoImage(r:Recipe):boolean{try{return r.can_edit&&!r.image&&!state.read_only&&['instagram','tiktok'].includes(videoPlatform(new URL(r.source_url))||'');}catch{return false;}}
function imageMarkup(r:Recipe):string{const src=recipeImage(r);return src?'<img class="recipe-photo'+(r.image?.credit.startsWith('Standbild aus dem Originalvideo')?' video-still':'')+'" src="'+esc(src)+'" alt="'+esc(r.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'';}
function imageCredit(r:Recipe):string{
  if(!recipeImage(r))return '';
  let link='';try{const url=new URL(r.image!.source_url);if(url.protocol==='https:')link='<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">Bildquelle ↗</a>';}catch{}
  return '<p class="image-credit">'+[esc(r.image!.credit),link].filter(Boolean).join(' · ')+'</p>';
}
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&event.target.classList.contains('recipe-photo'))event.target.remove();},true);
function renderRecipes(){
  const search=input('#search').value.toLowerCase();
  const recipes=state.recipes.filter(r=>(r.title+' '+r.ingredients.map(i=>i.name).join(' ')).toLowerCase().includes(search));
  $('#recipe-grid').innerHTML=recipes.length?recipes.map(r=>{const [emoji,tone]=presentation(r);return `<article class="recipe-card"><button class="recipe-cover tone-${tone}" data-open="${r.id}" aria-label="${esc(r.title)} ansehen"><span aria-hidden="true">${emoji}</span>${imageMarkup(r)}</button><div class="recipe-content">${r.warnings.length?'<div class="warning-label">Hinweise zur Prüfung</div>':''}<h2><button class="recipe-title" data-open="${r.id}" aria-label="${esc(r.title)} öffnen">${esc(r.title)}</button></h2><p class="recipe-meta"><span>◷ ${esc(cookingTime(r))}</span><span>${r.servings===null?'Portionen offen':fmt(r.servings)+' Portionen'}</span></p></div></article>`;}).join(''):empty(search?'Kein Treffer.':'Dein Kochbuch wartet auf dich.',search?'Versuche einen anderen Namen oder eine Zutat.':'Füge deinen ersten Rezeptlink ein.');
}
function render(){
  $('#recipe-count').textContent=String(state.recipes.length);$('#key-hint').hidden=state.has_key||state.read_only;
  $('#key-status').textContent=__REZEPTWERK_DEMO__?'Demo mit Beispieldaten. Importe werden simuliert und verursachen keine KI-Kosten.':state.read_only?'Geschützte, schreibgeschützte Vorschau ohne produktive Daten oder KI.':state.has_key?'OpenAI-Secret auf dem Worker vorhanden.':'OPENAI_API_KEY ist noch nicht als Worker Secret eingerichtet.';
  $('#identity').textContent=state.user.email?`${state.user.email} · ${state.user.role==='admin'?'Administrator':'Mitglied'}`:'';
  $('#members-panel').hidden=__REZEPTWERK_DEMO__||state.read_only||state.user.role!=='admin';input('#import-submit').disabled=state.read_only;
  $('#member-list').innerHTML=state.members.map(m=>`<div class="member-row"><span>${esc(m.email)} · ${esc(m.role)} · ${m.active?'aktiv':'gesperrt'}</span>${m.id!==state.user.id?`<button class="text-button" data-member="${esc(m.id)}" data-active="${m.active?0:1}">${m.active?'Sperren':'Aktivieren'}</button>`:''}</div>`).join('');
  $('#import-history').innerHTML=state.imports.length?state.imports.map(i=>`<p class="field-help">${esc(new Date(i.created_at).toLocaleString('de-DE'))} · ${esc(i.status==='completed'?'Gespeichert':i.status==='running'?'Läuft':'Fehlgeschlagen')}${i.error_code?' · '+esc(i.error_code):''}${i.estimated_cost_microusd!==null?' · ca. '+(i.estimated_cost_microusd/1e6).toFixed(4)+' USD':''}</p>`).join(''):'<p class="field-help">Noch keine Importe.</p>';
  $('#bring-panel').hidden=__REZEPTWERK_DEMO__||state.read_only;
  $('#bring-status').textContent=state.bring?.setup_required?'Die Datenbank-Erweiterung für Bring! fehlt noch. Bitte den Administrator informieren.':state.bring?.ready?'Verbunden mit „'+state.bring.list_name+'“. Zutaten werden in den Mengen des gespeicherten Rezepts übertragen.':state.bring?.enabled?'Noch keine Bring!-Zielliste ausgewählt.':'Noch nicht verbunden. Der Administrator hinterlegt BRING_EMAIL, BRING_PASSWORD und BRING_CLIENT_KEY als Cloudflare Worker Secrets.';
  $('#bring-admin').hidden=state.user.role!=='admin'||!state.bring?.enabled||Boolean(state.bring?.setup_required);
  renderRecipes();
}
async function refresh(){state=await api<AppState>('/api/state');render();}
function sourceLink(value:string){try{const url=new URL(value);if(url.protocol==='https:')return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Originalquelle öffnen ↗</a>`;}catch{}return '';}
function openRecipe(id:number){const r=state.recipes.find(r=>r.id===id);if(!r)return;
  $('#dialog-caption').textContent='AUS EUREM KOCHBUCH';
  const [emoji,tone]=presentation(r);
  $('#dialog-content').innerHTML=`<div class="detail-hero tone-${tone}"><div class="detail-hero-art" aria-hidden="true">${emoji}${imageMarkup(r)}</div><div class="detail-hero-copy"><h2>${esc(r.title)}</h2><p class="recipe-description">${esc(r.description)}</p></div></div>${imageCredit(r)}<div class="recipe-facts"><div><span>⏱️ Vorbereitung</span><strong>${r.prep_minutes===null?'Unbekannt':fmt(r.prep_minutes)+' Min.'}</strong></div><div><span>🍳 Kochzeit</span><strong>${r.cook_minutes===null?'Unbekannt':fmt(r.cook_minutes)+' Min.'}</strong></div><div><span>🍽️ Portionen</span><strong>${r.servings===null?'Unbekannt':fmt(r.servings)}</strong></div><div><span>👩‍🍳 Zubereitung</span><strong>${r.steps.length} Schritte</strong></div></div><div class="recipe-columns"><section><div class="ingredient-heading"><h3>Zutaten</h3></div><ul class="ingredient-view">${r.ingredients.map((i,n)=>`<li><label class="ingredient-check"><input type="checkbox" aria-label="${esc(i.name)} vorbereitet"><span>${esc(i.name)}<small>${esc(i.note)}</small></span><strong>${esc(quantity(i))||'Menge offen'}</strong></label><button class="ingredient-add" data-bring-ingredient="${n}" data-recipe-id="${r.id}" aria-label="${esc(i.name)} an Bring! senden" title="${state.bring?.ready?'An Bring! → '+esc(state.bring.list_name):'Bring! zuerst in den Einstellungen verbinden'}" ${state.read_only||!state.bring?.ready?'disabled':''}>＋</button></li>`).join('')}</ul><div class="detail-source">${sourceLink(r.source_url)}</div></section><section><h3>Zubereitung</h3><ol class="method-list">${r.steps.map((s,n)=>{return `<li><span class="step-number" aria-hidden="true">${n+1}</span><p>${esc(stepInstruction(r,n))}</p></li>`;}).join('')}</ol></section></div><div class="detail-actions">${r.can_edit?`<button class="secondary" data-edit="${r.id}">Bearbeiten</button>`:''}${canLoadVideoImage(r)?`<button class="secondary" data-video-image="${r.id}">Videovorschaubild laden</button>`:''}${r.can_delete?`<button class="text-button danger" data-delete="${r.id}">Löschen</button>`:''}</div>${r.warnings.length?`<footer class="recipe-notes" aria-label="Hinweise zum Rezept"><p>Hinweise zum Rezept</p><ul>${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></footer>`:''}`;
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
function requestDelete(id:number){
 const recipe=state.recipes.find(r=>r.id===id);if(!recipe?.can_delete||state.read_only||deleting)return;
 pendingDelete=id;$('#delete-recipe-name').textContent='„'+recipe.title+'“ wird aus dem gemeinsamen Kochbuch gelöscht.';
 $('#delete-error').hidden=true;const modal=$<HTMLDialogElement>('#delete-dialog');if(!modal.open)modal.showModal();
}
async function confirmDelete(){
 const id=pendingDelete;if(id===null||deleting)return;
 deleting=true;input('#confirm-delete').disabled=true;input('#cancel-delete').disabled=true;
 try{
  await api('/api/recipes/delete',{id});state.recipes=state.recipes.filter(r=>r.id!==id);render();
  $<HTMLDialogElement>('#delete-dialog').close();if(dialog().open)dialog().close();notify('Rezept gelöscht.');
 }catch(error){$('#delete-error').textContent=error instanceof Error?error.message:'Das Rezept konnte nicht gelöscht werden.';$('#delete-error').hidden=false;}
 finally{deleting=false;input('#confirm-delete').disabled=false;input('#cancel-delete').disabled=false;}
}
$<HTMLDialogElement>('#delete-dialog').addEventListener('close',()=>{pendingDelete=null;});
$<HTMLDialogElement>('#delete-dialog').addEventListener('cancel',event=>{if(deleting)event.preventDefault();});
const collectionGestures=installCollectionGestures({
 root:$('#view-collection'),indicator:$('#collection-refresh'),
 active:()=>document.body.dataset.view==='collection'&&!dialog().open&&!$<HTMLDialogElement>('#delete-dialog').open&&(!preview||__REZEPTWERK_DEMO__),
 canDelete:id=>!state.read_only&&Boolean(state.recipes.find(r=>r.id===id)?.can_delete),
 onDelete:requestDelete,onRefresh:refresh,onError:error=>notify(error instanceof Error?error.message:'Aktualisieren fehlgeschlagen.',true)
});
document.addEventListener('click',async event=>{
  if(!(event.target instanceof Element))return;const b=event.target.closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
  try{
    if(b.dataset.view){if(b.dataset.view==='collection'&&document.body.dataset.view==='collection')await collectionGestures.refresh();else showView(b.dataset.view);}
    if(b.id==='provide-video'){$('#transcript-panel').hidden=false;return;}
    if(b.id==='bring-load-lists'){
      b.disabled=true;try{const result=await api<{lists:BringList[]}>('/api/bring/lists',{});$('#bring-list').innerHTML=result.lists.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('');$('#bring-form').hidden=!result.lists.length;if(!result.lists.length)notify('Keine Bring!-Listen gefunden.',true);}finally{b.disabled=false;}return;
    }
    if(b.dataset.bringIngredient!==undefined){
      const recipe=state.recipes.find(r=>r.id===Number(b.dataset.recipeId)),index=Number(b.dataset.bringIngredient);
      if(!recipe||!state.bring?.ready||state.read_only)return;
      const payload={recipe_id:recipe.id,ingredient_index:index,revision:recipe.revision,target_revision:state.bring.revision};
      b.disabled=true;b.textContent='…';b.setAttribute('aria-busy','true');
      const task=bringQueue.then(()=>api<BringExportResult>('/api/bring/export',payload));
      bringQueue=task.then(()=>{},()=>{});
      try{const result=await task;b.textContent='✓';notify(result.existing?'Diese Zutat wurde vor Kurzem bereits an Bring! gesendet.':recipe.ingredients[index].name+' an „'+result.list_name+'“ gesendet.');}
      catch(error){b.textContent='＋';throw error;}
      finally{b.disabled=false;b.removeAttribute('aria-busy');}return;
    }
    if(b.dataset.videoImage){b.disabled=true;try{await api('/api/recipes/video-image',{recipe_id:Number(b.dataset.videoImage)});await refresh();openRecipe(Number(b.dataset.videoImage));dialog().scrollTop=0;notify('Videovorschaubild ergänzt.');}finally{b.disabled=false;}return;}
    if(b.id==='clear-adaptation'){$<HTMLTextAreaElement>('#adaptation').value='';$('#adaptation-active').hidden=true;$<HTMLTextAreaElement>('#adaptation').focus();return;}
    if(b.dataset.open)openRecipe(Number(b.dataset.open));
    if(b.dataset.edit){const r=state.recipes.find(r=>r.id===Number(b.dataset.edit));if(r)openEditor(r);}
    if(b.dataset.delete)requestDelete(Number(b.dataset.delete));
    if(b.id==='cancel-delete')$<HTMLDialogElement>('#delete-dialog').close();
    if(b.id==='confirm-delete')await confirmDelete();
    if(b.hasAttribute('data-delete-row'))b.closest('.ingredient-edit')?.remove();
    if(b.hasAttribute('data-delete-step'))b.closest('.step-edit')?.remove();
    if(b.id==='add-ingredient')$('#ingredient-rows').insertAdjacentHTML('beforeend',ingredientRow());
    if(b.id==='add-step')$('#step-rows').insertAdjacentHTML('beforeend',stepRow());
    if(['close-dialog','cancel-edit'].includes(b.id))dialog().close();
    if(b.dataset.member){await api('/api/members/update',{id:b.dataset.member,active:Number(b.dataset.active)});await refresh();}
    if(b.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,recipes:state.recipes},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rezeptwerk.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){notify(e instanceof Error?e.message:'Anfrage fehlgeschlagen.',true);}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();const b=form.querySelector<HTMLButtonElement>('[type="submit"]');if(b)b.disabled=true;
  try{
    if(form.id==='import-form'){
      if(b){b.textContent='…';b.setAttribute('aria-busy','true');}$('#import-progress').hidden=false;const video=!$('#transcript-panel').hidden;
      let evidence:Record<string,unknown>={};if(video){if(!input('#transcript-authorized').checked)throw new Error('Bitte bestätigen, dass du den Text verwenden darfst.');evidence={transcript:$<HTMLTextAreaElement>('#transcript').value,authorized:true,duration_seconds:Number(input('#video-duration').value)*60};}
      const result=await api<{id:number;existing:boolean}>('/api/import',{value:input('#source').value,adaptation:$<HTMLTextAreaElement>('#adaptation').value,...evidence});
      form.reset();$<HTMLDetailsElement>('#adaptation-options').open=false;$('#adaptation-active').hidden=true;$('#transcript-panel').hidden=true;$('#provide-video').hidden=true;
      await refresh();showView('collection');notify(result.existing?'Das Rezept ist bereits gespeichert.':'Das Rezept wurde automatisch gespeichert.');
    }else if(form.id==='editor-form')await saveEditor();
    else if(form.id==='bring-form'){await api('/api/bring/configure',{list_id:$<HTMLSelectElement>('#bring-list').value});$('#bring-form').hidden=true;await refresh();notify('Gemeinsame Bring!-Liste verbunden.');}
    else if(form.id==='member-form'){await api('/api/members',{email:input('#member-email').value,role:$<HTMLSelectElement>('#member-role').value});await refresh();input('#member-email').value='';notify('Kochbuch-Zugriff erlaubt. Auch die Access-Richtlinie muss die Person zulassen.');}
  }catch(e){if(form.id==='import-form'&&e instanceof Error&&'code'in e&&e.code==='VIDEO_SOURCE_REQUIRED')$('#transcript-panel').hidden=false;const message=e instanceof Error?e.message:'Anfrage fehlgeschlagen.';if(form.id==='editor-form'){$('#editor-error').textContent=message;$('#editor-error').hidden=false;}else notify(message,true);}
  finally{if(b){b.disabled=state.read_only;if(form.id==='import-form'){b.textContent='→';b.removeAttribute('aria-busy');$('#import-progress').hidden=true;}}}
});
input('#search').addEventListener('input',renderRecipes);
input('#source').addEventListener('input',()=>{$('#transcript-panel').hidden=true;$<HTMLTextAreaElement>('#transcript').value='';input('#transcript-authorized').checked=false;try{$('#provide-video').hidden=!videoPlatform(new URL(input('#source').value));}catch{$('#provide-video').hidden=true;}});
showView(location.hash.slice(1)||'import');
if(__REZEPTWERK_DEMO__){$('#demo-banner').hidden=false;refresh().catch(e=>notify(e.message,true));}
else if(preview){render();notify('Statische Vorschau ohne private Datenbank oder KI.');clearTimeout(timer);}
else refresh().catch(e=>notify(e instanceof Error?e.message:'Die App ist nicht erreichbar.',true));

$<HTMLTextAreaElement>('#adaptation').addEventListener('input',()=>{$('#adaptation-active').hidden=!$<HTMLTextAreaElement>('#adaptation').value.trim();});
