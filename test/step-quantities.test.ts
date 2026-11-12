import {it,expect} from 'vitest';
import {stepQuantityNotes} from '../src/shared/step-quantities.js';
import {recipe} from './fixtures.js';
it('ergänzt bekannte Mengen direkt am betroffenen Schritt',()=>{
  expect(stepQuantityNotes({...recipe,ingredients:[{name:'Paprikapulver',amount:1,unit:'TL',note:''}],steps:[{text:'Paprikapulver hinzufügen.',ingredient_indices:[0]}]},0)).toEqual(['Paprikapulver: 1 TL']);
});
it('wiederholt bereits im Text enthaltene Mengen nicht',()=>expect(stepQuantityNotes(recipe,0)).toEqual([]));
it('weist bei wiederholt verwendeten Zutaten auf Gesamtmenge statt erfundene Teilmenge hin',()=>{
  expect(stepQuantityNotes({...recipe,steps:[{text:'Einige Tomaten schneiden.',ingredient_indices:[0]},{text:'Restliche Tomaten zugeben.',ingredient_indices:[0]}]},1)).toEqual(['Tomaten: Teilmenge siehe Anleitung; Rezeptgesamtmenge 200 g']);
});
it('erfindet keine fehlende Menge und behandelt ungültige Referenzen defensiv',()=>{
  expect(stepQuantityNotes({...recipe,ingredients:[{...recipe.ingredients[0],amount:null}],steps:[{text:'Tomaten zugeben.',ingredient_indices:[0,0,9]}]},0)).toEqual(['Tomaten: Menge unbekannt']);
});
