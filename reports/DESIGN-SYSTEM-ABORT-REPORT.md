# Design System request cancellation — 16 October 2026

## Findings and reproduction
The existing development log contains the exact historical error: `[browser] unhandledRejection: AbortError: signal is aborted without reason`. Its creation stack maps to `controller.abort()` in DesignSystemPage's effect cleanup (the compiled cleanup was inspected). Cleanup aborted the controller unconditionally, including after fetch and JSON reading had completed, and during effect disconnect/reconnect.

The original effect already had a try/catch around awaited fetch and response.json(). It would therefore be inaccurate to describe this as simply a missing fetch catch. The precise promise branch responsible for the historical unhandled overlay was not reproducible on demand in the currently served page: pre-fix navigation did not add a new error. The log proves the cleanup creation point; it does not independently prove which downstream observer surfaced that historical rejection.

Cancellation itself was reproduced with a real local HTTP server that sends JSON headers and a partial body, then stalls. Cancelling the page request causes native response.json() to reject with AbortError. The regression verifies this rejection is consumed with no success/error UI callback after cancellation. In-flight fetch cancellation is tested separately.

Other confirmed lifecycle defects: the non-OK HTTP response branch lacked a stale-request guard, and the broad `if (signal.aborted) return` catch could hide a genuine unrelated error that happened to race with cleanup. The outer async effect task had no terminal rejection handler for failures outside its inner fetch/json catch.

## Changes
- `app/(protected)/dashboard/[session]/(workspace)/design-system/page.tsx`: delegates request ownership to the cancellable loader, resets readiness when loading, and keeps existing loading/editor/error behavior.
- `lib/load-project-style-guide.ts` (new): a separate controller and active flag for each effect run; deferred start skips the discarded Strict Mode setup; cancellation aborts only pending work; guards after both fetch and JSON; expected cancellation requires the owned signal to be aborted and an AbortError/matching reason; real failures are reported and visible while active; terminal task rejection is owned.
- `tests/generation.test.cjs`: seven additional cancellation/lifecycle regression cases.

AbortController is retained. There is no global error suppression and React Strict Mode remains enabled. The installed Next.js App Router development build defaults Strict Mode on; no strict-mode configuration was changed. A previous effect's cleanup cannot abort the replacement effect's independent controller. Completed requests are not aborted.

`next.config.ts` is unchanged: turbopack.root remains __dirname and the existing development disk-cache setting remains intact.

## Verification
- `npm test`: 34 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- Real HTTP partial-body cancellation: native AbortError reproduced and handled.
- Strict Mode setup-cleanup-setup: only active request starts; its signal remains usable; cleanup after completion does not abort it.
- Late fetch results, late HTTP errors and body readers ignoring abort cannot update stale UI.
- HTTP 503, malformed JSON, network failures and unrelated AbortErrors remain reported; genuine errors racing with unmount are reported without stale state writes.
- Live page opened, editor populated, and three Style Guide → Design System navigation cycles completed. Switching to the separate QA project showed QA content; returning to the original project restored its editor.
- Browser error log after retest: empty. Server error log remained at its pre-test 9696-byte baseline; no fresh AbortError was appended.
- Style-guide GET returned HTTP 200 and the existing autosave PATCH returned HTTP 200.
- Screenshot: design-system-abort-fixed.jpg.

The exact historical runtime overlay was verified in the saved log but not freshly triggered before this change. The cancellation path was reproduced with native HTTP/fetch and the live page was retested; the verification should not be read as proof of an independently isolated framework-level bug.
