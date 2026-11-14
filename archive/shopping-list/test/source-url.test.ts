import { it,expect } from 'vitest';
import { normalizeSourceUrl,publicSourceUrl } from '../src/shared/source-url.js';
it.each(['access_token','apikey','API-KEY','X-Amz-Signature','X-Amz-Credential','X-Amz-Security-Token','X-Goog-Signature','client_secret','refresh_token','id_token','session_id','sig','Authorization','params[access_token]','%61ccess_token','%2561ccess_token'])('weist sensible Query-Namen ab: %s',key=>{
  const url='https://recipes.example/?'+key+'=DO_NOT_EXPOSE';
  expect(()=>normalizeSourceUrl(url)).toThrow();expect(publicSourceUrl(url)).toBe('');
  try{normalizeSourceUrl(url);}catch(error){expect(String(error)).not.toContain('DO_NOT_EXPOSE');}
});
it('prüft verschachtelte und mehrfach kodierte Weiterleitungs-URLs',()=>{
  const nested='https://other.example/?access_token=DO_NOT_EXPOSE';
  for(const value of [nested,encodeURIComponent(nested),encodeURIComponent(encodeURIComponent(nested))])expect(()=>normalizeSourceUrl('https://recipes.example/?redirect='+encodeURIComponent(value))).toThrow();
});
it('normale Rezeptparameter bleiben nutzbar und Fragmente werden nicht gespeichert',()=>{
  expect(normalizeSourceUrl('https://recipes.example/?recipe_id=42&lang=de#access_token=ignored').href).toBe('https://recipes.example/?recipe_id=42&lang=de');
  expect(publicSourceUrl('https://user:password@recipes.example/')).toBe('');
});
