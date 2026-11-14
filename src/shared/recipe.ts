import { z } from 'zod';
import { AppError } from './errors.js';
import type { RecipeData } from './types.js';

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
  'fl oz': ['ml', 29.5735295625], cup: ['ml', 236.5882365], cups: ['ml', 236.5882365],
  el: ['EL', 1], tbsp: ['EL', 1], tl: ['TL', 1], tsp: ['TL', 1], stück: ['Stück', 1], stk: ['Stück', 1],
};
export function validateRecipe(input: unknown): RecipeData {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_RECIPE', 'Kein vollständiges gültiges Rezept erkannt. Es wurde nichts gespeichert.', 422);
  const recipe = parsed.data;
  recipe.title=recipe.title.trim();
  if(!recipe.title||recipe.ingredients.some(i=>!i.name.trim())||recipe.steps.some(s=>!s.text.trim()))throw new AppError('INVALID_RECIPE','Leere Rezeptangaben sind nicht erlaubt.',422);
  for (const item of recipe.ingredients) {
    item.name=item.name.trim();
    if(item.amount===null&&!item.note.trim())item.note='Menge unbekannt; bitte Quelle prüfen.';
    const conversion = units[item.unit.trim().toLowerCase()];
    if(['cup','cups'].includes(item.unit.trim().toLowerCase()))item.note=(item.note+' US-Volumenmaß in ml; keine Gewichtsumrechnung ohne zutatenabhängige Dichte.').trim().slice(0,300);
    if (conversion && item.amount !== null) { item.unit = conversion[0]; item.amount = Math.round(item.amount * conversion[1] * 1e6) / 1e6; }
    if (item.amount !== null && item.amount > 1e6) throw new AppError('INVALID_RECIPE', 'Eine Zutatenmenge ist zu groß.', 422);
  }
  for (const step of recipe.steps) if (step.ingredient_indices.some(i => i >= recipe.ingredients.length)) {
    throw new AppError('INVALID_RECIPE', 'Ein Arbeitsschritt verweist auf eine unbekannte Zutat.', 422);
  }
  if (recipe.servings === null && recipe.warnings.length<20 && !recipe.warnings.some(w => /portion/i.test(w))) recipe.warnings.push('Portionenzahl fehlt; bitte Quelle prüfen.');
  for (const [index, item] of recipe.ingredients.entries()) {
    if (item.amount !== null && !recipe.steps.some(s => s.ingredient_indices.includes(index))) {
      if (recipe.warnings.length < 20) recipe.warnings.push(`Zutat ${item.name}: Zuordnung zu einem Arbeitsschritt bitte prüfen.`);
    }
  }
  return recipeSchema.parse(recipe);
}

