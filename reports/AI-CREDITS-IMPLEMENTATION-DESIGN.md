# Approved AI Credits design

Updated 2026-10-27. Supersedes the earlier proposal. The user explicitly authorized schema/API implementation, Dodo Payments, retained unused credits, and charging per accepted screen. This does not authorize applying a migration or deploying.

| Plan | Price | Monthly grant | Charge | Screens/period | Platform AI budget |
| --- | --- | --- | --- | --- | --- |
| Plus | $9/month | 300 | 15/accepted screen | 20 | $7 |
| Pro | $25/month | 1,700 | 15/accepted screen | 50 | Required separate server configuration |
| Lifetime | $39 once | None | No platform credit charge | Not a platform-funded allowance | Own Vercel AI Gateway key |

Unused credits stay in the account. Renewals add the allocation; they do not overwrite the balance. Period screen/spend counters are independent. Pro's 50-screen allowance uses at most 750 credits in one period; remaining credits are retained. No expiry policy was introduced.

Six additive models: CreditAccount, CreditPeriod, GenerationRun, ScreenGeneration, CreditEntry and DodoBillingEvent. Existing project models, ownership and data remain unchanged. Per-call actual usage/rate metadata is JSON in GenerationRun; Gateway credentials are authenticated encrypted fields on CreditAccount.

Authenticated APIs: GET /api/ai-credits; PUT/DELETE /api/ai-gateway-key; POST /api/billing/checkout; POST /api/billing/portal. POST /api/billing/dodo-webhook verifies the signed raw request. Existing generation and autosave APIs integrate reservations and acceptance; no disconnected acceptance endpoint was added.

Generation results are validated/stored server-side, then accepted and charged atomically with canvas persistence. Four accepted screens cost 60 credits; three cost 45. Request IDs and unique ledger entries make retries idempotent. Account row locks serialize credits, slots and cost reservations. Unknown provider costs retain their conservative reservation instead of inventing zero usage. Pending generated HTML must be saved before editing it, so modified results cannot bypass acceptance charging.

Monthly entitlements come from server-bound Dodo customers and verified successful full-period payments. Browser metadata and signed plan claims cannot grant monthly credits. Legacy verified Lifetime claims may initialize an own-key entitlement. Refunds/disputes freeze funding for manual review without inventing a credit clawback policy.

The fixed Gemini 3.5 Flash-Lite model, existing JSON schema, no-retry/no-fallback behavior and removed application token caps remain unchanged. Lifetime uses only its own Gateway key. No production database was contacted or changed for implementation.

See AI-CREDITS-IMPLEMENTATION.md for verification, required configuration and rollout limitations.
