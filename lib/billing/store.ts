import { assertTestBillingUser } from '@/lib/billing/test-access';
import { SCREEN_CREDIT_COST } from '@/lib/billing/plan-catalog';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { FirebaseIdentity } from '@/lib/firebase/verify-token';
import { PLAN_CONFIG, isMonthlyPlan } from '@/lib/billing/plan-config';
import { CreditError, maximumCallCost, reconciledCost, htmlDigest, observedCost, rateSchedule, type BillingCall, type Candidate } from '@/lib/billing/policy';
import { decryptGatewayKey } from '@/lib/billing/crypto';
const zero=BigInt(0);
export type BillingTx=Prisma.TransactionClient;
export async function accountLock(tx:BillingTx,uid:string){await tx.$queryRaw`SELECT "uid" FROM "CreditAccount" WHERE "uid" = ${uid} FOR UPDATE`;const account=await tx.creditAccount.findUnique({where:{uid}});if(!account)throw new CreditError('Billing account is not configured.',403);return account;}
export async function ensureCreditAccount(identity:FirebaseIdentity){assertTestBillingUser(identity.sub);return prisma.creditAccount.upsert({where:{uid:identity.sub},update:{},create:{uid:identity.sub,plan:identity.plan==='lifetime'?'lifetime':'local',status:identity.plan==='lifetime'?'active':'inactive'}});}
async function releaseExpiredScreens(tx:BillingTx,uid:string){
 const old=await tx.generationRun.findMany({where:{uid,status:{in:['running','ready']},updatedAt:{lt:new Date(Date.now()-3600000)},reservedScreens:{gt:0}}});
 for(const run of old){
  await tx.creditAccount.update({where:{uid},data:{reservedCredits:{decrement:run.reservedScreens*SCREEN_CREDIT_COST}}});
  if(run.periodId)await tx.creditPeriod.update({where:{id:run.periodId},data:{reservedScreens:{decrement:run.reservedScreens}}});
  await tx.screenGeneration.updateMany({where:{runId:run.id,uid,status:'ready'},data:{status:'discarded'}});
  // Unknown provider cost stays reserved even after screen slots expire.
  await tx.generationRun.update({where:{id:run.id},data:{status:'abandoned',reservedScreens:0}});
 }
}
export async function reserveRun(identity:FirebaseIdentity,input:{requestId:string;fingerprint:string;projectId:string;workflowId:string;route:string;chat:boolean;screen:boolean}){
 await ensureCreditAccount(identity);
 return prisma.$transaction(async tx=>{
  await accountLock(tx,identity.sub);await releaseExpiredScreens(tx,identity.sub);const account=await accountLock(tx,identity.sub);
  const old=await tx.generationRun.findUnique({where:{uid_requestId:{uid:identity.sub,requestId:input.requestId}}});
  if(old)throw new CreditError(old.fingerprint===input.fingerprint?'This generation request has already been received. Use its saved result or a new request ID.':'Request ID was already used for different content.',409);
  if(!await tx.project.findUnique({where:{id:input.projectId,ownerUid:identity.sub},select:{id:true}}))throw new CreditError('Project not found.',404);
  if(account.plan==='lifetime'&&account.status==='active'){
   if(!account.gatewayKey)throw new CreditError('Add your own Vercel AI Gateway key in AI Preferences before generating.',403);
   const gatewayKey=decryptGatewayKey(identity.sub,account.gatewayKey);
   const run=await tx.generationRun.create({data:{uid:identity.sub,requestId:input.requestId,fingerprint:input.fingerprint,projectId:input.projectId,workflowId:input.workflowId,route:input.route,funding:'gateway_byok'}});
   return {run,gatewayKey};
  }
  if(!isMonthlyPlan(account.plan)||account.status!=='active'||!account.currentPeriodId)throw new CreditError('An active Plus or Pro subscription is required. Open Billing to subscribe.',403);
  const period=await tx.creditPeriod.findUnique({where:{id:account.currentPeriodId}});
  if(!period||period.uid!==identity.sub||period.startsAt>new Date()||period.endsAt<=new Date())throw new CreditError('Your billing period needs a verified renewal. Open Billing or contact support.',403);
  if(period.spentMicros+period.reservedSpendMicros+maximumCallCost()>period.spendLimitMicros)throw new CreditError('Your AI spending allowance is reached or reserved. Upgrade or wait for the next billing period.');
  const screenLimit=Math.min(period.screenLimit,PLAN_CONFIG[account.plan].generationLimit);
  const remainingScreens=screenLimit-period.successfulScreens-period.reservedScreens;
  if(input.screen&&remainingScreens<1)throw new CreditError(`Your ${account.plan==='plus'?'Plus':'Pro'} billing-period screen allowance limit is reached or reserved across all projects. Wait for the next verified billing period or release pending screens.`);
  const available=Math.min(Math.floor((account.balance-account.reservedCredits)/SCREEN_CREDIT_COST),remainingScreens);
  const slots=input.screen?(input.chat?Math.min(20,available):1):0;
  if(input.screen&&(available<1||slots<1))throw new CreditError('Your available credits or screen-generation allowance is exhausted or reserved.');
  await tx.creditAccount.update({where:{uid:identity.sub},data:{reservedCredits:{increment:slots*SCREEN_CREDIT_COST}}});
  await tx.creditPeriod.update({where:{id:period.id},data:{reservedScreens:{increment:slots}}});
  const run=await tx.generationRun.create({data:{uid:identity.sub,requestId:input.requestId,fingerprint:input.fingerprint,projectId:input.projectId,workflowId:input.workflowId,route:input.route,funding:'platform',periodId:period.id,reservedScreens:slots}});
  return {run,gatewayKey:undefined};
 });
}
export async function reserveProviderCall(uid:string,id:string){
 assertTestBillingUser(uid);
 return prisma.$transaction(async tx=>{
  const account=await accountLock(tx,uid);if(account.status!=='active')throw new CreditError('Your subscription is not active.',403);const run=await tx.generationRun.findFirst({where:{id,uid,status:'running'}});if(!run)throw new CreditError('Generation reservation is unavailable.',409);
  if(run.funding==='gateway_byok'){if(account.plan!=='lifetime')throw new CreditError('Lifetime entitlement is required.',403);return;}
  const period=await tx.creditPeriod.findUnique({where:{id:run.periodId!}}),cost=maximumCallCost();
  if(!period||period.endsAt<=new Date()||period.spentMicros+period.reservedSpendMicros+cost>period.spendLimitMicros)throw new CreditError('Your AI spending allowance is reached or reserved. Upgrade or wait for renewal.');
  await tx.creditPeriod.update({where:{id:period.id},data:{reservedSpendMicros:{increment:cost}}});
  await tx.generationRun.update({where:{id},data:{reservedCostMicros:{increment:cost}}});
 });
}
export async function finishRun(uid:string,id:string,candidates:Candidate[],calls:BillingCall[],failed:boolean){
 assertTestBillingUser(uid);
 await prisma.$transaction(async tx=>{
  const account=await accountLock(tx,uid),run=await tx.generationRun.findFirst({where:{id,uid}});if(!run||run.status!=='running')return;
  const billable=run.funding==='platform',accepted=failed?[]:candidates;
  if(billable&&accepted.length>run.reservedScreens)throw new CreditError('The result exceeded the reserved screen allowance.',409);
  const cost=reconciledCost(calls,run.reservedCostMicros);
  if(billable&&cost.spent>run.reservedCostMicros)throw new CreditError('Provider cost exceeded the configured reservation. Generation is held for reconciliation.',503);
  if(billable){
   await tx.creditAccount.update({where:{uid},data:{reservedCredits:{decrement:(run.reservedScreens-accepted.length)*SCREEN_CREDIT_COST}}});
   await tx.creditPeriod.update({where:{id:run.periodId!},data:{reservedScreens:{decrement:run.reservedScreens-accepted.length},reservedSpendMicros:{decrement:cost.known?run.reservedCostMicros:zero},spentMicros:{increment:cost.spent}}});
  }
  function sum(key:'inputTokens'|'outputTokens'|'totalTokens'){const values=calls.filter(c=>c.sent!==false).map(c=>c.usage[key]);return values.length&&values.every(v=>v!==null)?values.reduce<number>((n,v)=>n+(v??0),0):null;}
  await tx.generationRun.update({where:{id},data:{status:failed?'failed':accepted.length?'ready':'completed',reservedScreens:billable?accepted.length:0,costMicros:billable&&cost.known?cost.spent:null,usageJson:JSON.stringify(calls.map(call=>({...call,rateSource:'https://ai.google.dev/gemini-api/docs/pricing',rates:call.provider==='google'?rateSchedule():null,estimatedCostMicros:call.provider==='google'&&call.model==='gemini-3.5-flash-lite'?observedCost(call.usage).micros?.toString()??null:null}))),inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),completedAt:new Date()}});
  for(const candidate of accepted)await tx.screenGeneration.create({data:{uid,runId:id,projectId:run.projectId,workflowId:run.workflowId,screenKey:candidate.key,html:candidate.html,digest:htmlDigest(candidate.html),inputTokens:accepted.length===1?sum('inputTokens'):null,outputTokens:accepted.length===1?sum('outputTokens'):null,costMicros:billable&&accepted.length===1&&cost.known?cost.spent:null}});
 });
}
export function canvasScreens(data:unknown):Array<{id:string;html:string}>{
 if(!data||typeof data!=='object')return [];const state=data as {shapes?:{entities?:Record<string,unknown>}};return Object.entries(state.shapes?.entities||{}).flatMap(([id,row])=>{const s=row as {type?:string;uiSpecData?:unknown;isGenerating?:boolean};return s?.type==='generatedui'&&typeof s.uiSpecData==='string'&&!s.isGenerating?[{id,html:s.uiSpecData}]:[];});
}
/** Canvas persistence and per-screen charges share one DB transaction. No client balances/counts are trusted. */
export async function persistBilledCanvas(uid:string,projectId:string,shapesData:unknown,viewportData:unknown){
 assertTestBillingUser(uid);
 return prisma.$transaction(async tx=>{
  const account=await accountLock(tx,uid);const project=await tx.project.findUnique({where:{id:projectId,ownerUid:uid}});if(!project)throw new CreditError('Project not found.',404);
  let previous:unknown;try{previous=JSON.parse(project.sketchesData);}catch{previous={};}
  const old=new Map(canvasScreens(previous).map(s=>[s.id,htmlDigest(s.html)]));
  const pending=await tx.screenGeneration.findMany({where:{uid,projectId,status:'ready'},include:{run:true},orderBy:{createdAt:'asc'}});
  const used=new Set<string>(),receipts:Array<{id:string;credits:number}>=[];let charged=0,accepted=0;
  for(const screen of canvasScreens(shapesData)){
   const digest=htmlDigest(screen.html);if(old.get(screen.id)===digest)continue;
   const candidate=pending.find(row=>!used.has(row.id)&&row.digest===digest);if(!candidate){if(pending.some(row=>!used.has(row.id)))throw new CreditError('Save the completed generated screens before editing their HTML. A pending result must match its validated output.',409);const expired=await tx.screenGeneration.findFirst({where:{uid,projectId,digest,status:'discarded'}});if(expired)throw new CreditError('The screen reservation expired. Regenerate it before accepting.',409);continue;}used.add(candidate.id);
   const billed=candidate.run.funding==='platform';if(billed){
    if(account.balance-charged<SCREEN_CREDIT_COST||candidate.run.reservedScreens<1)throw new CreditError('This screen no longer has a valid credit reservation.',409);
    const period=await tx.creditPeriod.findUnique({where:{id:candidate.run.periodId!}});
    if(!period||period.uid!==uid||account.currentPeriodId!==period.id||period.endsAt<=new Date())throw new CreditError('This screen belongs to an expired billing period. Regenerate it in the current period.',409);
    await tx.creditPeriod.update({where:{id:candidate.run.periodId!},data:{reservedScreens:{decrement:1},successfulScreens:{increment:1},creditsUsed:{increment:SCREEN_CREDIT_COST}}});
    await tx.generationRun.update({where:{id:candidate.runId},data:{reservedScreens:{decrement:1}}});
    charged+=SCREEN_CREDIT_COST;receipts.push({id:candidate.id,credits:SCREEN_CREDIT_COST});await tx.creditEntry.create({data:{uid,periodId:candidate.run.periodId,runId:candidate.runId,screenId:candidate.id,type:'deduction',amount:-SCREEN_CREDIT_COST,balanceAfter:account.balance-charged,eventKey:'screen:'+candidate.id}});
   }
   await tx.screenGeneration.update({where:{id:candidate.id},data:{status:'accepted',screenId:screen.id,acceptedAt:new Date(),creditsCharged:billed?SCREEN_CREDIT_COST:0}});accepted++;
  }
  if(charged)await tx.creditAccount.update({where:{uid},data:{balance:{decrement:charged},reservedCredits:{decrement:charged}}});
  await tx.project.update({where:{id:projectId,ownerUid:uid},data:{sketchesData:JSON.stringify(shapesData),viewportData:viewportData?JSON.stringify(viewportData):undefined}});
  return {charged,accepted,receipts,messages:Array.from({length:charged/SCREEN_CREDIT_COST},()=> '15 credits used.')};
 });
}
export async function publicUsage(uid:string){
 const account=await prisma.creditAccount.findUnique({where:{uid}});if(!account)return {plan:'local',status:'inactive',funding:null};
 if(account.plan==='lifetime')return {plan:'lifetime',status:account.status,funding:'gateway_byok',gatewayConfigured:!!account.gatewayKey};
 const period=account.currentPeriodId?await prisma.creditPeriod.findFirst({where:{id:account.currentPeriodId,uid}}):null;
 const screenLimit=period&&isMonthlyPlan(account.plan)?Math.min(period.screenLimit,PLAN_CONFIG[account.plan].generationLimit):0;
 return {plan:account.plan,status:account.status,funding:'platform',creditsRemaining:account.balance,creditsReserved:account.reservedCredits,creditsUsed:period?.creditsUsed??0,allocation:period?.allocation??0,successfulScreens:period?.successfulScreens??0,screenLimit,screensRemaining:Math.max(0,screenLimit-(period?.successfulScreens??0)),screensReserved:period?.reservedScreens??0,periodStart:period?.startsAt.toISOString()??null,resetAt:period?.endsAt.toISOString()??null};
}
