import { AppError } from './errors.js';

const units = new Map([
  ['g', ['g', 1]], ['gramm', ['g', 1]], ['grams', ['g', 1]],
  ['kg', ['g', 1000]], ['kilogramm', ['g', 1000]],
  ['ml', ['ml', 1]], ['milliliter', ['ml', 1]], ['l', ['ml', 1000]], ['liter', ['ml', 1000]],
  ['oz', ['g', 28.349523125]], ['ounce', ['g', 28.349523125]], ['ounces', ['g', 28.349523125]],
  ['lb', ['g', 453.59237]], ['lbs', ['g', 453.59237]],
  ['el', ['EL', 1]], ['tbsp', ['EL', 1]], ['tl', ['TL', 1]], ['tsp', ['TL', 1]],
  ['stück', ['Stück', 1]], ['stk', ['Stück', 1]],
]);

export function number(value, max = 1_000_000) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') {
    throw new AppError('Bitte eine gültige Menge eingeben.');
  }
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > max) {
    throw new AppError(`Mengen müssen zwischen 0 und ${max.toLocaleString('de-DE')} liegen.`);
  }
  return result;
}

export function servings(value) {
  const result = number(value, 1000);
  if (result <= 0) throw new AppError('Die Portionenzahl muss größer als 0 sein.');
  return result;
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(value, max) {
  if (!Array.isArray(value) || value.length > max) throw new AppError('Ungültiges oder zu umfangreiches Rezept.');
  return value;
}

export function validateRecipe(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Ungültiges Rezept.');
  const title = text(data.title, 200);
  if (!title) throw new AppError('Das Rezept hat keinen Namen.');
  const ingredients = list(data.ingredients, 200).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError('Ungültige Zutat.');
    const name = text(item.name, 300);
    if (!name) throw new AppError('Eine Zutat hat keinen Namen.');
    let amount = item.amount === null || item.amount === '' || item.amount === undefined ? null : number(item.amount);
    let unit = text(item.unit, 30);
    if (amount !== null && units.has(unit.toLowerCase())) {
      const [canonical, factor] = units.get(unit.toLowerCase());
      unit = canonical;
      amount = number(amount * factor);
    }
    return { name, amount, unit, note: text(item.note, 300) };
  });
  const steps = list(data.steps, 100).map(step => text(step, 3000)).filter(Boolean);
  if (!ingredients.length || !steps.length) throw new AppError('Kein vollständiges Rezept erkannt. Es wurde nichts gespeichert.');
  const warnings = list(data.warnings ?? [], 20).map(w => text(w, 500)).filter(Boolean);
  return { title, servings: servings(data.servings), ingredients, steps,
    description: text(data.description, 1500), warnings,
    source_url: text(data.source_url, 2000), source_kind: text(data.source_kind, 30) || 'url',
    original_text: text(data.original_text, 40000) };
}

export function shoppingList(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const recipe = entry.recipe;
    const factor = entry.servings / recipe.servings;
    for (const ingredient of recipe.ingredients) {
      const { name, unit, amount, note = '' } = ingredient;
      const key = JSON.stringify([name.normalize('NFKC').toLocaleLowerCase('de-DE').trim(), unit.toLowerCase(), note, amount === null]);
      if (!groups.has(key)) groups.set(key, { key, name, unit, note, amount: amount === null ? null : 0, recipes: [] });
      const item = groups.get(key);
      if (amount !== null) item.amount += amount * factor;
      if (!item.recipes.includes(recipe.title)) item.recipes.push(recipe.title);
    }
  }
  return [...groups.values()].map(item => ({ ...item, amount: item.amount === null ? null : Math.round(item.amount * 1000) / 1000 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
