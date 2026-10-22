# Production dashboard schema mismatch — 2026-10-22

Read-only evidence is in `PRODUCTION-OWNERSHIP-SCHEMA-AUDIT.json`. No production records, schema, migrations, credentials, or deployments changed.

## Confirmed database findings

The locally configured pooled/direct URLs matched the previously verified production target fingerprint. Read-only server inspection identified Neon project `icy-sun-12796122`, branch `br-calm-morning-b4md3ubx`, compute `ep-tiny-thunder-b4xpxxw4`, database `neondb`. No connection values were printed.

`public.Project` contains all 12 original columns but no `ownerUid`. Migration history contains only completed `20261022000000_initial_postgresql`, with the expected initial SQL checksum. `20261022010000_project_ownership` is not recorded. Counts are 5 Projects, 4 ProjectSettings, 2 MoodBoardImage, 0 InspirationImage.

A read-only `SELECT id FROM public."Project" WHERE "ownerUid" = 'diagnostic-nonexistent-uid' LIMIT 0` reproduced PostgreSQL SQLSTATE `42703` (undefined column), specifically naming ownerUid internally. No records or private contents were retrieved by that probe.

## Code comparison / attribution limit

The current Git HEAD and working-tree ownership implementation define nullable `Project.ownerUid` and its index. `getAllProjects` filters `findMany` with `ownerFilter()`, which derives ownerUid from the verified server identity. Other reads also require this column. The missing column therefore breaks the query even when it is not in the selected output fields. Prisma generation changes the client, not the database schema. Existing build/postinstall scripts generate Prisma; they do not apply migrations.

The production database is definitively incompatible with this source. The supplied screenshot alone does not identify the deployed revision or exact Prisma error code; Vercel deployment metadata/log access was not available. Verify the deployment Source commit against current HEAD and obtain the server error code/metadata to close that final attribution gap. Do not treat local HEAD as proof of the exact deployed artifact.

## Safest proposed recovery (not executed)

1. Keep private dashboard access closed during the mismatch. Do not remove owner filters or fall back to unfiltered queries; older code may expose private projects.
2. Confirm Vercel's active deployment commit and production target, complete staging two-real-user acceptance, and take a verified production backup/snapshot before any separately approved change.
3. Request explicit production approval for ONLY the reviewed additive migration `20261022010000_project_ownership` (nullable text ownerUid plus index), with pinned production identity and before/after row checks. No initial migration replay, data reimport, reset, or broad migration command without reviewing pending history.
4. With only the column added, ownership-filtered queries stop failing but existing rows remain NULL and deliberately inaccessible. Production owner assignment requires a separately confirmed production mapping and approval. Staging's five-row confirmation is not production authorization. New projects can receive verified server UID automatically once source/schema are compatible.
5. Verify schema, unchanged existing fields/nested records, explicit approved ownership, and authenticated/anonymous isolation before reopening access. Storage durability and Firebase revocation limitations remain separate release risks.

Only these two local audit reports were added in this investigation; no source fix or production operation was performed. No tests/build run: no executable source changed; direct read-only database inspection/probe supplied the relevant evidence.
