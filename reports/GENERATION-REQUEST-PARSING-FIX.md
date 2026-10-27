# Generation request parsing and guard correction

Date: 2026-10-27

## Evidence and limits

The exact text Invalid generation request. exists only in lib/ai/generation-guard.ts. Its catch covered request.clone(), JSON/multipart parsing, file reads and hashing, and discarded the exception. The supplied message therefore identifies the guard but cannot establish which original operation failed. No raw production request or underlying exception was available; the live incident is not claimed reproduced.

The inspected flow independently cloned/parsed the same body for ownership, duplicate fingerprinting and image context, then the endpoint parsed the original. Repeated body-stream work is unnecessary. A regression fixture demonstrates that when the second clone fails, this old structure would reject a valid request; the corrected structure succeeds with just one clone. Streamed multipart uploads and their actual file content are covered too.

## Changes

- lib/ai/generation-request.ts: request-scoped WeakMap caches one parse of one clone. The original body stays readable by the existing endpoint. Failed promises are cached too. Known errors distinguish unavailable body, invalid JSON, invalid multipart and non-object payloads. Diagnostic generation_request_rejected logs contain only route, stage, reason and abort state; no prompts, headers, keys, user IDs or uploaded content.
- lib/ai/with-personal-provider.ts: authorization uses the shared parsed body while retaining verified identity, origin and project ownership checks.
- lib/ai/generation-guard.ts: fingerprint reuses the shared body; hashing, UID/route scoping, streamId exclusion, active-request rejection and lock release remain intact. Errors have actionable messages and reason codes rather than a generic message.
- lib/images/generation-pipeline.ts: image-reference context reuses the shared parsed body.
- tests/generation-request.test.cjs: shared JSON parse with failure-on-second-clone fixture; streamed multipart with an image; malformed JSON/multipart and safe logs; equivalent uploads with different stream IDs still return 409 while active and succeed after release.

No new API route/dependency, authentication bypass, token cap or provider change was introduced. No request content was silently dropped. Model remains Gemini 3.5 Flash-Lite.

## Verification

- Focused request, Gemini and ownership tests: 32 passed, 0 failed.
- Full suite: 220 passed, 0 failed, 0 skipped.
- npx tsc --noEmit: exit 0.
- Isolated production build: exit 0, including Prisma generation, Next.js compilation/type checks and 45 static pages. Synthetic credentials only.

No real model request, database write, environment edit, push or deployment was performed. Production acceptance remains necessary: retry the original request after deployment. If it fails, inspect generation_request_rejected for the exact stage/reason; malformed or interrupted requests are still rejected safely.
