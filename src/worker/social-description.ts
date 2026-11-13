import {parse,type DefaultTreeAdapterMap} from 'parse5';
import {AppError} from '../shared/errors.js';
type Node=DefaultTreeAdapterMap['node'];
export function socialDescription(html:string,requireRecipe=true):string{
 const values:string[]=[];const stack:Node[]=[parse(html)];
 while(stack.length){
  const node=stack.pop()!;
  if('tagName'in node&&node.tagName==='meta'){
   const attr=(name:string)=>node.attrs.find(a=>a.name===name)?.value||'';
   if(['og:description','description','twitter:description'].includes((attr('property')||attr('name')).toLowerCase()))values.push(attr('content').trim());
  }
  if('childNodes'in node)for(const child of node.childNodes)stack.push(child);
 }
 const text=values.filter(Boolean).sort((a,b)=>b.length-a.length)[0]||'';
 if(requireRecipe&&(text.length<80||!/[0-9¼½¾]/.test(text)||!/\b(?:zutaten|ingredients|recipe|rezept|kochen|backen|cook|add|mix|bake|g|ml|cup|tsp|tbsp)\b/i.test(text)))throw new AppError('VIDEO_SOURCE_REQUIRED','Die Videobeschreibung enthält kein ausreichend auslesbares Rezept. Bitte Beschreibung oder Transkript bereitstellen.',422);
 if(new TextEncoder().encode(text).byteLength>20000)throw new AppError('SOURCE_TOO_LARGE','Die Videobeschreibung überschreitet das Textlimit.',413);
 return text;
}
