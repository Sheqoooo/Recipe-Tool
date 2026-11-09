import type { Env } from "./env.js";
import type { Member, Recipe, RecipeData, Source, SourceKind, Usage,  ImportRecord, PlanEntry } from '../shared/types.js';
import { AppError } from '../shared/errors.js';
import { normalizeSourceUrl,publicSourceUrl } from '../shared/source-url.js';
import { positiveServings } from '../shared/recipe.js';

interface Row {
  id: number; owner_id: string; title: string; description: string; servings: number | null;
  prep_minutes: number | null; cook_minutes: number | null; source_url: string; source_kind: SourceKind;
  warnings_json: string; revision: number; created_at: string; updated_at: string;
}
export function intConfig(value: string | undefined, fallback: number, max = 100000000): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new AppError('CONFIGURATION', 'Die Serverkonfiguration ist ungültig.', 503);
  return n;
}

export class Repository {
  constructor(public db: D1Database) {}
  async member(email: string): Promise<(Member & { access_sub: string | null }) | null> {
    return this.db.prepare('SELECT * FROM members WHERE email=? COLLATE NOCASE').bind(email).first();
  }
  async admit(email: string, sub: string, bootstrap: string[]): Promise<Member> {
    let member = await this.member(email);
    if (!member && bootstrap.includes(email)) {
      await this.db.prepare("INSERT OR IGNORE INTO members(id,email,access_sub,role) VALUES(?,?,?,'admin')").bind(crypto.randomUUID(), email, sub).run();
      member = await this.member(email);
    }
    if (!member || !member.active || (member.access_sub && member.access_sub !== sub)) throw new AppError('NOT_INVITED', 'Für dieses Kochbuch fehlt eine aktive Einladung.', 403);
    await this.db.prepare('UPDATE members SET access_sub=? WHERE id=? AND access_sub IS NULL').bind(sub, member.id).run();
    return { id: member.id, email: member.email, role: member.role, active: member.active };
  }
  async members(): Promise<Member[]> {
    return (await this.db.prepare('SELECT id,email,role,active FROM members ORDER BY email').all<Member>()).results;
  }
  async invite(email: string, role: 'admin' | 'member'): Promise<void> {
    await this.db.prepare('INSERT INTO members(id,email,role) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(), email, role).run();
  }
  async updateMember(target:string,active:number,role:'admin'|'member'|undefined,actor:Member):Promise<void>{
    if(actor.role!=='admin'||target===actor.id)throw new AppError('FORBIDDEN','Eigene Rolle und eigenen Zugang nicht ändern; ein anderer Administrator kann dies übernehmen.',403);
    const result=await this.db.prepare('UPDATE members SET active=?,role=COALESCE(?,role) WHERE id=?').bind(active,role??null,target).run();
    if(!result.meta.changes)throw new AppError('NOT_FOUND','Mitglied nicht gefunden.',404);
  }
  async recipes(actor: Member): Promise<Recipe[]> {
    // One D1 batch gives all three queries the same selected-recipe snapshot.
    const selection='SELECT id FROM recipes ORDER BY created_at DESC,id DESC LIMIT 500';
    type IngredientRow={recipe_id:number;name:string;amount:number|null;unit:string;note:string};
    type StepRow={recipe_id:number;text:string;ingredient_indices_json:string};
    const result=await this.db.batch([
      this.db.prepare('SELECT * FROM recipes WHERE id IN ('+selection+') ORDER BY created_at DESC,id DESC'),
      this.db.prepare('SELECT * FROM ingredients WHERE recipe_id IN ('+selection+') ORDER BY recipe_id,position'),
      this.db.prepare('SELECT * FROM steps WHERE recipe_id IN ('+selection+') ORDER BY recipe_id,position'),
    ]);
    function group<T extends {recipe_id:number}>(values:T[]):Map<number,T[]>{
      const groups=new Map<number,T[]>();for(const value of values){const entries=groups.get(value.recipe_id)||[];entries.push(value);groups.set(value.recipe_id,entries);}return groups;
    }
    const ingredients=group(result[1].results as IngredientRow[]),steps=group(result[2].results as StepRow[]);
    return (result[0].results as Row[]).map(row => ({ id:row.id,owner_id:row.owner_id,title:row.title,description:row.description,
      servings:row.servings,prep_minutes:row.prep_minutes,cook_minutes:row.cook_minutes,source_url:publicSourceUrl(row.source_url),
      source_kind:row.source_kind,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at,
      warnings: JSON.parse(row.warnings_json) as string[],
      ingredients: (ingredients.get(row.id)||[]).map(i => ({ name:i.name, amount:i.amount, unit:i.unit, note:i.note })),
      steps: (steps.get(row.id)||[]).map(s => ({ text:s.text, ingredient_indices:JSON.parse(s.ingredient_indices_json) as number[] })),
      can_edit: actor.role === 'admin' || row.owner_id === actor.id, can_delete: actor.role === 'admin',
    }));
  }
  async byId(id: number): Promise<Row | null> { return this.db.prepare('SELECT * FROM recipes WHERE id=?').bind(id).first<Row>(); }
  async bySource(url: string): Promise<{id:number} | null> { url=normalizeSourceUrl(url).href;return this.db.prepare('SELECT id FROM recipes WHERE source_url=? ORDER BY id LIMIT 1').bind(url).first(); }
  async plan(recipes: Recipe[]): Promise<PlanEntry[]> {
    const rows = (await this.db.prepare('SELECT * FROM plan ORDER BY recipe_id').all<{recipe_id:number;servings:number}>()).results;
    return rows.flatMap(row => { const recipe=recipes.find(r => r.id===row.recipe_id); return recipe ? [{...row,recipe}] : []; });
  }
  async checked(): Promise<string[]> { return (await this.db.prepare('SELECT key FROM checked_items').all<{key:string}>()).results.map(r=>r.key); }
  async setPlan(id:number, target:unknown, remove:boolean): Promise<void> {
    const recipe=await this.byId(id);
    if (!recipe) throw new AppError('NOT_FOUND','Das Rezept wurde nicht gefunden.',404);
    if (!remove && recipe.servings===null) throw new AppError('SERVINGS_UNKNOWN','Bitte zuerst die fehlende Portionenzahl im Rezept korrigieren.',409);
    const statement=remove ? this.db.prepare('DELETE FROM plan WHERE recipe_id=?').bind(id)
      : this.db.prepare('INSERT INTO plan VALUES(?,?) ON CONFLICT(recipe_id) DO UPDATE SET servings=excluded.servings').bind(id,positiveServings(target));
    await this.db.batch([statement,this.db.prepare('DELETE FROM checked_items')]);
  }
  async check(key:string, checked:boolean):Promise<void> {
    await this.db.prepare(checked?'INSERT OR IGNORE INTO checked_items VALUES(?)':'DELETE FROM checked_items WHERE key=?').bind(key).run();
  }
  async reserve(actor:Member, source:Pick<Source,'url'|'kind'>, env:Env, cost:number):Promise<string> {
    const sourceUrl=normalizeSourceUrl(source.url).href;
    const now=Date.now(), day=new Date().toISOString().slice(0,10), month=new Date().toISOString().slice(0,7);
    const dayStart=Date.parse(day+'T00:00:00Z'), monthStart=Date.parse(month+'-01T00:00:00Z');
    await this.db.prepare("UPDATE imports SET status='failed',error_code='LEASE_EXPIRED' WHERE status='running' AND lease_expires_at<=?").bind(now).run();
    const id=crypto.randomUUID();
    try {
      const result=await this.db.prepare(`INSERT INTO imports(id,owner_id,source_url,source_kind,status,created_at,lease_expires_at,reserved_cost_microusd)
        SELECT ?,?,?,?,'running',?,?,?
        WHERE (SELECT COUNT(*) FROM imports WHERE owner_id=? AND created_at>=?) < ?
        AND (SELECT COUNT(*) FROM imports WHERE owner_id=? AND created_at>=?) < ?
        AND (SELECT COUNT(*) FROM imports WHERE status='running') < ?
        AND COALESCE((SELECT SUM(reserved_cost_microusd) FROM imports WHERE created_at>=?),0)+? <= ?
        AND COALESCE((SELECT SUM(reserved_cost_microusd) FROM imports WHERE created_at>=?),0)+? <= ?`)
        .bind(id,actor.id,sourceUrl,source.kind,now,now+180000,cost,
          actor.id,now-60000,intConfig(env.USER_IMPORTS_PER_MINUTE,5,100),
          actor.id,dayStart,intConfig(env.USER_IMPORTS_PER_DAY,30,10000),intConfig(env.MAX_PARALLEL_IMPORTS,2,10),
          dayStart,cost,intConfig(env.DAILY_BUDGET_MICROUSD,2000000),monthStart,cost,intConfig(env.MONTHLY_BUDGET_MICROUSD,10000000)).run();
      if (!result.meta.changes) throw new Error('limit');
    } catch { throw new AppError('IMPORT_LIMIT','Import läuft bereits oder Anfrage-/Kostenlimit erreicht. Bitte später erneut versuchen.',429); }
    return id;
  }
  async fail(id:string,code:string,usage?:Usage):Promise<void> {
    await this.db.prepare("UPDATE imports SET status='failed',error_code=?,input_tokens=?,output_tokens=?,model=?,estimated_cost_microusd=? WHERE id=? AND status='running'")
      .bind(code,usage?.input_tokens??null,usage?.output_tokens??null,usage?.model??null,usage?.estimated_cost_microusd??null,id).run();
  }
  async history(actor:Member):Promise<ImportRecord[]> {
    const statement=actor.role==='admin' ? this.db.prepare('SELECT * FROM imports ORDER BY created_at DESC LIMIT 30')
      :this.db.prepare('SELECT * FROM imports WHERE owner_id=? ORDER BY created_at DESC LIMIT 30').bind(actor.id);
    return (await statement.all<ImportRecord>()).results.map(r=>({id:r.id,source_url:publicSourceUrl(r.source_url),source_kind:r.source_kind,status:r.status,
      error_code:r.error_code,created_at:r.created_at,input_tokens:r.input_tokens,output_tokens:r.output_tokens,estimated_cost_microusd:r.estimated_cost_microusd}));
  }
  async save(recipe:RecipeData, actor:Member, source:Pick<Source,'url'|'kind'>, importId:string,usage:Usage):Promise<number> {
    const sourceUrl=normalizeSourceUrl(source.url).href;
    const id=Number.parseInt(crypto.randomUUID().replaceAll('-','').slice(0,13),16);
    const statements=[this.db.prepare(`INSERT INTO recipes(id,owner_id,title,description,servings,prep_minutes,cook_minutes,source_url,source_kind,warnings_json)
      SELECT ?,?,?,?,?,?,?,?,?,? FROM imports WHERE id=? AND status='running' AND lease_expires_at>?`).bind(id,actor.id,recipe.title,recipe.description,recipe.servings,recipe.prep_minutes,recipe.cook_minutes,sourceUrl,source.kind,JSON.stringify(recipe.warnings),importId,Date.now())];
    recipe.ingredients.forEach((i,p)=>statements.push(this.db.prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)').bind(id,p,i.name,i.amount,i.unit,i.note)));
    recipe.steps.forEach((s,p)=>statements.push(this.db.prepare('INSERT INTO steps VALUES(?,?,?,?)').bind(id,p,s.text,JSON.stringify(s.ingredient_indices))));
    statements.push(this.db.prepare("UPDATE imports SET status='completed',recipe_id=?,input_tokens=?,output_tokens=?,model=?,estimated_cost_microusd=? WHERE id=? AND status='running'")
      .bind(id,usage.input_tokens,usage.output_tokens,usage.model,usage.estimated_cost_microusd,importId),this.db.prepare('DELETE FROM checked_items'));
    await this.db.batch(statements); return id;
  }
  async edit(id:number,revision:number,recipe:RecipeData,actor:Member):Promise<void> {
    const previous=await this.byId(id);
    if(!previous)throw new AppError('NOT_FOUND','Rezept nicht gefunden.',404);
    if(actor.role!=='admin'&&previous.owner_id!==actor.id)throw new AppError('FORBIDDEN','Du darfst nur eigene Rezepte bearbeiten.',403);
    const token=crypto.randomUUID();
    const condition='EXISTS(SELECT 1 FROM recipes WHERE id=? AND write_token=?)';
    const statements=[this.db.prepare(`UPDATE recipes SET title=?,description=?,servings=?,prep_minutes=?,cook_minutes=?,warnings_json=?,revision=revision+1,write_token=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND revision=? AND (owner_id=? OR ?='admin')`).bind(recipe.title,recipe.description,recipe.servings,recipe.prep_minutes,recipe.cook_minutes,JSON.stringify(recipe.warnings),token,id,revision,actor.id,actor.role),
      this.db.prepare(`DELETE FROM ingredients WHERE recipe_id=? AND ${condition}`).bind(id,id,token),
      this.db.prepare(`DELETE FROM steps WHERE recipe_id=? AND ${condition}`).bind(id,id,token)];
    recipe.ingredients.forEach((i,p)=>statements.push(this.db.prepare(`INSERT INTO ingredients SELECT ?,?,?,?,?,? WHERE ${condition}`).bind(id,p,i.name,i.amount,i.unit,i.note,id,token)));
    recipe.steps.forEach((s,p)=>statements.push(this.db.prepare(`INSERT INTO steps SELECT ?,?,?,? WHERE ${condition}`).bind(id,p,s.text,JSON.stringify(s.ingredient_indices),id,token)));
    statements.push(this.db.prepare(`DELETE FROM checked_items WHERE ${condition}`).bind(id,token));
    const result=await this.db.batch(statements);
    if(!result[0].meta.changes)throw new AppError('EDIT_CONFLICT','Das Rezept wurde inzwischen geändert. Bitte neu laden.',409);
  }
  async delete(id:number,actor:Member):Promise<void> {
    if(actor.role!=='admin')throw new AppError('FORBIDDEN','Nur Administratoren dürfen Rezepte löschen.',403);
    await this.db.batch([this.db.prepare('DELETE FROM recipes WHERE id=?').bind(id),this.db.prepare('DELETE FROM checked_items')]);
  }
}
