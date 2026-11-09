import { it,expect } from 'vitest';
import { extractSource,MAX_SOURCE_BYTES } from '../src/worker/source.js';
const url='https://recipes.example/recipe';
const schema={ '@type':'Recipe', name:'Pasta',recipeYield:'2 Portionen',prepTime:'PT5M',cookTime:'PT10M',recipeIngredient:['200 g Tomaten','100 g Nudeln'],recipeInstructions:[{'@type':'HowToSection',name:'Sauce',itemListElement:[{'@type':'HowToStep',text:'<p>200 g Tomaten für 10 Minuten bei 180 °C garen.</p>',image:'x'.repeat(40000)}]},{'@type':'HowToStep',text:'100 g Nudeln hinzufügen.'}]};
it('reduziert großes JSON-LD auf vollständige Zutaten, Schritte, Mengen und Zeiten',()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'WebPage',description:'Intro '.repeat(10000)},{...schema,image:'x'.repeat(60000),review:[{text:'Bewertung '.repeat(10000)}],description:'Ü'.repeat(20000)}]})+'</script>';
  const text=extractSource(html,url).text,recipe=JSON.parse(text);
  expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(MAX_SOURCE_BYTES);
  expect(recipe.recipeIngredient).toEqual(schema.recipeIngredient);expect(recipe.recipeYield).toBe('2 Portionen');expect(recipe.cookTime).toBe('PT10M');
  expect(recipe.recipeInstructions).toEqual(['Sauce','200 g Tomaten für 10 Minuten bei 180 °C garen.','100 g Nudeln hinzufügen.']);
  expect(recipe).not.toHaveProperty('review');expect(recipe).not.toHaveProperty('image');expect(recipe.description.length).toBeLessThanOrEqual(500);
});
it('findet die Rezeptkarte hinter langen Einführungstexten und ignoriert Werbung/Kommentare',()=>{
  const text=extractSource('<main><p>'+('Lange Geschichte '.repeat(3000))+'</p><section class="wprm-recipe-container"><h2>Suppe</h2><p>2 Portionen</p><ul><li>200 g Tomaten</li></ul><ol><li>Bei 180 °C 10 Minuten garen.</li></ol></section><aside>'+('Werbung '.repeat(5000))+'</aside><section>Kommentare '+('gut '.repeat(8000))+'</section></main>',url).text;
  expect(text).toContain('200 g Tomaten');expect(text).toContain('180 °C 10 Minuten');expect(text).not.toMatch(/Geschichte|Kommentare|Werbung/);
});
it('nutzt vollständige Rezeptabschnitte aus umfangreichen Artikeln ohne Rezeptkarte',()=>{
  const text=extractSource('<article><header><h1>Tomatensuppe</h1></header><p>'+('Einleitung '.repeat(5000))+'</p><p>Portionen: 2</p><h2>Zutaten</h2><ul><li>200 g Tomaten</li></ul><h2>Zubereitung</h2><ol><li>10 Minuten bei 180 °C garen.</li></ol><h2>Kommentare</h2><p>'+('Bewertung '.repeat(5000))+'</p></article>',url).text;
  expect(text).toContain('Tomatensuppe');expect(text).toContain('Portionen: 2');expect(text).toContain('200 g Tomaten');expect(text).toContain('180 °C');expect(text).not.toMatch(/Einleitung|Bewertung|Kommentare/);
});
it('zählt UTF-8-Bytes und schneidet einen zu großen Rezeptkern niemals unbemerkt ab',()=>{
  expect(()=>extractSource('<script type="application/ld+json">'+JSON.stringify({...schema,recipeInstructions:['🌶'.repeat(6000)]})+'</script>',url)).toThrow(/nicht unvollständig/);
  expect(()=>extractSource('<main><h2>Zutaten</h2><p>200 g Tomaten</p><h2>Zubereitung</h2><p>'+('Schritt '.repeat(4000))+'</p></main>',url)).toThrow();
});
it('lange unbekannte Seiten werden nicht willkürlich auf einen vermeintlichen Rezeptanfang gekürzt',()=>{
  expect(()=>extractSource('<p>'+('Beliebiger Text '.repeat(4000))+'</p>',url)).toThrow();
  expect(()=>extractSource('<script>ignore</script><nav>menu</nav>',url)).toThrow(/Kein lesbarer/);
});
it('versteckte Blöcke und fehlerhaftes JSON-LD verhindern den sichtbaren HTML-Fallback nicht',()=>{
  expect(extractSource('<script type="application/ld+json">{invalid}</script><div hidden>secret</div><main><h1>Pasta</h1><p>200 g Nudeln kochen.</p></main>',url).text).toBe('Pasta\n200 g Nudeln kochen.');
});
