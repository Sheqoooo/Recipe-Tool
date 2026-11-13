import {AppError} from './errors.js';
import type {RecipeData} from './types.js';

export const MAX_ADAPTATION_LENGTH=400;
export const ADAPTATION_PREFIX='Nach Nutzerwunsch angepasst: ';
export function normalizeAdaptation(value:unknown):string{
 if(value===undefined)return '';
 if(typeof value!=='string'||value.length>MAX_ADAPTATION_LENGTH||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new AppError('INVALID_ADAPTATION','Bitte einen Rezeptwunsch mit höchstens 400 Zeichen eingeben.');
 const result=value.normalize('NFC').trim().replace(/\s+/g,' ');
 if(result.length>MAX_ADAPTATION_LENGTH)throw new AppError('INVALID_ADAPTATION','Bitte einen Rezeptwunsch mit höchstens 400 Zeichen eingeben.');
 return result;
}
export function adaptationNote(value:string):string{return ADAPTATION_PREFIX+normalizeAdaptation(value);}
export function markAdaptation(recipe:RecipeData,value:string):RecipeData{
 const normalized=normalizeAdaptation(value),other=recipe.warnings.filter(note=>!note.startsWith(ADAPTATION_PREFIX));
 const imageNote='Ein vorhandenes Quellenbild kann die ursprüngliche Rezeptversion zeigen.';
 return {...recipe,warnings:(normalized?[adaptationNote(normalized),imageNote,...other.filter(note=>note!==imageNote)]:other).slice(0,20)};
}
