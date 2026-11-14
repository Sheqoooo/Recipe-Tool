import {parse,type DefaultTreeAdapterMap} from 'parse5';
import {normalizeSourceUrl} from '../shared/source-url.js';
type Candidate={url:string;credit:string};
const clean=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,240):'';
function name(value:unknown):string{
  if(Array.isArray(value))return value.map(name).filter(Boolean).join(', ').slice(0,240);
  if(value&&typeof value==='object')return clean((value as Record<string,unknown>).name);
  return clean(value);
}
function image(value:unknown,base:string,inheritedCredit='',depth=0):Candidate|undefined{
  if(depth>8)return;
  if(Array.isArray(value)){for(const item of value){const candidate=image(item,base,inheritedCredit,depth+1);if(candidate)return candidate;}return;}
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    const credit=clean(row.creditText)||name(row.copyrightHolder)||name(row.creator)||name(row.author)||inheritedCredit;
    return image(row.contentUrl||row.url,base,credit,depth+1);
  }
  if(typeof value!=='string'||!value.trim())return;
  try{return {url:normalizeSourceUrl(new URL(value.trim(),base).href).href,credit:inheritedCredit};}catch{return;}
}
export function extractSourceImage(html:string,base:string):Candidate|undefined{
  const tree=parse(html);type Node=DefaultTreeAdapterMap['node'];const stack:Node[]=[tree],scripts:string[]=[],og:string[]=[],twitter:string[]=[];
  while(stack.length){const node=stack.pop()!;
    if('tagName'in node){const attr=(key:string)=>node.attrs.find(a=>a.name===key)?.value||'';
      if(node.tagName==='script'&&attr('type').trim().toLowerCase()==='application/ld+json')scripts.push(node.childNodes.map(n=>'value'in n?n.value:'').join(''));
      if(node.tagName==='meta'){const property=(attr('property')||attr('name')).toLowerCase();if(property==='og:image')og.push(attr('content'));if(property==='twitter:image')twitter.push(attr('content'));}
    }
    if('childNodes'in node)for(let i=node.childNodes.length-1;i>=0;i--)stack.push(node.childNodes[i]);
  }
  for(const script of scripts){
    let root:unknown;try{root=JSON.parse(script);}catch{continue;}
    const queue:{value:unknown;depth:number}[]=[{value:root,depth:0}];
    for(let i=0;i<queue.length&&i<20000;i++){
      const {value,depth}=queue[i];if(!value||typeof value!=='object'||depth>40)continue;
      const row=value as Record<string,unknown>,type=row['@type'];
      if(type==='Recipe'||Array.isArray(type)&&type.includes('Recipe')){
        const candidate=image(row.image,base);if(candidate)return candidate;
        // Match the first Recipe, not an unrelated recipe or arbitrary image elsewhere.
        break;
      }
      for(const child of Object.values(row))if(child&&typeof child==='object'&&queue.length<20000)queue.push({value:child,depth:depth+1});
    }
  }
  return image(og,base)||image(twitter,base);
}
