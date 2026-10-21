import { withGeneratedImages } from '@/lib/images/generation-pipeline';
import { NextResponse } from 'next/server';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';
import { personalProviderIdentity,canUsePersonalProviders } from '@/lib/ai/personal-provider-auth';
import { personalProviderStore } from '@/lib/ai/personal-provider-store';
export function withPersonalProvider<T extends Request>(handler:(request:T)=>Promise<Response>){return async(request:T):Promise<Response>=>{
 let identity;try{identity=await personalProviderIdentity(request);}catch{return NextResponse.json({error:'Sign in to continue.'},{status:401});}
 const run=()=>withGeneratedImages(request,identity.sub,()=>handler(request));
 if(!canUsePersonalProviders(identity,request))return run();
 let settings;try{settings=await personalProviderStore.read(identity.sub);}
 catch{return NextResponse.json({error:'Unable to load your saved provider configuration. Check the server encryption configuration.'},{status:500});}
 return personalProviderContext.run({uid:identity.sub,settings},()=>run());
};}
