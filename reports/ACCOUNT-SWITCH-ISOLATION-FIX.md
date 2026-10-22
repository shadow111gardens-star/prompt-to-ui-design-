# Account-switch project isolation fix

2026-10-22. Local source/test changes only. No production/staging database connection, data change, reassignment, migration, environment change, push or deployment.

## Confirmed source defect and reproduction

The root ReduxProvider retained one store across Firebase UID changes. AuthProvider temporarily changed ready and synchronized its HttpOnly cookie, but retained server-component/router project snapshots were neither account-tagged nor invalidated. ProjectsProvider unconditionally dispatched initialProjects into that shared store, and ProtectedWorkspace checked only that some user existed. It never compared that user with the identity which authorized the server snapshot.

Executed the original HEAD components with synthetic authenticated UID B and an A-owned server snapshot: ProjectsProvider returned A's children and dispatched A's list; ProtectedWorkspace returned A's canvas children. This reproduces the concrete client-side leak without needing an unscoped Neon query. New component tests reject the same mismatch. This is a confirmed source failure path; no live Vercel browser trace was captured, so claims do not extend to other possible deployment/configuration defects.

## Server flow audit

Dashboard page → getAllProjects → ownerFilter → serverIdentity → verifyFirebaseToken → prisma.project.findMany({where:{ownerUid:verifiedSub}}). Project-list API independently uses withProjectRoute → personalProviderIdentity → signature/claim verification, then the same scoped helper. Cookies make the server path dynamic; API responses are no-store/Vary Cookie.

The verifier checks Firebase signature, issuer, audience, subject, lifetime/auth time and required password email verification. Per-request AsyncLocalStorage carries only an already verified identity. New project creation takes serverIdentity().sub and explicitly constructs data; supplied uid/ownerUid fields are ignored.

Read/edit/delete/sketches/style-guide/thumbnail/autosave queries use ownedProjectWhere. Settings and nested images check parent ownership. Upload serving uses a parent-owner relation before file access. Image assets check both UID metadata and parent ownership. All eight generation routes are wrapped by withPersonalProvider's authenticated project gate and have additional scoped reads. Debug settings are owner-filtered. Delegated integration listing intentionally uses an owner-bound integration key rather than an interactive Firebase cookie; legacy unbound keys fail closed. No missing owner predicate was found in the inspected application paths. No change to those enforcement rules was necessary.

## Changes

Production source files:

1. `app/layout.tsx`: AuthProvider wraps ReduxProvider so store lifetime can follow resolved identity.
2. `redux/provider.tsx`: hide/unmount account state while auth session sync is pending; key a fresh store by UID. Includes project, canvas, undo and RTK caches. Same-account token refresh keeps the mounted store because ready remains true. Late callbacks holding A's old dispatch cannot write into B's fresh store.
3. `app/(protected)/layout.tsx`: verify server identity and tag the private subtree with its server UID; redirect invalid/unverified sessions appropriately.
4. `components/auth/protected.tsx`: hide mismatched server-authorized children immediately; once new session sync completes, fully navigate to the workspace to discard stale router/cache state. Never display old private canvas content while changing accounts.
5. `app/(protected)/dashboard/[session]/(workspace)/page.tsx`: explicit dynamic render, verify identity once, query within that verified context, and pass its UID with the project snapshot.
6. `app/(protected)/dashboard/[session]/(workspace)/settings/page.tsx`: same account-tagged verified-context snapshot.
7. `components/projects/list/provider.tsx`: hydrate only when resolved Firebase UID matches server snapshot UID. Hide and clear on mismatch; refresh stale page snapshot under the new cookie. Correctly hydrate empty lists.

Test files:

- `tests/account-switch-isolation.test.cjs`: new regression cases for stale A snapshot under B, hidden canvas until session/UID match, fresh/empty B list, UID-keyed store isolation and late A callbacks.
- `tests/project-ownership.test.cjs`: added both-direction nested style/settings/upload and all-generation-route direct-request denials with distinct signed UIDs and no side effects. Existing cases cover list/detail/read/edit/delete/create spoofing and fresh-token returning-user access.
- `tests/email-verification-ui.test.cjs`: supply required server snapshot UID in the protected-layout fixture; password verification behavior retained.
- `tests/personal-provider-keys.test.cjs`: isolate database import in the provider-context-only test. Its model-catalog path never queries a DB; the fixture previously depended on an ambient DATABASE_URL. Production DB fallback was not introduced.

Documentation: this report. Preexisting PROJECT-SETTINGS-FLOW-AUDIT.md was not modified.

## Verification and limits

- Original-source synthetic reproduction: A list hydrated/rendered with B session, and A protected children rendered with B session.
- Targeted auth/component/ownership tests passed. Final complete Node suite: **205 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed (Git CRLF conversion notices only).
- Initial full run caught one fixture needing the new required UID prop and one environment-dependent DB import; both fixtures corrected, full suite rerun and passed.

Tests exercise actual components through the existing hook-harness pattern, real Redux reducers/stores, and actual server handlers with locally signed test identities and instrumented persistence/files/provider adapters. This is not a mounted-browser Firebase/Neon acceptance test. No build or live deployment/browser verification was run in this task. No existing project was read from or changed in a real database.

## Make live after approval

1. Review these local changes and run an authorized staging instance with its confirmed staging target. No new schema/env configuration is required by this patch.
2. In the SAME browser profile reproduce A → B switching, plus a second profile for B. Create disposable projects only with approval; verify A's list/canvas disappears during transition, B loads only its own list, browser back/forward does not reveal A, and B's direct API GET/PATCH/DELETE and nested upload/settings/generation calls to A's test IDs return denial. Same-user signout/signin must preserve that user's saved projects. Do not touch legacy projects.
3. After staging/browser review, obtain approval to push the exact reviewed source and deploy it to Vercel Production. Confirm deployed SHA and runtime target, then repeat account-switch checks. Until that deployment, production continues running the old client behavior. No migration, ownership backfill or secret rotation is needed for this patch.
