# Staging acceptance and backup recovery checklist

Planning only — 2026-10-22. Read POST-DEPLOYMENT-AUDIT.md and PRODUCTION-RECOVERY-PLAN.md, the backup manifest, current test cases, API handlers, and staging launcher. No database connection, test execution, migration, restore, account creation, environment change, or deployment performed in this task. Commands below are instructions for a later separately approved rehearsal, not a record of execution.

## Evidence and prerequisites

- [x] Prior audit documents production missing ownerUid, staging having the completed ownership migration, and 17 passing synthetic ownership tests. These are historical results, not rerun here.
- [x] Operator confirmed Production deployment main/a57fcfa. The later deployment confirmation supersedes the older recovery plan's unverified-commit blocker; runtime Vercel environment still needs target validation before any production operation.
- [ ] Two distinct real Firebase test accounts in the configured project, with different UIDs. Verify each in Firebase Console → Authentication → Users. Password accounts must be email-verified. Sign in normally; never paste passwords/tokens into reports.
- [ ] Two independent Chrome profiles, plus an unauthenticated profile. Same browser tabs share cookies and are not separate identities.
- [ ] A running staging app using reviewed ownership code. The isolated local launcher below is available; deployment is not necessary. Verify intended Firebase public config and Firebase Authorized domains for localhost (or staging domain); any configuration change requires separate approval. Provider sign-in settings must already support the selected method.
- [ ] Existing provider access for successful generation and writable isolated staging asset storage. Do not rotate keys, configure a paid provider, or treat authorization-only tests as successful generation.
- [ ] Approval for creating/editing/deleting disposable staging test projects and their files. Current planning authorization does not authorize those operations.
- [ ] An already provisioned, EMPTY, disposable PostgreSQL instance/database, isolated from production AND staging, with separately confirmed identity. Creation/provisioning requires separate approval. No tunnel/proxy to a live database is acceptable for the loopback example below.
- [ ] PostgreSQL client tools `psql` and, for native backups, version-compatible `pg_dump`/`pg_restore`. Prior inspection found dump/restore unavailable. No tools installed here.
- [ ] Approval to restore into that disposable target. No existing JSON restore utility is in the repo; the proposed offline SQL-generation recipe below needs independent review and isolated execution. Its commands were not run or syntax/restore-tested here.
- [ ] A Neon recovery point/native backup and a full restore rehearsal remain separate disaster-recovery prerequisites. The existing JSON snapshot covers application tables/history, not a full database or uploaded files.

## A. Staging acceptance sequence

Use project root `C:\Users\Abhay Solanki\Downloads\openui-main\openui-main`.

### Preflight commands (later; not run here)

```powershell
Set-Location -LiteralPath 'C:\Users\Abhay Solanki\Downloads\openui-main\openui-main'
git rev-parse HEAD
git check-ignore .env.staging.local
node --test tests/project-ownership.test.cjs
npx tsc --noEmit
node scripts/dev-staging.cjs --check-only
```

The last command contacts only its pinned staging target read-only and validates Project columns. Expect branch `br-square-mud-b4xx4iwp`, compute `ep-calm-mouse-b4nvpc6s`, database `neondb`, project `icy-sun-12796122`. Independently inspect completed migration `20261022010000_project_ownership` and SQL checksum if anything changed since the audit. Stop on target/schema mismatch.

After approval for live acceptance, stop any other local Next dev process sharing this working tree, then:

```powershell
node scripts/dev-staging.cjs
```

Open `http://localhost:3001` in both profiles. The launcher pins child DATABASE_URL/DIRECT_URL from .env.staging.local; it does not edit env files. Other app configuration may still load through normal Next loading. Review it before testing. Never use ordinary `npm run dev` assuming it selects staging, and never invoke plain Prisma commands: defaults can load .env.local production credentials. A cached Prisma singleton in an older process is not target verification.

- [ ] Before any test writes, capture a private read-only database snapshot of all five legacy rows and all their child rows, using PostgreSQL JSON to preserve timestamp precision. Record hashes/counts, not private field values. Make an explicit denylist of all five legacy IDs from STAGING-OWNER-ASSIGNMENT.json.
- [ ] Log in A and B. Verify authenticated identity belongs to each intended test UID. If A uses the legacy owner account it may legitimately list five existing projects; B must not see them. If A is another test account neither should see legacy projects.
- [ ] Create one clearly labelled `ownership-acceptance-A-<run>` and `ownership-acceptance-B-<run>` through the UI. Record ONLY the newly returned IDs as the mutation allowlist. Verify database ownerUid against each verified session UID using read-only server checks. A browser-supplied UID must not determine ownership.
- [ ] For each account: list projects, open its test canvas, rename, edit/save, reload and reopen. Confirm persistence and absence from the other user's list. A project list being empty is not enough evidence.

### API test matrix (both A→B and B→A)

Use Chrome Network → select a real OWN-test-project request → Edit and Resend (where available) or Copy as fetch into that same profile's DevTools. Substitute ONLY the other NEW test project ID or its nested asset ID/path. Keep the real method, request schema, content type, and same-origin headers. Do not copy cookies/session tokens into scripts, logs, chat, or shell history. Inspect response status and verify private response bodies are absent. Do not send mutation requests to legacy IDs.

| Surface | Owner positive case | Foreign-account/IDOR case |
|---|---|---|
| `GET /api/projects` | Own created ID appears | Other test ID absent |
| `GET /api/projects/{id}` and corresponding canvas URL captured from UI | Opens own data/canvas | API 404; page reveals no data (404/authorized denial) |
| `PATCH /api/projects/{id}` body `{ "name": "..." }` | Own rename persists | 404; foreign row unchanged |
| `POST /api/autosave`, thumbnail POST | Real own save/thumbnail persists | Foreign projectId gets 404; no writes |
| `GET/PUT/PATCH /api/projects/{id}/style-guide` | Own style reads/writes | Foreign parent ID denied |
| `GET /api/models/select?projectId=...`, model-select POST | Own settings read/update | Foreign projectId denied; settings unchanged |
| `POST /api/upload` multipart file/projectId/type=moodboard or inspiration | Own upload, preview, navigate/reopen | Foreign parent denied before file write |
| `GET /api/uploads/{captured-path}` | Own test image loads | Foreign account cannot read image; private/no-store response |
| `DELETE /api/upload?id={imageId}&type=...` | Delete own test upload | Foreign child ID denied; bytes/row unchanged |
| `POST /api/images/assets`, `GET /api/images/assets/{assetId}` | Own test asset works | Foreign parent/asset ID denied; no file write/read exposure |
| `POST /api/generate` and `/convert`, `/redesign`, `/workflow`, `/workflow-redesign`, `/style`, `/theme`, `/retheme` | One real supported own generation reaches canvas and persists | Every route rejects foreign projectId before provider, stream, file/image work; no quota/provider call |
| `DELETE /api/projects/{id}` | Own disposable project deletes | Foreign test ID 404 and remains intact |

Use real handler payloads captured from the UI; main generation uses multipart while several other routes use JSON. A validation 400 from an invalid payload is NOT proof of ownership denial. Unsupported provider/model failure is NOT a passed positive generation test. Record skipped/blocked tests explicitly.

Example browser-console read checks, run separately in each logged-in profile, with captured NEW test IDs:

```javascript
const ownId = 'REPLACE_WITH_OWN_NEW_TEST_ID';
const otherId = 'REPLACE_WITH_OTHER_NEW_TEST_ID';
const mine = await fetch('/api/projects', { credentials: 'same-origin' });
console.log('list status', mine.status);
for (const id of [ownId, otherId]) {
  const r = await fetch('/api/projects/' + encodeURIComponent(id), { credentials: 'same-origin' });
  console.log(id === ownId ? 'own' : 'foreign', r.status);
}
```

- [ ] Repeat project/nested/generation calls without a cookie in a third profile: APIs should return 401 before side effects; page requests may redirect to sign-in. Test forged/expired token denial using the local synthetic suite; do not modify real account tokens or weaken auth. Unverified password accounts should be blocked appropriately (403/verification flow).
- [ ] Delete cross-owner test ID first (must fail), then delete each OWN allowlisted test project. Cleanup only captured disposable files/resources, with approval; never bulk-delete by name or owner UID.
- [ ] Compare all five legacy rows, timestamps, related records and original file metadata against the before snapshot. Require exact equality and unchanged counts: legacy 5/2/0/4. Inspect no orphan test resources remain. On failure STOP; do not automatically repair or reassign legacy rows.

### Existing automated coverage vs live acceptance

The inspected 17-case suite includes owner listing/detail, server loaders, both users' own edit/delete, foreign ID mutation denial, client UID spoof protection, nested settings/styles/uploads/assets, all eight generation entrypoints, anonymous denial, async/SSE identity separation, generated Prisma owner SQL, and integration-key binding. It covers the requested classes locally. Stubs do NOT verify real Firebase sign-in, actual Neon persistence, real image bytes, provider success, or browser canvas behavior. Do not mark live acceptance passed based on those tests alone.

## B. Existing backup recovery rehearsal

Use the backup path and SHA from `reports/PRODUCTION-RECOVERY-BACKUP.json`. Current expected SHA-256 is `9e3d96cea46965580ba960c6438bc7a4ba7d1ce8ca55272dad50ca312eeb3791`. Snapshot has 5 Project, 2 MoodBoardImage, 0 InspirationImage, 4 ProjectSettings and 1 _prisma_migrations row. It predates ownerUid. Restore its ORIGINAL schema; do not apply the ownership migration as part of proving backup fidelity.

Later offline checksum command (does not contact a database):

```powershell
$recoveryManifest = Get-Content -LiteralPath 'reports/PRODUCTION-RECOVERY-BACKUP.json' -Raw | ConvertFrom-Json
$recoveryHash = (Get-FileHash -LiteralPath $recoveryManifest.backupFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($recoveryHash -ne $recoveryManifest.sha256) { throw 'Backup checksum mismatch' }
Write-Output 'Backup checksum matched; restore still unverified'
```

The snapshot is JSON, not SQL, SQLite or pg_dump. Do NOT feed it to pg_restore or reuse scripts/neon-phase2.cjs (production-pinned importer). Do not reuse staging migration/assignment scripts for recovery. Restore needs a reviewed importer or SQL artifact.

### Proposed offline SQL artifact recipe (not implemented/executed)

Prepare a reviewed one-off generator that reads the manifest and snapshot WITHOUT loading any env file or connecting anywhere. Its precise requirements:

1. Verify SHA, snapshot format, original initial-migration checksum `540deb74296fa0e776079a92107bb1cc041edb36e6c88aa09aa69703e346e186`, table allowlist/counts, unique IDs, foreign keys and catalog. Reject any unexpected table, schema feature or data type.
2. Produce a private SQL file OUTSIDE Git with one BEGIN/COMMIT. Assert the exact disposable database name/role and absence of user tables before creating anything; set lock/statement timeouts. Never DROP, TRUNCATE, overwrite, ON CONFLICT UPDATE, disable constraints, or update live objects.
3. Use the reviewed initial PostgreSQL SQL (without nested BEGIN/COMMIT) for the four tables. Reconstruct _prisma_migrations separately from its captured column/default/index/constraint metadata; compare timestamp precision and native types, not guesses. Recovering migration-history VALUES is not equivalent to running or resolving a Prisma migration.
4. Load Project first, then MoodBoardImage, InspirationImage, ProjectSettings, and captured migration history. Specify every column, including IDs/nulls/defaulted fields/timestamps, using parameterized inserts or PostgreSQL json_populate_recordset with a safe encoded JSON payload. Use the database's timestamp types; never round-trip dates through JS Date or transform stored JSON-strings. Never interpolate unescaped values or log rows/settings/content.
5. Before COMMIT, assert all expected row counts; exact ID sets; every scalar and stored string/null/timestamp through type-normalized row comparisons BOTH directions; zero orphans; unique settings.projectId; all constraints validated; original column/default/index/constraint equivalence; history checksum and completion fields. Raise an exception/rollback on ANY mismatch. Do not perform Prisma updates that rewrite @updatedAt.
6. After commit, independently reconnect READ ONLY and repeat comparisons/counts. Save only sanitized evidence/hashes. This generator/importer is a missing prerequisite; no such ready/tested command is claimed here.

After independently reviewing the generated artifact, the following exact command shape applies ONLY to an already provisioned isolated LOCAL PostgreSQL server at 127.0.0.1:55432 with database/role explicitly named below. These are proposed disposable names, not claims those resources exist. No production/staging URLs or env loaders are used; `-W` prompts privately:

```powershell
psql --version
psql -X -h 127.0.0.1 -p 55432 -U openui_recovery -d openui_recovery_disposable -W -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, inet_server_addr(), inet_server_port(); SELECT count(*) AS public_tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'; COMMIT;"
# STOP: require expected disposable identity, zero public tables, no remote tunnel.
# The reviewed private restore.sql must implement all guards/comparisons above.
psql -X -h 127.0.0.1 -p 55432 -U openui_recovery -d openui_recovery_disposable -W -v ON_ERROR_STOP=1 -f 'C:\PRIVATE-RECOVERY-WORKDIR\restore.sql'
```

`C:\PRIVATE-RECOVERY-WORKDIR\restore.sql` is an explicitly uncreated artifact, NOT a repository script. Do not run until implemented/reviewed, target confirmed, and restore approved. For an approved remote disposable Neon recovery branch instead, replace ONLY with its reviewed endpoint/database/role, require TLS and verify project/branch/compute GUCs; do not substitute production or staging. Do not use defaults from .env.local, PGDATABASE, or a connection string in shell history.

Post-restore count command on the same disposable local target:

```powershell
psql -X -h 127.0.0.1 -p 55432 -U openui_recovery -d openui_recovery_disposable -W -v ON_ERROR_STOP=1 -c 'BEGIN READ ONLY; SELECT ''Project'' AS model,count(*) FROM "Project" UNION ALL SELECT ''MoodBoardImage'',count(*) FROM "MoodBoardImage" UNION ALL SELECT ''InspirationImage'',count(*) FROM "InspirationImage" UNION ALL SELECT ''ProjectSettings'',count(*) FROM "ProjectSettings" UNION ALL SELECT ''_prisma_migrations'',count(*) FROM "_prisma_migrations"; COMMIT;'
```

Counts alone are insufficient. Require the importer and independent verifier's field-by-field/schema/relationship evidence above. Native restore testing additionally needs an actual pg_dump archive/Neon recovery point; pg_restore is not a converter for this JSON snapshot. Uploaded bytes and encrypted provider settings require separately reviewed backups/restores; database paths do not recover those files.

## Completion evidence and gates

Record run timestamp, code SHA, verified target, distinct test UIDs privately, disposable IDs, expected/actual status matrix, provider/file side-effect evidence, legacy equality hashes, backup checksum, restore target identity/schema/field/count comparisons, and explicit failed/skipped checks. Do not attach cookies, credentials, raw project/settings content or private snapshot to Git.

- [ ] Live two-user staging acceptance completed with evidence.
- [ ] Legacy preservation after acceptance verified.
- [ ] JSON backup restored and exact data/schema comparisons passed on disposable PostgreSQL.
- [ ] Independent post-commit verification passed.
- [ ] Full recovery-point/native-backup limitations addressed.

All boxes above remain pending in this planning task. No production migration/owner assignment is approved or performed by this checklist. After evidence review, seek separate production schema approval; keep owner checks intact throughout.
