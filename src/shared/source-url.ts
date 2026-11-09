import ipaddr from 'ipaddr.js';
import { AppError } from './errors.js';

function decoded(value:string):string {
  for(let i=0;i<3;i++){try{const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}}
  return value;
}
function hasCredentials(url:URL,depth=0):boolean {
  for(const [name,value] of url.searchParams){
    const key=decoded(name).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(/(?:token|apikey|authorization|password|passwd|secret|secretkey|signature|session|sessionid|credential|credentials)$/.test(key)||['key','auth','sig','code'].includes(key)||/^(xamz|xgoog)/.test(key))return true;
    const nested=decoded(value).trim();
    if(/^(?:bearer\s+|sk-(?:proj-|svcacct-)?)/i.test(nested))return true;
    if(/^https?:\/\//i.test(nested)){
      if(depth>=3)return true;
      try{const target=new URL(nested);if(target.username||target.password||hasCredentials(target,depth+1))return true;}catch{continue;}
    }
  }
  return false;
}
export function normalizeSourceUrl(value:unknown):URL {
  if(typeof value!=='string'||value.length>2000)throw new AppError('INVALID_URL','Bitte einen gültigen Rezeptlink angeben.');
  let url:URL;try{url=new URL(value);}catch{throw new AppError('INVALID_URL','Bitte einen vollständigen HTTPS-Link angeben.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||url.hostname.endsWith('.')||ipaddr.isValid(url.hostname.replace(/^\[|\]$/g,'')))throw new AppError('INVALID_URL','Nur öffentliche HTTPS-Links ohne Zugangsdaten oder Sonderport sind erlaubt.');
  if(hasCredentials(url))throw new AppError('PRIVATE_URL','Bitte keine Links mit Zugangsschlüsseln verwenden.');
  url.hash='';return url;
}
// Defense for historical rows: never return known credential-bearing source URLs.
// No historical database mutation is performed by reading an API response.
export function publicSourceUrl(value:string):string {
  try{return normalizeSourceUrl(value).href;}catch{return '';}
}
