import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, shoppingList, number } from '../app/recipes.js';

import { recipe } from './fixtures.js';

test('kg und Liter werden normalisiert; unbekannte Mengen bleiben erhalten', () => {
  const document = recipe({ ingredients: [
    { name: 'Tomaten', amount: 0.3, unit: 'kg' }, { name: 'Milch', amount: 1.5, unit: 'l' },
    { name: 'Salz', amount: null, unit: '', note: 'nach Geschmack' },
  ] });
  assert.deepEqual(document.ingredients.map(i => i.amount), [300, 1500, null]);
  assert.deepEqual(document.ingredients.map(i => i.unit), ['g', 'ml', '']);
});

test('ungültige Mengen, Portionen und unvollständige Rezepte werden abgewiesen', () => {
  for (const value of [NaN, Infinity, -1, true, null, '', {}, []]) assert.throws(() => number(value));
  for (const overrides of [{ title: '' }, { servings: 0 }, { servings: 1001 }, { ingredients: [] },
    { steps: [] }, { ingredients: 'keine Liste' }, { steps: [null] }, { warnings: 'keine Liste' }]) {
    assert.throws(() => recipe(overrides));
  }
});

test('Einkaufsliste skaliert Portionen und addiert kompatible Zutaten', () => {
  const items = shoppingList([{ recipe: recipe(), servings: 4 }, { recipe: recipe({ title: 'Salat',
    ingredients: [{ name: 'tomaten', amount: 0.3, unit: 'kg' }] }), servings: 2 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 700);
  assert.deepEqual(items[0].recipes, ['Tomatenpasta', 'Salat']);
});

test('Produktvarianten, Hinweise, Einheiten und unbekannte Mengen bleiben getrennt', () => {
  const items = [
    { name: 'Tomaten', amount: 100, unit: 'g' }, { name: 'Dosentomaten', amount: 100, unit: 'g' },
    { name: 'Tomaten', amount: null, unit: 'g' }, { name: 'Tomaten', amount: 2, unit: 'Stück' },
    { name: 'Tomaten', amount: 100, unit: 'g', note: 'optional' },
  ];
  assert.equal(shoppingList([{ recipe: recipe({ ingredients: items }), servings: 2 }]).length, 5);
});
