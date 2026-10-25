# AI generation usage logging

Implemented 2026-10-25. No database/schema/environment changes, new dependencies, paid provider requests, push or deployment.

## Inspected pipeline

Installed SDK: `ai@6.0.198` (Vercel AI SDK). Adapters: `@ai-sdk/google@3.0.80`, `@ai-sdk/openai@3.0.68`, `@ai-sdk/anthropic@3.0.81`, `@openrouter/ai-sdk-provider@2.9.0`. NVIDIA, xAI and Ollama use the OpenAI-compatible chat adapter with their existing endpoints. Google uses createGoogleGenerativeAI through the AI SDK, not a direct Gemini SDK call. No Vercel AI Gateway is configured in the inspected registry; OpenRouter is a separate gateway.

`/api/generate/redesign` goes through authenticated ownership/personal-provider guards and the image-reference pipeline. Normal redesign calls streamText and reads fullStream; project-chat delegates to projectChatResponse, also streaming. Normal mode can retry once using the existing Google fallback rule before any text is emitted. SDK retries are disabled on those redesign calls; other generateText calls can retain SDK retry behavior. The requested project model is not necessarily the effective model: vision fallback and active personal-provider overrides can replace it.

Other model calls: main generation, convert, workflow, workflow-redesign and retheme use streamText; style and theme use generateText. They all resolve their model through the shared registry, so adapter-level instrumentation covers them without changing prompts or streaming protocols. No separate planning model call exists in normal redesign; project-chat returns a plan in its own model response. If a tool/multistep/planning call is made through these instrumented models within the request scope it is counted separately. Image references consume provider-reported input tokens. Pixabay search/download is not an AI inference call; no Gemini image generation was added.

Previous SSE metadata read final result.totalUsage, which covers only that SDK result, not preceding failed/fallback results. It is preserved for compatibility but is not added to our counters.

## Collection and logs

- Each authorized generation HTTP request gets a server-generated UUID, returned in `X-OpenUI-Generation-Id`. No client UID, stream ID or supplied generation ID is trusted as the accounting identity.
- AsyncLocalStorage isolates counters for concurrent users/requests. Scope starts before the image pipeline and handler; response completion, failure, cancellation or abort finalizes it once.
- AI SDK v3 language-model middleware wraps doGenerate/doStream. Each actual adapter invocation gets a callId. This includes SDK retries, explicit fallback and follow-up SDK steps. Merely constructing/selecting a model is not an AI call. Re-wrapping an already instrumented model is ignored.
- Streaming usage is taken from the adapter's finish event, and response-metadata provides the returned model ID when available. Nonstreaming usage comes from doGenerate's returned usage/response. No stream is teed or consumed a second time for accounting.
- Effective provider is captured AFTER personal-provider overrides. Requested adapter model, returned model (when provided), and modelSource are logged separately. OpenRouter upstream provider metadata is included when supplied. If the provider doesn't return a resolved version, modelSource is adapter_model_id; it is not falsely labelled provider-confirmed.
- Logs are concise JSON strings with events `ai_usage_call` and `ai_usage_summary`. They contain IDs for accounting, route, provider/model, counts, completeness, sanitized failure category/status code, and cost information. They do not contain prompts, HTML, image payloads, project IDs, Firebase UIDs, keys, headers, request bodies or raw provider errors. This describes the new telemetry; existing SDK/application diagnostic logs were not globally replaced.
- Summary counts are sums across calls, NOT sums of SDK totalUsage plus individual steps. Cache reads and reasoning are subsets of input/output and are not added again. Provider raw total is retained when supplied; otherwise total is the sum of known input/output totals. A total may differ from those components when the provider reports other token categories; we do not rewrite the reported total.
- Missing/invalid counts are null, not assumed zero. The Google adapter defaults missing raw fields to zero; our Google-aware normalization preserves absent primary/cache/reasoning metadata as unavailable instead. A provider-reported total minus reported prompt count can supply its actual output total.
- If any attempt has unknown primary usage, aggregate input/output/total fields become null as applicable, usageComplete=false, and knownInputTokens/knownOutputTokens/knownTotalTokens preserve the observed subtotal. That subtotal is NOT the full generation cost. Optional cache/reasoning absence does not invalidate known primary totals.
- Main generation, redesign and project-chat include the persisted designTarget (web/app) when present. Older projects without it are labelled null rather than guessed.

## Cost behavior

`lib/ai/usage-pricing.ts` is the centralized exact-provider/model rate catalog. Direct Google standard paid rates were checked against [Google's official pricing](https://ai.google.dev/gemini-api/docs/pricing) on 2026-10-25. Entries currently cover gemini-3.5-flash-lite, gemini-2.5-flash, gemini-2.5-flash-lite. No alias/gateway rate substitution. Rate entries expire for automatic calculations after 2026-11-24 pending review.

Input cost separates cached reads from uncached input. Output totals already include reasoning; it is not charged twice in the calculation. Missing cache breakdown, cache writes, tools, audio/unclassified files, generated image/file outputs, nonstandard provider options/tiers, unknown model rates and stale rates produce unavailable cost instead of a fabricated amount. Explicit cache storage duration/grounding/image fees are not inferred from token totals.

Calculated costs are labelled `published_standard_paid_token_rates_not_invoice`; actualBilledUsd remains null because free tier, private pricing/discounts, taxes or billing settings are not observable from token counts. This is a rate-based calculation, NOT a claim about the actual invoice. OpenRouter usage accounting is explicitly requested; if its returned metadata supplies a charge, that is logged as provider_reported/actualBilledUsd. If it reports only a total charge, input/output dollar breakdown remains unavailable. Summary dollar fields are only populated where all calls have that component; no unknown call is treated as free.

An unlisted model such as the registry's plain gemini-3.5-flash remains measurable in tokens, but cost is unavailable unless provider-reported or its exact applicable rates are added after verification. Adding pricing does not select/change a user's model.

## Verification

- New `tests/ai-usage.test.cjs`: nine tests using the actual installed AI SDK with synthetic adapters; exercise planning + streaming, SDK retry, explicit fallback, personal-model override through the actual redesign handler, cache/reasoning accounting, Google missing fields, cancellation, partial usage, stream/read errors, all seven provider labels, parallel web/app IDs, repeated wrapping/finish, provider-returned version and OpenRouter charge metadata. No real API was invoked.
- Final full suite: **214 passed, 0 failed, 0 skipped**. Final standalone `npx tsc --noEmit`: passed.
- Final isolated `npm run build` (via scripts/safe-production-build.cjs): passed, including Prisma generation, Next compilation/TypeScript and all 46 static pages. Only synthetic credentials were supplied; no env files, production data, uploads or .openui settings were copied. Build evidence is in reports/production-readiness-build.json and .log. No live production usage is claimed.

## Files

New: `lib/ai/usage-logging.ts`, `lib/ai/usage-pricing.ts`, `tests/ai-usage.test.cjs`, this report.

Updated: `lib/ai/provider-registry.ts` (meter effective adapters; request OpenRouter accounting), `lib/ai/with-personal-provider.ts` (request lifetime), `app/api/generate/route.ts`, `app/api/generate/redesign/route.ts`, `lib/ai/project-chat-response.ts` (persisted target label). Existing `reports/production-readiness-build.json` and `.log` refreshed by the safe build runner. Package/lock/schema/env files unchanged.

## Measure one website and one app screen after approved deployment

1. Deploy this reviewed source only after approval; no migration or new key is needed. In Vercel select that deployment's Runtime Logs and filter `ai_usage_summary` or the response header's generation ID.
2. Use an authorized project with target Web. Generate one design, let its stream finish, record its response generation ID and matching summary. Inspect ai_usage_call entries for retries/actual models and ensure usageComplete=true before treating the summary as complete usage.
3. Repeat with target App for one mobile screen. Keep the two generation IDs separate. Compare input/output/total counts; only compare dollar amounts with the stated cost basis and reliable rates or provider charges. Unknown fields stay unknown.
4. Do not add call logs AND their summary together: that double-counts. A retry with no returned usage makes the full request cost incomplete, even when the later successful attempt has counts.

IDs/summary scope is one server generation request. Multiple variants/screens generated by separate HTTP requests have separate IDs/summaries; aggregate only the distinct request summaries needed for the whole website. A later user follow-up is a new generation, not silently merged into an earlier request. Cross-request workflow billing storage/grouping is not introduced.

Remaining limitations: actual provider counts and invoices were not tested with paid requests; provider/platform termination can prevent terminal metadata or logs, and in-flight work after cancellation may remain billed but unknown. Existing raw SDK/application diagnostics are outside the new sanitized usage-log schema. This feature is console accounting, not a durable invoice ledger, and it does not replace the sidebar's previously requested dummy token quota.
