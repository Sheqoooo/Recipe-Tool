import type { AppState,Recipe,RecipeData } from '../src/shared/types.js';
type Ingredient=RecipeData['ingredients'][number];
type Step=RecipeData['steps'][number];
let state:AppState={recipes:[],plan:[],shopping:[],checked:[],members:[],imports:[],has_key:false,read_only:true,user:{id:'',email:'',role:'member',active:0}};
let draft:Recipe|null=null;
function $<T extends HTMLElement=HTMLElement>(selector:string):T{const element=document.querySelector<T>(selector);if(!element)throw new Error('Oberflächenelement fehlt');return element;}
const input=(s:string)=>$<HTMLInputElement>(s);
const dialog=()=>$<HTMLDialogElement>('#recipe-dialog');
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number|null)=>v===null?'':v.toLocaleString('de-DE',{maximumFractionDigits:2});
const quantity=(i:{amount:number|null;unit:string})=>[fmt(i.amount),i.unit].filter(Boolean).join(' ');
const preview=location.protocol==='file:'||new URLSearchParams(location.search).get('preview')==='1';
let timer:ReturnType<typeof setTimeout>|undefined;
function notify(message:string,error=false){$('#notice').textContent=message;$('#notice').hidden=false;$('#notice').classList.toggle('error',error);clearTimeout(timer);timer=setTimeout(()=>{$('#notice').hidden=true;},error?15000:6000);}
async function api<T>(path:string,data?:unknown):Promise<T>{
  if(preview)throw new Error('Diese statische Vorschau ist nicht mit der privaten App verbunden.');
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Rezeptwerk-Request':'1'},body:JSON.stringify(data)});
  if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Die Access-Anmeldung ist abgelaufen. Bitte neu laden.');
  const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Anfrage fehlgeschlagen.');return result as T;
}
function showView(view:string){if(!['import','collection','shopping','settings'].includes(view))view='import';document.querySelectorAll<HTMLElement>('.view').forEach(e=>{e.hidden=e.id!=='view-'+view;});document.querySelectorAll<HTMLElement>('.nav-item').forEach(e=>e.classList.toggle('active',e.dataset.view===view));history.replaceState(null,'','#'+view);}
const empty=(title:string,text:string)=>`<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
function renderRecipes(){const search=input('#search').value.toLowerCase();const recipes=state.recipes.filter(r=>(r.title+' '+r.ingredients.map(i=>i.name).join(' ')).toLowerCase().includes(search));
  $('#recipe-grid').innerHTML=recipes.length?recipes.map((r,i)=>`<article class="recipe-card"><span class="recipe-number">${String(i+1).padStart(2,'0')} /</span>${r.warnings.length?'<div class="warning-label">Hinweise zur Prüfung vorhanden</div>':''}<h2>${esc(r.title)}</h2><p>${r.servings===null?'Portionen unbekannt':fmt(r.servings)+' Portionen'} · ${r.ingredients.length} Zutaten</p><footer><button class="text-button" data-open="${r.id}">Rezept ansehen ↗</button><button class="secondary" data-add="${r.id}" ${state.read_only||r.servings===null?'disabled':''}>${state.plan.some(p=>p.recipe_id===r.id)?'✓ Auf der Kochliste':'+ Kochliste'}</button></footer></article>`).join(''):empty(search?'Kein Treffer.':'Hier beginnt euer Kochbuch.',search?'Versuche einen anderen Namen oder eine Zutat.':'Füge einen Rezeptlink ein. Das Rezept wird automatisch gespeichert.');
}
function renderShopping(){
  $('#plan-list').innerHTML=state.plan.length?state.plan.map(p=>`<article class="plan-card"><h3>${esc(p.recipe.title)}</h3><div class="portion-control"><label class="sr-only" for="portion-${p.recipe_id}">Portionen für ${esc(p.recipe.title)}</label><input id="portion-${p.recipe_id}" type="number" min="0.01" max="1000" step="any" value="${p.servings}" data-portions="${p.recipe_id}"><span>Portionen</span><button class="text-button danger" data-remove="${p.recipe_id}">Entfernen</button></div></article>`).join(''):empty('Was möchtet ihr kochen?','Wählt Gerichte aus eurer Sammlung.');
  $('#shopping-list').innerHTML=state.shopping.length?state.shopping.map(i=>`<label class="shopping-row ${state.checked.includes(i.key)?'checked':''}"><input type="checkbox" data-check="${esc(i.key)}" ${state.checked.includes(i.key)?'checked':''}><span><strong>${esc(quantity(i))} ${esc(i.name)}</strong><small>${esc(i.note)}</small><small>${esc(i.recipes.join(' · '))}${i.amount===null?' · Menge bitte prüfen':''}</small></span></label>`).join(''):'<p class="field-help">Hier erscheinen die Zutaten eurer Gerichte.</p>';
  input('#copy-list').disabled=!state.shopping.length;
}
function render(){
  $('#recipe-count').textContent=String(state.recipes.length);$('#plan-count').textContent=String(state.plan.length);$('#key-hint').hidden=state.has_key||state.read_only;
  $('#key-status').textContent=state.read_only?'Geschützte, schreibgeschützte Vorschau ohne produktive Daten oder KI.':state.has_key?'OpenAI-Secret auf dem Worker vorhanden.':'OPENAI_API_KEY ist noch nicht als Worker Secret eingerichtet.';
  $('#identity').textContent=state.user.email?`${state.user.email} · ${state.user.role==='admin'?'Administrator':'Mitglied'}`:'';
  $('#members-panel').hidden=state.read_only||state.user.role!=='admin';input('#import-submit').disabled=state.read_only;
  $('#member-list').innerHTML=state.members.map(m=>`<div class="member-row"><span>${esc(m.email)} · ${esc(m.role)} · ${m.active?'aktiv':'gesperrt'}</span>${m.id!==state.user.id?`<button class="text-button" data-member="${esc(m.id)}" data-active="${m.active?0:1}">${m.active?'Sperren':'Aktivieren'}</button>`:''}</div>`).join('');
  $('#import-history').innerHTML=state.imports.length?state.imports.map(i=>`<p class="field-help">${esc(new Date(i.created_at).toLocaleString('de-DE'))} · ${esc(i.status==='completed'?'Gespeichert':i.status==='running'?'Läuft':'Fehlgeschlagen')}${i.error_code?' · '+esc(i.error_code):''}${i.estimated_cost_microusd!==null?' · ca. '+(i.estimated_cost_microusd/1e6).toFixed(4)+' USD':''}</p>`).join(''):'<p class="field-help">Noch keine Importe.</p>';
  renderRecipes();renderShopping();
}
async function refresh(){state=await api<AppState>('/api/state');render();}
function sourceLink(value:string){try{const url=new URL(value);if(url.protocol==='https:')return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Originalquelle öffnen ↗</a>`;}catch{}return '';}
function openRecipe(id:number){const r=state.recipes.find(r=>r.id===id);if(!r)return;
  $('#dialog-caption').textContent='AUS EUREM KOCHBUCH';
  $('#dialog-content').innerHTML=`<h2>${esc(r.title)}</h2><p class="detail-meta">${r.servings===null?'Portionen unbekannt':fmt(r.servings)+' Portionen'}${r.prep_minutes!==null?' · Vorbereitung '+fmt(r.prep_minutes)+' Min.':' · Vorbereitung unbekannt'}${r.cook_minutes!==null?' · Kochen '+fmt(r.cook_minutes)+' Min.':' · Kochzeit unbekannt'}</p><p>${esc(r.description)}</p>${r.warnings.length?`<div class="hint"><ul class="warning-list">${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}${sourceLink(r.source_url)}<h3>Zutaten</h3><ul class="ingredient-view">${r.ingredients.map(i=>`<li><strong>${esc(quantity(i))}</strong> ${esc(i.name)} ${esc(i.note)}</li>`).join('')}</ul><h3>Zubereitung</h3><ol>${r.steps.map(s=>`<li>${esc(s.text)}${s.ingredient_indices.length?`<span class="recipe-step-ingredients">Zutatenbezug: ${s.ingredient_indices.map(i=>r.steps.filter(step=>step.ingredient_indices.includes(i)).length>1?`${esc(r.ingredients[i].name)} (Rezeptgesamtmenge ${esc(quantity(r.ingredients[i]))||'unbekannt'}; Teilmenge siehe Schritttext)`:`${esc(quantity(r.ingredients[i]))} ${esc(r.ingredients[i].name)}`).join(', ')}</span>`:''}</li>`).join('')}</ol><div class="detail-actions"><button class="primary compact" data-add="${r.id}" ${r.servings===null||state.read_only?'disabled':''}>+ Zur Kochliste</button>${r.can_edit?`<button class="secondary" data-edit="${r.id}">Bearbeiten</button>`:''}${r.can_delete?`<button class="text-button danger" data-delete="${r.id}">Löschen</button>`:''}</div>`;
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
    if(b.id==='copy-list'){await navigator.clipboard.writeText(state.shopping.filter(i=>!state.checked.includes(i.key)).map(i=>`☐ ${quantity(i)} ${i.name} ${i.note}`).join('\n'));notify('Offene Zutaten kopiert.');}
    if(b.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,recipes:state.recipes},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rezeptwerk.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){notify(e instanceof Error?e.message:'Anfrage fehlgeschlagen.',true);}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();const b=form.querySelector<HTMLButtonElement>('[type="submit"]');if(b)b.disabled=true;
  try{
    if(form.id==='import-form'){
      if(b)b.textContent='Rezept wird aufbereitet …';const video=!$('#transcript-panel').hidden;
      const result=await api<{id:number;existing:boolean}>('/api/import',{value:input('#source').value,...(video?{transcript:$<HTMLTextAreaElement>('#transcript').value,authorized:input('#transcript-authorized').checked,duration_seconds:Number(input('#video-duration').value)*60}:{})});
      await refresh();showView('collection');notify(result.existing?'Das Rezept ist bereits gespeichert.':'Das Rezept wurde automatisch gespeichert.');
    }else if(form.id==='editor-form')await saveEditor();
    else if(form.id==='member-form'){await api('/api/members',{email:input('#member-email').value,role:$<HTMLSelectElement>('#member-role').value});await refresh();input('#member-email').value='';notify('Kochbuch-Zugriff erlaubt. Auch die Access-Richtlinie muss die Person zulassen.');}
  }catch(e){const message=e instanceof Error?e.message:'Anfrage fehlgeschlagen.';if(form.id==='editor-form'){$('#editor-error').textContent=message;$('#editor-error').hidden=false;}else notify(message,true);}
  finally{if(b){b.disabled=state.read_only;if(form.id==='import-form')b.textContent='Rezept importieren ↗';}}
});
document.addEventListener('change',async event=>{const e=event.target;if(!(e instanceof HTMLInputElement))return;
  try{if(e.dataset.portions){if(!e.reportValidity())return;await api('/api/plan',{recipe_id:Number(e.dataset.portions),servings:Number(e.value)});await refresh();}if(e.dataset.check!==undefined){await api('/api/shopping/check',{key:e.dataset.check,checked:e.checked});await refresh();}}
  catch(error){notify(error instanceof Error?error.message:'Anfrage fehlgeschlagen.',true);await refresh().catch(()=>{});}
});
input('#search').addEventListener('input',renderRecipes);
input('#source').addEventListener('input',()=>{try{$('#transcript-panel').hidden=!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(new URL(input('#source').value).hostname);}catch{$('#transcript-panel').hidden=true;}});
showView(location.hash.slice(1));
if(preview){render();notify('Statische Vorschau ohne private Datenbank oder KI.');clearTimeout(timer);}
else refresh().catch(e=>notify(e instanceof Error?e.message:'Die App ist nicht erreichbar.',true));
