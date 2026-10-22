# COLOR inspector update investigation

## Confirmed findings and limits

No browser is connected, and the user does not have the expanded error stack yet. The saved localhost browser logs do not contain this maximum-update-depth error. Therefore the component at the top of the reported runtime stack and the complete recursive cycle remain **unconfirmed**. Do not interpret passing build/tests as verification that the browser error is fixed.

Code inspection confirmed redundant synchronization in `ElementInspectorProvider`:

- `refresh()` always published a new selection and computed-info object even when every value was identical. This updates all context consumers on an unchanged read.
- Applying an already-saved color (or resetting an already-reset color) still synchronized the DOM, dispatched an edit and refreshed the inspector. Depending on gesture history state, an unnecessary history entry could also be requested.
- Placeholder synchronization always removed and recreated its style rules, even when identical. This is unnecessary stylesheet mutation during state/history synchronization.
- The context value object was recreated on every provider render, even when its fields were unchanged.

These are proven redundant-update defects, not proof of a self-sustaining React effect cycle. The COLOR draft synchronization depends on a string (`control.value`), not the recreated control object; its preset effect depends on `resolvedTheme`, not the preset array. Existing inspector callbacks use stable callback dependencies. The undo/redo observer depends on Redux entities and does not dispatch itself; the save architecture was left intact.

## Changes in this follow-up

1. `components/canvas/element-inspector/context.tsx`: preserve selection identity when its plain-data description is unchanged; memoize the context value; return early for unchanged saved HTML; compare color attributes before writing; skip identical placeholder rules. Changed colors still use the existing live-DOM, Redux history, save and export architecture.
2. `tests/element-colors.test.cjs`: three new regression tests execute the actual provider with isolated hook scheduling and DOM/store fixtures, and the actual placeholder synchronization utility. They verify repeated unchanged refreshes do not commit state, repeated identical color/reset events do not dispatch, genuine changes update state, undo/redo still work, and identical placeholder rules cause no writes. These are not React DOM/browser tests.
3. This report and command-output logs under `reports/color-update-loop-*`.

Earlier uncommitted COLOR implementation files remain in the workspace; this follow-up does not redesign or remove those controls, change export behavior, add dependencies, or change APIs/schema.

## Verification

- New regressions: all three pass. An in-memory baseline run with only the three new idempotency guards removed fails exactly these three tests (8 existing tests pass, 3 fail). No production file was reverted for that check.
- `npm test`: **142 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including compilation, TypeScript and generation of all 46 static pages.
- `git diff --check`: passed.

The baseline reproduces redundant state/DOM/Redux writes. It does not reproduce the user's exact React runtime exception. Browser verification is still needed.

## Capture the missing stack in Chrome

1. Run the app in development mode and open the affected canvas. Press **F12** (or **Ctrl+Shift+J**) and select **Console**.
2. Enable **Preserve log**, clear the console, then reload. Repeat the exact action that triggers the error: selecting an element, editing hex/alpha, resetting, or undo/redo. Note which action triggers it.
3. Expand the red **Maximum update depth exceeded** entry and every collapsed stack/component-stack group. If Chrome hides frames, select **Show ignore-listed frames**. Right-click the entry and choose **Copy stack trace** (or **Copy message** if stack copying is unavailable). Paste the complete text, especially the first application file and line number.
4. If the console entry lacks the originating application frame: in **Sources**, enable **Pause on exceptions**, also enable **Pause on caught exceptions**, reproduce once, and copy the **Call Stack** from the paused exception. Disable pause-on-caught afterward if it stops on unrelated application exceptions.
5. Check the COLOR controls again after the patch: edit hex and alpha, reset, undo/redo, save/reopen, and export. Capture a new stack if the runtime error persists.

No API keys or environment values are needed in that stack; omit unrelated network payloads or credentials.
