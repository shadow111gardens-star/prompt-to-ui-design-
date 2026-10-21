import { NextResponse } from 'next/server';
import { z } from 'zod';
import { personalProviderIdentity,canUsePersonalProviders } from '@/lib/ai/personal-provider-auth';
import { personalProviderStore } from '@/lib/ai/personal-provider-store';
import { discoverPersonalModels } from '@/lib/ai/personal-provider-discovery';
import { personalProviders,publicSettings } from '@/lib/ai/personal-provider-types';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const schema=z.object({provider:z.enum(personalProviders),apiKey:z.string().trim().min(12).max(4096).regex(/^[!-~]+$/).optional(),model:z.string().max(200).optional(),active:z.boolean().optional()}).strict();
const testing=new Set<string>();const tested=new Map<string,number>();
async function access(request:Request){
 let identity;try{identity=await personalProviderIdentity(request);}catch{return NextResponse.json({error:'Sign in to manage provider keys.'},{status:401,headers});}
 if(!canUsePersonalProviders(identity,request))return NextResponse.json({error:'Provider keys require the Lifetime plan.'},{status:403,headers});
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});
 return identity;
}
async function body(request:Request){const text=await request.text();if(text.length>12000)throw new Error('Request too large.');return schema.parse(JSON.parse(text));}
function failure(){return NextResponse.json({error:'Unable to update provider settings. Check your input and server encryption configuration.'},{status:400,headers});}
export async function GET(request:Request){const identity=await access(request);if(identity instanceof Response)return identity;try{return NextResponse.json(publicSettings(await personalProviderStore.read(identity.sub)),{headers});}catch{return failure();}}
export async function PUT(request:Request){
 const identity=await access(request);if(identity instanceof Response)return identity;
 try{const input=await body(request);const settings=await personalProviderStore.update(identity.sub,state=>{
  const previous=state.providers[input.provider];const key=input.apiKey||previous?.key;if(!key)throw new Error('API key required.');
  const changed=!!input.apiKey&&input.apiKey!==previous?.key;
  const models=changed?[]:previous?.models||[];
  const model=input.model??(changed?'':previous?.model||'');if(model&&!models.some(item=>item.id===model))throw new Error('Test the connection before selecting a model.');
  state.providers[input.provider]={key,model,models,testedAt:changed?undefined:previous?.testedAt};
  if(changed&&state.active===input.provider)delete state.active;
  if(input.active){if(!model)throw new Error('Select a tested model first.');state.active=input.provider;}
 });return NextResponse.json(publicSettings(settings),{headers});}catch{return failure();}
}
export async function DELETE(request:Request){const identity=await access(request);if(identity instanceof Response)return identity;try{const {provider}=await body(request);const settings=await personalProviderStore.update(identity.sub,state=>{delete state.providers[provider];if(state.active===provider)state.active=undefined;});return NextResponse.json(publicSettings(settings),{headers});}catch{return failure();}}
export async function POST(request:Request){
 const identity=await access(request);if(identity instanceof Response)return identity;
 let marker='',ownsLock=false;try{
  const input=await body(request);const original=(await personalProviderStore.read(identity.sub)).providers[input.provider];const key=input.apiKey||original?.key;if(!key)return NextResponse.json({error:'Save or enter an API key first.'},{status:400,headers});
  marker=identity.sub+':'+input.provider;
  if(testing.has(marker)||Date.now()-(tested.get(marker)||0)<3000)return NextResponse.json({error:'Please wait a few seconds before testing again.'},{status:429,headers});
  testing.add(marker);ownsLock=true;tested.set(marker,Date.now());
  let models;try{models=await discoverPersonalModels(input.provider,key);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Connection test failed.'},{status:400,headers});}
  const settings=await personalProviderStore.update(identity.sub,state=>{
   const current=state.providers[input.provider];if(!current||current.key!==key)throw new Error('Save this key before testing it.');
   current.models=models;current.testedAt=new Date().toISOString();if(!models.some(item=>item.id===current.model))current.model=models[0].id;if(!state.active)state.active=input.provider;
  });return NextResponse.json({...publicSettings(settings),message:'Connection verified. Available models loaded.'},{headers});
 }catch{return failure();}finally{if(ownsLock)testing.delete(marker);}
}
