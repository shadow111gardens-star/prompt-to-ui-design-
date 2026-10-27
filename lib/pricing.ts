import { PUBLIC_PLANS } from '@/lib/billing/plan-catalog';
export type PricingPlan = 'plus' | 'pro' | 'lifetime';
export type BillingPeriod = 'monthly' | 'yearly';

export function getPricing(plan:PricingPlan,period:BillingPeriod) {
  const monthlyCents=PUBLIC_PLANS[plan].priceCents;
  const recurring=plan!=='lifetime';
  const yearly=recurring&&period==='yearly';
  const displayCents=yearly?Math.round(monthlyCents*0.7):monthlyCents;
  return {displayCents,chargedCents:yearly?displayCents*12:displayCents,recurring,yearly};
}
export function pricingAmount(cents:number) {
  return `$${Number.isInteger(cents/100)?cents/100:(cents/100).toFixed(2)}`;
}
