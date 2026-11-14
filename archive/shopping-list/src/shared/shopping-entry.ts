import {z} from 'zod';
import {AppError} from './errors.js';
export function productKey(value:string):string{return value.normalize('NFKC').toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
const field=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u001f\u007f]/.test(v),'Steuerzeichen sind nicht erlaubt.');
const entry=z.object({id:z.uuid().optional(),name:field(100),quantity:z.string().trim().max(60).refine(v=>!/[\u0000-\u001f\u007f]/.test(v)).default('')}).strict();
export function validateShoppingEntry(input:unknown){const result=entry.safeParse(input);if(!result.success)throw new AppError('INVALID_SHOPPING_ITEM','Bitte Artikelname (max. 100 Zeichen) und Menge (max. 60 Zeichen) prüfen.');const name=result.data.name.normalize('NFKC').replace(/\s+/g,' ');if(name.length>100||!productKey(name))throw new AppError('INVALID_SHOPPING_ITEM','Bitte einen Artikelnamen eingeben.');return {...result.data,name};}
export function shoppingItemId(input:unknown):string{const result=z.uuid().safeParse(input);if(!result.success)throw new AppError('INVALID_SHOPPING_ITEM','Ungültiger Einkaufsartikel.');return result.data;}
export function shoppingEntriesFromIngredients(ingredients:{name:string;amount:number|null;unit:string}[]){
 const grouped=new Map<string,{name:string;quantities:string[]}>();
 for(const row of ingredients){const key=productKey(row.name),item=grouped.get(key)||{name:row.name,quantities:[]};item.quantities.push(row.amount===null?'Menge offen':[row.amount.toLocaleString('de-DE',{maximumFractionDigits:6}),row.unit].filter(Boolean).join(' '));grouped.set(key,item);}
 return [...grouped.values()].map(i=>validateShoppingEntry({name:i.name,quantity:i.quantities.join(' + ')}));
}
