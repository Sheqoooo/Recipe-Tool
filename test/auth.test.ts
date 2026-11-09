import { it,expect } from 'vitest';
import { generateKeyPair,SignJWT,exportJWK,createLocalJWKSet } from 'jose';
import { verifyIdentity } from '../src/worker/auth.js';
import type { Env } from '../src/shared/types.js';
const config:Env={APP_ENV:'production',AUTH_MODE:'access',ACCESS_ISSUER:'https://recipe-test.cloudflareaccess.com',ACCESS_AUD:'test-audience',ASSETS:{} as Fetcher};
it('vertraut einem E-Mail-Header ohne signiertes JWT nicht',async()=>{
  await expect(verifyIdentity(new Request('https://app.example/',{headers:{'Cf-Access-Authenticated-User-Email':'admin@example.invalid'}}),config)).rejects.toMatchObject({status:401});
});
it('prüft Signatur, Audience, Aussteller und Ablauf',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';
  const resolver=createLocalJWKSet({keys:[jwk]});
  async function token(aud='test-audience',iss=config.ACCESS_ISSUER!,exp=Math.floor(Date.now()/1000)+60){return new SignJWT({email:'member@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('subject').setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(privateKey);}
  async function request(value:string){return new Request('https://app.example/',{headers:{'Cf-Access-Jwt-Assertion':value}});}
  expect((await verifyIdentity(await request(await token()),config,resolver)).email).toBe('member@example.invalid');
  for(const invalid of [await token('wrong'),await token('test-audience','https://evil.example'),await token('test-audience',config.ACCESS_ISSUER!,1)])await expect(verifyIdentity(await request(invalid),config,resolver)).rejects.toMatchObject({status:401});
});
it('lokale Anmeldung ist auf die lokale Umgebung UND Loopback begrenzt',async()=>{
  await expect(verifyIdentity(new Request('https://public.example/'),{...config,AUTH_MODE:'local',APP_ENV:'local'})).rejects.toMatchObject({status:503});
  await expect(verifyIdentity(new Request('http://localhost/'),{...config,AUTH_MODE:'local',APP_ENV:'production'})).rejects.toMatchObject({status:503});
});
