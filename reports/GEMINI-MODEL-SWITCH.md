# Gemini generation switch

Date: 2026-10-27

## Implementation

Generation now uses Google's direct Gemini API through the existing installed @ai-sdk/google adapter. The fixed model is gemini-3.5-flash-lite and the selector displays Gemini 3.5 Flash-Lite without fetching a model catalogue. Google's current model documentation lists this exact stable model: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite . The installed adapter accepts custom model IDs; no dependency changes were necessary.

The active TokenHarbor transport was replaced. Historical provider names remain in the ProviderKey type solely for reading saved selections. Stored project or personal-provider selections cannot redirect generation to DeepSeek or another provider. No project/database records were modified.

The existing FRAME prompts, image-slot contract, Google systemInstruction conversion, SSE, local JSON validation, usage logging, ownership checks, 4,000 input/output limits, no-retry boundary and in-process duplicate-request guard remain in place. Input accounting remains the existing conservative UTF-8 content proxy, not an exact Gemini tokenizer. Existing rejection of image inputs whose tokens cannot be validated remains unchanged; this switch does not claim to enable moodboard multimodal generation. The selected model already has an exact provider/model pricing entry in the existing usage-pricing configuration. No pricing values were changed.

## Configuration

- GEMINI_API_KEY: required, server-side only. A nonempty value was found locally; its value was never printed or modified.
- GEMINI_MODEL: optional; defaults to gemini-3.5-flash-lite. Any other explicit model ID fails closed.
- TOKENHARBOR_API_KEY / TOKENHARBOR_MODEL: no longer read by generation. Existing real environment files were not edited.

For Vercel, configure GEMINI_API_KEY in the intended environment before a separately authorized deployment. GEMINI_MODEL can be omitted or set to gemini-3.5-flash-lite. Local changes require restarting the Next.js development server.

## Production source files

- lib/ai/fixed-model.ts
- lib/ai/gemini.ts (replaces lib/ai/tokenharbor.ts)
- lib/ai/provider-registry.ts
- lib/ai/model-listing.ts
- lib/ai/moodboard-model.ts
- lib/ai/generation-guard.ts
- app/api/models/route.ts
- app/api/models/select/route.ts
- app/(protected)/dashboard/[session]/(workspace)/layout.tsx
- .env.example (blank key placeholder and fixed model only)

The existing selector component derives its label from fixed-model.ts and needed no separate UI edit.

## Regression tests

- tests/gemini.test.cjs replaces tests/tokenharbor.test.cjs: real installed Google SDK with mocked HTTP responses; exact generateContent/streamGenerateContent endpoints, header-only key, output parameter, no retries, configuration failures, oversized input, selector rendering, schema validation, duplicate protection, and FRAME SSE for custom/web/tablet/mobile.
- tests/image-message-order.test.cjs: real Google request format, separate leading systemInstruction, ordered user/model history, image contract and old trailing-system rejection.
- Updated existing fixtures/assertions in tests/ai-usage.test.cjs, tests/frame-generator.test.cjs, tests/generation-limits.test.cjs, tests/generation.test.cjs, tests/moodboard-generation.test.cjs, tests/personal-provider-keys.test.cjs and tests/project-ownership.test.cjs.

## Results

- Flash-Lite-only regression: stale DeepSeek/Gemini 3.8/OpenAI selections all send requests only to gemini-3.5-flash-lite; an explicit nonmatching server GEMINI_MODEL rejects before fetch.
- Full Node test suite: 216 passed, 0 failed, 0 skipped.
- npx tsc --noEmit: exit 0.
- Isolated production build (scripts/safe-production-build.cjs): exit 0; Prisma 7.8.0 generation, Next.js compilation, type checks and 45 static pages completed. Synthetic credentials only, no real environment files/data copied. Build evidence: reports/production-readiness-build.json and reports/production-readiness-build.log.
- No live paid/provider request, authenticated browser generation, deployment or database write was performed. Key validity, account model access/quota and actual generated-design quality still require a real generation in the running application.

## Browser acceptance

1. Restart the local development server and sign in.
2. Open an owned project; confirm the selector shows Gemini 3.5 Flash-Lite.
3. Generate a short text-only website prompt, then an app-screen prompt; confirm the existing canvas receives editable output.
4. Inspect server ai_usage_call / ai_usage_summary logs for provider google and the returned actual model ID. Do not copy headers/keys into logs.
5. Check manual retry/error behavior if quota or model access is denied. No automatic fallback should run.

No push or deployment was performed.
