# Backup restore rehearsal — BLOCKED before database writes

Date: 2026-10-22. This is NOT a successful restore rehearsal. Only offline inspection and local tool/listener availability checks completed. No connection to production or staging; no database/container creation, restore, migration, owner assignment, environment change, push, or deployment.

## Inputs inspected

Read PRODUCTION-RECOVERY-PLAN.md, STAGING-ACCEPTANCE-AND-RECOVERY-CHECKLIST.md, PRODUCTION-RECOVERY-BACKUP.json, current Prisma schema, and existing script inventory. Read the external snapshot privately without printing its rows/content.

Snapshot: `C:\Users\Abhay Solanki\Downloads\openui-production-recovery-backups\2026-10-22T09-48-31-462Z\snapshot.json`.

SHA-256: `9e3d96cea46965580ba960c6438bc7a4ba7d1ce8ca55272dad50ca312eeb3791` — recalculated and matched the manifest.

Format: openui-readonly-logical-snapshot-v1. Top-level keys: format, capturedAt, target, columns, indexes, constraints, data. Row values were not logged. Counts/column counts:

| Table | Rows | Columns |
|---|---:|---:|
| Project | 5 | 12 |
| MoodBoardImage | 2 | 6 |
| InspirationImage | 0 | 6 |
| ProjectSettings | 4 | 4 |
| _prisma_migrations | 1 | 8 |

Offline checks passed: unique Project IDs, all child projectId references exist, ProjectSettings projectId uniqueness. These are snapshot checks, NOT PostgreSQL restore checks.

## Schema compatibility and smallest proposed implementation

The snapshot predates ownerUid; current Prisma schema includes it. Do not use current-schema Prisma migration/generation to reconstruct this backup. Restore the original four-table DDL from checksum-pinned initial PostgreSQL migration and reconstruct the migration-history table from validated captured catalog metadata. Never run the ownership migration or assign owners in this rehearsal.

No JSON restore utility was found in scripts/tests. Existing sqlite-neon import tooling is for SQLite and pins a production target: do not invoke it. pg_restore cannot consume this JSON.

Proposed future additions, documented BEFORE implementation:

1. `scripts/rehearse-json-backup.cjs`: a standalone runner for ONE confirmed disposable target. No dotenv/app DB imports, DATABASE_URL/DIRECT_URL fallback, or production/staging URL support. Prefer a specifically identified local PostgreSQL container with no published network port; feed SQL via its psql stdin. Pin container ID, local Docker context, approved image/version, expected role/database, and empty target; reject changed identity/nonempty schemas. Network address alone is not proof of isolation.
2. Offline input checks: snapshot SHA/format, initial SQL checksum, model/table/type allowlists, row IDs, references, counts, and catalog completeness. Reject unknown/unsupported catalog features rather than invent DDL. Validate native timestamp/varchar precision for _prisma_migrations using trustworthy original metadata/DDL; stop if the snapshot lacks sufficient type details.
3. One transaction: original application DDL plus correctly reconstructed history table; explicit parameterized or safely encoded JSON-record inserts for every column. Insert Project before children; preserve original IDs, all nulls, stored strings, booleans, and database timestamp precision. Never use JS Date for timestamp conversion or Prisma updates with @updatedAt. No conflicts overwritten, no constraint disabling, no destructive cleanup.
4. Before commit: exact counts, bidirectional normalized field equality for every row, no orphan references, unique settings relationship, validated constraints, schema/index/default/history equality. Raise/rollback on any difference.
5. Separate read-only post-commit connection repeats data/schema verification. Emit sanitized hashes/boolean outcomes, never payloads. Store any generated SQL/private artifacts outside Git.
6. `tests/backup-restore.test.cjs`: corrupted checksum, malformed schema, missing records, nonempty target, wrong target/container, forbidden targets, transaction rollback and unchanged stored strings/timestamps. Run meaningful PostgreSQL integration tests against the disposable instance; synthetic tests alone cannot establish recoverability.

No dependencies installed, files above created, or application files changed. A local Docker/psql-based runner could avoid new npm dependencies. Any tool/container installation or package change needs separate review where applicable.

## Target availability checks and exact blocker

- `Get-Command psql,pg_restore,postgres,docker,podman -ErrorAction SilentlyContinue`: only docker.exe found.
- No listening connection was found on local PostgreSQL candidate ports 5432/55432. Other ports were not exhaustively scanned; no operator-confirmed disposable connection was provided.
- `docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}'` failed: Docker Desktop Linux engine named pipe unavailable. No containers could be inventoried or validated; no daemon was started.

**Required next prerequisite:** start Docker Desktop's local Linux engine, then provide/approve a dedicated disposable PostgreSQL container/database (with no production/staging network/proxy mounts or application secrets), or supply an explicitly confirmed empty disposable PostgreSQL target and its expected nonsecret identity. Do not paste credentials in chat. Verify identity/emptiness read-only BEFORE any restore write. No safe target currently exists that this task could verify, so execution stopped as requested.

After the operator starts Docker Desktop, safe local inventory commands are:

```powershell
docker context show
docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Ports}}'
```

Do not print full docker inspect/env output: it can contain credentials. Do not create/start a database or change Docker context automatically. Container provisioning and actual restore commands should be prepared after selecting and verifying the isolated target and reviewing the proposed runner. No made-up ready-to-run restore command is supplied for a nonexistent utility/target.

## Results / evidence status

- PASS: snapshot file exists and SHA matches.
- PASS: privately parsed structure, counts, parent references and uniqueness.
- BLOCKED: isolated PostgreSQL target identity and emptiness verification.
- NOT RUN: schema creation, row import, transaction checks, PostgreSQL equality checks, independent post-commit readback.
- NOT VERIFIED: backup recoverability/full disaster recovery. Snapshot excludes upload bytes, encrypted provider-key files, roles and potentially other database-level objects; these remain separate backup requirements.

Only this report was created. Production migration remains unperformed; this blocked rehearsal is not evidence authorizing it.
