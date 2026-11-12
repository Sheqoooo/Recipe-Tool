import {it,expect} from 'vitest';
import {departmentFor,groupShopping} from '../src/shared/shopping-order.js';
import {products} from '../src/shared/products.js';
it.each([
 ['Tomaten','produce'],['Möhren','produce'],['Brot','bakery'],['Spaghetti','pantry'],
 ['Olivenöl','pantry'],['Oliven','pantry'],['Kokosmilch','pantry'],['Paprikapulver','pantry'],
 ['Spülmittel sensitiv','household'],['Milch','chilled'],['Hähnchen','meat'],['TK Brokkoli','frozen'],
 ['Tiefgekühlte Erbsen','frozen'],['Tomaten aus der Dose','pantry'],['Getrocknete Tomaten','pantry'],
 ['Eisbergsalat','produce'],['Mein Spezialprodukt','other'],
])('ordnet %s nachvollziehbar %s zu',(name,id)=>expect(departmentFor(name)).toBe(id));
it('jeder gepflegte Katalogartikel hat eine Abteilung',()=>{
 expect(products.filter(p=>departmentFor(p.name)==='other')).toEqual([]);
});
it('sortiert gemischte Artikel nach Einkaufsweg und innerhalb alphabetisch, ohne die Eingabe zu verändern',()=>{
 const input=[{name:'Eis',origin:'manual'},{name:'Zitrone',origin:'recipe'},{name:'Äpfel',origin:'manual'},{name:'Spülmittel',origin:'manual'},{name:'Milch',origin:'recipe'},{name:'Reis',origin:'manual'}];
 const before=structuredClone(input),result=groupShopping(input);
 expect(result.map(g=>g.id)).toEqual(['produce','pantry','household','chilled','frozen']);
 expect(result[0].items.map(i=>i.name)).toEqual(['Äpfel','Zitrone']);expect(result[0].items.map(i=>i.origin)).toEqual(['manual','recipe']);expect(input).toEqual(before);
 expect(groupShopping([])).toEqual([]);
});

it.each([['Gehackte rote Chiliflocken','pantry'],['Chilipulver','pantry'],['Chilischoten','produce'],['Knoblauchgranulat','pantry'],['Nutella 750 g','pantry'],['Philadelphia','chilled'],['Coca-Cola','drinks']])('ordnet zusätzliche Varianten und Marken passend ein: %s',(name,id)=>expect(departmentFor(name)).toBe(id));
