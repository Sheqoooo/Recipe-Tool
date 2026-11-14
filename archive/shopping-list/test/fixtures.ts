import type { Env } from "../src/worker/env.js";
import type { RecipeData,Generated } from '../src/shared/types.js';
export const recipe:RecipeData={title:'Tomatenpasta',description:'Einfaches Rezept',servings:2,prep_minutes:null,cook_minutes:10,
  ingredients:[{name:'Tomaten',amount:200,unit:'g',note:''}],steps:[{text:'200 g Tomaten zehn Minuten kochen.',ingredient_indices:[0]}],warnings:[]};
export const generated:Generated={recipe,usage:{input_tokens:2000,output_tokens:1500,model:'gpt-5.4-mini',estimated_cost_microusd:8250}};
export function localEnv(db:D1Database):Env{return {DB:db,ASSETS:{fetch:async()=>new Response('private asset')} as Fetcher,APP_ENV:'local',AUTH_MODE:'local',OPENAI_API_KEY:'mock-not-a-real-key',RECIPE_ALLOWED_HOSTS:'recipes.example'};}

