# Staging ownership verification — 2026-10-22

## Executed checks

- `node --test tests/project-ownership.test.cjs`: 17 passed, zero failures/skips.
- `npx tsc --noEmit`: passed (exit 0).
- `.env.staging.local` is Git-ignored. Its only configured variable names are DATABASE_URL and DIRECT_URL; no values were printed.
- Inspected the existing Prisma loader, Firebase client, route guards, test fixtures, and staging migration/assignment tooling. No existing live two-account staging runner was found.

These are local tests, NOT live staging acceptance tests. Tokens are RSA-signed synthetic identities verified through the application verifier with a test certificate. Database/filesystem/provider operations use instrumented stubs; a generated Prisma client test inspects PostgreSQL SQL through a non-network adapter. No Firebase accounts were created or signed in, and no database was connected in this verification phase.

Coverage: owner-scoped lists/detail/server loaders; both identities can edit/delete their own synthetic project while cross-owner mutations fail; forged client UID ignored on creation; nested settings/styles, uploads/assets, all eight generation handlers and model selection reject foreign project IDs; anonymous requests fail before side effects; concurrent request/SSE identities remain isolated; integration keys are owner-bound. Actual provider generation success and real storage persistence are not established by these checks.

## Blockers before live acceptance

1. A confirmed running staging application origin using the current ownership-enforcing source, with an isolated runtime environment explicitly loading staging DATABASE_URL/DIRECT_URL and the intended Firebase configuration. A staging deployment is optional: a properly isolated local application can serve this purpose. No such origin or runtime configuration was supplied/verified here.
2. Two distinct real Firebase test accounts in the app's configured Firebase project, with email verification completed for password accounts. No test-account sessions were supplied/established. Do not share passwords or session tokens in reports/chat; sign in through the UI in separate browser profiles.
3. `.env.staging.local` is not automatically selected by ordinary Next.js/Prisma commands. Prisma config falls back to `.env.local` if DIRECT_URL is absent. Do not start an ordinary local command assuming it selects staging. Use a separately reviewed isolated environment with no production fallback.
4. Staging upload storage must be writable/durable for the test, and an existing configured AI provider is needed to verify successful generation (as opposed to authorization denial). No keys rotated or new providers configured.

## Live test plan (pending prerequisites)

- Recheck server-side Neon branch br-square-mud-b4xx4iwp, compute ep-calm-mouse-b4nvpc6s, database neondb before enabling writes. Capture exact database-side JSON of all five legacy projects and their nested records privately for post-run equality checks; do not print private contents.
- Use two separate browser profiles for accounts A/B. Confirm distinct verified server identities. Create one clearly labelled disposable ownership-test project in each account through the application. Never use a legacy ID for edit/delete/upload/generation tests.
- Record only the two newly returned test project IDs. Verify each new row's ownerUid matches its server-verified creator. A may legitimately list the five assigned legacy projects; B must not list them. Open each own test project and edit it, then confirm persistence.
- In both directions, call project GET/PATCH/DELETE, autosave, thumbnail/style-guide, model/settings, upload create/read/delete, asset read/save, and each generation endpoint with the OTHER test project ID. Expect 404 without side effects. Test read denial of legacy projects from B only; never mutate legacy records.
- For valid owners, test nested style/settings edits, a harmless image upload/read/delete, and one supported generation operation. Confirm the foreign account cannot fetch those nested IDs/paths. Verify denied generation never reaches a provider.
- Repeat protected requests without a session: expect 401; protected page navigation may redirect to sign-in. Check invalid/unverified sessions separately.
- Delete only the two captured disposable test IDs as their respective owners. Confirm cross-owner deletes fail first. Recompare every legacy field/timestamp and nested record with the before snapshot; validate no orphan test records/assets remain. If any mismatch occurs, stop and report rather than repairing legacy records automatically.

## Changes / safety

Changed `tests/project-ownership.test.cjs` to add symmetric owner edit/delete checks and an anonymous resource-denial matrix; added this report. No application source or runtime environment changed. No staging or production records accessed/modified, no migration/secret rotation/push/deployment performed. The five imported projects were not touched. Live two-user verification remains blocked, not passed.
