import type { z } from 'zod';
import type { recipeSchema } from './recipe.js';

export type RecipeData = z.infer<typeof recipeSchema>;
export type SourceKind = 'web' | 'youtube_transcript';
export type Role = 'admin' | 'member';
export interface Member { id: string; email: string; role: Role; active: number }
export interface Recipe extends RecipeData {
  image?:{url:string;source_url:string;credit:string}|null;
  id: number; owner_id: string; source_url: string; source_kind: SourceKind;
  created_at: string; updated_at: string; revision: number;
  can_edit: boolean; can_delete: boolean;
}
export interface PlanEntry { recipe_id: number; servings: number; recipe: Recipe }
export interface ShoppingItem { key: string; name: string; amount: number | null; unit: string; note: string; recipes: string[] }
export interface ManualShoppingItem {id:string;name:string;quantity:string;checked:boolean;updated_at:string}
export interface ImportRecord {
  id: string; source_url: string; source_kind: SourceKind; status: string; error_code: string | null;
  created_at: number; input_tokens: number | null; output_tokens: number | null; estimated_cost_microusd: number | null;
}
export interface AppState {
  manual_items?:ManualShoppingItem[];
  recipes: Recipe[]; plan: PlanEntry[]; shopping: ShoppingItem[]; checked: string[];
  user: Member; members: Member[]; imports: ImportRecord[]; has_key: boolean; read_only: boolean;
}
export interface Source { kind: SourceKind; url: string; text: string; image?:{url:string;credit:string} }
export interface RecipeImageData {bytes:ArrayBuffer;mime:'image/jpeg'|'image/png'|'image/webp';original_url:string;credit:string}
export interface Usage { input_tokens: number; output_tokens: number; estimated_cost_microusd: number; model: string }
export interface Generated { recipe: RecipeData; usage: Usage }
