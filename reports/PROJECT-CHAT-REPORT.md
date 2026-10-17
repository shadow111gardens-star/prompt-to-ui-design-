# Project Chat implementation and verification

Verified on 17 October 2026 (Asia/Calcutta).

The existing canvas now has a Chat toggle in the bottom toolbar and a compact dark right panel with history, multiline input, Send, Close, Cancel and Retry. At desktop widths the canvas reserves 360px; at narrower widths the panel overlays the right edge above the toolbar. No additional navigation/sidebar or bottom panel was added.

## Architecture and project safety

- Reuses `/api/generate/redesign` with a `project-chat` mode; no new API endpoint, schema migration or dependency.
- Resolves the active project's selected provider/model on the server, and reuses resilient SSE streaming. API credentials stay server-side.
- Each request includes all generated screens' identified HTML and dimensions/positions, current screen and element selection, live style guide/DESIGN.md tokens, viewport, and the latest 20 project chat messages. Existing screen HTML remains the design reference when saved tokens differ.
- The AI returns validated operations: create screen, targeted element patch, screen redesign, or answer without changes. There is no delete operation or arbitrary Redux mutation command.
- New screens use the existing generated-screen factory. Existing IDs and unrelated screens are preserved. Element patches use the existing source-preserving HTML editor. Font changes retain the font stylesheet reference.
- Redesigns and changes across multiple screens require review and Apply. Previews use a script-disabled iframe. Discard preserves existing source.
- A complete response is validated before any edit. Canvas changes are atomic and join existing undo/redo history. Baseline checks reject stale or locked targets rather than overwriting newer edits.
- Request abort, timeout and active-project guards prevent stale responses from mutating another project. Cancelling discards pending AI operations.
- Chat history is part of the existing serialized project sketches state and autosave workflow. Project loading restores its own history and clears another project's history. Autosave refuses a project/state ownership mismatch and flushes on canvas unmount during SPA navigation.
- The toolbar, minimap and fit-to-screen calculations account for panel width. Inspector and Chat share the right-hand workspace without overlapping each other.

## Actual live verification

Used an isolated project, **Project Chat QA**, ID `cmvbczj7b0003ikuy33svvbcx`, with existing mobile/tablet fixture screens. Original FitTrack screen content was not edited for this task. The QA project uses Google Gemini 3.5 Flash Lite.

| Test | Result |
| --- | --- |
| Open/close Chat from bottom toolbar | Passed |
| Ask about actual colors/fonts | Answer referenced actual screen overrides (Georgia/rose) and saved tokens; no design mutation |
| Add Settings screen | New third screen appeared; both original IDs remained, and tablet source was byte-for-byte unchanged at this stage |
| Edit selected button | Background changed to `rgb(37,99,235)`; label `Begin session` retained |
| Redesign only Settings | Review/visual preview opened; Apply changed Settings content and retained its screen ID |
| Consistent buttons across three screens | Actual provider high-demand failure displayed Retry; retry succeeded, offered a three-screen review, then Apply updated buttons |
| Verify rendered button styles | Mobile/tablet rendered purple `rgb(124,58,237)`, 14px radius and weight 600 |
| Resize selected card through chat | Reloaded card rendered width 250px, padding 12px, auto content height; no vertical content overflow |
| Cancellation | Cancel during new-screen request displayed cancellation; project remained at three screens |
| Project switch during request | Other project opened with separate empty chat, without the QA history; returning restored QA history |
| Reload | Settings, button styles, card changes and completed chat history remained |
| Desktop responsive layout | At 1440px, canvas measured 1080px and Chat 360px |
| Pan/zoom with Chat | Pan moved rendered frame by 30px/20px; zoom controls and selection tools remained functional |
| Fit to screen with Chat | Fixed window-width fallback; all three frames fitted inside remaining canvas (leftmost x60, rightmost ending about x1020 within 1080px) |
| HTML and PNG exports | Downloaded edited mobile screen; HTML retained 250px card and 14px button radius, with no chat UI embedded |
| ZIP export | Downloaded selected Settings package with 10 entries |

The existing per-screen toolbar can overlap adjacent screen toolbars at some zoom/spacing combinations. HTML/PNG export controls were verified using keyboard activation when pointer overlap occurred. This existing toolbar layout limitation is separate from the new bottom Chat toggle.

## Automated verification

- `npx tsc --noEmit`: passed, exit 0, after final source edits.
- `npm test`: **51/51 passed**. Includes existing generation, redesign, provider streaming, theme, cancellation and element-editor regressions.
- New tests cover bounded operation parsing, unsupported/deletion rejection, source isolation, unsafe values, selected-element targeting, locked/stale targets, atomic transactions, undo behavior, project-owned history, selected provider/model context, and safe SSE cancellation.
- No production build was run. A new paid framework conversion was not needed; HTML/PNG/ZIP were live-tested.
- Browser screenshot capture returned `Unable to capture screenshot` in the final verification session; the live preview remains available instead of presenting a fabricated screenshot.

## Source files changed

1. `components/canvas/project-chat.tsx` (new): panel, request lifecycle, history display, validation/application and proposals.
2. `lib/project-chat.ts` (new): operation schema, prompt and safe change preparation.
3. `lib/ai/project-chat-response.ts` (new): project-aware model resolution and SSE response.
4. `app/api/generate/redesign/route.ts`: dispatch existing route's project-chat mode.
5. `redux/slice/shapes/index.ts`: persisted project history/owner and atomic chat transaction.
6. `components/projects/provider/index.tsx`: supply project identity when restoring state.
7. `components/canvas/autosave/index.tsx`: ownership guard and navigation flush.
8. `components/canvas/index.tsx`: project panel integration and toolbar toggle events.
9. `components/canvas/toolbar/shapes/index.tsx`: Chat toggle.
10. `components/canvas/toolbar/index.tsx`: available-width calculation.
11. `components/canvas/minimap.tsx`: panel-aware placement.
12. `hooks/use-canvas.ts`: fit-to-screen measures the actual canvas from toolbar hook instances.
13. `lib/ai/route-utils.ts`: cancellation-safe stream writes.
14. `tests/generation.test.cjs`: regression tests.

No changes to `next.config.ts`, lockfiles, package manager, dependency list or Prisma schema.

## Supported operations and limits

Verified: design questions, new screens, selected-element styling/dimensions, named-screen redesign and multi-screen styling. Element editing supports the existing editor's static HTML/CSS properties, text and safe attributes; it does not edit chart datasets, arbitrary application backend behavior or cross-origin widgets. This is project design editing, not a general code-execution agent.

Requests are explicitly bounded to 60 generated screens and 700,000 context characters; oversized projects receive a clear error rather than silently omitting screens. Each HTML screen is limited to 250,000 characters. Only the latest 20 messages are sent as conversation context, while saved chat history is retained. Provider availability and generation quality can vary; validation/failure/cancellation leaves pending operations unapplied. Unapplied proposals are not persisted across reloads. As with existing debounced autosave, allow saving to complete before abruptly closing the browser.

Preview: http://localhost:3000/dashboard/workspace/canvas?project=cmvbczj7b0003ikuy33svvbcx

Evidence: `project-chat-live-checks.json`, `project-chat-export-checks.json`, and the saved QA project/history.
