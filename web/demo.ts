// Included only by the separate --demo build. No fetch, database, keys or remote persistence.
import type { AppState,Recipe,RecipeData } from '../src/shared/types.js';
import { shoppingList,validateRecipe } from '../src/shared/recipe.js';
import {validateShoppingEntry,shoppingItemId,productKey,shoppingEntriesFromIngredients} from '../src/shared/products.js';
import { normalizeSourceUrl } from '../src/shared/source-url.js';
import {normalizeAdaptation,markAdaptation,adaptationNote,ADAPTATION_PREFIX} from '../src/shared/adaptation.js';
const owner='demo-member';
const make=(id:number,title:string,description:string,cook:number,items:[string,number,string][],texts:string[]):Recipe=>({
  id,owner_id:owner,title,description,servings:2,prep_minutes:10,cook_minutes:cook,
  ingredients:items.map(([name,amount,unit])=>({name,amount,unit,note:''})),
  steps:texts.map((text,i)=>({text,ingredient_indices:i===0?items.map((_,n)=>n):[]})),warnings:[],
  source_url:'https://recipes.example/demo/'+id,source_kind:'web',revision:1,
  created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-01T12:00:00Z',can_edit:true,can_delete:true,
});
const recipes:Recipe[]=[
  make(1,'Zitronenpasta mit Parmesan','Frisch, cremig und mit wenigen Zutaten auf dem Tisch.',15,[['Spaghetti',200,'g'],['Zitrone',1,'Stück'],['Parmesan',60,'g']],['Spaghetti kochen (200 g). Zitrone auspressen (1 Stück) und Parmesan reiben (60 g).','Die Nudeln mit Zitronensaft und Parmesan vermengen.']),
  make(2,'Knackiger Kichererbsensalat','Ein frischer Salat für die Mittagspause.',0,[['Kichererbsen',250,'g'],['Gurke',1,'Stück'],['Tomaten',200,'g']],['Kichererbsen abspülen (250 g). Gurke würfeln (1 Stück) und Tomaten schneiden (200 g).','Alle vorbereiteten Zutaten in einer Schüssel vermengen.']),
  make(3,'Cremiges Gemüse-Curry','Wärmend, unkompliziert und gut vorzubereiten.',20,[['Kokosmilch',400,'ml'],['Paprika',2,'Stück'],['Paprikapulver',1,'TL']],['Paprika schneiden (2 Stück), Kokosmilch zugießen (400 ml) und Paprikapulver hinzufügen (1 TL).','Das Gemüse 20 Minuten sanft köcheln lassen.']),
  make(4,'Fluffige Pfannkuchen','Ein gemütlicher Start in den Tag.',15,[['Mehl',150,'g'],['Milch',250,'ml'],['Eier',2,'Stück']],['Mehl mit Milch und Eiern verrühren (150 g Mehl, 250 ml Milch, 2 Eier).','Den Teig portionsweise in einer beschichteten Pfanne ausbacken.']),
  make(5,'Karotten-Ingwer-Suppe','Eine einfache Suppe für kühle Tage.',25,[['Karotten',400,'g'],['Ingwer',15,'g'],['Gemüsebrühe',500,'ml']],['Karotten und Ingwer schneiden (400 g Karotten, 15 g Ingwer). Mit Gemüsebrühe aufgießen (500 ml).','25 Minuten köcheln lassen, anschließend pürieren.']),
  make(6,'Tomatenpasta mit Basilikum','Ein Klassiker, der immer geht.',15,[['Pasta',200,'g'],['Tomaten',300,'g'],['Basilikum',10,'g']],['Pasta kochen (200 g). Tomaten schneiden (300 g) und Basilikum hacken (10 g).','Alles miteinander vermengen.']),
];
recipes[0].image={url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720"><rect width="960" height="720" fill="#f5edda"/><ellipse cx="480" cy="390" rx="320" ry="230" fill="#ded3bd"/><ellipse cx="480" cy="360" rx="300" ry="225" fill="white"/><ellipse cx="480" cy="360" rx="210" ry="150" fill="#f6cf6c"/><g fill="none" stroke="#e4a944" stroke-width="13" stroke-linecap="round"><path d="M320 340 Q470 230 625 340 Q400 460 340 355 Q470 280 620 380"/><path d="M335 390 Q500 240 620 355 Q470 455 360 325"/><path d="M350 420 Q560 270 600 330 Q520 425 365 375"/></g><g fill="#5d8654"><ellipse cx="470" cy="310" rx="35" ry="13" transform="rotate(-30 470 310)"/><ellipse cx="510" cy="320" rx="28" ry="12" transform="rotate(25 510 320)"/></g><circle cx="730" cy="550" r="72" fill="#f8ce42"/><circle cx="730" cy="550" r="56" fill="#fff2a4"/><path d="M730 494 V606 M674 550 H786 M690 510 L770 590 M690 590 L770 510" stroke="#f8ce42" stroke-width="5"/></svg>'),source_url:'',credit:'Demo-Illustration · Futterluke'};
const state:AppState={manual_items:[
{id:'00000000-0000-4000-8000-000000000001',name:'Oliven',quantity:'1 Glas',checked:false,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000002',name:'Milch',quantity:'1 l',checked:false,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000003',name:'Tofu',quantity:'400 g',checked:false,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000004',name:'Spülmittel',quantity:'1 Flasche',checked:false,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000005',name:'Salz',quantity:'',checked:false,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000006',name:'Rosenkohl',quantity:'500 g',checked:true,updated_at:'2026-11-12T10:00:00Z'},
{id:'00000000-0000-4000-8000-000000000007',name:'Weißwein',quantity:'1 Flasche',checked:true,updated_at:'2026-11-12T10:00:00Z'}
],recipes,plan:[],shopping:[],checked:[],members:[],imports:[],has_key:true,read_only:false,user:{id:owner,email:'demo@example.invalid',role:'member',active:1}};
let nextId=7;
function recalculate(){state.shopping=shoppingList(state.plan);state.manual_items!.sort((a,b)=>Number(a.checked)-Number(b.checked)||b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));}
export async function demoApi<T>(path:string,data?:unknown):Promise<T>{
  const body=(data||{}) as Record<string,unknown>;
  let result:unknown={ok:true};
  if(path==='/api/state'){recalculate();result=state;}
  else if(path==='/api/shopping/from-recipe'){
    const recipe=state.recipes.find(r=>r.id===Number(body.recipe_id));if(!recipe)throw new Error('Rezept nicht gefunden.');
    const indices=body.ingredient_indices as number[]|undefined;
    const selected=recipe.ingredients.filter((_,i)=>!indices||indices.includes(i));
    const items=shoppingEntriesFromIngredients(selected);
    if(state.manual_items!.length+items.filter(item=>!state.manual_items!.some(row=>productKey(row.name)===productKey(item.name))).length>500)throw new Error('Maximal 500 Artikel. Es wurde nichts hinzugefügt.');
    for(const item of items){
      const existing=state.manual_items!.find(row=>productKey(row.name)===productKey(item.name));
      if(existing){existing.quantity=item.quantity;existing.checked=false;existing.updated_at=new Date().toISOString();}
      else state.manual_items!.unshift({id:crypto.randomUUID(),name:item.name,quantity:item.quantity,checked:false,updated_at:new Date().toISOString()});
    }
  }else if(path==='/api/shopping/items/save'){
    const item=validateShoppingEntry(body),items=state.manual_items!;
    const existing=item.id?items.find(i=>i.id===item.id):items.find(i=>productKey(i.name)===productKey(item.name));
    if(item.id&&!existing)throw new Error('Artikel nicht gefunden.');
    if(item.id&&items.some(i=>i.id!==item.id&&productKey(i.name)===productKey(item.name)))throw new Error('Artikel bereits vorhanden.');
    if(existing){existing.name=item.name;existing.quantity=item.quantity||(!item.id?existing.quantity:'');if(!item.id)existing.checked=false;existing.updated_at=new Date().toISOString();}
    else{if(items.length>=500)throw new Error('Maximal 500 Artikel.');items.unshift({id:crypto.randomUUID(),name:item.name,quantity:item.quantity,checked:false,updated_at:new Date().toISOString()});}
  }else if(path==='/api/shopping/items/check'){
    const item=state.manual_items!.find(i=>i.id===shoppingItemId(body.id));if(!item||typeof body.checked!=='boolean')throw new Error('Artikel oder Status ungültig.');item.checked=body.checked;item.updated_at=new Date().toISOString();
  }else if(path==='/api/shopping/items/delete'){
    const id=shoppingItemId(body.id);state.manual_items=state.manual_items!.filter(i=>i.id!==id);
  }else if(path==='/api/import'){
    const url=normalizeSourceUrl(body.value),adaptation=normalizeAdaptation(body.adaptation);
    if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(url.hostname)&&!body.transcript)throw Object.assign(new Error('Demo: Bitte Beschreibung oder Transkript bereitstellen. Kein echter Plattformabruf.'),{code:'VIDEO_SOURCE_REQUIRED'});
    const existing=state.recipes.find(r=>r.source_url===url.href&&(adaptation?r.warnings.includes(adaptationNote(adaptation)):!r.warnings.some(note=>note.startsWith(ADAPTATION_PREFIX))));
    if(existing)result={id:existing.id,existing:true};
    else{const recipe={...structuredClone(recipes[0]),...(['www.instagram.com','instagram.com','www.tiktok.com','tiktok.com'].includes(url.hostname)?{image:null}:{}),id:nextId++,source_url:url.href,title:'Dein importiertes Beispielrezept'};if(adaptation){Object.assign(recipe,markAdaptation(recipe,adaptation));recipe.title='Deine angepasste Rezeptvariante';if(/halloumi/i.test(adaptation)){recipe.ingredients=[{name:'Halloumi',amount:200,unit:'g',note:'Demo-Annahme zur Anpassung.'}];recipe.steps=[{text:'Halloumi (200 g) würfeln und in einer Pfanne goldbraun anbraten.',ingredient_indices:[0]}];recipe.cook_minutes=null;}}state.recipes.unshift(recipe);result={id:recipe.id,existing:false};}
  }else if(path==='/api/recipes/video-image'){
    const recipe=state.recipes.find(r=>r.id===Number(body.recipe_id));if(!recipe)throw new Error('Beispielrezept nicht gefunden.');
    if(!recipe.image)recipe.image={url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960"><rect width="640" height="960" fill="#e8eee3"/><circle cx="320" cy="480" r="240" fill="white"/><circle cx="320" cy="480" r="170" fill="#e3b55b"/><circle cx="270" cy="430" r="35" fill="#82a66b"/><circle cx="380" cy="500" r="42" fill="#b95647"/></svg>'),source_url:recipe.source_url,credit:'Standbild aus dem Originalvideo (Demo-Illustration)'};
  }else if(path==='/api/recipes/save'){
    const recipe=state.recipes.find(r=>r.id===Number(body.id));if(!recipe)throw new Error('Beispielrezept nicht gefunden.');
    const {id,revision,...data}=body;Object.assign(recipe,validateRecipe(data),{revision:recipe.revision+1});state.checked=[];
  }else if(path==='/api/recipes/delete'){
    state.recipes=state.recipes.filter(r=>r.id!==Number(body.id));state.plan=state.plan.filter(p=>p.recipe_id!==Number(body.id));state.checked=[];
  }else if(path==='/api/plan'){
    const id=Number(body.recipe_id),recipe=state.recipes.find(r=>r.id===id);
    if(!recipe)throw new Error('Beispielrezept nicht gefunden.');
    state.plan=state.plan.filter(p=>p.recipe_id!==id);
    if(body.remove!==true){const servings=Number(body.servings);if(!Number.isFinite(servings)||servings<=0||servings>1000)throw new Error('Portionen prüfen.');state.plan.push({recipe_id:id,servings,recipe});}
    state.checked=[];
  }else if(path==='/api/shopping/check'){
    const key=String(body.key);state.checked=state.checked.filter(k=>k!==key);if(body.checked===true)state.checked.push(key);
  }else throw new Error('Diese Aktion ist in der Design-Demo nicht verfügbar.');
  recalculate();return structuredClone(result) as T;
}
