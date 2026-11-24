import { describe,it,expect } from 'vitest';
import { validateRecipe } from '../src/shared/recipe.js';
import { recipe } from './fixtures.js';
describe('Rezeptvalidierung und Mengen',()=>{
  it('erhält unbekannte Portionen und Zeiten statt Werte zu erfinden',()=>{
    const result=validateRecipe({...recipe,servings:null,cook_minutes:null});expect(result.servings).toBeNull();expect(result.cook_minutes).toBeNull();expect(result.warnings.join()).toMatch(/Portion/);
  });
  it('normalisiert kg/l und erhält unbekannte Mengen',()=>{
    const result=validateRecipe({...recipe,ingredients:[{name:'Tomaten',amount:.3,unit:'kg',note:''},{name:'Milch',amount:1.5,unit:'l',note:''},{name:'Salz',amount:null,unit:'',note:'nach Geschmack'}]});
    expect(result.ingredients.map(i=>i.amount)).toEqual([300,1500,null]);
  });
  it('rechnet US-Volumen in ml statt pauschal in Gewicht um',()=>{
    const result=validateRecipe({...recipe,ingredients:[{name:'Mehl',amount:1,unit:'cup',note:''}]});
    expect(result.ingredients[0].amount).toBeCloseTo(236.588236);expect(result.ingredients[0].unit).toBe('ml');expect(result.ingredients[0].note).toContain('Dichte');
  });
  it('normalisiert importierte US-Cups nach Zutat und passt nur eindeutige Mengen im Schritt an',()=>{
    const ingredients=[
      {name:'gelbe Zwiebel',amount:1,unit:'cup',note:'gewürfelt'},
      {name:'rote Zwiebel',amount:.5,unit:'cup',note:'gehackt'},
      {name:'weißer Langkornreis',amount:1,unit:'cup',note:'ungekocht'},
      {name:'Gemüsebrühe',amount:2.5,unit:'cup',note:''},
      {name:'Mehl',amount:1,unit:'cups',note:''},
      {name:'Salz',amount:.75,unit:'TL',note:''},
    ];
    const steps=[{text:'gelbe Zwiebel (1 cup), rote Zwiebel (1/2 cup), weißer Langkornreis (1 cup), Gemüsebrühe (2,5 cup), Mehl (1 cup), Salz (3/4 TL). 25 Minuten köcheln.',ingredient_indices:[0,1,2,3,4,5]},
      {text:'Gemüsebrühe (1/2 cup) später zugeben.',ingredient_indices:[3]}];
    const result=validateRecipe({...recipe,ingredients,steps},{imported:true});
    expect(result.ingredients.map(i=>[i.amount,i.unit])).toEqual([[160,'g'],[80,'g'],[185,'g'],[600,'ml'],[1,'US-Tasse'],[.75,'TL']]);
    expect(result.steps[0].text).toBe('gelbe Zwiebel (ca. 160 g), rote Zwiebel (ca. 80 g), weißer Langkornreis (ca. 185 g), Gemüsebrühe (ca. 600 ml), Mehl (1 US-Tasse), Salz (3/4 TL). 25 Minuten köcheln.');
    expect(result.steps[1]).toEqual(steps[1]);
    expect(validateRecipe(result,{imported:true})).toEqual(result);
  });
  it('erhält bei unklarer Schnittform oder Reissorte das ursprüngliche Maß und lässt exakte metrische Mengen bestehen',()=>{
    const ingredients=[
      {name:'Zwiebel',amount:1,unit:'cup',note:''},
      {name:'Langkornreis',amount:1,unit:'cup',note:'roh'},
      {name:'Gemüsebrühe',amount:591,unit:'ml',note:''},
    ];
    expect(validateRecipe({...recipe,ingredients},{imported:true}).ingredients.map(i=>[i.amount,i.unit])).toEqual([[1,'US-Tasse'],[1,'US-Tasse'],[591,'ml']]);
  });
  it.each([{title:''},{ingredients:[]},{steps:[]},{servings:0},{servings:Infinity},{prep_minutes:-1},{steps:[{text:'Kochen',ingredient_indices:[4]}]},{unknown:'field'}])('weist ungültige Daten ab: %j',change=>{expect(()=>validateRecipe({...recipe,...change})).toThrow();});
});
