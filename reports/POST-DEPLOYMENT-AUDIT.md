# Post-deployment ownership audit

Date: 2026-10-22. Read-only database inspection; only this local report created. No schema/data changes, assignments, migrations, environment changes, push, or deployment.

## Deployment and inspected source

The operator confirmed the latest Vercel Production deployment is Ready, branch main, commit `a57fcfa` (data store neon). Inspected the exact Git object `a57fcfa165f34d7bbcb7d8fe61379915e2177607`, not merely unstaged source. Deployment status/commit are operator-confirmed; Vercel metadata was not independently fetched here.

In this commit:

- `prisma/schema.prisma`: nullable Project.ownerUid plus its index.
- `lib/server/project-access.ts:32`: ownerFilter derives `{ ownerUid: verifiedIdentity.sub }`; ownedProjectWhere adds the project ID; requireOwnedProject performs an ownership-filtered findUnique.
- `lib/db/projects.ts:8`: getAllProjects uses project.findMany with ownerFilter. `getProject`, `getProjectStyleGuide`, rename, delete, sketches/style-guide updates use ownedProjectWhere. Creation reads the owner's last project and writes ownerUid from serverIdentity.
- `lib/db/images.ts`: nested image reads/deletes filter the parent Project by ownerUid; create/list require an owned parent.
- `lib/db/settings.ts`: requires an owned Project and scopes nested settings through the parent relation.
- `lib/ai/route-utils.ts`, `lib/ai/project-chat-response.ts`, `lib/ai/with-personal-provider.ts`, `lib/images/api-auth.ts`, and `lib/images/generation-pipeline.ts`: ownership-filtered project reads/guards before generation or image access. The thumbnail API and server Style Guide page also require ownership.
- The dashboard page `app/(protected)/dashboard/[session]/(workspace)/page.tsx` calls getAllProjects before rendering.
- Build/postinstall run prisma generate, not prisma migrate deploy. Including migration files or deploying a generated client does not apply the database migration.

## Fresh read-only production evidence

Checked 2026-10-22T09:58:56.259Z. Parsed only the local production file for this target, validated pooled/direct host/database/role agreement, then checked server identity. No credential values printed.

- Neon project: icy-sun-12796122
- Branch: br-calm-morning-b4md3ubx
- Compute: ep-tiny-thunder-b4xpxxw4
- Database: neondb
- Server transaction_read_only: on
- Project.ownerUid: absent; Project_ownerUid_idx: absent.
- History: only 20261022000000_initial_postgresql, completed, not rolled back; checksum matches local migration SQL.
- A separate read-only `SELECT id FROM public."Project" WHERE "ownerUid" = 'audit-nonexistent-uid' LIMIT 0` failed with SQLSTATE 42703, explicitly identifying the undefined ownerUid column. No project data was returned.

## Fresh read-only staging evidence

Checked 2026-10-22T09:58:57.434Z. Independently parsed .env.staging.local; validated its own pooled/direct target and server identity without modifying environment variables.

- Neon project: icy-sun-12796122
- Branch: br-square-mud-b4xx4iwp
- Compute: ep-calm-mouse-b4nvpc6s
- Database: neondb
- Server transaction_read_only: on
- Project.ownerUid: nullable text; Project_ownerUid_idx: present.
- Both 20261022000000_initial_postgresql and 20261022010000_project_ownership are completed, not rolled back, and their checksums match local SQL.
- The same read-only ownership-filtered LIMIT 0 query succeeds.

## Diagnosis

The confirmed deployed revision requires a column missing from production. The dashboard executes its ownerUid predicate even though the listing's selected result fields omit ownerUid, so PostgreSQL rejects the SQL and Prisma raises the runtime error. This explains the reported dashboard failure after login. Firebase session POST itself verifies Firebase identity and sets a cookie without querying Prisma; this evidence does not show that Firebase credential authentication is broken. A Ready deployment/build is not a runtime database-compatibility check.

## Tests and limits

Reran `node --test tests/project-ownership.test.cjs`: 17 passed, 0 failed, 0 skipped. Covers signed synthetic identities, own-project and cross-owner access/mutations, anonymous denial, nested settings/uploads, generation guards, async/SSE identity isolation, and generated PostgreSQL owner predicates.

These tests execute locally with test certificates and database/filesystem/provider stubs (plus a non-network generated-Prisma adapter); they are not two-real-account browser acceptance against staging. Fresh staging schema/query probes passed, but live Firebase account, successful provider generation, and durable file-storage behavior remain unverified. No production build run: this audit changed no executable source and build cannot validate a missing database column.

## Safest next step — approval required before production recovery

Keep strict owner checks. Finish real two-account staging acceptance and verify a production recovery point/restore rehearsal using the existing recovery plan. Then request separate explicit approval for ONLY the reviewed additive production migration 20261022010000_project_ownership with pinned target, unchanged-value checks, and reviewed migration history. Do not replay initial migration, reset, or reimport data.

The current compatible code is already deployed according to the operator; no additional deployment is required merely to make the missing column available. Once migrated, legacy NULL-owned rows will remain inaccessible safely. Any production legacy owner assignment requires its own explicitly confirmed production mapping and approval; staging assignments do not authorize production backfill. Verify isolation and field preservation before reopening access. Do not roll back to unscoped code or bypass owner filters.
