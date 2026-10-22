# Workspace Web / App selection

Added a theme-matched Web/App toggle at the bottom-left of the workspace prompt composer. App is initially selected, preserving the existing workspace wording. Web switches the heading, description, prompt placeholder and suggestions to website language. Both controls are keyboard-accessible toggle buttons and are disabled during project creation.

The selected target is sent through the existing new-project flow and stored in the project's existing sketches JSON. Web creates a 1600×900 initial frame; App creates a 375×812 frame. Redux loading and existing autosave retain the target after reopening. Older projects without a saved target keep their previous behavior, and switching to an older project clears the prior project's target.

Server-side generation reads the saved project target. Workspace chat, direct frame/Moodboard generation, redesign and workflow generation receive website-specific or application-specific system instructions. Web requests responsive website navigation/sections/content; App requests mobile-first task-oriented screens and application controls/navigation. The user's prompt is preserved verbatim. This guides AI generation; no live AI output is claimed as verified.

Files changed for this request:

- `components/projects/workspace-home.tsx`
- `hooks/use-project.ts`
- `redux/slice/shapes/index.ts`
- `lib/design-target.ts` (new)
- `lib/ai/project-chat-response.ts`
- `app/api/generate/route.ts`
- `app/api/generate/redesign/route.ts`
- `app/api/generate/workflow/route.ts`
- `tests/workspace-quick-start.test.cjs`
- `tests/design-target.test.cjs` (new)

Checks: all 168 tests passed (including five new regressions covering the actual selector handlers, project creation payload/frame sizes, autosave/reopen, legacy projects and server chat instructions). TypeScript passed. Production build passed; output is recorded in `reports/design-target-build.txt`. No browser is connected; visual interaction and live generated design quality remain unverified.

Manual check: choose Web, enter a website idea, and use the existing Generate → Canvas flow. Confirm a desktop website frame and website generation. Repeat with App and confirm the mobile application frame/direction. Reopen both projects, edit/generate another screen, and verify their saved direction remains correct. Check the selector at mobile widths and with keyboard navigation.
