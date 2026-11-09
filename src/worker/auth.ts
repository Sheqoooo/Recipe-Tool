import type { Env } from "./env.js";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type {  Member } from '../shared/types.js';
import { AppError } from '../shared/errors.js';
import { Repository } from './db.js';

const keys=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export interface Identity { email:string; sub:string }
export function localRequest(request:Request,env:Env):boolean {
  return env.APP_ENV==='local' && env.AUTH_MODE==='local' && ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
}
export async function verifyIdentity(request:Request,env:Env,resolver?:JWTVerifyGetKey):Promise<Identity> {
  if(localRequest(request,env))return {email:'local-admin@example.invalid',sub:'local-development-only'};
  const issuer=env.ACCESS_ISSUER?.replace(/\/$/,'');
  if(env.AUTH_MODE!=='access'||!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!env.ACCESS_AUD) {
    throw new AppError('ACCESS_CONFIGURATION','Cloudflare Access ist noch nicht vollständig eingerichtet.',503);
  }
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token||token.length>16000)throw new AppError('UNAUTHENTICATED','Bitte über Cloudflare Access anmelden.',401);
  try {
    if(!keys.has(issuer))keys.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000}));
    const {payload}=await jwtVerify(token,resolver||keys.get(issuer)!,{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],maxTokenAge:86400,clockTolerance:5});
    if(typeof payload.email!=='string'||!/^\S+@\S+\.\S+$/.test(payload.email)||typeof payload.sub!=='string')throw new Error('identity');
    return {email:payload.email.toLowerCase(),sub:payload.sub};
  }catch{throw new AppError('UNAUTHENTICATED','Die Access-Anmeldung ist ungültig oder abgelaufen.',401);}
}
export async function authenticate(request:Request,env:Env,repo:Repository):Promise<Member> {
  const identity=await verifyIdentity(request,env);
  const bootstrap=localRequest(request,env)?[identity.email]:(env.BOOTSTRAP_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return repo.admit(identity.email,identity.sub,bootstrap);
}
