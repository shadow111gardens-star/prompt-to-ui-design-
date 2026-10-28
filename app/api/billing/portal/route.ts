import { paymentsEnabled } from '@/lib/billing/feature-flags';
import { withProjectRoute, serverIdentity } from '@/lib/server/project-access';
import { prisma } from '@/lib/db';
import { dodoRequest } from '@/lib/billing/dodo';
export const POST=withProjectRoute(async()=>{if(!paymentsEnabled())return Response.json({error:'Payments are disabled for testing.'},{status:503});try{const {sub}=await serverIdentity();const account=await prisma.creditAccount.findUnique({where:{uid:sub}});if(!account?.customerId)return Response.json({error:'No billing customer is connected.'},{status:404});const result=await dodoRequest('/customers/'+encodeURIComponent(account.customerId)+'/customer-portal/session?send_email=false','POST');if(typeof result.link!=='string'||new URL(result.link).protocol!=='https:')throw Error('Invalid portal');return Response.json({url:result.link});}catch{return Response.json({error:'Billing portal could not be opened. Please contact support.'},{status:503});}});
