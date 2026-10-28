import { paymentsEnabled } from '@/lib/billing/feature-flags';
import { PLAN_CONFIG } from '@/lib/billing/plan-config';
import { withProjectRoute, serverIdentity } from '@/lib/server/project-access';
import { ensureCreditAccount, publicUsage } from '@/lib/billing/store';
export const GET=withProjectRoute(async()=>{const identity=await serverIdentity();if(!paymentsEnabled())return Response.json({disabled:true,plan:'testing',status:'disabled',funding:null,plans:[]});await ensureCreditAccount(identity);return Response.json({...await publicUsage(identity.sub),plans:Object.entries(PLAN_CONFIG).map(([id,plan])=>({id,name:id==='plus'?'Plus':id==='pro'?'Pro':'Lifetime',priceCents:plan.priceCents,cadence:plan.cadence,...('allocation' in plan?{allocation:plan.allocation,screenLimit:plan.generationLimit}:{})}))},{headers:{'Cache-Control':'no-store'}});});
