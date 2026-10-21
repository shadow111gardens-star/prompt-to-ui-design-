import { AUTH_COOKIE,verifyFirebaseToken,type FirebaseIdentity } from '@/lib/firebase/verify-token';
export function localByokTesting(request:Request){return process.env.NODE_ENV==='development'&&process.env.OPENUI_LOCAL_BYOK_TESTING==='true'&&['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);}
export async function personalProviderIdentity(request:Request):Promise<FirebaseIdentity>{
 const token=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(AUTH_COOKIE+'='))?.slice(AUTH_COOKIE.length+1);
 if(!token)throw new Error('Sign in to manage provider keys.');
 return verifyFirebaseToken(decodeURIComponent(token));
}
export function canUsePersonalProviders(identity:FirebaseIdentity,request:Request){return identity.plan==='lifetime'||localByokTesting(request);}
