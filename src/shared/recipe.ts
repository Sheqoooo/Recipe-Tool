import { z } from 'zod';
import { AppError } from './errors.js';
import type { PlanEntry, RecipeData, ShoppingItem } from './types.js';

const short = z.string().max(300);
export const recipeSchema = z.object({
  title: z.string().min(1).max(200), description: z.string().max(1500),
  servings: z.number().positive().max(1000).nullable(),
  prep_minutes: z.number().nonnegative().max(10080).nullable(),
  cook_minutes: z.number().nonnegative().max(10080).nullable(),
  ingredients: z.array(z.object({ name: short.min(1), amount: z.number().nonnegative().max(1e6).nullable(),
    unit: z.string().max(30), note: short }).strict()).min(1).max(200),
  steps: z.array(z.object({ text: z.string().min(1).max(3000),
    ingredient_indices: z.array(z.number().int().nonnegative().max(199)).max(200) }).strict()).min(1).max(100),
  warnings: z.array(z.string().max(500)).max(20),
}).strict();

const units: Record<string, [string, number]> = {
  g: ['g', 1], gramm: ['g', 1], kg: ['g', 1000], kilogramm: ['g', 1000],
  ml: ['ml', 1], milliliter: ['ml', 1], l: ['ml', 1000], liter: ['ml', 1000],
  oz: ['g', 28.349523125], lb: ['g', 453.59237], lbs: ['g', 453.59237],
  el: ['EL', 1], tbsp: ['EL', 1], tl: ['TL', 1], tsp: ['TL', 1], stück: ['Stück', 1], stk: ['Stück', 1],
};
export function validateRecipe(input: unknown): RecipeData {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_RECIPE', 'Kein vollständiges gültiges Rezept erkannt. Es wurde nichts gespeichert.', 422);
  const recipe = parsed.data;
  for (const item of recipe.ingredients) {
    const conversion = units[item.unit.trim().toLowerCase()];
    if (conversion && item.amount !== null) { item.unit = conversion[0]; item.amount = Math.round(item.amount * conversion[1] * 1e6) / 1e6; }
    if (item.amount !== null && item.amount > 1e6) throw new AppError('INVALID_RECIPE', 'Eine Zutatenmenge ist zu groß.', 422);
  }
  for (const step of recipe.steps) if (step.ingredient_indices.some(i => i >= recipe.ingredients.length)) {
    throw new AppError('INVALID_RECIPE', 'Ein Arbeitsschritt verweist auf eine unbekannte Zutat.', 422);
  }
  if (recipe.servings === null && !recipe.warnings.some(w => /portion/i.test(w))) recipe.warnings.push('Portionenzahl fehlt; Skalieren erst nach Korrektur möglich.');
  for (const [index, item] of recipe.ingredients.entries()) {
    if (item.amount !== null && !recipe.steps.some(s => s.ingredient_indices.includes(index))) {
      if (recipe.warnings.length < 20) recipe.warnings.push(`Zutat ${item.name}: Zuordnung zu einem Arbeitsschritt bitte prüfen.`);
    }
  }
  return recipeSchema.parse(recipe);
}

export function positiveServings(input: unknown): number {
  const parsed = z.number().positive().max(1000).safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_SERVINGS', 'Bitte eine gültige positive Portionenzahl angeben.');
  return parsed.data;
}

export function shoppingList(entries: PlanEntry[]): ShoppingItem[] {
  const groups = new Map<string, ShoppingItem>();
  for (const entry of entries) {
    if (entry.recipe.servings === null) continue;
    const factor = entry.servings / entry.recipe.servings;
    for (const ingredient of entry.recipe.ingredients) {
      const { name, amount, unit, note } = ingredient;
      const key = JSON.stringify([name.normalize('NFKC').toLowerCase().trim(), unit.toLowerCase(), note, amount === null]);
      if (!groups.has(key)) groups.set(key, { key, name, unit, note, amount: amount === null ? null : 0, recipes: [] });
      const item = groups.get(key)!;
      if (amount !== null && item.amount !== null) item.amount += amount * factor;
      if (!item.recipes.includes(entry.recipe.title)) item.recipes.push(entry.recipe.title);
    }
  }
  return [...groups.values()].map(item => ({ ...item, amount: item.amount === null ? null : Math.round(item.amount * 1000) / 1000 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
