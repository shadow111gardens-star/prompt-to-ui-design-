# Gemini input preflight correction

Date: 2026-10-27

## Confirmed cause

The production transformParams middleware compared UTF-8 byte totals plus a framing allowance directly with a 4,000-token limit. Bytes are not Gemini tokens. Project-chat and redesign envelopes also classified stored HTML/reference context as userPrompt, making the error suggest that the user's typed request alone was oversized. No original failing request payload was available, so its actual token count cannot be asserted.

## Changes

- lib/ai/gemini.ts: retain byte measurements for size diagnostics only; classify project-reference and redesign envelopes separately. At the existing Google SDK fetch boundary, send the entire native request to the same fixed model's official countTokens endpoint using generateContentRequest (model, contents, systemInstruction, tools and generationConfig/schema). Generate only after a validated non-negative integer count is at most 4,000. Preserve the original body and all requirements. Never divide bytes by an invented ratio or silently truncate context. Count failures/timeouts/invalid responses stop generation with a readable error. Requests remain server-side, fixed to gemini-3.5-flash-lite; no new route, dependency, fallback or retries. Existing 4,000 output cap is unchanged.
- lib/ai/usage-logging.ts: track transport state per adapter attempt using AsyncLocalStorage. Token-count-only rejections have generationRequestSent:false and do not increase aiCalls; aiAttempts retains the attempted operation. Unknown usage remains null.
- tests/gemini.test.cjs: real installed SDK/native body fixtures for streaming FRAME, schema generation, image input, exact token-count gate, no retry/fallback, 18,436-byte synthetic regression, privacy, and preflight-only summary counts.
- tests/generation-limits.test.cjs: actual-token boundaries 3,999 / 4,000 / 4,001; unchanged content/schema; diagnostic byte classification.

Official API contract: https://ai.google.dev/api/tokens . CountTokens accepts the full generateContentRequest rather than contents alone, preserving system/schema/tool accounting. One countTokens request is added before each generation request, with a 15-second timeout, existing cancellation signal, header-only key and no retries. This is a token-counting operation, not design generation.

## Live count-only evidence

reports/GEMINI-PREFLIGHT-COUNT-CHECK.json records a real request to gemini-3.5-flash-lite:countTokens using synthetic text, not project data. The old diagnostic was exactly 18,436 units; the provider returned 3,480 tokens and the new preflight accepted it. Zero generation requests were sent in that live check. These numbers do not claim to measure the user's unavailable original prompt.

## Verification

- Focused Gemini, generation-limits and usage tests: 23 passed, 0 failed.
- Full Node suite: 218 passed, 0 failed, 0 skipped.
- npx tsc --noEmit: exit 0.
- Isolated production build: exit 0; Next.js compilation, TypeScript and 45 static pages passed. Synthetic build credentials only. Evidence: reports/production-readiness-build.json and reports/production-readiness-build.log.
- No production data/env changes, push, deployment or real design generation performed during this fix.

## Runtime logs and browser check

ai_input_components reports UTF-8 size diagnostics, explicitly labelled as bytes. ai_input_preflight reports method:gemini_count_tokens, actual inputTokens, limit, accepted and tokenCountRequestSent. generationRequestSent:false means no generation request has been sent at that stage; ai_usage_call later records actual transport state. ai_usage_summary.aiCalls excludes preflight-only failures. Prompts, HTML, keys and user/project identifiers are not logged.

Restart the local dev server, open an owned canvas and repeat the original prompt. Confirm the complete request is accepted when Gemini counts at most 4,000 tokens. A request genuinely above that total still rejects, without generating or discarding requirements. A production deployment is needed for the live Vercel site to use this code; it was not performed here. The original authenticated browser reproduction remains to be checked.
