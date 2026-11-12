import type {RecipeData} from './types.js';
const fold=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function stepQuantityNotes(recipe:RecipeData,index:number):string[]{
  const step=recipe.steps[index];if(!step)return [];
  const text=fold(step.text);
  return [...new Set(step.ingredient_indices)].flatMap(ref=>{
    const ingredient=recipe.ingredients[ref];if(!ingredient)return [];
    const quantity=ingredient.amount===null?'Menge unbekannt':[ingredient.amount.toLocaleString('de-DE',{maximumFractionDigits:2}),ingredient.unit].filter(Boolean).join(' ');
    const uses=recipe.steps.filter(s=>s.ingredient_indices.includes(ref)).length;
    if(uses>1)return [`${ingredient.name}: Teilmenge siehe Anleitung; Rezeptgesamtmenge ${quantity}`];
    if(ingredient.amount!==null&&text.includes(fold(ingredient.name))&&text.includes(fold(quantity)))return [];
    return [`${ingredient.name}: ${quantity}`];
  });
}
