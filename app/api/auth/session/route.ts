import { NextResponse } from 'next/server';
import { AUTH_COOKIE, EmailVerificationRequiredError, verifyFirebaseToken } from '@/lib/firebase/verify-token';

export const runtime='nodejs';
function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  try{
    if(Number(request.headers.get('content-length')||0)>20000)return NextResponse.json({error:'Request too large.'},{status:413});
    const {idToken}: {idToken?:unknown}=await request.json();
    if(typeof idToken!=='string')return NextResponse.json({error:'An authentication token is required.'},{status:400});
    const identity=await verifyFirebaseToken(idToken);
    const response=NextResponse.json({uid:identity.sub,plan:identity.plan},{headers:{'Cache-Control':'no-store'}});
    response.cookies.set(AUTH_COOKIE,idToken,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:Math.max(0,identity.exp-Math.floor(Date.now()/1000))});
    return response;
  }catch(error){
    const pending=error instanceof EmailVerificationRequiredError;
    const response=NextResponse.json({error:pending?'Verify your email address to continue.':'Unable to establish a secure session. Sign in again.',...(pending?{code:'EMAIL_VERIFICATION_REQUIRED'}:{})},{status:pending?403:401,headers:{'Cache-Control':'no-store'}});
    response.cookies.set(AUTH_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
    return response;
  }
}
export async function DELETE(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const response=NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(AUTH_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  return response;
}
