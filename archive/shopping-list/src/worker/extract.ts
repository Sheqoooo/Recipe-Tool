import { parse,parseFragment,type DefaultTreeAdapterMap } from 'parse5';
import { AppError } from '../shared/errors.js';

type Node=DefaultTreeAdapterMap['node'];
type Block={text:string;heading:number};
const hiddenTags=new Set(['script','style','noscript','svg','nav','footer','aside','template','form']);
const blockTags=new Set(['p','li','div','section','article','main','br','tr','dt','dd','h1','h2','h3','h4','h5','h6']);
const encoder=new TextEncoder();
function tag(node:Node):string{return 'tagName'in node?node.tagName:'';}
function attr(node:Node,name:string):string{return 'attrs'in node?node.attrs.find(a=>a.name===name)?.value||'':'';}
function hidden(node:Node):boolean{return hiddenTags.has(tag(node))||('attrs'in node&&node.attrs.some(a=>a.name==='hidden'||a.name==='aria-hidden'&&a.value==='true'));}
function blocks(root:Node):Block[]{
  const result:Block[]=[];let parts:string[]=[],heading=0;
  const flush=()=>{const text=parts.join(' ').replace(/\s+/g,' ').trim();if(text)result.push({text,heading});parts=[];};
  const stack:{node:Node;exit?:boolean;previousHeading?:number}[]=[{node:root}];
  while(stack.length){const current=stack.pop()!,node=current.node,name=tag(node);
    if(current.exit){if(blockTags.has(name))flush();heading=current.previousHeading!;continue;}
    if(hidden(node))continue;
    if(blockTags.has(name))flush();
    const previousHeading=heading;if(/^h[1-6]$/.test(name))heading=Number(name[1]);
    if('value'in node)parts.push(node.value);
    if('childNodes'in node){stack.push({node,exit:true,previousHeading});for(let i=node.childNodes.length-1;i>=0;i--)stack.push({node:node.childNodes[i]});}
  }
  flush();return result;
}
function plain(value:unknown):string {
  if(typeof value==='number')return String(value);
  if(typeof value!=='string')return '';
  return blocks(parseFragment(value)).map(b=>b.text).join('\n');
}
function clip(value:string,bytes:number):string {
  let size=0,result='';for(const character of value){const n=encoder.encode(character).length;if(size+n>bytes)break;result+=character;size+=n;}return result;
}
function instructions(value:unknown,depth=0):string[]{
  if(depth>40)throw new AppError('SOURCE_COMPLEX','Die Rezeptstruktur ist zu stark verschachtelt.',422);
  if(typeof value==='string')return [plain(value)].filter(Boolean);
  if(Array.isArray(value))return value.flatMap(v=>instructions(v,depth+1));
  if(!value||typeof value!=='object')return [];
  const row=value as Record<string,unknown>;
  const text=plain(row.text),name=plain(row.name);
  return [name!==text?name:'',text,...instructions(row.itemListElement??row.item,depth+1)].filter(Boolean);
}
function projectRecipe(row:Record<string,unknown>,limit:number):string {
  // Keep the complete cooking core. Reviews, images, nutrition and URLs never enter the model input.
  const core:Record<string,unknown>={name:plain(row.name)};
  for(const field of ['recipeYield','prepTime','cookTime','totalTime','cookingTemperature','ovenTemperature']){
    const value=row[field];const text=Array.isArray(value)?value.map(plain).join(' / '):value&&typeof value==='object'?plain((value as Record<string,unknown>).value)+' '+plain((value as Record<string,unknown>).unitText):plain(value);
    if(text.trim())core[field]=text.trim();
  }
  if(Array.isArray(row.recipeIngredient))core.recipeIngredient=row.recipeIngredient.map(plain).filter(Boolean);
  else if(typeof row.recipeIngredient==='string')core.recipeIngredient=[plain(row.recipeIngredient)];
  const steps=instructions(row.recipeInstructions);if(steps.length)core.recipeInstructions=steps;
  let text=JSON.stringify(core);
  if(encoder.encode(text).length>limit)throw tooLarge();
  const description=clip(plain(row.description),1000);
  if(description){const extended=JSON.stringify({...core,description});if(encoder.encode(extended).length<=limit)text=extended;}
  return text;
}
function tooLarge():AppError{return new AppError('SOURCE_TOO_LARGE','Der eigentliche Rezeptinhalt überschreitet das Textlimit. Zutaten und Schritte werden nicht unvollständig abgeschnitten.',413);}
function fits(value:string,limit:number):boolean{return encoder.encode(value).length<=limit;}

export function extractRecipeContent(html:string,limit:number):string {
  const tree=parse(html),scripts:string[]=[],cards:Node[]=[],articles:Node[]=[],mains:Node[]=[];
  const stack:Node[]=[tree];
  while(stack.length){const node=stack.pop()!,name=tag(node);
    if(name==='script'&&attr(node,'type').trim().toLowerCase()==='application/ld+json'&&'childNodes'in node)scripts.push(node.childNodes.map(n=>'value'in n?n.value:'').join(''));
    if(hidden(node))continue;
    const hint=attr(node,'class')+' '+attr(node,'id');
    if(cards.length<32&&(/schema\.org\/Recipe(?:\s|$)/i.test(attr(node,'itemtype'))||/(?:wprm-recipe-container|tasty-recipes(?:\s|$)|recipe[-_]card|recipe[-_]content)/i.test(hint)))cards.push(node);
    if(name==='article'&&articles.length<16)articles.push(node);
    if(name==='main'&&mains.length<8)mains.push(node);
    if('childNodes'in node)for(let i=node.childNodes.length-1;i>=0;i--)stack.push(node.childNodes[i]);
  }
  function find(value:unknown):Record<string,unknown>|null {
    // Breadth first: graph-level Recipe siblings precede deeply nested reviews/metadata.
    const queue:{value:unknown;depth:number}[]=[{value,depth:0}];
    for(let i=0;i<queue.length&&i<20000;i++){
      const current=queue[i];if(!current.value||typeof current.value!=='object'||current.depth>40)continue;
      const obj=current.value as Record<string,unknown>,type=obj['@type'];
      if(type==='Recipe'||Array.isArray(type)&&type.includes('Recipe'))return obj;
      for(const child of Object.values(obj))if(child&&typeof child==='object'&&queue.length<20000)queue.push({value:child,depth:current.depth+1});
    }
    return null;
  }
  for(const script of scripts){let value:unknown;try{value=JSON.parse(script);}catch{continue;}
    const recipe=find(value);if(recipe)return projectRecipe(recipe,limit);
  }
  // Prefer explicit recipe cards, then semantic article/main regions over page chrome.
  const scopes=[...cards,...articles,...mains,tree];
  for(const scope of scopes){
    const content=blocks(scope),text=content.map(b=>b.text).join('\n');
    if(!text)continue;
    if(fits(text,limit))return text;
    // Select whole ingredient/method sections, even if the surrounding article is very long.
    const selected=new Set<number>();let hasIngredients=false,hasMethod=false;
    const title=content.findIndex(b=>b.heading===1);if(title>=0)selected.add(title);
    for(let i=0;i<content.length;i++){
      if(content[i].heading&&/^(?:zutaten|ingredients|zubereitung|anleitung|instructions|directions|method|preparation)\b/i.test(content[i].text)){
        if(/^(zutaten|ingredients)\b/i.test(content[i].text))hasIngredients=true;else hasMethod=true;
        const level=content[i].heading;selected.add(i);
        for(let j=i+1;j<content.length&&(!content[j].heading||content[j].heading>level);j++)selected.add(j);
      }
      if(/^(?:portionen|servings|yield|vorbereitungszeit|kochzeit|gesamtzeit|prep time|cook time|total time)\s*[:\d]/i.test(content[i].text)){
        if(encoder.encode(content[i].text).length<=300)selected.add(i);
      }
    }
    const sections=[...selected].sort((a,b)=>a-b).map(i=>content[i].text).join('\n');
    // A title/time alone is not a recipe section.
    if(hasIngredients&&hasMethod&&fits(sections,limit))return sections;
  }
  if(!blocks(tree).length)throw new AppError('NO_RECIPE','Kein lesbarer Rezeptinhalt gefunden.',422);
  throw tooLarge();
}
