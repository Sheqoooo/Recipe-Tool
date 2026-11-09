'use strict';
let state = {recipes: [], plan: [], shopping: [], checked: []};
let draft = null;
let currentView = 'import';
const $ = selector => document.querySelector(selector);
const filePreview = location.protocol === 'file:';
const previewMode = filePreview || new URLSearchParams(location.search).get('preview') === '1';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = value => value == null ? '' : Number(value).toLocaleString('de-DE', {maximumFractionDigits: 2});
const quantity = item => [fmt(item.amount), item.unit].filter(Boolean).join(' ');
let noticeTimer;
function notify(message, error = false) {
  const node = $('#notice');
  node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { node.hidden = true; }, error ? 12000 : 5000);
}
async function api(path, data) {
  if (previewMode) throw new Error('Diese Vorschau hat keine Serververbindung. Import und Datenbank funktionieren in der gestarteten bzw. gehosteten App.');
  const options = data === undefined ? {} : {method: 'POST', headers: {'Content-Type':'application/json', 'X-Rezeptwerk-Token':state.token}, body:JSON.stringify(data)};
  const response = await fetch(path, options);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Die Serververbindung fehlt. Rezeptwerk benötigt ein laufendes Node.js-Hosting; GitHub Pages allein reicht nicht.');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Die Anfrage konnte nicht verarbeitet werden.');
  return body;
}
async function refresh() {
  state = await api('/api/state');
  $('#recipe-count').textContent = state.recipes.length;
  $('#plan-count').textContent = state.plan.length;
  $('#key-hint').hidden = state.has_key;
  $('#key-status').textContent = state.env_key ? 'Ein API-Key ist über die Serverumgebung eingerichtet.' : state.has_key ? 'Dein API-Key ist auf dem Server hinterlegt. Bereit für den ersten Import.' : 'Noch kein API-Key hinterlegt. Bitte einmal einrichten, um Rezepte automatisch zu importieren.';
  $('#api-key').disabled = state.env_key;
  $('#remove-key').disabled = state.env_key || !state.has_key;
  $('#settings-form button[type="submit"]').disabled = state.env_key;
  renderRecipes(); renderShopping();
}
function showView(view) {
  if (!['import', 'collection', 'shopping', 'settings'].includes(view)) view = 'import';
  currentView = view;
  document.querySelectorAll('.view').forEach(el => {el.hidden = el.id !== 'view-' + view;});
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  history.replaceState(null, '', '#' + view);
}
function empty(title, text) { return `<div class="empty"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(text)}</p></div>`; }
function renderRecipes() {
  const search = $('#search').value.toLocaleLowerCase('de');
  const recipes = state.recipes.filter(recipe => (recipe.title + ' ' + recipe.ingredients.map(i => i.name).join(' ')).toLocaleLowerCase('de').includes(search));
  $('#recipe-grid').innerHTML = recipes.length ? recipes.map((recipe, index) => `<article class="recipe-card"><span class="recipe-number">${String(index + 1).padStart(2,'0')} /</span>${recipe.warnings.length ? '<div class="warning-label">Hinweise zur Prüfung vorhanden</div>' : ''}<h2>${escapeHTML(recipe.title)}</h2><p>${fmt(recipe.servings)} Portionen · ${recipe.ingredients.length} Zutaten</p><footer><button class="text-button" data-open="${recipe.id}">Rezept ansehen ↗</button><button class="secondary" data-add="${recipe.id}">${state.plan.some(p => p.recipe_id === recipe.id) ? '✓ Auf der Kochliste' : '+ Kochliste'}</button></footer></article>`).join('') : empty(search ? 'Kein Treffer.' : 'Hier beginnt dein Kochbuch.', search ? 'Versuche einen anderen Rezeptnamen oder eine Zutat.' : 'Füge einen Rezeptlink ein. Dein Rezept wird automatisch gespeichert.');
}
function renderShopping() {
  $('#plan-list').innerHTML = state.plan.length ? state.plan.map(entry => `<article class="plan-card"><h3>${escapeHTML(entry.recipe.title)}</h3><div class="portion-control"><label class="sr-only" for="portion-${entry.recipe_id}">Portionen für ${escapeHTML(entry.recipe.title)}</label><input id="portion-${entry.recipe_id}" type="number" min="0.01" max="1000" step="any" value="${entry.servings}" data-portions="${entry.recipe_id}"><span>Portionen</span><button class="text-button danger" data-remove="${entry.recipe_id}">Entfernen</button></div></article>`).join('') : empty('Was möchtest du kochen?', 'Füge in deiner Rezeptsammlung ein Gericht zur Kochliste hinzu.');
  $('#shopping-list').innerHTML = state.shopping.length ? state.shopping.map(item => `<label class="shopping-row ${state.checked.includes(item.key) ? 'checked' : ''}"><input type="checkbox" data-check="${escapeHTML(item.key)}" ${state.checked.includes(item.key) ? 'checked' : ''}><span><strong>${escapeHTML(quantity(item))} ${escapeHTML(item.name)}</strong>${item.note ? `<small>${escapeHTML(item.note)}</small>` : ''}<small>${escapeHTML(item.recipes.join(' · '))}${item.amount === null ? ' · Menge nach Bedarf / bitte prüfen' : ''}</small></span></label>`).join('') : '<p class="field-help">Hier erscheinen die Zutaten deiner ausgewählten Gerichte.</p>';
  $('#copy-list').disabled = !state.shopping.length;
}
async function addToPlan(id) {
  if (state.plan.some(p => p.recipe_id === id)) {showView('shopping'); return;}
  const recipe = state.recipes.find(r => r.id === id);
  await api('/api/plan', {recipe_id:id, servings:recipe.servings}); await refresh();
  notify('Zur Kochliste hinzugefügt. Die Einkaufsliste ist aktualisiert.');
}
function openDialog() { if (!$('#recipe-dialog').open) $('#recipe-dialog').showModal(); }
function sourceLink(url) {
  try { const parsed = new URL(url); if (['https:', 'http:'].includes(parsed.protocol)) return `<a class="source-link" href="${escapeHTML(parsed.href)}" target="_blank" rel="noopener noreferrer">Originalrezept öffnen ↗</a>`; } catch (_) {}
  return '';
}
function openRecipe(id) {
  const recipe = state.recipes.find(r => r.id === id);
  $('#dialog-caption').textContent = 'AUS DEINER SAMMLUNG';
  $('#dialog-content').innerHTML = `<h2>${escapeHTML(recipe.title)}</h2><p class="detail-meta">${fmt(recipe.servings)} Portionen · ${recipe.ingredients.length} Zutaten</p><p>${escapeHTML(recipe.description)}</p>${recipe.warnings.length ? `<div class="hint"><strong>Bitte beachten</strong><ul class="warning-list">${recipe.warnings.map(w => `<li>${escapeHTML(w)}</li>`).join('')}</ul></div>` : ''}${sourceLink(recipe.source_url)}<h3>Zutaten</h3><ul class="ingredient-view">${recipe.ingredients.map(i => `<li><strong>${escapeHTML(quantity(i))}</strong> ${escapeHTML(i.name)}${i.note ? ` <small>(${escapeHTML(i.note)})</small>` : ''}</li>`).join('')}</ul><h3>Zubereitung</h3><ol>${recipe.steps.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ol><div class="detail-actions"><button class="primary compact" data-add="${id}">${state.plan.some(p => p.recipe_id === id) ? 'Zur Einkaufsliste' : '+ Zur Kochliste'}</button><button class="secondary" data-edit="${id}">Bearbeiten</button><button class="text-button danger" data-delete="${id}">Löschen</button></div>`;
  openDialog();
}
function ingredientRow(item = {}) {
  return `<div class="ingredient-edit"><input type="number" aria-label="Menge" min="0" max="1000000" step="any" placeholder="Menge" value="${item.amount ?? ''}"><input aria-label="Einheit" placeholder="g / ml …" maxlength="30" value="${escapeHTML(item.unit || '')}"><input aria-label="Zutat" placeholder="Zutat" maxlength="300" required value="${escapeHTML(item.name || '')}"><button type="button" class="icon-button danger" data-delete-row aria-label="Zutat entfernen">×</button><input class="ingredient-note" aria-label="Hinweis zur Zutat" placeholder="Hinweis, z. B. nach Geschmack oder Umrechnung prüfen" maxlength="300" value="${escapeHTML(item.note || '')}"></div>`;
}
function openEditor(recipe) {
  if (!recipe?.id) return;
  draft = JSON.parse(JSON.stringify(recipe));
  $('#dialog-caption').textContent = 'GESPEICHERTES REZEPT KORRIGIEREN';
  $('#dialog-content').innerHTML = `<form id="editor-form"><div id="editor-error" class="dialog-error" role="alert" hidden></div>${recipe.warnings?.length ? `<div class="hint"><strong>Vor dem Speichern prüfen</strong><ul class="warning-list">${recipe.warnings.map(w => `<li>${escapeHTML(w)}</li>`).join('')}</ul></div>` : ''}<div class="editor-grid"><div class="editor-field"><label for="edit-title">Rezeptname</label><input id="edit-title" maxlength="200" required value="${escapeHTML(recipe.title || '')}"></div><div class="editor-field"><label for="edit-servings">Portionen</label><input id="edit-servings" type="number" min="0.01" max="1000" step="any" required value="${recipe.servings || 2}"></div></div><div class="editor-field"><label for="edit-description">Kurzbeschreibung</label><input id="edit-description" maxlength="1500" value="${escapeHTML(recipe.description || '')}"></div><div class="editor-field"><label for="edit-source">Originalquelle (optional)</label><input id="edit-source" type="url" maxlength="2000" value="${escapeHTML(recipe.source_url || '')}"></div><div class="editor-head"><h3>Zutaten</h3><button type="button" id="add-ingredient" class="text-button">+ Zutat ergänzen</button></div><p class="field-help">Menge, Einheit und Zutat getrennt eintragen. Eine unbekannte Menge kannst du leer lassen.</p><div id="ingredient-rows">${(recipe.ingredients?.length ? recipe.ingredients : [{}]).map(ingredientRow).join('')}</div><div class="editor-field"><label for="edit-steps">Zubereitung · ein Schritt pro Zeile</label><textarea id="edit-steps" rows="7" required>${escapeHTML((recipe.steps || []).join('\n'))}</textarea></div><div class="editor-field"><label for="edit-warnings">Hinweise zur Prüfung · einer pro Zeile</label><textarea id="edit-warnings" rows="2">${escapeHTML((recipe.warnings || []).join('\n'))}</textarea><p class="field-help">Erledigte Prüfhinweise kannst du hier entfernen.</p></div>${recipe.original_text ? `<details><summary>Importierten Originaltext ansehen</summary><p class="original">${escapeHTML(recipe.original_text)}</p></details>` : ''}<div class="detail-actions"><button class="primary compact" type="submit">Rezept speichern ✓</button><button type="button" id="cancel-edit" class="secondary">Abbrechen</button></div></form>`;
  openDialog();
}
async function saveEditor(event) {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]'); button.disabled = true;
  try {
    const ingredients = [...document.querySelectorAll('.ingredient-edit')].map(row => {
      const inputs = row.querySelectorAll('input');
      return {amount:inputs[0].value === '' ? null : Number(inputs[0].value), unit:inputs[1].value, name:inputs[2].value, note:inputs[3].value};
    });
    const recipeDocument = {...draft, title:$('#edit-title').value, servings:Number($('#edit-servings').value), description:$('#edit-description').value, source_url:$('#edit-source').value, ingredients, steps:$('#edit-steps').value.split('\n').filter(s => s.trim()), warnings:$('#edit-warnings').value.split('\n').filter(s => s.trim())};
    await api('/api/recipes/save', recipeDocument); await refresh(); $('#recipe-dialog').close(); showView('collection'); notify('Dein Rezept ist gespeichert.');
  } catch (error) {$('#editor-error').textContent = error.message; $('#editor-error').hidden = false; $('#recipe-dialog').scrollTop = 0;}
  finally {button.disabled = false;}
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button, a.brand');
  if (!button || button.disabled) return;
  try {
    if (button.matches('a.brand')) {event.preventDefault(); showView('import');}
    if (button.dataset.view) showView(button.dataset.view);
    if (button.dataset.open) openRecipe(Number(button.dataset.open));
    if (button.dataset.edit) openEditor(state.recipes.find(r => r.id === Number(button.dataset.edit)));
    if (button.dataset.add) {button.disabled = true; await addToPlan(Number(button.dataset.add)); if ($('#recipe-dialog').open) $('#recipe-dialog').close();}
    if (button.dataset.remove) {await api('/api/plan', {recipe_id:Number(button.dataset.remove), remove:true}); await refresh();}
    if (button.dataset.delete) {
      if (confirm('Dieses Rezept aus deiner Sammlung löschen?')) {await api('/api/recipes/delete', {id:Number(button.dataset.delete)}); await refresh(); $('#recipe-dialog').close(); notify('Rezept gelöscht.');}
    }
    if (button.hasAttribute('data-delete-row')) button.closest('.ingredient-edit').remove();
    if (button.id === 'add-ingredient') $('#ingredient-rows').insertAdjacentHTML('beforeend', ingredientRow());
    if (['close-dialog','cancel-edit'].includes(button.id)) $('#recipe-dialog').close();
    if (button.id === 'remove-key') {await api('/api/settings', {api_key:''}); await refresh(); notify('Der auf dem Server gespeicherte Schlüssel wurde entfernt.');}
    if (button.id === 'copy-list') {
      const text = state.shopping.filter(i => !state.checked.includes(i.key)).map(i => `☐ ${quantity(i)} ${i.name}${i.note ? ' (' + i.note + ')' : ''}`.trim()).join('\n');
      await navigator.clipboard.writeText(text); notify('Die offenen Zutaten wurden kopiert.');
    }
    if (button.id === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify({version:1, recipes:state.recipes}, null, 2)], {type:'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'rezeptwerk-rezepte.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (error) {notify(error.message, true);}
  finally {button.disabled = false;}
});
document.addEventListener('submit', async event => {
  if (event.target.id === 'editor-form') {await saveEditor(event); return;}
  if (!['import-form', 'settings-form'].includes(event.target.id)) return;
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]'); button.disabled = true;
  try {
    if (event.target.id === 'import-form') {
      button.textContent = 'Rezept wird aufbereitet …';
      if (!state.has_key) { showView('settings'); throw new Error('Bitte zuerst deinen API-Key hinterlegen. Dein Rezeptlink bleibt im Importfeld erhalten.'); }
      const result = await api('/api/import', {value:$('#source').value});
      await refresh();
      $('#source').value = '';
      showView('collection');
      notify(result.existing ? 'Dieses Rezept ist bereits in deiner Sammlung.' : 'Dein Rezept wurde automatisch auf Deutsch aufbereitet und gespeichert.');
    } else {
      await api('/api/settings', {api_key:$('#api-key').value}); $('#api-key').value = ''; await refresh(); notify('API-Key auf dem Server gespeichert. Er wird beim nächsten KI-Import verwendet.');
    }
  } catch (error) {notify(error.message, true);}
  finally {button.disabled = false; if (event.target.id === 'import-form') button.innerHTML = 'Rezept importieren <span>↗</span>';}
});
document.addEventListener('change', async event => {
  const input = event.target;
  try {
    if (input.dataset.portions) {
      if (!input.reportValidity()) return;
      await api('/api/plan', {recipe_id:Number(input.dataset.portions), servings:Number(input.value)}); await refresh();
    }
    if (input.dataset.check !== undefined) {
      input.disabled = true;
      await api('/api/shopping/check', {key:input.dataset.check, checked:input.checked}); await refresh();
    }
  } catch (error) {notify(error.message, true); await refresh();}
});
$('#search').addEventListener('input', renderRecipes);
showView(location.hash.slice(1));
if (previewMode) {
  renderRecipes();
  renderShopping();
  $('#import-submit').disabled = true;
  $('#api-key').disabled = true;
  $('#settings-form button[type="submit"]').disabled = true;
  $('#remove-key').disabled = true;
  $('#key-status').textContent = 'Die Vorschau ist nicht mit der Datenbank verbunden. Bitte den API-Key erst in der vollständigen App hinterlegen.';
  notify(filePreview
    ? 'Dateivorschau: Für Import und Datenbank im Projektordner npm ci (einmalig) und npm start ausführen. Danach http://127.0.0.1:8765 öffnen.'
    : 'GitHub-Pages-Vorschau: Hier kannst du die Oberfläche ansehen. Rezeptimport und Datenbank werden auf deinem Node.js-Hosting verfügbar.');
  clearTimeout(noticeTimer);
} else {
  refresh().catch(error => notify('Die Anwendung ist nicht erreichbar. ' + error.message, true));
}
