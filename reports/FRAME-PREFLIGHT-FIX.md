# FRAME input preflight investigation and fix

## Confirmed cause

The old guard counted `JSON.stringify({prompt, extra})`, including SDK field names, escaped newlines/quotes and part wrappers, then added 512 plus 32 per message. This inflated the estimate; HTTP JSON escape sequences are not literal model text. FRAME's fixed system/image rules, default DESIGN.md and device/target instructions already exceeded that bound before meaningful user input. FRAME has **no conversation history and no response JSON schema**. Neither caused the rejection.

The reproduction used the actual `DEFAULT_STYLE_GUIDE` from `lib/db/projects.ts`, including its complete DESIGN.md, and this 73-byte synthetic prompt: “A clean minimal website with an accessible navigation and pricing section”. Before values below are an offline replay of HEAD's original instructions/message construction with its original counting formula. After values are observed from the actual route and installed SDK with fetch intercepted; no real provider was called.

| Device/target | Previous bound | New bound | Accepted after fix |
| --- | ---: | ---: | --- |
| custom/legacy | 5,080 | 3,301 | yes |
| web/website | 6,028 | 3,781 | yes |
| tablet/website | 5,944 | 3,702 | yes |
| mobile/app | 6,254 | 3,862 | yes |

The old mobile request contained 3,177 bytes of system/image instructions and 2,025 bytes of design/device context before labels and JSON/framing inflation. After compaction the measured components are:

| Device | System/image instructions | Design/device context | User prompt including label | Schema | History | Tools | Framing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| custom | 1,749 | 1,289 | 103 | 0 | 0 | 0 | 160 |
| web | 1,978 | 1,540 | 103 | 0 | 0 | 0 | 160 |
| tablet | 1,978 | 1,461 | 103 | 0 | 0 | 0 | 160 |
| mobile | 2,007 | 1,592 | 103 | 0 | 0 | 0 | 160 |

## Changes

- `lib/ai/tokenharbor.ts`: shared component measurement and content-only accounting before every model invocation. Logs structured `ai_input_preflight` events with method, model, component counts, total, limit and acceptance. Logs contain no prompt/schema content, credentials, user/project IDs or headers. Rejections report the largest component and confirm that no provider request was sent.
- `app/api/generate/route.ts`: separate labelled user/device/design text parts for measurement. Preserve the user request and DESIGN.md verbatim. Remove the duplicated DESIGN.md instruction prefix and repeated Moodboard instruction from the user message; Moodboard instructions remain in the system message. No history is introduced or removed because FRAME sends none.
- `prompts/index.ts`: compact fixed FRAME and device wording, retaining numeric constraints, responsive rules, semantic/accessibility requirements, color pair conventions, editable HTML contract and typography/spacing guidance.
- `lib/design-target.ts`: compact website/application instructions while retaining target identity, default dimensions, responsive behavior and prohibited substitutions.
- `lib/images/image-contract.ts`: compact image instructions while retaining asset markers, roles, orientation, persistence paths, licensing workflow and product-UI/no-fabricated-screenshot rules.
- `tests/generation-limits.test.cjs`: content-once accounting, quotes/newlines/Unicode, schema/tools/history/context separation, 4,000 boundary and oversized rejection. Existing JSON validation tests retained.
- `tests/tokenharbor.test.cjs`: real SDK FRAME route exercises complete default style guide across all four devices/targets, with exactly one call per accepted request; oversized request adds no fetch. Retains fixed model, 4,000 output parameter, zero retries, duplicate and key-secrecy tests.
- `tests/moodboard-generation.test.cjs`: verify image parts by type instead of obsolete array position; confirm Moodboard instructions occur once in system and not again in user text.
- This report; refreshed `reports/production-readiness-build.json` and `.log` contain build evidence.

## Limits and safeguards

Input/output ceilings remain **4,000/4,000**, model remains `deepseek-v4.1-flash:free`. No retries, fallback, schema changes, dependencies, environment changes, database writes or deployments were added.

No compatible DeepSeek V4.1 tokenizer is present in package.json/lockfile. The revised method counts UTF-8 bytes of actual message content once, serialized schema/tools once, plus a framing allowance of 32 per message, 32 for assistant priming and 16 per additional content part. It does not divide bytes by an arbitrary tokens-per-character ratio. It is a conservative local proxy, **not an exact provider tokenizer/chat-template count or observed token usage**. Long or non-English contexts can still be rejected even when actual model tokenization might fit. Image inputs remain explicitly rejected because their token budget cannot currently be verified. Requests with large saved design documents may still legitimately fail the local bound; nothing is silently truncated.

## Verification

- Full suite: **212 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- `node scripts/safe-production-build.cjs`: passed (`npm run build` in an isolated source copy; Prisma 7.8.0 generation, Next.js compilation/build type checks, 46 static pages).
- Build uses synthetic configuration; no real environment files, uploads, SQLite data or .openui data copied. No live TokenHarbor or browser generation was tested.

To verify in the running application, create a text-only FRAME with the default style guide, disable drawing/reference input, use a short prompt, and inspect server/Vercel logs for `ai_input_preflight`. It should show schema/history zero and `accepted:true`. A very large prompt should show `accepted:false` and an SSE error without any upstream API call. A custom saved DESIGN.md may have different component sizes; use the log to identify that overhead explicitly.
