# AI Credits and Dodo Payments implementation

**Testing pause (2026-10-28):** Payment/credit enforcement is temporarily OFF by default. `OPENUI_PAYMENTS_ENABLED=true` explicitly restores the preserved billing flow. While off, verified Firebase users generate without subscription/credit reservations, autosave skips deductions, usage UI shows testing mode, and checkout/portal/webhooks return 503 without processing payments. Existing billing data is unchanged. Webhooks are not acknowledged as processed, so deliveries can be retried/reconciled after re-enabling. This code toggle does not cancel subscriptions at Dodo. Normal AI provider API charges still apply. No real environment file was edited and no code was pushed/deployed for this pause. The implementation/rollout details below describe the enabled billing flow.

Date: 2026-10-27. Local implementation; NOT deployed and NOT enabled against a live database. No migration, production/staging data change, owner assignment, secret rotation, push or deployment was performed. Real environment files were not changed. No dependency was added.

## Implemented policy

| Plan | Price | Monthly credit allocation | Accepted screens/period | Platform AI spend ceiling |
| --- | --- | --- | --- | --- |
| Plus | $9/month | 300 | 20 | $7 |
| Pro | $25/month | 1,700 | 50 | Required explicit OPENUI_PRO_PERIOD_SPEND_LIMIT_USD |
| Lifetime | $39 once | No platform grant | Own-key funding | No platform AI spending |

Each accepted screen costs exactly 15 credits. Four screens cost 60; three accepted screens cost 45. A workflow shares a workflow ID while individual calls/screens retain unique IDs. Extra rolled-over credits cannot bypass the current-period screen or spend allowance. With Pro's requested allocation, 50 screens consume 750 credits; the remaining 950, plus other unused credits, stays in the account. There is no invented credit expiration.

Plus's $9 minus the $7 AI budget leaves $2 BEFORE payment fees, taxes, hosting, asset costs and other expenses. This is not a guaranteed profit margin.

## Database and acceptance architecture

Draft migration: prisma/migrations-postgresql/20261027010000_ai_credits/migration.sql. It adds ONLY six billing tables, their indexes, foreign keys between new tables and nonnegative/allowance checks. It does not alter the four existing project models or any records. It has NOT been applied anywhere.

- CreditAccount: verified Firebase UID, plan/status, retained balance/reserved credits, Dodo customer/subscription, current period reference and UID-bound AES-256-GCM encrypted Gateway key.
- CreditPeriod: immutable verified billing-period allocation/limits/dates, used credits, accepted/reserved screen counts, integer micro-USD spend/holds.
- GenerationRun: UID, project/workflow/request identifiers, immutable request fingerprint, funding/status, reservations, token totals, cost and per-call normalized actual usage JSON.
- ScreenGeneration: validated HTML/digest, workflow/run/actual canvas screen IDs, acceptance status, credits charged and attributable usage/cost.
- CreditEntry: immutable grant/deduction/rollover/refund-review/adjustment journal with unique event keys.
- DodoBillingEvent: unique verified webhook ID, payload hash and processing result timestamp.

Account SELECT ... FOR UPDATE locks serialize reservation/settlement. A stable request key is unique per user; reusing it returns 409 rather than calling AI again. Different content under the same explicit key is rejected. Every provider transport call obtains its spend reservation first. The in-memory generation guard remains an additional duplicate safeguard, not the financial authority.

The generation wrapper stores validated final results before returning its completion event. Existing autosave/manual canvas persistence matches their canonical HTML digests, enforces UID/project ownership, and commits the canvas and one 15-credit ledger deduction per accepted screen in ONE transaction. Repeated saves do not charge twice. Input owner, balance, plan or charge fields are never financial authority.

Pending generated HTML must be saved before editing it: a modified pending result is rejected with a clear 409 rather than bypassing acceptance charging. Normal editing after the first successful save remains free. Manual layouts without pending AI results are preserved. Pending screen reservations expire after one hour on the next generation check; unknown provider-cost holds never expire automatically. Abandoned/failed outputs consume no screen credits, but actual provider cost is still recorded. A deliberate client can decline to accept a streamed result; the corresponding provider cost/holds still count toward the hard dollar limit.

## Actual usage and spend

The existing SDK middleware captures actual input, output, total, cache and reasoning metadata for every call, including failures. Billing generation IDs are also used in structured console usage logs. Per-call records and rate provenance persist in GenerationRun. Unknown metrics are null, not invented estimates. For a multi-screen response, shared usage is attached to the parent run; child attribution stays null rather than dividing tokens/cost arbitrarily. No call is counted twice.

USD amounts are internal estimates from actual provider token metadata and the centrally reviewed exact-model rate schedule, not a promise to match a later provider invoice. Cache input is an input subset; reasoning is already part of output, so neither is added twice. Missing cache metadata is conservatively priced as uncached input. Unknown model/usage retains the entire cost reservation for operator reconciliation; known per-call data remains in the stored JSON even when the overall total is incomplete.

Reservations use the fixed model's documented native maximum context/output and reviewed rate schedule. They DO NOT reintroduce the removed 4,000-token input/output caps. No maxOutputTokens is sent. Unbounded extra billable tools/options are rejected for platform funding. The current reviewed price schedule expires 2026-11-24; stale pricing blocks platform funding until reviewed. Missing Pro budget also fails closed.

Lifetime calls use only the user's encrypted Vercel AI Gateway key, fixed google/gemini-3.5-flash-lite, only Google routing and no model fallback. No platform key fallback, credit reservation/deduction or platform USD spend applies. Existing direct-provider key settings are preserved; fixed generation continues to ignore those legacy direct-provider selections.

## Dodo Payments

New APIs use the existing verified Firebase session and same-origin mutation checks:

- GET /api/ai-credits returns ONLY the authenticated account's safe plan/balance/period/count/reset DTO and public plan catalog.
- PUT /api/ai-gateway-key accepts only {key}; active Lifetime entitlement required. DELETE removes only the caller's key. No plaintext key is returned.
- POST /api/billing/checkout accepts only {plan}, verifies the configured Dodo product/price/currency/interval, binds a customer server-side and returns the hosted checkout URL. Checkout/return URLs do not grant credits.
- POST /api/billing/portal opens only the caller's bound customer's portal.
- POST /api/billing/dodo-webhook verifies HMAC over the exact raw body, timestamp tolerance and constant-time signature comparison. It checks business ID, re-fetches authoritative objects and processes event ID/hash idempotently in the same transaction as entitlements/grants.

Only verified successful full-period USD payments for the configured subscription product create a credit period/grant. Active/trial status alone is insufficient. Customer-to-UID binding is stored on the server; client metadata cannot select an owner. A repeated event OR a different event for the same period cannot grant twice. Renewal ADDs the allocation to retained balance and initializes fresh period counters; prior periods remain auditable. Status/cancellation events preserve balances and stop funding when inactive. Scheduled cancellation follows the provider's authoritative active status/period.

Successful refunds/disputes place the account into refund_review, retain the ledger/balance, and stop funding. A later ordinary subscription event cannot silently clear the hold. A refund amount or clawback/expiry policy was not invented: reconciliation/reactivation is an explicit operator action. Plan quota changes wait for a verified full paid period rather than inventing prorated grants.

## Dashboard

The dummy usage card was replaced with actual persisted allocation/used/remaining credits, period screen count/limit, reserved credits, authoritative reset date/countdown, accessible progress and loading/error states. Account-switch state is UID keyed. Confirmed accepted saves trigger one deduplicated '15 credits used.' toast per screen. Lifetime displays own-account funding, never dummy platform balances. Normal APIs/UI do not expose provider tokens or USD costs. Marketing pricing uses the same public plan catalog and no invented yearly discount.

## Verification

- Full suite: **250 tests passed, 0 failed, 0 skipped** (node --test, concurrency 2).
- TypeScript: **npx tsc --noEmit passed**.
- Production compilation: **npm run build passed**, including Prisma 7.8.0 generation, TypeScript and 50 static pages, through scripts/safe-production-build.cjs. Isolated directory: openui-production-check-mAE5hI.
- Evidence: reports/ai-credits-verification.json and reports/production-readiness-build.json/.log. No real database credentials were copied into the build.
- No schema migration was applied; live billing/readiness remains contingent on the staging checks below.

Test scope includes exact plan policy, four-screen and partial workflows, duplicate IDs/saves/webhooks, serialized concurrent reservations, rollover, Plus $7 and Pro independent budget, failed/interrupted usage, tampered pending results, cross-user denial, raw webhook signature/tamper/replay, unpaid subscription rejection, refunds/status holds, safe API DTOs, encrypted UID-bound Gateway keys, SSR dashboard states and the actual installed Google/Gateway SDKs with intercepted synthetic HTTP.

IMPORTANT: Database tests use a rollback-capable serialized transaction test double. They are NOT proof of real PostgreSQL multi-connection locking or a successfully applied migration. SDK transport tests use synthetic responses and do not prove a live provider payment/generation. Authenticated browser interaction, real Firebase/Dodo test-mode checkout/webhook delivery, live Gateway access and real isolated PostgreSQL concurrency remain unverified. No live AI/payment request was needed to run these tests. The production build uses an isolated source copy and synthetic configuration only; this validates compilation, not live service configuration.

## Required server configuration (names only)

Already existing: DATABASE_URL, DIRECT_URL, Firebase configuration, GEMINI_API_KEY, optional fixed GEMINI_MODEL, and OPENUI_PROVIDER_KEYS_SECRET. Keep the same stable encryption secret across deployments; rotating it without a migration would make saved keys unreadable.

New placeholders in .env.example:

- DODO_PAYMENTS_API_KEY
- DODO_PAYMENTS_WEBHOOK_KEY
- DODO_BUSINESS_ID
- DODO_PAYMENTS_ENVIRONMENT: explicitly test_mode or live_mode
- DODO_PLUS_PRODUCT_ID, DODO_PRO_PRODUCT_ID, DODO_LIFETIME_PRODUCT_ID: distinct server-controlled IDs
- OPENUI_PUBLIC_ORIGIN: the intended HTTPS app origin
- OPENUI_PRO_PERIOD_SPEND_LIMIT_USD: choose a separate positive budget; no amount was guessed
- OPENUI_CREDITS_ENABLED: true to exercise billing locally; production always enforces it

No values should be sent in chat or committed. The Gateway API key is entered by each Lifetime user, encrypted in Neon and only decrypted server-side for their call. Monthly Firebase claims alone cannot create grants. Legacy verified Lifetime claims can initialize an own-key account without creating platform credits.

## Required staged rollout before production

1. Separately review/approve the additive migration and a verified isolated/staging database target/backup. Apply it there using the existing guarded migration workflow. No database-changing command was run for this task.
2. Configure Dodo TEST products: Plus $9 monthly, Pro $25 monthly, Lifetime $39 once, no trial/discount, USD, quantity one. Configure the explicit Pro cap and stable encryption secret. Do not change production variables for this rehearsal.
3. Register the test-mode webhook at /api/billing/dodo-webhook for payment.succeeded, subscription lifecycle events, refund.succeeded and relevant dispute events, with its signing secret/business ID.
4. Use two real Firebase test accounts. Complete hosted test checkouts; verify distinct server-bound customer IDs, one paid-period allocation each, and denial of cross-user project/key/credits access.
5. Generate/save one screen (15 credits), a four-screen workflow (60), and a workflow with one failed screen (45 for three accepted). Retry the SAME idempotency key and autosave; verify no duplicate provider call/charge. Edit/reset/export/reopen accepted screens.
6. On an isolated database, run simultaneous requests through separate app instances/connections near the credit, screen and dollar caps. Confirm constraints, row locks and ledger totals. Exercise interrupted streams and inspect held cost with an authorized operator query.
7. Deliver renewal events twice and two event IDs for the same period: balance adds one allocation, old balance remains, new counts/spend reset once. Check cancellation and refund-review funding denial. Verify plan changes do not mint an extra full-period grant.
8. Test Lifetime with an own Gateway key and missing/invalid key. Confirm no platform-funded fallback or platform balance/spend mutation, and verify the fixed model is accessible in that Gateway account.
9. After separately approved production backup/migration/configuration, deploy compatible code. DO NOT deploy this code first: production enforcement requires the new tables. No push or deployment was performed here.

## Remaining operational limitations

- No real PostgreSQL/Dodo/browser acceptance test has passed yet; staging rehearsal is mandatory before enabling paid production funding.
- The authoritative payment proof search currently considers the latest 100 subscription payments and fails closed if the relevant payment is absent. Missed historical renewals, unusual billing schedules, resubscriptions with a different subscription ID, proration and refund holds require operator reconciliation. These cases never mint guessed credits.
- Unknown-cost reservations are intentionally retained. No automated provider invoice reconciliation or operator adjustment UI was introduced. CreditEntry supports adjustments; any administrative adjustment must be audited and separately authorized.
- Screen acceptance depends on existing canvas HTML persistence. Save completed generated results before first editing; a 409 preserves the last committed canvas and pending result for retry. Tokens/cost shared by multiple outputs are not falsely attributed to individual screens.
- Existing asset/filesystem durability limitations on Vercel are outside this task. Existing uploads and direct-provider settings were not migrated/deleted.
- The fixed model and schema were not changed. Existing global model-selector configuration messages still describe platform Gemini configuration; Lifetime transport uses its own Gateway key independently, as tested.

## Primary references

- [Dodo webhooks and signature verification](https://docs.dodopayments.com/developer-resources/webhooks)
- [Dodo authoritative subscription types](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/subscriptions.ts)
- [Dodo payment/service-period types](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/payments.ts)
- [Gemini model limits](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Vercel AI Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok)

## Exact working-tree file manifest

This manifest includes the prior, uncommitted request-parsing fix (generation-request.ts, generation-request.test.cjs and its report), which was preserved. Shared generation wrapper changes integrate that fix. Other files below are the current billing implementation, regression fixtures or build evidence. Nothing was committed.

- .env.example
- app/api/ai-credits/route.ts
- app/api/ai-gateway-key/route.ts
- app/api/autosave/route.ts
- app/api/billing/checkout/route.ts
- app/api/billing/dodo-webhook/route.ts
- app/api/billing/portal/route.ts
- components/billing/billing-panel.tsx
- components/billing/credits-card.tsx
- components/billing/gateway-key.tsx
- components/billing/use-credit-usage.ts
- components/canvas/autosave/index.tsx
- components/canvas/shapes/generatedui/design-tokens-editor.tsx
- components/landing/pricing-section.tsx
- components/projects/workspace-dashboard.tsx
- components/projects/workspace-settings.tsx
- components/site/product-page.tsx
- hooks/use-canvas.ts
- lib/ai/gemini.ts
- lib/ai/generation-guard.ts
- lib/ai/generation-request.ts
- lib/ai/moodboard-model.ts
- lib/ai/personal-provider-auth.ts
- lib/ai/provider-registry.ts
- lib/ai/usage-logging.ts
- lib/ai/with-personal-provider.ts
- lib/billing/client.ts
- lib/billing/crypto.ts
- lib/billing/dodo.ts
- lib/billing/generation.ts
- lib/billing/plan-catalog.ts
- lib/billing/plan-config.ts
- lib/billing/policy.ts
- lib/billing/public-types.ts
- lib/billing/scope.ts
- lib/billing/store.ts
- lib/db/projects.ts
- lib/images/generation-pipeline.ts
- lib/moodboard-to-ui.ts
- lib/pricing.ts
- lib/site-pages.ts
- lib/stream-utils.ts
- prisma/migrations-postgresql/20261027010000_ai_credits/migration.sql
- prisma/schema.prisma
- redux/api/style-guide/index.ts
- reports/AI-CREDITS-IMPLEMENTATION-DESIGN.md
- reports/AI-CREDITS-IMPLEMENTATION.md
- reports/GENERATION-REQUEST-PARSING-FIX.md
- reports/ai-credits-verification.json
- reports/production-readiness-build.json
- reports/production-readiness-build.log
- tests/ai-credits.test.cjs
- tests/ai-usage.test.cjs
- tests/credit-api.test.cjs
- tests/credit-dashboard.test.cjs
- tests/dodo-billing.test.cjs
- tests/generation-request.test.cjs
- tests/helpers/billing-db.cjs
- tests/plan-config.test.cjs
- tests/postgres-phase1.test.cjs
- tests/workspace-settings.test.cjs
