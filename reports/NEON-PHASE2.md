# SQLite to Neon — Phase 2

## Approved target and final preflight

The user identified the Neon project as `openui-production`, branch `production`.
SQL connections verify endpoint/database/role identity, not Neon Console display
labels. The target fingerprint in `neon-phase2-postcheck.json` matches the
previously verified endpoint, database `neondb`, and role `neondb_owner`.

Both exact `.env.local` variables were present and non-empty. Pooled DATABASE_URL
and non-pooled DIRECT_URL matched the same endpoint/database/role. Both connected
successfully. No credentials or connection strings were printed or written to
these reports.

Immediately before migration, the target was rechecked: zero user objects,
routines, or enum/domain types. No existing application data or migration history
was present. The user explicitly approved schema application and the 11-record
import. No reset, db push, deployment, or unrelated database operations occurred.

## Schema and import

Applied only `20261022000000_initial_postgresql` with Prisma 7.8.0 `migrate deploy`.
The file equals the reviewed offline empty-to-schema diff, wrapped in BEGIN/COMMIT:
four tables, primary keys, three cascading foreign keys, and one unique project
settings index. No destructive DDL or model/ownership changes were made.

The source was the read-only verified backup:
`C:\Users\Abhay Solanki\Downloads\openui-main-sqlite-backups\phase1-2026-10-22-1792650848214\openui.db`.
Its manifest checksum, SQLite integrity, foreign keys, and approved counts were
reverified. The SQLite migration history row was not imported into PostgreSQL.

The data import used one serializable Prisma transaction with table locks.
All existing target records were inspected before writes. Identical records are
skipped on reruns; conflicting or unexpected records abort rather than overwrite.
Projects are inserted before children, with explicit original IDs and dates.
SQLite 0/1 booleans become PostgreSQL booleans; dates retain UTC milliseconds.
Nulls and strings, including JSON stored as strings and upload paths, are retained.
Every field and relationship was compared with the backup before commit.

| Model | Backup | Verified Neon |
| --- | ---: | ---: |
| Project | 5 | 5 |
| MoodBoardImage | 2 | 2 |
| InspirationImage | 0 | 0 |
| ProjectSettings | 4 | 4 |

## Verification

- Migration history: one completed initial migration, matching SQL checksum;
  `prisma migrate status` succeeded.
- Independent post-commit verification: every field matches through the direct
  connection and through the pooled application connection.
- All three foreign keys are validated; all child project IDs match source parents.
- First post-commit pooled verification hit Prisma P2028 while starting the
  transaction. A read-only verification rerun with a longer connection-start
  allowance passed. No re-import or overwrite was used to resolve it.
- Full suite: 183 tests passed using synthetic database environment settings.
  An initial unconfigured test invocation had one environment initialization
  failure; the isolated configured invocation passed all tests.
- TypeScript: `npx tsc --noEmit` passed.
- SQLite database and backup checksums remain unchanged; original SQLite migration
  checksums and existing uploads/`.openui` file size/mtime records remain unchanged.
- No Vercel deployment or production build was performed in this phase. Browser UI
  behavior and hosted file storage were not part of this database verification.

Machine-readable evidence: `neon-phase2-postcheck.json`,
`neon-phase2-preservation.json`, and `neon-phase2-tests.txt`.

## Files added or updated in Phase 2

- `prisma/migrations-postgresql/20261022000000_initial_postgresql/migration.sql`
- `prisma/migrations-postgresql/migration_lock.toml`
- `prisma/migrations-postgresql/README.md`
- `scripts/sqlite-neon-import-core.cjs`
- `scripts/neon-phase2.cjs`
- `tests/postgres-phase2.test.cjs`
- `reports/NEON-PHASE2.md`
- `reports/neon-phase2-postcheck.json`
- `reports/neon-phase2-preservation.json`
- `reports/neon-phase2-tests.txt`
- `reports/neon-phase2-verification-log.txt` (safe diagnostic log from the earlier
  pooled-verification attempt)

Phase 1 changes remain in the working tree. Nothing was committed or deployed.

## Operational commands

`node scripts/neon-phase2.cjs --verify-only` compares backup fields/relationships
with the target without inserting or updating records. It acquires short-lived
table locks during its snapshot check.

`--apply-initial-and-import` is the explicit first-run mode: it refuses any
non-empty target, verifies identity/backup/SQL, applies the initial migration,
and imports in a separate transaction. It must not be rerun on this migrated
database. `--import` is a separately explicit idempotent import mode for recovery;
it verifies applied history and rejects conflicts. Do not invoke it merely to
check results; use `--verify-only`.

Uploads and `.openui` assets remain on local disk. PostgreSQL stores their
existing paths; this migration does not upload those files to Neon or prepare
durable hosting storage. A deployment remains a separate task.
