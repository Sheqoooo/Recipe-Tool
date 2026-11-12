import importedRows from '../../data/catalog/search.json';
import type {DepartmentId} from './shopping-order.js';
import {z} from 'zod';
import {AppError} from './errors.js';
export type ProductTone='mint'|'lemon'|'peach'|'lilac'|'blue'|'rose';
export interface Product {name:string;emoji:string;tone:ProductTone;aliases?:string[];department?:DepartmentId}
// Maintained locally: suggestions never send shopping entries to an AI provider.
const groups:[ProductTone,string][]=[
 ['mint','🥑 Avocado|🍆 Aubergine|🥦 Brokkoli|🥬 Salat,Kopfsalat,Eisbergsalat|🥬 Spinat|🥬 Rosenkohl|🥬 Grünkohl|🥬 Artischocken|🥒 Gurke|🥒 Zucchini|🫑 Paprika|🫛 Erbsen|🫛 Bohnen|🌿 Basilikum|🌿 Petersilie|🌿 Koriander|🌿 Schnittlauch|🌿 Minze|🫒 Oliven'],
 ['peach','🥕 Karotten,Möhren,Karotte,Möhre|🥔 Kartoffeln,Kartoffel|🍠 Süßkartoffeln|🧅 Zwiebeln,Zwiebel|🧄 Knoblauch|🍄 Pilze,Champignons|🫚 Ingwer|🎃 Kürbis|🌽 Mais|🥜 Kichererbsen|🥜 Linsen|🥜 Nüsse|🥜 Mandeln|🥜 Erdnüsse|🥜 Walnüsse|🧈 Tofu|🧈 Tempeh'],
 ['rose','🍎 Äpfel,Apfel|🍐 Birnen|🍓 Erdbeeren|🫐 Heidelbeeren,Blaubeeren|🍇 Trauben|🍒 Kirschen|🍉 Wassermelone|🍑 Pfirsiche|🍅 Tomaten,Tomate|🥩 Rindfleisch|🥩 Hackfleisch|🍗 Hähnchen,Hühnchen,Hähnchenbrust|🥓 Speck|🌭 Würstchen|🐟 Fisch|🐟 Lachs|🍤 Garnelen|🌶️ Chili|🌶️ Paprikapulver'],
 ['lemon','🍌 Bananen,Banane|🍋 Zitronen,Zitrone|🍋 Limetten|🍊 Orangen|🍍 Ananas|🥭 Mango|🧀 Käse|🧀 Parmesan|🧀 Feta|🧀 Mozzarella|🧈 Butter|🥚 Eier,Ei|🍯 Honig|🫙 Olivenöl|🫙 Sonnenblumenöl|🫙 Rapsöl|🫙 Essig|🧂 Salz,Meersalz,Urmeersalz|🧂 Pfeffer|🧂 Zimt|🧂 Curry|🫙 Senf|🫙 Ketchup|🫙 Mayonnaise'],
 ['lilac','🍞 Brot|🥖 Baguette|🥐 Croissants|🥯 Brötchen|🍝 Nudeln,Pasta,Spaghetti|🍚 Reis|🌾 Mehl|🌾 Haferflocken|🌾 Couscous|🌾 Bulgur|🌾 Quinoa|🍬 Zucker|🍫 Schokolade|🍪 Kekse|🧁 Backpulver|🧁 Vanillezucker|🧁 Hefe|🥜 Erdnussbutter|🫙 Marmelade|🧂 Gemüsebrühe|🫙 Sojasauce|🫙 Tomatenmark'],
 ['blue','🥛 Milch,Vollmilch|🥛 Hafermilch,Haferdrink|🥛 Sojamilch,Sojadrink|🥛 Mandelmilch|🥛 Joghurt|🥛 Sahne|🥛 Quark|🥥 Kokosmilch|💧 Wasser,Mineralwasser|🧃 Saft,Orangensaft,Apfelsaft|☕ Kaffee|🍵 Tee|🍷 Weißwein,Weisswein|🍷 Rotwein|🍺 Bier|🧊 Tiefkühlerbsen|🧊 Eis|🧼 Spülmittel,Spuelmittel|🧼 Spülmaschinentabs,Geschirrspültabs|🧽 Schwämme,Schwamm|🧴 Waschmittel|🧴 Weichspüler|🧴 Allzweckreiniger|🧴 Glasreiniger|🧻 Toilettenpapier,Klopapier|🧻 Küchenrolle,Küchenpapier|🗑️ Müllbeutel,Müllsäcke|🧴 Shampoo|🧴 Duschgel|🪥 Zahnpasta|🪥 Zahnbürste|🧼 Seife|🧻 Taschentücher|👶 Windeln|🐈 Katzenfutter|🐕 Hundefutter|💧 Luftentfeuchterbeutel'],
];
const curatedProducts:Product[]=groups.flatMap(([tone,items])=>items.split('|').map(item=>{const [emoji,...rest]=item.trim().split(' ');const [name,...aliases]=rest.join(' ').split(',');return {name,emoji,tone,aliases};}));
const departmentPresentation:Record<DepartmentId,[string,ProductTone]>={produce:['🥬','mint'],bakery:['🥖','peach'],pantry:['🫙','lemon'],drinks:['🧃','blue'],household:['🧼','lilac'],other:['🛒','mint'],chilled:['🥛','blue'],meat:['🐟','rose'],frozen:['🧊','blue']};
const curatedIndex=curatedProducts.map(p=>({p,keys:[p.name,...p.aliases||[]].map(productKey)}));
const importedProducts:Product[]=importedRows.map(row=>{
 const [name,aliases,category]=row as [string,string[],DepartmentId];
 const key=productKey(name),match=curatedIndex.find(({keys})=>keys.some(word=>word===key||word.length>=3&&(' '+key+' ').includes(' '+word+' ')));
 const emoji=match?.p.emoji||departmentPresentation[category][0],tone=departmentPresentation[category][1];
 return {name,aliases,department:category,emoji,tone};
});
export const products:Product[]=[...curatedProducts,...importedProducts];
export function productKey(value:string):string{return value.normalize('NFKC').toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
const keyCache=new WeakMap<Product,string[]>();
const names=(p:Product)=>{let cached=keyCache.get(p);if(!cached){cached=[p.name,...p.aliases||[]].map(productKey);keyCache.set(p,cached);}return cached;};
const catalogIndex=products.map(p=>({p,keys:names(p)}));
const catalogExact=new Map([...catalogIndex].reverse().flatMap(({p,keys})=>keys.map(key=>[key,p] as const)));
export function productFor(value:string):Product{
 const key=productKey(value),exact=catalogExact.get(key);if(exact)return exact;
 const words=key.split(' ');
 for(let size=Math.min(6,words.length);size>=1;size--)for(let at=0;at+size<=words.length;at++){
  const candidate=catalogExact.get(words.slice(at,at+size).join(' '));
  if(candidate)return {...candidate,name:value};
 }
 return {name:value,emoji:'🛒',tone:'mint'};
}
export function productSuggestions(value:string,personal:string[]=[]):Product[]{
 const key=productKey(value);if(!key)return [];
 const candidates=[...personal.slice(0,1000).map(name=>({...productFor(name),name})),...products];
 const seen=new Set<string>();return candidates.map((p,index)=>({p,index,score:Math.min(...names(p).map(n=>n===key?0:n.startsWith(key)?1:n.split(' ').some(w=>w.startsWith(key))?2:n.includes(key)?3:9))})).filter(c=>c.score<9).sort((a,b)=>a.score-b.score||a.index-b.index).filter(c=>{const k=productKey(c.p.name);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,6).map(c=>c.p);
}
const field=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u001f\u007f]/.test(v),'Steuerzeichen sind nicht erlaubt.');
const entry=z.object({id:z.uuid().optional(),name:field(100),quantity:z.string().trim().max(60).refine(v=>!/[\u0000-\u001f\u007f]/.test(v)).default('')}).strict();
export function validateShoppingEntry(input:unknown){const result=entry.safeParse(input);if(!result.success)throw new AppError('INVALID_SHOPPING_ITEM','Bitte Artikelname (max. 100 Zeichen) und Menge (max. 60 Zeichen) prüfen.');const name=result.data.name.normalize('NFKC').replace(/\s+/g,' ');if(name.length>100||!productKey(name))throw new AppError('INVALID_SHOPPING_ITEM','Bitte einen Artikelnamen eingeben.');return {...result.data,name};}
export function shoppingItemId(input:unknown):string{const result=z.uuid().safeParse(input);if(!result.success)throw new AppError('INVALID_SHOPPING_ITEM','Ungültiger Einkaufsartikel.');return result.data;}
export function shoppingEntriesFromIngredients(ingredients:{name:string;amount:number|null;unit:string}[]){
 const grouped=new Map<string,{name:string;quantities:string[]}>();
 for(const row of ingredients){const key=productKey(row.name),item=grouped.get(key)||{name:row.name,quantities:[]};item.quantities.push(row.amount===null?'Menge offen':[row.amount.toLocaleString('de-DE',{maximumFractionDigits:6}),row.unit].filter(Boolean).join(' '));grouped.set(key,item);}
 return [...grouped.values()].map(i=>validateShoppingEntry({name:i.name,quantity:i.quantities.join(' + ')}));
}
