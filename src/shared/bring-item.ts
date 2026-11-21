import type {RecipeData} from './types.js';
import {AppError} from './errors.js';
export function normalizeIngredientName(name:string):string {
 return name.normalize('NFKC').replace(/\s+/g,' ').trim();
}

// Keep distinctions such as smoked, dried, gluten-free and canned intact.
export function bringIngredientName(name:string,unit=''):string {
 const original=normalizeIngredientName(name);
 const key=original.toLowerCase();
 if(/^(?:(?:\d+|ein(?:e)?)\s+)?dosen?\s+tomaten$/.test(key)||
    /^(?:(?:stückige|gehackte|geschälte|ganze) )?tomaten aus (?:der |einer )?dose$/.test(key))return 'Dosentomaten';
 if(/^(?:(?:stückige|gehackte|geschälte|ganze) )?tomaten$/.test(key)&&/^dosen?$/i.test(unit.trim()))return 'Dosentomaten';
 const simplified=original.replace(/^(?:(?:frisch(?:e|er|es|en|em)?|fein gehackt(?:e|er|es|en|em)?|gehackt(?:e|er|es|en|em)?|gewürfelt(?:e|er|es|en|em)?|geschnitten(?:e|er|es|en|em)?) )+/iu,'')
   .replace(/,\s*(?:frisch|(?:fein )?gehackt|gewürfelt|geschnitten)$/iu,'').trim();
 return simplified?simplified[0].toLocaleUpperCase('de-DE')+simplified.slice(1):original;
}

export function bringItem(ingredient:RecipeData['ingredients'][number],storedName?:string|null):{name:string;quantity:string}{
 const name=storedName??bringIngredientName(ingredient.name,ingredient.unit);
 const quantity=ingredient.amount===null?'Menge offen':[ingredient.amount.toLocaleString('de-DE',{maximumFractionDigits:6}),ingredient.unit].filter(Boolean).join(' ');
 if(!name||name.length>100||quantity.length>60||/[\u0000-\u001f\u007f]/.test(name+quantity))throw new AppError('BRING_INGREDIENT','Diese Zutat lässt sich nicht sicher an Bring! übertragen. Bitte Namen oder Menge im Rezept prüfen.',422);
 return {name,quantity};
}
