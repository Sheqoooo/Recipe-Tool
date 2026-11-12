import type {RecipeData} from './types.js';

const escapeRegex=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Display-only cleanup of explicit quantities. Never infer a step's share from recipe totals. */
export function stepInstruction(recipe:RecipeData,index:number):string{
  const step=recipe.steps[index];if(!step)return '';
  let text=step.text;
  const names=[...new Set(step.ingredient_indices)].map(i=>recipe.ingredients[i]?.name).filter((n):n is string=>Boolean(n)).sort((a,b)=>b.length-a.length);
  for(const name of names){
    // Only move a quantity already immediately attached to an exact ingredient name.
    // Inflections, vague shares and existing parentheses remain untouched.
    const pattern=new RegExp('(^|[^\\p{L}\\p{N}(])((?:\\d+[.,]\\d+|\\d+(?:\\s+\\d+/\\d+|/\\d+)?|[¼½¾])(?:\\s*(?:–|-|bis)\\s*\\d+(?:[.,]\\d+)?)?\\s+(?:kg|g|mg|ml|l|EL|TL|Stück|Zehen?|Zweige?|Prisen?|Dosen?))\\s+('+escapeRegex(name)+')(?=$|[^\\p{L}\\p{N}])','giu');
    text=text.replace(pattern,(_match,prefix:string,amount:string,ingredient:string)=>`${prefix}${ingredient} (${amount})`);
  }
  return text;
}
