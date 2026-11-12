import {productFor,productKey,type ProductTone} from './products.js';
export const shoppingDepartments=[
 {id:'produce',name:'Obst & Gemüse',emoji:'🥬',tone:'mint'},
 {id:'bakery',name:'Brot & Backwaren',emoji:'🥖',tone:'peach'},
 {id:'pantry',name:'Vorrat & Konserven',emoji:'🫙',tone:'lemon'},
 {id:'drinks',name:'Getränke',emoji:'🧃',tone:'blue'},
 {id:'household',name:'Haushalt & Drogerie',emoji:'🧼',tone:'lilac'},
 {id:'other',name:'Sonstiges · Zuordnung offen',emoji:'🛒',tone:'mint'},
 {id:'chilled',name:'Milch, Eier & Kühlregal',emoji:'🥛',tone:'blue'},
 {id:'meat',name:'Fleisch & Fisch',emoji:'🐟',tone:'rose'},
 {id:'frozen',name:'Tiefkühlkost',emoji:'🧊',tone:'blue'},
] as const satisfies readonly {id:string;name:string;emoji:string;tone:ProductTone}[];
export type DepartmentId=typeof shoppingDepartments[number]['id'];
const mapping:[DepartmentId,string][]=[
 ['produce','Avocado|Aubergine|Brokkoli|Salat|Spinat|Rosenkohl|Grünkohl|Artischocken|Gurke|Zucchini|Paprika|Erbsen|Bohnen|Basilikum|Petersilie|Koriander|Schnittlauch|Minze|Karotten|Kartoffeln|Süßkartoffeln|Zwiebeln|Knoblauch|Pilze|Ingwer|Kürbis|Mais|Äpfel|Birnen|Erdbeeren|Heidelbeeren|Trauben|Kirschen|Wassermelone|Pfirsiche|Tomaten|Chili|Bananen|Zitronen|Limetten|Orangen|Ananas|Mango'],
 ['bakery','Brot|Baguette|Croissants|Brötchen'],
 ['drinks','Wasser|Saft|Kaffee|Tee|Weißwein|Rotwein|Bier'],
 ['household','Spülmittel|Spülmaschinentabs|Schwämme|Waschmittel|Weichspüler|Allzweckreiniger|Glasreiniger|Toilettenpapier|Küchenrolle|Müllbeutel|Shampoo|Duschgel|Zahnpasta|Zahnbürste|Seife|Taschentücher|Windeln|Katzenfutter|Hundefutter|Luftentfeuchterbeutel'],
 ['chilled','Tofu|Tempeh|Käse|Parmesan|Feta|Mozzarella|Butter|Eier|Milch|Hafermilch|Sojamilch|Mandelmilch|Joghurt|Sahne|Quark|Hefe'],
 ['meat','Rindfleisch|Hackfleisch|Hähnchen|Speck|Würstchen|Fisch|Lachs|Garnelen'],
 ['frozen','Tiefkühlerbsen|Eis'],
 ['pantry','Oliven|Kichererbsen|Linsen|Nüsse|Mandeln|Erdnüsse|Walnüsse|Paprikapulver|Honig|Olivenöl|Sonnenblumenöl|Rapsöl|Essig|Salz|Pfeffer|Zimt|Curry|Senf|Ketchup|Mayonnaise|Nudeln|Reis|Mehl|Haferflocken|Couscous|Bulgur|Quinoa|Zucker|Schokolade|Kekse|Backpulver|Vanillezucker|Erdnussbutter|Marmelade|Gemüsebrühe|Sojasauce|Tomatenmark|Kokosmilch'],
];
const byName=new Map(mapping.flatMap(([id,names])=>names.split('|').map(name=>[productKey(name),id] as const)));
export function departmentFor(name:string):DepartmentId{
 const key=productKey(name);
 // Explicit preparation/storage markers override a fresh base ingredient.
 if(/(^| )(tk|tiefkuhl\w*|tiefgekuhl\w*|gefrore\w*|frozen)( |$)/.test(key))return 'frozen';
 if(/(^| )(dose\w*|konserv\w*|glas|getrocknet\w*|passiert\w*|pulver|uht|h milch)( |$)/.test(key))return 'pantry';
 const product=productFor(name);
 const exact=byName.get(productKey(product.name));if(exact)return exact;
 // Product matching preserves descriptive names; match known words, longest first.
 const match=[...byName].filter(([word])=>word.length>=3&&(' '+key+' ').includes(' '+word+' ')).sort((a,b)=>b[0].length-a[0].length)[0];
 return match?.[1]||'other';
}
export function groupShopping<T extends {name:string}>(items:T[]){
 const groups=new Map<DepartmentId,T[]>();
 for(const item of items){const id=departmentFor(item.name);const list=groups.get(id)||[];list.push(item);groups.set(id,list);}
 const collator=new Intl.Collator('de',{sensitivity:'base',numeric:true});
 return shoppingDepartments.flatMap(department=>{const list=groups.get(department.id);return list?.length?[{...department,items:[...list].sort((a,b)=>collator.compare(a.name,b.name))}]:[];});
}
