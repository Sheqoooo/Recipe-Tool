import {it,expect} from 'vitest';
import {stepInstruction} from '../src/shared/step-quantities.js';
import {recipe} from './fixtures.js';
it('setzt explizite Mengen direkt hinter die Zutat, ohne Zutatenblock am Ende',()=>{
 const r={...recipe,ingredients:[{name:'Paprikapulver',amount:1,unit:'TL',note:''},{name:'Reis',amount:200,unit:'g',note:''}],steps:[{text:'1 TL Paprikapulver hinzufügen. Danach 200 g Reis dazugeben und leicht anrösten.',ingredient_indices:[0,1]}]};
 expect(stepInstruction(r,0)).toBe('Paprikapulver (1 TL) hinzufügen. Danach Reis (200 g) dazugeben und leicht anrösten.');
});
it('belässt bereits geklammerte Mengen und normale Sätze unverändert',()=>{
 const text='Paprikapulver (1 TL) hinzufügen. Danach den Reis dazugeben (200 g).';
 expect(stepInstruction({...recipe,steps:[{text,ingredient_indices:[0]}]},0)).toBe(text);
});
it('erhält echte Teilmengen und fügt keine Gesamtmenge bei wiederholter Verwendung hinzu',()=>{
 const r={...recipe,steps:[{text:'50 g Tomaten schneiden.',ingredient_indices:[0]},{text:'Restliche Tomaten zugeben.',ingredient_indices:[0]}]};
 expect(stepInstruction(r,0)).toBe('Tomaten (50 g) schneiden.');
 expect(stepInstruction(r,1)).toBe('Restliche Tomaten zugeben.');
});
it('erfindet keine unbekannten Mengen, rät keine Flexionen und behandelt ungültige Referenzen defensiv',()=>{
 const r={...recipe,ingredients:[{...recipe.ingredients[0],amount:null}],steps:[{text:'Einige gewürfelte Tomaten zugeben und 5 Minuten kochen.',ingredient_indices:[0,0,9]}]};
 expect(stepInstruction(r,0)).toBe(r.steps[0].text);expect(stepInstruction(r,9)).toBe('');
});
it('verwechselt Mengenbereiche und Brüche nicht mit Gesamtmengen',()=>{
 for(const amount of ['1/2 TL','1 1/2 TL','½ TL','1,5 TL','1–2 TL']){
 const r={...recipe,ingredients:[{name:'Salz',amount:9,unit:'TL',note:''}],steps:[{text:amount+' Salz hinzufügen.',ingredient_indices:[0]}]};
 expect(stepInstruction(r,0)).toBe('Salz ('+amount+') hinzufügen.');
 }
});
it('gibt nicht vertrauenswürdigen Text unverändert als Text zurück',()=>{
 const text='<img src=x onerror=alert(1)> hinzufügen.';
 expect(stepInstruction({...recipe,steps:[{text,ingredient_indices:[0]}]},0)).toBe(text);
});
