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
  it.each([{title:''},{ingredients:[]},{steps:[]},{servings:0},{servings:Infinity},{prep_minutes:-1},{steps:[{text:'Kochen',ingredient_indices:[4]}]},{unknown:'field'}])('weist ungültige Daten ab: %j',change=>{expect(()=>validateRecipe({...recipe,...change})).toThrow();});
});
