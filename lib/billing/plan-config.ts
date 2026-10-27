import { PUBLIC_PLANS } from '@/lib/billing/plan-catalog';
export { CREDIT_ROLLOVER_POLICY } from '@/lib/billing/plan-catalog';

// Server-side policy only. Client dashboards receive a public usage DTO, never
// this internal spend policy. No ledger or entitlement is created by importing it.
export const PLAN_CONFIG={plus:{...PUBLIC_PLANS.plus,spendLimitMicroUsd:7_000_000,periodSource:'verified_subscription'},pro:{...PUBLIC_PLANS.pro,spendLimitEnvironment:'OPENUI_PRO_PERIOD_SPEND_LIMIT_USD',periodSource:'verified_subscription'},lifetime:{...PUBLIC_PLANS.lifetime,periodSource:'verified_purchase'}} as const;
export type PaidPlan = keyof typeof PLAN_CONFIG;
export type MonthlyPlan = 'plus' | 'pro';
export function isMonthlyPlan(plan: unknown): plan is MonthlyPlan { return plan === 'plus' || plan === 'pro'; }

/** Positive USD, at most six decimal places; integer microdollars avoid float
 * drift in the eventual persisted ledger. Missing Pro config fails closed. */
export function proSpendLimitMicroUsd(value = process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD): number {
  const text = value?.trim();
  if (!text || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) throw new Error('Configure a positive OPENUI_PRO_PERIOD_SPEND_LIMIT_USD value on the server.');
  const [whole, fraction = ''] = text.split('.');
  const micro = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, '0'));
  if (micro <= BigInt(0) || micro > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('OPENUI_PRO_PERIOD_SPEND_LIMIT_USD is outside the supported positive range.');
  return Number(micro);
}
export function periodSpendLimitMicroUsd(plan: MonthlyPlan): number {
  return plan === 'plus' ? PLAN_CONFIG.plus.spendLimitMicroUsd : proSpendLimitMicroUsd();
}
