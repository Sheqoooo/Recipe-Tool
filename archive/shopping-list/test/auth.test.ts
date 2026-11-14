import { it,expect } from 'vitest';
import { generateKeyPair,SignJWT,exportJWK,createLocalJWKSet } from 'jose';
import { verifyIdentity } from '../src/worker/auth.js';
import type { Env } from '../src/worker/env.js';
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
it('ein fremder Signaturschlüssel mit passender Audience wird abgewiesen',async()=>{
  const expected=await generateKeyPair('RS256'),attacker=await generateKeyPair('RS256');const jwk=await exportJWK(expected.publicKey);jwk.kid='expected';
  const token=await new SignJWT({email:'admin@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'expected'}).setSubject('subject').setIssuer(config.ACCESS_ISSUER!).setAudience(config.ACCESS_AUD!).setIssuedAt().setExpirationTime('1h').sign(attacker.privateKey);
  await expect(verifyIdentity(new Request('https://app.example/',{headers:{'Cf-Access-Jwt-Assertion':token}}),config,createLocalJWKSet({keys:[jwk]}))).rejects.toMatchObject({status:401});
});

it('respektiert einmonatige Access-Sitzungen und weist ungültige Zeitangaben weiterhin ab',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='month';
  const resolver=createLocalJWKSet({keys:[jwk]}),now=Math.floor(Date.now()/1000),day=86400;
  const check=async(iat:number,exp:number,nbf?:number)=>{
    const jwt=new SignJWT({email:'member@example.invalid',...(nbf===undefined?{}:{nbf})}).setProtectedHeader({alg:'RS256',kid:'month'}).setSubject('subject').setIssuer(config.ACCESS_ISSUER!).setAudience(config.ACCESS_AUD!).setIssuedAt(iat).setExpirationTime(exp);
    const token=await jwt.sign(privateKey);
    return verifyIdentity(new Request('https://app.example/',{headers:{'Cf-Access-Jwt-Assertion':token}}),config,resolver);
  };
  expect((await check(now-29*day,now+day)).email).toBe('member@example.invalid');
  await expect(check(now-30*day,now-10)).rejects.toMatchObject({status:401});
  await expect(check(now+60,now+day)).rejects.toMatchObject({status:401});
  await expect(check(now,now+day,now+60)).rejects.toMatchObject({status:401});
  await expect(check(now,now-1)).rejects.toMatchObject({status:401});
});
