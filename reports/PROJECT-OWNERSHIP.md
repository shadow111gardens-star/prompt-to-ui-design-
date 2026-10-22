# Project ownership/security source fix

Prepared on 22 October 2026. **No production database was accessed, no migration
was applied, no owners were assigned, and nothing was deployed or pushed.**
The working tree was clean at the start of this task; existing pushed application
features were retained. Persistent-storage migration was not started.

## Approved schema and enforcement

The user approved nullable `Project.ownerUid` and its index. New projects derive
this field only from the verified Firebase identity. No request body, query string,
email, session path segment, or arbitrary user header determines ownership.
Unassigned legacy projects fail closed. The `isPublic` flag does not bypass the
authenticated owner policy; no public-sharing API was introduced.

`lib/server/project-access.ts` provides request-scoped verified identity, server
cookie verification for server-rendered loaders, owner filters, required-parent
checks, safe 401/403/404 responses, and same-origin mutation enforcement. Its
AsyncLocalStorage context is separate for concurrent requests and survives
asynchronous generation/SSE work. Project updates/deletes include the owner UID
in their database predicates, not merely a client check or UI filter.

The pending migration is:
`prisma/migrations-postgresql/20261022010000_project_ownership/migration.sql`.
It only adds nullable TEXT `ownerUid` and the `Project_ownerUid_idx` index inside
BEGIN/COMMIT. It contains no defaults, backfill, drops, or resets. It was generated
offline using the Prisma schema-to-schema diff workflow, without a database
connection. See [Prisma 7 diff documentation](https://docs.prisma.io/docs/cli/v7/migrate/diff).

**The new code requires this column before it is activated against a database.**
Production still has the previous schema; starting the new code against it before
the separately approved migration would fail queries, not silently fall back to
shared access. Do not treat this source change as an already deployed security fix.

## Access-path audit

| Access path | Enforcement |
| --- | --- |
| Workspace and settings server pages | Shared project loader verifies the server Firebase cookie and lists only that UID's projects. |
| Canvas server page | Owned project lookup; foreign/unassigned IDs return no project. |
| Style Guide server page | Required owned parent, 404 for foreign/unassigned IDs, followed by scoped guide/image reads. |
| `/api/projects` GET/POST | Authenticated route wrapper; UID-filtered listing; server-derived owner on creation. |
| `/api/projects/[id]` GET/PATCH/DELETE | Owned lookup/update/delete; ownership checked before file cleanup. Unknown and foreign IDs are indistinguishable. |
| `/api/autosave` | Atomic update predicate contains ID and verified UID; arbitrary body owner fields cannot change ownership. |
| Style Guide GET/PATCH/PUT and thumbnail POST | Required ownership/scoped updates; no whole-body field spreading. |
| `/api/upload` POST/DELETE | Required owned parent before writes; child delete reads and deletes through parent owner relation. Uploaded filename basename + UUID contains the write within the authorized project's directory. |
| `/api/uploads/[...path]` | Database-backed child/path + parent-owner lookup before reading bytes; path containment, no-store/private delivery, SVG sandbox policy. |
| `/api/images/assets` POST | Authenticated owner context and owned project check before upload/import. |
| `/api/images/assets/[id]` GET | Existing per-UID asset check plus current parent ownership; private no-store response. |
| `/api/models/select` GET/POST | Parent authorization happens before personal model settings can short-circuit the handler or be changed. Settings helper also checks the parent. |
| All eight `/api/generate` routes | Verified identity + owned parent before provider settings, filesystem references, requests, or streaming; project queries also contain the owner predicate. |
| Project-chat branch and shared AI relation/model helpers | Additional scoped project reads, independent of the wrapper. |
| Generation image hydration | Required owned project before loading reference paths or starting asset hydration; authorization errors are not swallowed as image-search fallbacks. |
| `/api/debug-settings` | Authenticated, owner-filtered settings; no cross-user dump or raw database errors. |
| `/api/integration/projects` | Existing delegated Bearer-key flow preserved, now UID-bound and owner-filtered. Legacy unbound keys are rejected. |
| `/api/workspace-key` | Explicit Firebase + Lifetime entitlement check, existing localhost restriction, UID-bound generation/revocation/status. No other account can rotate/revoke an owned key or see its status. |
| `/api/ai-provider-keys` | Existing verified Firebase UID-scoped encrypted settings and entitlement checks retained; no project records or client-supplied owner identity involved. |
| `/api/models`, `/api/images/search` | Existing authenticated provider/catalog/search behavior retained; these do not return project data. |
| `/api/auth/session` and `proxy.ts` | Existing signature/email verification, CSRF/cookie protections, and dashboard/API guard retained. Project APIs additionally enforce checks themselves. |

The integration endpoint intentionally supports delegated Bearer access rather
than requiring an interactive cookie. Its owner UID comes from a key record
created under a verified Firebase session. Existing unbound keys must be explicitly
rotated by their owner; no old key was modified or auto-assigned in this task.

## Safe assignment plan for the five imported projects

`reports/project-owner-assignment-plan.json` contains the exact five project IDs
from the checksum-verified Phase 1 backup. Every ownerUid remains **null**.
`readyForReview` is false. No UID was guessed or inferred from project names,
record order, login email, or the currently logged-in account.

The repeatable offline planner is `scripts/plan-project-owners.cjs`. It verifies
backup checksum/integrity/counts, supports an explicit complete five-ID mapping,
and has **no database connection, environment loading, or apply mode**. It rejects
missing/duplicate/unknown IDs and malformed UID values. Its output is a review
plan, not proof that the supplied users exist in Firebase.

Later approved rollout:

1. In the correct Firebase Authentication project, identify the intended account
   for each project and copy its actual UID from the Users entry. Have the owner
   explicitly confirm the mapping. One UID may own all five only if explicitly
   confirmed. Verify each account exists in Firebase; an email may help locate a
   user but is not a substitute for the UID.
2. Review the mapping privately and test this code/schema on a separate staging
   database with two test accounts. Do not point preview deployments at production.
3. Schedule a controlled cutover/maintenance window. Review and separately approve
   applying the additive migration, the explicit five-record assignment, and code
   activation. Keep public access closed during the transition; the old app does
   not enforce ownership merely because the column exists.
4. Immediately before assignment, reverify target identity, migration status, all
   five IDs, current owner values, and source/target inventories. Stop on missing
   records, unexpected owners, or any mapping discrepancy. Do not re-import the
   SQLite records or change project content.
5. Use one transaction with locked project rows and parameterized updates of only
   ownerUid. Require an unassigned row or skip an identical already-assigned UID;
   abort on conflicting owners. Preserve IDs, createdAt, lastModified and all other
   fields (avoid an ORM update that automatically changes lastModified).
6. Compare the five assignments, unchanged field values, and all child relations
   before commit. Verify both users' lists/read/write/upload/generation denial and
   allowed-owner behavior afterward, then complete the approved cutover. No such
   production operation was performed here.

Assignment does not copy `.openui` assets or provider-key files. Do not implicitly
reassign per-UID asset metadata; any mismatch must be separately reviewed during
the later storage migration.

## Verification

- Full suite: **198 passed, zero failures/skips** with synthetic database settings.
- New security cases use actual route handlers, real RSA-signed synthetic Firebase
  tokens, the existing verifier, strict owner-filtering in-memory database stubs,
  and instrumented filesystem/provider stubs. They cover both denial and retained
  owner behavior without production data or network calls.
- Generated Prisma PostgreSQL query tests capture actual SQL through a non-network
  adapter and verify owner predicates for lists, nested images, and atomic updates.
- SSR-cookie verification and concurrent/asynchronous SSE identity tests pass.
- Existing color edit/undo/autosave/reopen, Moodboard, image forwarding, generation,
  provider settings, Firebase and export regressions remain passing. Their focused
  feature fixtures now explicitly supply an authorized test identity; the security
  suite uses the actual authorization module rather than that fixture stub.
- `npx tsc --noEmit`: passed. Prisma 7.8.0 generation passed with a synthetic URL.
- Isolated `npm run build`: passed with synthetic credentials and no environment
  files or local data copied; Next.js 16.2.9 Turbopack and all 46 static pages passed.
- Ten compiled-production HTTP smoke checks passed using synthetic configuration.
- SQLite source and backup checksums, old SQLite history, original PostgreSQL
  initial migration, and original upload/`.openui` metadata remain unchanged.

Evidence: `project-ownership-tests.txt`, `project-ownership-probe.log`,
`project-ownership-preservation.json`, and refreshed `production-readiness-*`
authorization/build/smoke reports. These are local automated checks, not a real
two-user browser test against a migrated staging/production database.

## Remaining risks and rollout constraints

- Pending ownership migration and explicitly verified assignment are required;
  neither production schema nor records have been changed.
- Local filesystem persistence remains a Vercel release blocker. No storage migration
  was started. Asset ownership follows both its UID metadata and its parent project.
- Firebase's current short-lived ID-token-cookie implementation still does not
  perform immediate disabled-user/revocation lookup. This task did not replace it.
- Delegated integration keys remain local-file backed and require explicit rotation
  for legacy unbound records; durable storage is a later task.
- Ownership is enforced in the server application, not PostgreSQL RLS. Database
  credentials/maintenance tools remain privileged and must stay server-only.
- Ownership transfer/sharing is not exposed by any API. Any future transfer needs
  transactional coordination with nested assets and concurrent operations.
- No deployment, Git commit/push, production DB query, or live Firebase action was run.

## Changed files

The complete path inventory, including regression fixtures and generated local
verification reports, is in `reports/project-ownership-files.json`.
