# Production ownership recovery plan — approval required

Prepared 2026-10-22. No database writes, owner assignments, migrations, push, or deployment performed.

## Verified evidence

- Git HEAD: `a57fcfa165f34d7bbcb7d8fe61379915e2177607`. Committed schema and queries require ownerUid; relevant working-tree source matches HEAD.
- Reverified production server in a read-only RepeatableRead transaction: project `icy-sun-12796122`, branch `br-calm-morning-b4md3ubx`, compute `ep-tiny-thunder-b4xpxxw4`, database `neondb`. Local pooled/direct endpoints match the previously recorded production fingerprint. Never assume this proves the Vercel deployment has identical environment values.
- ownerUid still absent; only initial migration recorded. Earlier read-only SQL reproduced undefined-column error 42703. Application client generation does not migrate the database.
- Reviewed ownership SQL: BEGIN; ALTER TABLE public-equivalent "Project" ADD COLUMN "ownerUid" TEXT; CREATE INDEX "Project_ownerUid_idx" ON "Project"("ownerUid"); COMMIT. It is additive and has no owner backfill or field rewrite; ALTER/CREATE INDEX can acquire blocking locks.
- Vercel CLI exists, but no local `.vercel/project.json`, environment VERCEL_TOKEN, recognized local CLI auth file, or connected Vercel tools were found. Active deployment identity, Source SHA, runtime environment, and logs are NOT verified. Do not infer deployment identity from local HEAD or GitHub push history.

## Backup prepared

See `PRODUCTION-RECOVERY-BACKUP.json` for exact external path/checksum. Snapshot captured at 2026-10-22T09:48:31.462Z under `C:\Users\Abhay Solanki\Downloads\openui-production-recovery-backups\2026-10-22T09-48-31-462Z\`.

It contains PostgreSQL-side JSON for every field of all four application tables plus `_prisma_migrations`, along with column/default/index/constraint metadata, from one consistent read-only transaction. Database timestamp text is preserved through PostgreSQL row_to_json. Counts: 5 Projects, 2 MoodBoardImage, 0 InspirationImage, 4 ProjectSettings, 1 migration row. Written bytes were re-read, parsed, compared with the captured snapshot, SHA-256 checked, and child-parent membership checked.

This is a private application logical snapshot, NOT a pg_dump archive or a proven full-database disaster-recovery backup. It may contain private project text/content and must not be uploaded to Git or reports. No environment credential fields were included; arbitrary stored project content was preserved without printing it. It does not back up upload file bytes, `.openui` keys, database roles, or all database-level objects. pg_dump/pg_restore were unavailable locally. PostgreSQL restore rehearsal has NOT been performed.

Before migration approval is exercised, obtain a Neon recovery point/restore branch or a version-compatible pg_dump through trusted tooling, privately verify its contents, and rehearse recovery in an isolated non-production database. A Neon backup branch is an additional resource-changing action requiring approval; none was created here. Refresh the consistent snapshot during the approved write-free maintenance window; this snapshot alone does not protect subsequent writes.

## Exact proposed order (not executed)

1. Obtain active Vercel deployment URL/ID and authenticated read-only metadata access, or review its dashboard details with the operator. Record Production alias, Source SHA, logs/error metadata, Prisma version, and DB endpoint/database identity privately. Compare SHA with reviewed source. Do not request/paste credentials in chat.
2. Finish two-real-user staging acceptance, including positive owner operations and negative direct API tests. Current 17 local synthetic ownership tests pass; live staging acceptance is still blocked. Resolve/review independent file-storage durability risks before declaring the entire SaaS production-ready.
3. Schedule a brief maintenance window and separately approve its activation. Quiesce project/background writes without bypassing auth. Verify/refresh the backup and restore rehearsal. Recheck production identity, all original column/value snapshots, child rows, initial migration checksum, absence of ownerUid/index, and that ONLY the ownership migration is pending. Abort if any check differs.
4. With explicit approval for production schema only, execute ONLY `20261022010000_project_ownership` through a reviewed isolated Prisma migration configuration pinned to production, no dotenv fallback or inherited staging credentials. Set appropriate lock/statement timeouts, review trigger behavior, and abort on unexpected pending migration/history. Do not replay initial migration, import SQLite, db push, reset, or mark an unapplied migration resolved. Verify column/index, migration receipt, and all original fields/timestamps/children unchanged.
5. Before reopening traffic, verify deployed code is compatible. If active code already contains reviewed ownership enforcement, no new deployment may be necessary; otherwise separately approve deploying that exact tested revision after schema expansion. Never deploy old unscoped code as a recovery shortcut. After adding the column, NULL legacy owners remain inaccessible by design; this is the safe interim state.
6. Present a production-only five-ID owner worksheet. Require explicit confirmation of actual production owners/verified Firebase UIDs for every row. Staging confirmation does not authorize production assignments. With separate production data approval, lock only reviewed rows in one guarded transaction, require expected nulls, raw parameterized UPDATE of ownerUid only, and compare every other field/timestamp/child row before commit. Abort missing/conflicting rows. Avoid Prisma @updatedAt side effects.
7. Verify owners and two-user/anonymous isolation through the compatible running production artifact using approved disposable test projects only. Compare legacy data to the pre-change snapshot. Reopen access only after verification; do not automatically push/deploy/rotate keys as part of a schema command.

## Rollback / stop conditions

- Before migration commit, any SQL/check/timeout failure must roll back; inspect migration history read-only and do not blindly retry after a lost connection.
- After additive migration commits, prefer leaving the harmless nullable column/index and ownership checks in place while traffic stays restricted. Do not DROP the column or erase migration history, and do not roll back to code that lacks ownership enforcement.
- Owner-assignment failure before commit rolls back the entire transaction. If an incorrect assignment is discovered after commit, restrict access and seek explicit approval for a reviewed corrective transaction using captured prior values; never silently reassign or null owners.
- Full restore is a last resort requiring separate approval. Rehearse on a separate isolated recovery branch first, compare schema/rows/relationships, account for writes after the recovery point, and coordinate app connection changes. Never overwrite production from the old SQLite backup or this JSON file without a reviewed restoration procedure and approval.

## Approval gates and current blockers

No approval is requested for a blind migration while active deployment identity, restore rehearsal, and live staging acceptance remain unverified. Next safe approval: authorize an isolated backup/restore rehearsal (specify trusted tooling/Neon recovery branch) and provide read-only active Vercel deployment metadata. Production migration, each production owner mapping, any compatible-code deployment, and access reopening remain separate explicit approval gates. No ownerUid mapping is assumed by this plan.

Local files added: this plan and the nonsecret backup manifest. Existing audit files retained. No executable source changed; no new test/build run was needed for this documentation/read-only backup phase.
