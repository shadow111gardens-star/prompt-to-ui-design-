import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { accountLock } from '@/lib/billing/store';
import { PLAN_CONFIG, periodSpendLimitMicroUsd, type PaidPlan } from '@/lib/billing/plan-config';
import { CreditError } from '@/lib/billing/policy';
import { assertTestBillingConfigured, assertTestBillingUser } from '@/lib/billing/test-access';

export const dodoObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
/** Prices are server-owned minor units. Never coerce missing/NaN amounts into payment proof. */
export function paidAmountMatches(payment:Record<string,unknown>,minimum:number){
 const total=payment.total_amount,tax=payment.tax,discounts=payment.discounts;
 // Dodo reports customer total inclusive of tax in payment currency. Require
 // Null/absent tax can only reconcile as zero when the total is exactly the plan price.
 // An omitted discounts field is ambiguous: a discount could be masked by other adjustments.
 const reconciledTax=tax==null?0:tax;
 return payment.status==='succeeded'&&payment.currency==='USD'&&typeof total==='number'&&Number.isSafeInteger(total)&&
  typeof reconciledTax==='number'&&Number.isSafeInteger(reconciledTax)&&reconciledTax>=0&&reconciledTax<=total&&total-reconciledTax===minimum&&
  Object.hasOwn(payment,'discounts')&&(discounts===null||Array.isArray(discounts)&&discounts.length===0)&&
  payment.discount_id==null&&!payment.refund_status&&payment.includes_usage!==true&&payment.is_multi_subscription!==true;
}
export function assertDodoProduct(plan:PaidPlan,product:Record<string,unknown>){
 const price=dodoObject(product.price),discount=price.discount_bps??price.discount??0;
 if(product.is_archived===true||price.currency!=='USD'||price.price!==PLAN_CONFIG[plan].priceCents||discount!==0||price.pay_what_you_want===true||price.purchasing_power_parity===true||Number(price.trial_period_days??0)!==0||
  (plan==='lifetime'?price.type!=='one_time_price':price.type!=='recurring_price'||price.payment_frequency_count!==1||String(price.payment_frequency_interval).toLowerCase()!=='month'))
  throw new CreditError('Dodo product prices or billing intervals do not match the configured plans. Contact support.',503);
}
function text(data:Record<string,unknown>,name:string){const v=data[name];if(typeof v!=='string'||!v||v.length>300)throw new CreditError('Dodo response is missing required billing fields.',503);return v;}
export function dodoProducts(){const map={plus:process.env.DODO_PLUS_PRODUCT_ID,pro:process.env.DODO_PRO_PRODUCT_ID,lifetime:process.env.DODO_LIFETIME_PRODUCT_ID};if(Object.values(map).some(v=>!v)||new Set(Object.values(map)).size!==3)throw new CreditError('Configure the three distinct Dodo product IDs on the server.',503);return map as Record<PaidPlan,string>;}
export async function dodoRequest(path:string,method='GET',body?:unknown){
 assertTestBillingConfigured();
 const key=process.env.DODO_PAYMENTS_API_KEY;
 const base='https://test.dodopayments.com';
 let response:Response;try{response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new CreditError('Payment provider is unavailable. Please retry later.',503);}
 if(!response.ok){await response.body?.cancel();throw new CreditError('Payment provider could not verify this operation.',503);}return dodoObject(await response.json());
}
export function verifyDodoSignature(raw:string,headers:Headers,secret=process.env.DODO_PAYMENTS_WEBHOOK_KEY,now=Date.now()){
 const id=headers.get('webhook-id'),stamp=headers.get('webhook-timestamp'),signatures=headers.get('webhook-signature');
 if(!secret)throw new CreditError('Webhook verification is not configured.',503);
 if(!id||id.length>200||!stamp||!/^\d+$/.test(stamp)||!signatures||signatures.length>4096||Math.abs(now/1000-Number(stamp))>300)throw new CreditError('Invalid webhook signature.',401);
 const encoded=secret.replace(/^whsec_/, '');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new CreditError('Webhook verification is not configured.',503);
 const key=Buffer.from(encoded,'base64');if(key.length<16)throw new CreditError('Webhook verification is not configured.',503);
 const expected=createHmac('sha256',key).update(id+'.'+stamp+'.'+raw).digest();
 if(!signatures.split(' ').some(signature=>{const [version,hash]=signature.split(',');if(version!=='v1'||!hash)return false;const actual=Buffer.from(hash,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);}))throw new CreditError('Invalid webhook signature.',401);
 return id;
}
const eventSchema=z.object({business_id:z.string(),type:z.string(),timestamp:z.string().datetime({offset:true}),data:z.record(z.string(),z.unknown())});
export async function processDodoEvent(id:string,raw:string){
 assertTestBillingConfigured();
 const event=eventSchema.parse(JSON.parse(raw));if(!process.env.DODO_BUSINESS_ID||event.business_id!==process.env.DODO_BUSINESS_ID)throw new CreditError('Unexpected payment business.',403);
 const hash=createHash('sha256').update(raw).digest('hex');const known=await prisma.dodoBillingEvent.findUnique({where:{id}});if(known){if(known.payloadHash!==hash)throw new CreditError('Webhook ID payload mismatch.',409);return;}
 const subscriptionEvents=['subscription.active','subscription.renewed','subscription.on_hold','subscription.past_due','subscription.paused','subscription.unpaused','subscription.cancelled','subscription.failed','subscription.expired','subscription.plan_changed','subscription.updated'];
 const disputeEvents=['dispute.opened','dispute.expired','dispute.accepted','dispute.cancelled','dispute.challenged','dispute.won','dispute.lost'];
 let isSubscription=subscriptionEvents.includes(event.type);const isPayment=event.type==='payment.succeeded',isRefund=event.type==='refund.succeeded'||disputeEvents.includes(event.type);
 if(!isSubscription&&!isPayment&&!isRefund){await prisma.dodoBillingEvent.upsert({where:{id},update:{},create:{id,type:event.type,payloadHash:hash}});return;}
 let data=event.data;
 // Re-fetch authoritative objects; signed delivery alone does not prove current subscription status.
 if(isSubscription)data=await dodoRequest('/subscriptions/'+encodeURIComponent(text(data,'subscription_id')));
 else if(isPayment)data=await dodoRequest('/payments/'+encodeURIComponent(text(data,'payment_id')));
 else data=await dodoRequest('/payments/'+encodeURIComponent(text(data,'payment_id')));
 if(isPayment&&data.status==='succeeded'&&typeof data.subscription_id==='string'){data=await dodoRequest('/subscriptions/'+encodeURIComponent(data.subscription_id));isSubscription=true;}
 const customerId=text(dodoObject(data.customer),'customer_id');const owner=await prisma.creditAccount.findUnique({where:{customerId}});
 if(!owner)throw new CreditError('Payment has no server-bound account. Reconcile this payment before granting credits.',409);
 // Customer association is established by authenticated checkout, never webhook metadata.
 assertTestBillingUser(owner.uid);
 const products=dodoProducts(),plan=(Object.keys(products) as PaidPlan[]).find(p=>products[p]===data.product_id);
 const grantEvent=['subscription.active','subscription.renewed','payment.succeeded'].includes(event.type)&&isSubscription&&data.status==='active';
 if(grantEvent){
  if(plan!=='plus'&&plan!=='pro')throw new CreditError('Unexpected subscription product.',409);
  assertDodoProduct(plan,await dodoRequest('/products/'+encodeURIComponent(products[plan])));
  const listed=await dodoRequest('/payments?subscription_id='+encodeURIComponent(text(data,'subscription_id'))+'&page_size=100');
  const items=Array.isArray(listed.items)?listed.items:[];
  let proof=false;
  for(const candidate of items.map(dodoObject)){
   if(typeof candidate.payment_id!=='string'||!['new','renewal'].includes(String(candidate.charge_type)))continue;
   const payment=await dodoRequest('/payments/'+encodeURIComponent(candidate.payment_id));
   if(payment.payment_id!==candidate.payment_id||!paidAmountMatches(payment,PLAN_CONFIG[plan].priceCents)||!['new','renewal'].includes(String(payment.charge_type))||text(dodoObject(payment.customer),'customer_id')!==customerId)continue;
   if(Array.isArray(payment.service_periods)&&payment.service_periods.map(dodoObject).some(period=>period.subscription_id===data.subscription_id&&period.proration_factor==='1'&&new Date(String(period.starts_at)).getTime()===new Date(String(data.previous_billing_date)).getTime()&&new Date(String(period.ends_at)).getTime()===new Date(String(data.next_billing_date)).getTime())){proof=true;break;}
  }
  if(!proof)throw new CreditError('Awaiting verified successful payment for this full subscription period.',409);
 }
 if(isPayment&&!isSubscription){const cart=Array.isArray(data.product_cart)?data.product_cart:[];if(!paidAmountMatches(data,PLAN_CONFIG.lifetime.priceCents)||cart.length!==1||dodoObject(cart[0]).product_id!==products.lifetime||dodoObject(cart[0]).quantity!==1)throw new CreditError('Unexpected one-time purchase.',409);assertDodoProduct('lifetime',await dodoRequest('/products/'+encodeURIComponent(products.lifetime)));}
 await prisma.$transaction(async tx=>{
  const account=await accountLock(tx,owner.uid);const previous=await tx.dodoBillingEvent.findUnique({where:{id}});if(previous){if(previous.payloadHash!==hash)throw new CreditError('Webhook ID mismatch.',409);return;}
  assertTestBillingUser(account.uid);
  if(account.customerId!==customerId)throw new CreditError('Payment account association changed.',409);
  const occurred=new Date(event.timestamp),older=account.lastBillingAt&&account.lastBillingAt>occurred;
  if(isRefund){
   await tx.creditAccount.update({where:{uid:owner.uid},data:{status:'refund_review',lastBillingAt:occurred}});
   await tx.creditEntry.create({data:{uid:owner.uid,type:'refund',amount:0,balanceAfter:account.balance,eventKey:'dodo:'+id}});
  }else if(isSubscription){
   const subscriptionId=text(data,'subscription_id');
   if(account.subscriptionId&&account.subscriptionId!==subscriptionId)throw new CreditError('Subscription does not match the bound account.',409);
   if(plan!=='plus'&&plan!=='pro')throw new CreditError('Unknown Dodo subscription product.',409);
   if(!older&&account.plan!=='lifetime'&&account.status!=='refund_review')await tx.creditAccount.update({where:{uid:owner.uid},data:{plan,subscriptionId,status:data.status==='active'?'active':String(data.status||'inactive'),lastBillingAt:occurred}});
   if(grantEvent&&!older&&account.plan!=='lifetime'&&account.status!=='refund_review'){
    if(data.payment_frequency_count!==1||String(data.payment_frequency_interval).toLowerCase()!=='month'||data.quantity!==1)throw new CreditError('Unexpected subscription billing interval or quantity.',409);
    const startsAt=new Date(text(data,'previous_billing_date')),endsAt=new Date(text(data,'next_billing_date'));
    if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||startsAt>=endsAt||startsAt>new Date())throw new CreditError('Invalid verified billing period.',409);
    const periodKey=subscriptionId+':'+startsAt.toISOString();let period=await tx.creditPeriod.findUnique({where:{uid_periodKey:{uid:owner.uid,periodKey}}});
    if(!period){
     const config=PLAN_CONFIG[plan];period=await tx.creditPeriod.create({data:{uid:owner.uid,periodKey,plan,startsAt,endsAt,allocation:config.allocation,screenLimit:config.generationLimit,spendLimitMicros:BigInt(periodSpendLimitMicroUsd(plan))}});
     if(account.balance+config.allocation>2_000_000_000)throw new CreditError('Credit balance needs administrative reconciliation.',409);
     if(account.balance)await tx.creditEntry.create({data:{uid:owner.uid,periodId:period.id,type:'rollover',amount:0,balanceAfter:account.balance,eventKey:'rollover:'+period.id}});
     await tx.creditAccount.update({where:{uid:owner.uid},data:{balance:{increment:config.allocation}}});
     await tx.creditEntry.create({data:{uid:owner.uid,periodId:period.id,type:'grant',amount:config.allocation,balanceAfter:account.balance+config.allocation,eventKey:'grant:'+period.id}});
    }
    if(account.plan!=='lifetime')await tx.creditAccount.update({where:{uid:owner.uid},data:{currentPeriodId:period.id}});
   }
  }else if(isPayment&&!data.subscription_id){
   const cart=Array.isArray(data.product_cart)?data.product_cart:[];
   if(!paidAmountMatches(data,PLAN_CONFIG.lifetime.priceCents)||cart.length!==1||dodoObject(cart[0]).product_id!==products.lifetime||dodoObject(cart[0]).quantity!==1)throw new CreditError('Unexpected one-time purchase.',409);
   if(!older&&account.status!=='refund_review')await tx.creditAccount.update({where:{uid:owner.uid},data:{plan:'lifetime',status:'active',lastBillingAt:occurred}});
  }
  await tx.dodoBillingEvent.create({data:{id,type:event.type,payloadHash:hash,uid:owner.uid}});
 });
}
