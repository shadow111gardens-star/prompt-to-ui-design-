import { withProjectRoute, serverIdentity } from '@/lib/server/project-access';
import { ensureCreditAccount, accountLock } from '@/lib/billing/store';
import { encryptGatewayKey } from '@/lib/billing/crypto';
import { prisma } from '@/lib/db';
import { z } from 'zod';
const schema=z.object({key:z.string().trim().min(12).max(4096).regex(/^[!-~]+$/)}).strict();
export const PUT=withProjectRoute(async(request:Request)=>{try{const identity=await serverIdentity();await ensureCreditAccount(identity);const input=schema.parse(await request.json());await prisma.$transaction(async tx=>{const account=await accountLock(tx,identity.sub);if(account.plan!=='lifetime'||account.status!=='active')throw Error('Lifetime required');await tx.creditAccount.update({where:{uid:identity.sub},data:{gatewayKey:encryptGatewayKey(identity.sub,input.key)}});});return Response.json({configured:true});}catch{return Response.json({error:'An active Lifetime plan, valid Gateway key and server encryption configuration are required.'},{status:400});}});
export const DELETE=withProjectRoute(async()=>{const {sub}=await serverIdentity();await prisma.creditAccount.updateMany({where:{uid:sub},data:{gatewayKey:null}});return Response.json({configured:false});});
