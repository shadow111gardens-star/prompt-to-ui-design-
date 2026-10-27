# Application token limits removed

Date: 2026-10-27

The user requested removal of the application-imposed input/output caps. This supersedes the earlier preflight-fix behavior; historical reports remain as verification records.

Changed production files:
- lib/ai/fixed-model.ts: removed both token-limit constants; fixed Gemini 3.5 Flash-Lite identifiers remain.
- lib/ai/gemini.ts: removed byte measurement, countTokens requests, preflight rejection and output-cap middleware. Generation goes directly through the existing Google SDK transport. Key handling and fixed endpoint restrictions remain.
- lib/ai/generation-sdk.ts: removed default/clamped maxOutputTokens; automatic retries remain disabled.
- lib/ai/project-chat-response.ts: removed the explicit output cap from project chat.
- app/api/generate/route.ts and components/style/moodboard/generate-ui.tsx: removed the legacy Moodboard description character cap from server and UI.
- lib/ai/usage-logging.ts: removed obsolete preflight-specific failure classification; actual provider usage and request-state logging remain.
- lib/site-pages.ts: updated the public generation description and outdated preflight claim.

Tests updated: tests/gemini.test.cjs and tests/generation-limits.test.cjs. Requests with large system/user content and image input go directly to generation with their contents unchanged and no countTokens call. FRAME requests above the old threshold stream successfully with mocked provider responses. No maxOutputTokens is sent by default. Long returned output is preserved intact. Fixed model, server key secrecy, schema validation, no retries and duplicate protection remain tested.

Results:
- Focused tests: 12 passed.
- Full suite: 216 passed, 0 failed, 0 skipped.
- npx tsc --noEmit: passed.
- Isolated production build: passed, 45 static pages. A final public copy-only wording correction was made after the isolated build snapshot; no generation code changed afterward.
- Search of active lib/app/components code found no token-cap constants, countTokens preflight, 4,000-token messages or explicit output cap remaining.

Provider model context/output limits still apply. Existing request/schema/asset safety validation remains; this is removal of application token caps, not unlimited provider capacity. No live generation, database/env changes, push or deployment performed.
