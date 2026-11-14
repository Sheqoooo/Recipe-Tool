import type {RecipeData} from './types.js';
import {AppError} from './errors.js';
export function bringItem(ingredient:RecipeData['ingredients'][number]):{name:string;quantity:string}{
 const name=ingredient.name.normalize('NFKC').replace(/\s+/g,' ').trim();
 const quantity=ingredient.amount===null?'Menge offen':[ingredient.amount.toLocaleString('de-DE',{maximumFractionDigits:6}),ingredient.unit].filter(Boolean).join(' ');
 if(!name||name.length>100||quantity.length>60||/[\u0000-\u001f\u007f]/.test(name+quantity))throw new AppError('BRING_INGREDIENT','Diese Zutat lässt sich nicht sicher an Bring! übertragen. Bitte Namen oder Menge im Rezept prüfen.',422);
 return {name,quantity};
}
