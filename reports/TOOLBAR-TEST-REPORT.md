# Screen toolbar test report — 16 October 2026

## Result
All seven requested panels were exercised in the local application. Bugs were fixed, 20 automated regression tests pass, and TypeScript checking passes. This is not a claim that every generated application has a real backend or that every export has passed a production build.

Tests used a separate project (`cmvay7lkr0000uguy8zpr032r`) and a synthetic, non-personal interface. The original FitTrack project had four saved screens; its screen HTML was compared with the backup and remained unchanged.

| Panel | Checks and outcome |
| --- | --- |
| Sandbox | Start/stop changes iframe interaction state. A button without an application handler shows explicit prototype feedback. PASS. |
| Export | HTML and PNG downloaded; PNG inspected at 750×1784. ZIP downloaded and verified to contain index plus four screen files. React, Vue, Angular and Svelte conversions generated code and downloaded the corresponding component files through the UI. PASS for these operations. |
| Copy | HTML copy displayed success feedback. Added focused-textarea fallback for browsers denying Clipboard API. Clipboard read-back returned empty in this embedded browser, so actual paste contents remain UNVERIFIED; download alternatives pass. |
| Theme | Exercised ten preset selections, dark switch, accent, font, radius, Apply All, and DESIGN.md import/export. Blue accent and Inter font were checked through rendered styles. Not every property of every preset received a computed-style assertion. |
| Preview | Mobile 375×812, tablet 768×1024, desktop 1600×900, zoom, and close exercised. Open in New Tab could not be verified because the browser blocked blob navigation. |
| Translate | Mobile/tablet/web live endpoint checks pass. Actual toolbar Tablet action changed the screen width to 768px and rendered content. Mobile/web were endpoint-tested, not separately clicked in the toolbar. |
| Workflow | Actual toolbar produced four complete additional screens, cleared generation state, and retained reference styling. All four live generation endpoint checks pass. |
| Chat | Local reference-file import, prompt send, successful redesign and clear-history state verified in UI. Error/stop-spinner/retry behavior covered by regression checks; provider failure does not overwrite the original design. |
| Compare (additional control) | 2-up/3-up/4-up selected; all five test variants accessible. Pick left one test screen and closed the dialog. PASS on disposable QA content. |

## Fixes
- Shared resilient streaming for conversion, workflow and retheme; one conditional fallback before output, no hidden switch after partial output, and SDK automatic retries disabled for these paths.
- Retired Gemini fallback replaced with Gemini 3.5 Flash Lite after live provider rejection. Google model discovery reads the provider model-list endpoint rather than a stale fixed list. See [Google model-list documentation](https://ai.google.dev/api/models).
- Full HTML conversion input retained, with framework code-fence cleanup.
- Workflow uses source design/style context and source frame width; generation failures clear pending state.
- Theme changes persist one HTML override, propagate variables, preserve contrast on dark surfaces, and keep the settings popover scrollable.
- Preview sizing and code-dialog responsiveness corrected.
- Chat Import now reads supported local reference files, rather than being an inactive control.
- Conversion errors now remain visible with Retry conversion, instead of leaving an unexplained empty code dialog.
- Compare initial column count is clamped, all variants remain accessible, and its dialog fits smaller windows.

## Evidence
- `npm test`: 20 passed, 0 failed.
- `npx tsc --noEmit`: passed (rerun after final edits).
- `reports/toolbar-api-results.json`: 12/12 successful synthetic live checks (four conversion, three translation, four workflow, one chat redesign).
- React and Angular sample output: TypeScript syntax diagnostics empty. Vue and Svelte: structural checks and downloads; full framework builds were not performed.
- Initial retired-model failures retained in `reports/toolbar-api-retired-model-failures.json`; these are not counted as passes.
- One actual Vue conversion initially failed; a separate explicit retry succeeded. Provider calls can still fail, and retry/error handling is part of the result.
- Screenshots: `toolbar-qa-verified.jpg` (five completed test screens), `toolbar-qa-winner.jpg` (Compare winner result).

## API calls and tokens
The successful 12-case live API matrix made at least 12 generation requests. Additional calls were made for initial retired-model diagnosis, one targeted workflow retest, and actual UI interaction tests. The test harness did not persist usage metadata, so an exact aggregate token count or total provider-call count cannot be reconstructed reliably; no token total is invented here.

Normal conversion, translation and chat actions each make one generation request; Workflow intentionally makes four. Conditional fallback may add one provider attempt per failing request. Local theme changes, preview, copy, HTML/PNG/ZIP export and Sandbox need no generation call. Removing reference HTML truncation improves consistency but can increase input tokens. No measured token-reduction percentage is claimed.

## Limits
Preview Open in New Tab remains browser-restricted in this environment, and clipboard paste contents remain unverified. A full production build and exhaustive runtime validation of generated framework applications were not performed. Generated prototype actions do not imply connected workout/account backends.

Automatic approval review rejected the initial batch that would have sent real profile content to an AI provider across all test operations. The batch was replaced with a non-personal synthetic fixture in a separate QA project; no restriction was bypassed.
