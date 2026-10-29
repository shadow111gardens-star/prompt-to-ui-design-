import { assertTestBillingUser, assertBillingRequestOrigin, configuredBillingOrigin } from '@/lib/billing/test-access';
import { paymentsEnabled } from '@/lib/billing/feature-flags';
import { periodSpendLimitMicroUsd } from '@/lib/billing/plan-config';
import { withProjectRoute, serverIdentity } from '@/lib/server/project-access';
import { ensureCreditAccount, accountLock } from '@/lib/billing/store';
import { dodoRequest, dodoProducts, assertDodoProduct } from '@/lib/billing/dodo';
import { prisma } from '@/lib/db';
import { CreditError } from '@/lib/billing/policy';
import { z } from 'zod';
const schema=z.object({plan:z.enum(['plus','pro','lifetime'])}).strict();
export const POST=withProjectRoute(async(request:Request)=>{if(!paymentsEnabled())return Response.json({error:'Payments are disabled for testing.'},{status:503});try{
 const identity=await serverIdentity(),{plan}=schema.parse(await request.json());assertTestBillingUser(identity.sub);assertBillingRequestOrigin(request);let account=await ensureCreditAccount(identity);
 if(account.plan==='lifetime'&&account.status==='active')throw new CreditError('Your Lifetime entitlement is already active.',409);
 if(account.subscriptionId&&(account.status==='active'||plan!=='lifetime'))throw new CreditError('Manage your existing subscription or contact support before purchasing another monthly plan.',409);
 if(plan!=='lifetime')periodSpendLimitMicroUsd(plan);
 const product=await dodoRequest('/products/'+encodeURIComponent(dodoProducts()[plan]));assertDodoProduct(plan,product);
 const origin=configuredBillingOrigin();
 if(!account.customerId){if(!identity.email)throw new CreditError('A verified account email is required.',400);const customer=await dodoRequest('/customers','POST',{email:identity.email,name:identity.email.split('@')[0]});if(typeof customer.customer_id!=='string')throw new CreditError('Payment customer setup failed.',503);
  account=await prisma.$transaction(async tx=>{const current=await accountLock(tx,identity.sub);return current.customerId?current:tx.creditAccount.update({where:{uid:identity.sub},data:{customerId:customer.customer_id as string}});});
 }
 const session=await dodoRequest('/checkouts','POST',{product_cart:[{product_id:dodoProducts()[plan],quantity:1}],customer:{customer_id:account.customerId},metadata:{firebase_uid:identity.sub},return_url:new URL('/dashboard/workspace/settings',origin).href,billing_currency:'USD',feature_flags:{allow_discount_code:false,allow_customer_editing_email:false,allow_currency_selection:false}});
 if(typeof session.checkout_url!=='string'||new URL(session.checkout_url).protocol!=='https:')throw new CreditError('Checkout could not be created.',503);
 return Response.json({url:session.checkout_url});
}catch(error){return Response.json({error:error instanceof CreditError?error.message:'Checkout could not be started. Check your billing configuration.'},{status:error instanceof CreditError?error.status:400});}});
