// Exact provider/model matches only. Never apply Google direct prices to a gateway.
// Source checked 2026-10-25: https://ai.google.dev/gemini-api/docs/pricing
const source = 'https://ai.google.dev/gemini-api/docs/pricing';
export const AI_PRICING = {
  'google/gemini-3.5-flash-lite': { input: 0.30, cachedInput: 0.03, output: 2.50 },
  'google/gemini-2.5-flash': { input: 0.30, cachedInput: 0.03, output: 2.50 },
  'google/gemini-2.5-flash-lite': { input: 0.10, cachedInput: 0.01, output: 0.40 },
} satisfies Record<string, { input: number; cachedInput: number; output: number }>;
export const PRICING_REVIEW = { verifiedAt: '2026-10-25', validUntil: '2026-11-24', source };

export type TokenCounts = {
  inputTokens: number | null; outputTokens: number | null; totalTokens: number | null;
  cachedInputTokens: number | null; cacheWriteTokens: number | null; reasoningTokens: number | null;
};
export function calculateTokenCost(provider: string, model: string, usage: TokenCounts, extraBilling: boolean, now = Date.now()) {
  const unavailable = (reason: string) => ({ status: 'unavailable' as const, reason, inputUsd: null, outputUsd: null, totalUsd: null, actualBilledUsd: null });
  if (extraBilling) return unavailable('additional_or_unclassified_billable_operations');
  if (now > Date.parse(PRICING_REVIEW.validUntil + 'T23:59:59Z')) return unavailable('pricing_requires_review');
  const key = `${provider}/${model}`;
  if (!Object.hasOwn(AI_PRICING, key)) return unavailable('exact_provider_model_pricing_unknown');
  const rates = AI_PRICING[key as keyof typeof AI_PRICING];
  if (usage.inputTokens === null || usage.outputTokens === null || usage.cachedInputTokens === null) return unavailable('usage_or_cache_breakdown_unavailable');
  if (usage.cachedInputTokens > usage.inputTokens || (usage.cacheWriteTokens !== null && usage.cacheWriteTokens > 0)) return unavailable('unsupported_cache_billing');
  // Output totals already INCLUDE reasoning. Cache reads are a SUBSET of input.
  const inputUsd = ((usage.inputTokens - usage.cachedInputTokens) * rates.input + usage.cachedInputTokens * rates.cachedInput) / 1_000_000;
  const outputUsd = usage.outputTokens * rates.output / 1_000_000;
  return { status: 'calculated' as const, reason: null, inputUsd, outputUsd, totalUsd: inputUsd + outputUsd,
    actualBilledUsd: null, basis: 'published_standard_paid_token_rates_not_invoice', currency: 'USD', ...PRICING_REVIEW };
}
