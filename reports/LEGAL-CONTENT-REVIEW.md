# Legal-page content review

Reviewed: 2026-10-20

Updated Terms, Privacy, Security and Cookies with implementation-specific content. Existing fonts/themes/layout are retained; privacy and storage inventories use accessible, horizontally scrollable tables. The reading navigation is bounded for long pages.

## Evidence used

- Repository `LICENSE`: MIT permissions, attribution and warranty wording.
- `prisma/schema.prisma`, `lib/db.ts`, `lib/db/projects.ts`, `lib/db/images.ts`: SQLite persistence, image files and deletion boundaries.
- `app/api/generate/route.ts`, project context/chat code: provider-bound prompts, project context and selected reference images.
- `components/projects/workspace-settings.tsx`, `components/projects/dashboard-shell.tsx`: browser-local profile, header initial and account behavior.
- `hooks/use-project.ts`, `components/canvas/index.tsx`: session-storage starter handoff and consumption.
- `app/layout.tsx`, installed next-themes configuration: theme preference storage.
- `components/ui/sidebar.tsx`: optional seven-day sidebar_state cookie. No active application consumer was found; the notice distinguishes this reusable component from the current dashboard sidebar.
- `lib/workspace-key.ts`, key/integration API routes: random key generation, SHA-256 storage, timing-safe comparison, local-origin writes and limited integration scope.
- `app/api/upload/route.ts`: 10 MB upload limit and declared MIME allowlist; no claim of scanning or sanitization.
- API handlers and repository dependencies: no general authenticated multi-user layer or connected checkout is represented as available.

Browser-storage lifecycle descriptions were checked against [MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API), and [HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies). Notice topics were informed by [ICO transparency guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/); this does not assert that UK law applies or that the deployment is legally compliant.

## Information not established

Registered operator/entity, public privacy/security email, country/jurisdiction, deployment-specific processing grounds and provider-account retention settings were not supplied. The pages explain the local-installation scope and link the existing Contact page rather than inventing these details. They do not claim compliance certification, universal privacy rights/response deadlines, a bounty program, no-training provider terms, managed encryption or a refund policy.

## Verification

- TypeScript: passed.
- Tests: 69 passed, 0 failed, including footer-page and content-link checks.
- All four pages: live HTTP 200, reviewed date present, expanded sections rendered; inventory tables rendered on Privacy and Cookies.
- Actual browser visual verification remains unavailable.

## Changed files

- `lib/legal-pages.ts`
- `lib/site-pages.ts`
- `components/site/content-page.tsx`
- `tests/site-pages.test.cjs`
