# TokenHarbor 4,000 input/output limits

The fixed model remains `deepseek-v4.1-flash:free`. Credentials remain server-side. No environment files, database records, schema, deployments or dependencies were changed.

## Behavior

- The shared model middleware checks the fully assembled prompt (including instructions, history, tools and response schema) before each provider invocation. The input ceiling is now 4,000.
- Input checking uses a conservative UTF-8 byte bound plus framing allowance, not the model's exact tokenizer. It can reject requests that would fit. Image inputs remain explicitly rejected because their input budget cannot currently be verified. No user requirements or history are silently truncated.
- Fixed FRAME instruction scaffolding was compacted while retaining design-token, device, spacing, typography, accessibility and editable HTML rules. Existing schemas and pipeline formats remain unchanged.
- The installed OpenAI-compatible adapter sends `max_tokens: 4000` for standard generation. Shared wrappers enforce a maximum output of 4,000 and zero automatic retries; the existing fixed-provider policy and duplicate-request guard remain active. Duplicate protection is per application instance, not distributed across Vercel instances.
- Theme/style results are explicitly parsed with their existing schemas before saving. Project-chat JSON is buffered and validated with the existing plan parser before emitting renderable SSE text; malformed, truncated or invalid JSON emits an error. HTML FRAME generation retains progressive streaming.

## Changed implementation/test files

- `lib/ai/fixed-model.ts`: input ceiling.
- `lib/ai/tokenharbor.ts`: limit error messages; existing per-call guard reused.
- `app/api/generate/route.ts`, `prompts/index.ts`: compact fixed FRAME instructions without trimming supplied requirements or design context.
- `app/api/generate/theme/route.ts`, `app/api/generate/style/route.ts`: explicit existing-schema validation.
- `lib/ai/project-chat-response.ts`: 4,000 output setting and plan validator.
- `lib/ai/resilient-stream.ts`, `lib/ai/route-utils.ts`: optional complete-output validation before JSON text emission.
- `tests/tokenharbor.test.cjs`: revised input limit; actual installed SDK structured-output success/failure coverage.
- `tests/generation-limits.test.cjs`: input boundary, schema/context, Unicode, unchanged requirements, JSON buffering/failure and progressive HTML coverage.

## Verification

- Full Node test suite: **211 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: **passed**.
- Production build (`node scripts/safe-production-build.cjs`, running `npm run build` in an isolated copy): **passed**, Prisma 7.8.0 generated, Next.js compilation and build TypeScript checks passed, all 46 static pages generated. The isolated builder uses synthetic configuration and copies no real environment files, uploads or database data.
- Provider tests intercept fetch: exact endpoint/model, output parameter, no retries, configuration errors, duplicate suppression and key secrecy are tested without calling TokenHarbor or spending credits. Live provider/browser generation is not verified.

Existing build evidence is refreshed in `reports/production-readiness-build.log` and `reports/production-readiness-build.json`.
