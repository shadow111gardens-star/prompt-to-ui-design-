import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, EmailVerificationRequiredError, verifyFirebaseToken } from '@/lib/firebase/verify-token';

export async function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  // Dodo authenticates server-to-server callbacks using the route's signature check.
  // It cannot supply a Firebase session cookie or browser Origin header.
  if(path==='/api/auth/session'||path==='/api/integration/projects'||path==='/api/billing/dodo-webhook')return NextResponse.next();
  const token=request.cookies.get(AUTH_COOKIE)?.value;
  try{
    if(!token)throw new Error('Missing session');
    const identity=await verifyFirebaseToken(token);
    if(path==='/api/workspace-key'&&identity.plan!=='lifetime')return NextResponse.json({error:'AI Preferences requires the Lifetime plan.'},{status:403,headers:{'Cache-Control':'no-store'}});
    if(path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
    return NextResponse.next();
  }catch(error){
    const pending=error instanceof EmailVerificationRequiredError;
    if(path.startsWith('/api/')){
      const response=NextResponse.json({error:pending?'Verify your email address to continue.':'Sign in to continue.',...(pending?{code:'EMAIL_VERIFICATION_REQUIRED'}:{})},{status:pending?403:401,headers:{'Cache-Control':'no-store'}});
      response.cookies.set(AUTH_COOKIE,'',{path:'/',maxAge:0});return response;
    }
    const target=new URL(pending?'/verify-email':'/sign-in',request.url);
    target.searchParams.set('next',request.nextUrl.pathname+request.nextUrl.search);
    const response=NextResponse.redirect(target);response.cookies.set(AUTH_COOKIE,'',{path:'/',maxAge:0});return response;
  }
}
export const config={matcher:['/dashboard/:path*','/api/:path*']};
