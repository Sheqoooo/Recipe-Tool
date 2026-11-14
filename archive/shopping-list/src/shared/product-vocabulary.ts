import type {Product} from './products.js';

// Small, reviewable vocabulary additions. These are plain names, not a branded product feed.
// Keep distinct preparations as distinct products; never alias a generic food to a brand.
export const additionalProducts:Product[]=[
 {name:'Chiliflocken',aliases:['Chilliflocken','Chili-Flocken','Chilli-Flocken','Chili flakes'],emoji:'🌶️',tone:'rose',department:'pantry'},
 {name:'Chilipulver',aliases:['Chillipulver','Chili-Pulver','Chilli-Pulver'],emoji:'🌶️',tone:'rose',department:'pantry'},
 {name:'Chilischoten',aliases:['Chillischoten','Chilischote','Chili-Schoten','Chilli-Schoten'],emoji:'🌶️',tone:'rose',department:'produce'},
 {name:'Chiliöl',aliases:['Chilliöl','Chili-Öl'],emoji:'🌶️',tone:'lemon',department:'pantry'},
 {name:'Chilisauce',aliases:['Chilisosse','Chillisauce','Chili-Sauce','Sweet-Chili-Sauce'],emoji:'🌶️',tone:'rose',department:'pantry'},
 {name:'Paprikaflocken',aliases:['Paprika-Flocken'],emoji:'🌶️',tone:'rose',department:'pantry'},
 {name:'Knoblauchpulver',aliases:['Knoblauch-Pulver'],emoji:'🧄',tone:'lemon',department:'pantry'},
 {name:'Knoblauchgranulat',aliases:['Knoblauch-Granulat'],emoji:'🧄',tone:'lemon',department:'pantry'},
 {name:'Zwiebelpulver',aliases:['Zwiebel-Pulver'],emoji:'🧅',tone:'lemon',department:'pantry'},
 {name:'Zwiebelgranulat',aliases:['Zwiebel-Granulat'],emoji:'🧅',tone:'lemon',department:'pantry'},
 {name:'Ingwerpulver',aliases:['Ingwer-Pulver'],emoji:'🫚',tone:'lemon',department:'pantry'},
 {name:'Tomatenpulver',aliases:['Tomaten-Pulver'],emoji:'🍅',tone:'rose',department:'pantry'},
 {name:'Tomatenflocken',aliases:['Tomaten-Flocken'],emoji:'🍅',tone:'rose',department:'pantry'},
 {name:'Tomatensauce',aliases:['Tomatensosse','Tomaten-Sauce'],emoji:'🍅',tone:'rose',department:'pantry'},
 {name:'Kokosraspeln',aliases:['Kokos-Raspeln'],emoji:'🥥',tone:'lemon',department:'pantry'},
 {name:'Knoblauchbutter',aliases:['Knoblauch-Butter'],emoji:'🧈',tone:'lemon',department:'chilled'},
 {name:'Kräuterbutter',aliases:['Kräuter-Butter'],emoji:'🧈',tone:'lemon',department:'chilled'},
 {name:'Nuss-Nougat-Creme',aliases:['Nussnougatcreme','Haselnusscreme','Schokoaufstrich'],emoji:'🍫',tone:'lemon',department:'pantry'},
 // Initial brand vocabulary, deliberately separate from generic food names.
 {name:'Nutella',emoji:'🍫',tone:'lemon',department:'pantry'},
 {name:'Nusspli',emoji:'🍫',tone:'lemon',department:'pantry'},
 {name:'Philadelphia',emoji:'🧀',tone:'blue',department:'chilled'},
 {name:'Buko',emoji:'🧀',tone:'blue',department:'chilled'},
 {name:'Maggi Würze',aliases:['Maggi-Würze'],emoji:'🫙',tone:'lemon',department:'pantry'},
 {name:'Kikkoman Sojasauce',emoji:'🫙',tone:'lemon',department:'pantry'},
 {name:'Heinz Ketchup',emoji:'🍅',tone:'rose',department:'pantry'},
 {name:'Coca-Cola',aliases:['Coca Cola'],emoji:'🥤',tone:'blue',department:'drinks'},
 {name:'Pepsi',emoji:'🥤',tone:'blue',department:'drinks'},
 {name:'Fanta',emoji:'🥤',tone:'blue',department:'drinks'},
 {name:'Sprite',emoji:'🥤',tone:'blue',department:'drinks'},
 {name:'Red Bull',aliases:['RedBull'],emoji:'🥤',tone:'blue',department:'drinks'},
 {name:'Monster Energy',emoji:'🥤',tone:'blue',department:'drinks'},
];
