import {it,expect} from 'vitest';
import {bringIngredientName,bringItem} from '../src/shared/bring-item.js';
it('übernimmt nur verlässliche metrische Mengen und kennzeichnet fehlende Mengen',()=>{
 expect(bringItem({name:'Paprikapulver',amount:1,unit:'TL',note:''})).toEqual({name:'Paprikapulver',quantity:'1 TL'});
 expect(bringItem({name:'Salz',amount:null,unit:'',note:''})).toEqual({name:'Salz',quantity:'Menge offen'});
 expect(()=>bringItem({name:'x'.repeat(101),amount:1,unit:'g',note:''})).toThrow();
});

it.each([
 ['frischer Rosmarin','Zweig','Rosmarin'],
 ['Rosmarin, frisch','Zweig','Rosmarin'],
 ['2 Dosen Tomaten','','Dosentomaten'],
 ['Tomaten','Dose','Dosentomaten'],
 ['stückige Tomaten aus der Dose','g','Dosentomaten'],
 ['Tomaten','g','Tomaten'],
 ['getrocknete Tomaten','g','Getrocknete Tomaten'],
 ['Räuchertofu','g','Räuchertofu'],
 ['glutenfreies Mehl','g','Glutenfreies Mehl'],
])('vereinfacht %s für Bring! und erhält produktrelevante Zusätze', (name,unit,expected)=>{
 expect(bringIngredientName(name,unit)).toBe(expected);
});
