import { validateRecipe } from '../app/recipes.js';
export function recipe(overrides = {}) {
  return validateRecipe({ title: 'Tomatenpasta', description: '', servings: 2,
    ingredients: [{ name: 'Tomaten', amount: 200, unit: 'g', note: '' }],
    steps: ['Tomaten kochen.'], warnings: [], ...overrides });
}
