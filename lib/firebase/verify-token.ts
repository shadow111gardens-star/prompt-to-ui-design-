import { accountPlan, type AccountPlan } from '@/lib/account-plan';
import { createPublicKey, verify } from 'node:crypto';

export class EmailVerificationRequiredError extends Error { constructor(){super('Verify your email address to continue.');this.name='EmailVerificationRequiredError';} }

export type FirebaseIdentity = { sub: string; exp: number; email?: string; plan:AccountPlan };
const certificateUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cached: { keys: Record<string,string>; expires: number } | undefined;
let inflight: Promise<Record<string,string>> | undefined;
async function certificates(): Promise<Record<string,string>> {
  if (cached && cached.expires > Date.now()) return cached.keys;
  if (inflight) return inflight;
  inflight = (async()=>{
    const response = await fetch(certificateUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Authentication verification is temporarily unavailable.');
    const keys: unknown = await response.json();
    if (!keys || typeof keys !== 'object' || Array.isArray(keys) || !Object.values(keys).every(value=>typeof value==='string')) throw new Error('Invalid signing certificates.');
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
    cached = { keys: keys as Record<string,string>, expires: Date.now() + Math.min(maxAge,21600)*1000 };
    return cached.keys;
  })();
  try { return await inflight; } finally { inflight = undefined; }
}
// Verify Firebase's signature and mandatory claims; never trust decoded claims alone.
export async function verifyFirebaseToken(token: string, options?: { projectId: string; keys: Record<string,string>; now?: number }): Promise<FirebaseIdentity> {
  const projectId = options?.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || typeof token !== 'string' || token.length>16000) throw new Error('Invalid authentication token.');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part=>!part || !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid authentication token.');
  const header = JSON.parse(Buffer.from(parts[0],'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1],'base64url').toString());
  const now = options?.now ?? Math.floor(Date.now()/1000);
  if (!header || header.alg!=='RS256' || typeof header.kid!=='string' || !claims || claims.aud!==projectId || claims.iss!==`https://securetoken.google.com/${projectId}` || typeof claims.sub!=='string' || !claims.sub || claims.sub.length>128 || typeof claims.exp!=='number' || !Number.isFinite(claims.exp) || claims.exp<=now || typeof claims.iat!=='number' || !Number.isFinite(claims.iat) || claims.iat>now || typeof claims.auth_time!=='number' || !Number.isFinite(claims.auth_time) || claims.auth_time>now) throw new Error('Invalid or expired authentication token.');
  const keys = options?.keys || await certificates();
  if (!Object.hasOwn(keys,header.kid)) throw new Error('Unrecognized authentication signature.');
  const publicKey = createPublicKey(keys[header.kid]);
  if (!verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),publicKey,Buffer.from(parts[2],'base64url'))) throw new Error('Invalid authentication signature.');
  if(claims.firebase?.sign_in_provider==='password' && claims.email_verified!==true)throw new EmailVerificationRequiredError();
  return {sub:claims.sub,exp:claims.exp,plan:accountPlan(claims.plan),email:typeof claims.email==='string'?claims.email:undefined};
}
export const AUTH_COOKIE = 'openui_firebase_session';
