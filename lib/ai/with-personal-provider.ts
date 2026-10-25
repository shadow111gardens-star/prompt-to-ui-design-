import { withGeneratedImages } from '@/lib/images/generation-pipeline';
import { NextResponse } from 'next/server';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';
import { personalProviderIdentity,canUsePersonalProviders } from '@/lib/ai/personal-provider-auth';
import { personalProviderStore } from '@/lib/ai/personal-provider-store';
import { withVerifiedIdentity, requireOwnedProject, projectAccessResponse } from '@/lib/server/project-access';
import { withGenerationUsage } from '@/lib/ai/usage-logging';
export function withPersonalProvider<T extends Request>(handler:(request:T)=>Promise<Response>){return async(request:T):Promise<Response>=>{
 let identity;try{identity=await personalProviderIdentity(request);}catch{return NextResponse.json({error:'Sign in to continue.'},{status:401});}
 if(!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
 return withVerifiedIdentity(identity,async()=>{
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/generate')||url.pathname==='/api/models/select'){
  let projectId:unknown;
  try{
   if(request.method==='GET')projectId=url.searchParams.get('projectId');
   else if(request.headers.get('content-type')?.includes('multipart/form-data'))projectId=(await request.clone().formData()).get('projectId');
   else projectId=(await request.clone().json()).projectId;
  }catch{return NextResponse.json({error:'Invalid project request.'},{status:400});}
  if(typeof projectId!=='string'||!projectId)return NextResponse.json({error:'A project ID is required.'},{status:400});
  try{await requireOwnedProject(projectId);}catch(error){const denied=projectAccessResponse(error);if(denied)return denied;throw error;}
 }
 const run=()=>withGenerationUsage(request,()=>withGeneratedImages(request,identity.sub,()=>handler(request)));
 if(!canUsePersonalProviders(identity,request))return run();
 let settings;try{settings=await personalProviderStore.read(identity.sub);}
 catch{return NextResponse.json({error:'Unable to load your saved provider configuration. Check the server encryption configuration.'},{status:500});}
 return personalProviderContext.run({uid:identity.sub,settings},()=>run());
 });
};}
