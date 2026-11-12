import {it,expect} from 'vitest';
import {productSuggestions,productFor,productKey,validateShoppingEntry} from '../src/shared/products.js';
it.each(['Spül','spuel','SPÜL'])('vervollständigt Haushaltsartikel: %s',query=>{
 expect(productSuggestions(query).some(p=>p.name==='Spülmittel')).toBe(true);
});
it('bevorzugt eigene Artikel, begrenzt Vorschläge und vermeidet Duplikate',()=>{
 const result=productSuggestions('Mil',['Milch','Milch','Milchreis']);
 expect(result[0].name).toBe('Milch');expect(result.filter(p=>p.name==='Milch')).toHaveLength(1);expect(result.length).toBeLessThanOrEqual(12);
 expect(productSuggestions('')).toEqual([]);
});
it('ordnet Emojis deterministisch zu und verwendet einen ehrlichen Fallback',()=>{
 expect(productFor('Spülmittel').emoji).toBe('🧼');expect(productFor('Spuelmittel').emoji).toBe('🧼');
 expect(productFor('Rote Paprika').emoji).toBe('🫑');expect(productFor('Paprikapulver').emoji).toBe('🌶️');
 expect(productFor('Erdnussbutter').emoji).toBe('🥜');expect(productFor('Mein Spezialprodukt').emoji).toBe('🛒');
 expect(productKey('  WEISSWEIN ')).toBe(productKey('Weißwein'));
});
it.each([{name:''},{name:'  '},{name:'x'.repeat(101)},{name:'Milch',quantity:'x'.repeat(61)},{name:'Milch',emoji:'🔥'},{name:'Milch\u0000'},{name:'Milch',id:'invalid'}])('validiert freie Artikel serverseitig: %j',value=>expect(()=>validateShoppingEntry(value)).toThrow());
it('erlaubt Freitextmengen und unbekannte internationale Artikelnamen',()=>{
 expect(validateShoppingEntry({name:'Reismilch',quantity:'2 Packungen'})).toEqual({name:'Reismilch',quantity:'2 Packungen'});
 expect(validateShoppingEntry({name:'味噌'}).name).toBe('味噌');
});

it('durchsucht importierte Lebensmittel und Synonyme ohne Veränderung der Haushaltsvorschläge',()=>{
 expect(productSuggestions('Pastinak').some(p=>/Pastinak/i.test(p.name))).toBe(true);
 expect(productSuggestions('Karamellsirup').some(p=>/Karamell|Caramel/i.test(p.name))).toBe(true);
 expect(productSuggestions('Spül')[0].name).toBe('Spülmittel');
 expect(productFor('Frische Pastinake').department).toBe('produce');
});
