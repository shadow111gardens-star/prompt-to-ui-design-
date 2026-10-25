# Fixed TokenHarbor generation configuration

2026-10-25. Application code updated locally. No database records, ownership, schema, migration, live environment files, push or deployment changed. No new dependency or live provider request.

## Root cause and routing

The old selector fetched /api/models and /api/models/select, while discovery enabled only unrelated provider env variables. TOKENHARBOR_API_KEY was not recognized. Stored project/personal selections and fallback logic could choose other providers. The empty dropdown was not a missing ProjectSettings import problem.

Generation now always resolves the server-configured `deepseek-v4.1-flash:free` through createOpenAI(...).chat(...), base URL https://tokenharbor.ai/v1, producing POST https://tokenharbor.ai/v1/chat/completions. No Responses API or remote model catalog. This matches the provider's [model/API page](https://tokenharbor.ai/models/deepseek-v4.1-flash:free). Existing model preferences are left untouched and cannot change generation routing. Personal provider key management remains available independently, but cannot override this fixed generation policy.

Server configuration is mandatory:

```dotenv
TOKENHARBOR_API_KEY=<privately configured server key>
TOKENHARBOR_MODEL=deepseek-v4.1-flash:free
```

Missing key or nonmatching model fails with a clear configuration error; no alternative provider/model is selected. Local presence/matching checks succeeded without revealing the values. Actual Vercel configuration was not inspected or changed. Secrets remain server-only, not NEXT_PUBLIC variables. .env.example contains a blank key placeholder; a credential encountered there during inspection was removed from the example. Because it appeared in diagnostic output, rotate that exposed key privately. No key was rotated here, and no live env file was overwritten.

## UI and protocol

The selector is a fixed display: DeepSeek V4.1 Flash (Free). It makes zero requests to populate a dropdown. The workspace server layout passes only a sanitized configuration error to the navbar; the key never becomes a browser prop. Existing /api/models and /api/models/select endpoints remain authenticated compatibility endpoints, returning the one fixed selection without provider catalog calls. Attempts to select another model are rejected; model selection does not rewrite historical ProjectSettings.

All eight generation routes and project chat reuse the existing server API, design prompts/schema, SSE/usage handling, editable canvas renderer, save/reopen and export paths. Existing image-slot instructions remain at the beginning of normalized messages. No new route or alternative renderer was introduced.

## Limits, retries and duplicates

- Central generation-sdk boundary sets maxRetries=0 for streamText and generateText, and caps maxOutputTokens at 4,000. Adapter middleware also caps output. Tests observe max_tokens=4000 in the actual OpenAI-compatible wire payload.
- Explicit Google fallback attempts were removed from redesign/workflow-redesign and the shared resilient-stream helper. Legacy getFallbackModel is now only a compatibility name for the same fixed model, never a second provider/model attempt.
- Full normalized text input (system/image-slot instructions, history, user messages, tools/schema) is validated before provider fetch. Limit is configured as 8,000 tokens, enforced via a conservative UTF-8 byte upper bound plus reserved framing overhead. This is deliberately stricter than an exact tokenizer and is NOT logged as actual usage. It can reject text that an exact DeepSeek tokenizer would fit; instructions/HTML/history are not silently truncated.
- Important unresolved capability: no model-compatible tokenizer or documented multimodal preflight counter exists in the inspected setup. Image/drawing/Moodboard inference therefore FAILS CLOSED with an actionable error before provider fetch rather than pretending to fit the 8,000-token budget or discarding images. Uploads/Moodboard persistence and canvas UI are retained, but reference-based inference is NOT verified working under this strict policy. To enable that inference while guaranteeing the budget, supply/review a compatible text+vision token counter. Do not loosen the limit or claim image references were analyzed without it.
- Existing FRAME UI pending guards remain; the server additionally fingerprints requests by authenticated UID, route and normalized body, ignores changing streamId, and rejects identical in-flight requests with 409. The lock is held through response completion/cancellation and released on failure. Variant fields remain distinct. This is per running server instance, not distributed exactly-once enforcement across separate Vercel instances; that would require a shared durable idempotency mechanism and is not claimed here.
- TokenHarbor failures are sanitized before reaching SDK errors/SSE; raw rejection bodies can echo keys and are discarded. Redirects are not followed. Keys are never included in model messages or the request JSON body.

## Changed files

New production modules: lib/ai/fixed-model.ts, lib/ai/tokenharbor.ts, lib/ai/generation-sdk.ts, lib/ai/generation-guard.ts.

Updated production files: lib/ai/provider-registry.ts, lib/ai/model-listing.ts, lib/ai/moodboard-model.ts, lib/ai/resilient-stream.ts, lib/ai/with-personal-provider.ts, lib/ai/project-chat-response.ts; app/api/generate/route.ts and convert/redesign/retheme/style/theme/workflow/workflow-redesign route.ts; app/api/models/route.ts and select/route.ts; components/canvas/model-selector.tsx; components/navbar/index.tsx; app/(protected)/dashboard/[session]/(workspace)/layout.tsx; .env.example.

Tests: new tests/tokenharbor.test.cjs; updated tests/ai-usage.test.cjs, frame-generator.test.cjs, generation.test.cjs, image-message-order.test.cjs, moodboard-generation.test.cjs, personal-provider-keys.test.cjs, project-ownership.test.cjs. Obsolete seven-provider routing/vision loops were consolidated into fixed-policy tests; generic middleware, persistence/rendering/export, error and ownership regressions retained. Tests do not claim production has those old routes enabled.

Build evidence: reports/production-readiness-build.json and .log refreshed by the existing isolated build runner. No secrets/env files or user data copied into that build.

## Verification results

- Focused TokenHarbor tests: 6 passed. Real installed AI SDK/adapter with intercepted fetch verifies endpoint, model, key header secrecy, 4,000 output cap, zero retry even when caller requests retries, oversized/full-system input rejection before fetch, image-budget rejection, static selector/error rendering, duplicate protection, and successful FRAME HTML SSE including image-slot system instructions.
- Final complete suite: **207 passed, 0 failed, 0 skipped**. Initial historical failures were old multi-provider/fallback policy expectations and were updated to the new required policy rather than restoring old routing. The smaller test count reflects consolidating obsolete seven-provider routing loops, not skipped tests.
- Standalone npx tsc --noEmit: passed. Isolated npm run build: passed, all 46 static pages, with synthetic credentials and no real database/provider connections.
- No real TokenHarbor model call, free-allowance validation, browser session or deployed UI verification was performed. Successful generation evidence is mocked provider transport through the actual SDK/server FRAME route, not a fabricated live claim.

## Next steps

Review the image-token-counter limitation before calling all preexisting image-generation features production-ready. After approving/deploying the code and privately configuring/rotating the server key, restart/redeploy for env changes. Open a saved canvas, confirm the fixed label with no catalog fetch, turn drawing/references off, submit a short FRAME prompt once, and verify one /api/generate request plus one TokenHarbor call. Test configuration errors, 429/manual retry and >budget input; no automatic retries or model switching should occur. Existing output limit may require simpler designs when 4,000 tokens is insufficient.
