import { assertTestBillingUser, assertBillingRequestOrigin, testUserAllowlist } from '@/lib/billing/test-access';
import { readGenerationBody } from '@/lib/ai/generation-request';
import { generationFingerprint } from '@/lib/ai/generation-guard';
import { candidateScreens, CreditError } from '@/lib/billing/policy';
import { fundingScope } from '@/lib/billing/scope';
import type { FirebaseIdentity } from '@/lib/firebase/verify-token';
import { randomUUID } from 'node:crypto';

export async function withBillingGeneration(request:Request,identity:FirebaseIdentity,handler:()=>Promise<Response>):Promise<Response>{
 try{assertBillingRequestOrigin(request);}catch(error){return Response.json({error:error instanceof CreditError?error.message:'Billing origin is unavailable.',code:'billing_unavailable'},{status:error instanceof CreditError?error.status:503});}
 if(process.env.OPENUI_PAYMENTS_ENABLED==='false'&&process.env.OPENUI_CREDITS_ENABLED==='false'){
  try{
   if(!testUserAllowlist().has(identity.sub))throw new CreditError('Generation is not available for this account.',403);
   const body=await readGenerationBody(request),projectId=body instanceof FormData?body.get('projectId'):body.projectId;
   if(typeof projectId!=='string'||!projectId)throw new CreditError('A project is required.',400);
   const {prisma}=await import('@/lib/db');const {decryptGatewayKey}=await import('@/lib/billing/crypto');
   const account=await prisma.creditAccount.findUnique({where:{uid:identity.sub},select:{plan:true,status:true,gatewayKey:true}});
   if(!account||account.plan!=='lifetime'||account.status!=='active'||!account.gatewayKey)throw new CreditError('Platform-funded generation is unavailable while billing is disabled. An active Lifetime plan and your own AI Gateway key are required.',403);
   if(!await prisma.project.findUnique({where:{id:projectId,ownerUid:identity.sub},select:{id:true}}))throw new CreditError('Project not found.',404);
   const envelope=account.gatewayKey;let gatewayKey:string;try{gatewayKey=decryptGatewayKey(identity.sub,envelope);}catch{throw new CreditError('Your AI Gateway key could not be unlocked. Check your key settings.',503);}
   if(!gatewayKey.trim())throw new CreditError('Your AI Gateway key is unavailable.',403);
   const beforeCall=async()=>{if(!testUserAllowlist().has(identity.sub))throw new CreditError('Generation is not available for this account.',403);const current=await prisma.creditAccount.findUnique({where:{uid:identity.sub},select:{plan:true,status:true,gatewayKey:true}});if(!current||current.plan!=='lifetime'||current.status!=='active'||current.gatewayKey!==envelope||!await prisma.project.findUnique({where:{id:projectId,ownerUid:identity.sub},select:{id:true}}))throw new CreditError('Your Gateway authorization has changed.',403);};
   return await fundingScope.run({uid:identity.sub,runId:randomUUID(),gatewayKey,calls:[],beforeCall},handler);
  }catch(error){return Response.json({error:error instanceof CreditError?error.message:'Your AI Gateway authorization is unavailable.',code:'byok_unavailable'},{status:error instanceof CreditError?error.status:503});}
 }
 // A restricted Test Mode rollout must never fall through to unfunded generation.
 try{assertTestBillingUser(identity.sub);}catch(error){return Response.json({error:error instanceof CreditError?error.message:'Billing is not ready.',code:'billing_unavailable'},{status:error instanceof CreditError?error.status:503});}
 const {reserveRun,reserveProviderCall,finishRun}=await import('@/lib/billing/store');
 let reserved:Awaited<ReturnType<typeof reserveRun>>|undefined;
 const calls:import('@/lib/billing/policy').BillingCall[]=[];
 try{
  const body=await readGenerationBody(request),value=(name:string)=>body instanceof FormData?body.get(name):body[name];
  const projectId=value('projectId'),rawId=request.headers.get('idempotency-key')||value('requestId')||value('streamId');
  if(typeof projectId!=='string'||typeof rawId!=='string'||!rawId||rawId.length>200)throw new CreditError('A stable generation request ID and project are required.',400);
  const route=new URL(request.url).pathname,fingerprint=await generationFingerprint(request),chat=value('mode')==='project-chat';
  // Existing screen IDs are sometimes reused as stream IDs. Fingerprint is part
  // of that legacy key; explicit Idempotency-Key reuse with changed input rejects.
  const requestId=request.headers.has('idempotency-key')?rawId:rawId+':'+fingerprint.slice(0,24);
  reserved=await reserveRun(identity,{requestId,fingerprint,projectId,workflowId:typeof value('workflowId')==='string'?String(value('workflowId')):rawId,route,chat,screen:!/\/(convert|style|theme)$/.test(route)});
  const {run,gatewayKey}=reserved;
  return await fundingScope.run({uid:identity.sub,runId:run.id,gatewayKey,calls,beforeCall:()=>reserveProviderCall(identity.sub,run.id)},async()=>{
   const response=await handler();
   if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream')){await finishRun(identity.sub,run.id,[],calls,!response.ok);return response;}
   const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='',text='',failed=false,finished=false,streamId=rawId;
   async function complete(cancelled=false){if(finished)return;finished=true;let candidates:ReturnType<typeof candidateScreens>=[];
    if(!failed&&!cancelled&&!/\/(convert|style|theme)$/.test(route))try{candidates=candidateScreens(text,chat);}catch{failed=true;}
    if(!chat&&!/\/(convert|style|theme)$/.test(route)&&!candidates.length)failed=true;
    await finishRun(identity.sub,run.id,candidates,calls,failed||cancelled);
   }
   function packet(message:string){let data:Record<string,unknown>;try{data=JSON.parse(message.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n'));}catch{return message+'\n\n';}
    if(typeof data.streamId==='string')streamId=data.streamId;
    if(data.type==='error')failed=true;
    if(data.type==='usage'){if(data.finishReason==='length'||data.finishReason==='error')failed=true;return 'data: '+JSON.stringify({type:'usage',streamId,finishReason:data.finishReason})+'\n\n';}
    if(typeof data.text==='string')text=data.type==='replace'?data.text:text+data.text;
    return message+'\n\n';
   }
   const stream=new ReadableStream<Uint8Array>({async pull(controller){try{const next=await reader.read();buffer+=next.done?decoder.decode():decoder.decode(next.value,{stream:true});let boundary:RegExpExecArray|null;while((boundary=/\r?\n\r?\n/.exec(buffer))){controller.enqueue(encoder.encode(packet(buffer.slice(0,boundary.index))));buffer=buffer.slice(boundary.index+boundary[0].length);}if(next.done){if(buffer.trim())controller.enqueue(encoder.encode(packet(buffer)));await complete();controller.enqueue(encoder.encode('data: '+JSON.stringify(failed?{type:'error',streamId,error:'The provider did not return a complete validated screen. No screen credits were charged.'}:{type:'billing',streamId,generationId:run.id})+'\n\n'));controller.close();}}catch{failed=true;try{await complete(true);}catch{}controller.enqueue(encoder.encode('data: '+JSON.stringify({type:'error',streamId,error:'Generation could not be finalized. No screen credits were charged. Check Billing before retrying.'})+'\n\n'));controller.close();}},async cancel(reason){try{await reader.cancel(reason);}finally{await complete(true);}}});
   const headers=new Headers(response.headers);headers.set('X-OpenUI-Billing-Generation',run.id);return new Response(stream,{status:response.status,headers});
  });
 }catch(error){
  if(reserved)try{await finishRun(identity.sub,reserved.run.id,[],calls,true);}catch{/* Keep uncertain reservations held; never resend a billed call. */}
  return Response.json({error:error instanceof CreditError?error.message:'Billing is not ready. Please contact support before retrying.',code:'billing_unavailable'},{status:error instanceof CreditError?error.status:503});
 }
}
