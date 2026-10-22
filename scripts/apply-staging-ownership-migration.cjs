// One explicitly approved additive schema migration. No owner assignment mode.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { neon } = require('@neondatabase/serverless');
const root = path.resolve(__dirname, '..');
const initial = '20261022000000_initial_postgresql';
const migration = '20261022010000_project_ownership';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const ensure = (condition, code) => { if (!condition) { const error = new Error(code); error.safeCode = code; throw error; } };
let stage = 'local-preflight';
let applied = false;

async function main() {
  ensure(process.argv[2] === '--approved-staging-schema-only' && process.argv.length === 3, 'EXPLICIT_APPROVED_MODE_REQUIRED');
  const envPath = path.join(root, '.env.staging.local');
  const envHash = sha(fs.readFileSync(envPath));
  const parsed = require('dotenv').parse(fs.readFileSync(envPath));
  ensure(parsed.DATABASE_URL?.trim() && parsed.DIRECT_URL?.trim(), 'MISSING_STAGING_URL');
  const pooled = new URL(parsed.DATABASE_URL), direct = new URL(parsed.DIRECT_URL);
  const compute = 'ep-calm-mouse-b4nvpc6s';
  ensure([pooled, direct].every(url => url.protocol === 'postgresql:' && url.hostname.endsWith('.neon.tech') && ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))), 'INVALID_STAGING_URL');
  ensure(direct.hostname.startsWith(compute + '.') && pooled.hostname === direct.hostname.replace(compute + '.', compute + '-pooler.') && pooled.pathname === '/neondb' && direct.pathname === '/neondb' && pooled.username === direct.username, 'TARGET_NOT_APPROVED_STAGING');
  const historyRoot = path.join(root, 'prisma/migrations-postgresql');
  const sqlText = fs.readFileSync(path.join(historyRoot, migration, 'migration.sql'), 'utf8');
  const statements = sqlText.replace(/--[^\n]*/g, '').split(';').map(statement => statement.trim().replace(/\s+/g, ' ')).filter(Boolean);
  assert.deepEqual(statements, ['BEGIN', 'ALTER TABLE "Project" ADD COLUMN "ownerUid" TEXT', 'CREATE INDEX "Project_ownerUid_idx" ON "Project"("ownerUid")', 'COMMIT']);
  const initialSql = fs.readFileSync(path.join(historyRoot, initial, 'migration.sql'));
  ensure(sha(initialSql) === '540deb74296fa0e776079a92107bb1cc041edb36e6c88aa09aa69703e346e186', 'INITIAL_SQL_CHANGED');
  const planPath = path.join(root, 'reports/project-owner-assignment-plan.json');
  const planHash = sha(fs.readFileSync(planPath));
  const expectedIds = JSON.parse(fs.readFileSync(planPath, 'utf8')).assignments.map(row => row.projectId).sort();
  ensure(expectedIds.length === 5 && new Set(expectedIds).size === 5, 'UNEXPECTED_PROJECT_PLAN');
  const sql = neon(parsed.DIRECT_URL);
  async function identity() {
    const [rows] = await sql.transaction([sql`SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.project_id',true) AS project_id,current_setting('neon.endpoint_id',true) AS endpoint_id`], { readOnly: true });
    const value = rows[0];
    ensure(value?.database === 'neondb' && value.role === decodeURIComponent(direct.username) && value.read_only === 'on' && value.branch_id === 'br-square-mud-b4xx4iwp' && value.project_id === 'icy-sun-12796122' && value.endpoint_id === compute, 'SERVER_TARGET_MISMATCH');
  }
  stage = 'read-only-target-check';
  await identity();
  const [columns, indexes, history] = await sql.transaction([
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Project' AND column_name='ownerUid'`,
    sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='Project' AND indexname='Project_ownerUid_idx'`,
    sql`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at`,
  ], { readOnly: true, isolationLevel: 'RepeatableRead' });
  ensure(columns.length === 0 && indexes.length === 0, 'OWNERSHIP_SCHEMA_ALREADY_PRESENT_STOP');
  ensure(history.length === 1 && history[0].migration_name === initial && history[0].checksum === sha(initialSql) && history[0].finished_at && !history[0].rolled_back_at, 'UNEXPECTED_MIGRATION_HISTORY');
  const tables = ['Project', 'MoodBoardImage', 'InspirationImage', 'ProjectSettings'];
  const before = await sql.transaction(tables.map(table => sql.query('SELECT * FROM public."' + table + '" ORDER BY id')), { readOnly: true, isolationLevel: 'RepeatableRead' });
  assert.deepEqual(before[0].map(row => row.id).sort(), expectedIds);

  // Freeze the reviewed migration history and config outside the application.
  // No dotenv imports, inherited database variables, or production fallback.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openui-staging-owner-migration-'));
  for (const name of [initial, migration]) {
    const target = path.join(directory, 'migrations', name); fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(historyRoot, name, 'migration.sql'), path.join(target, 'migration.sql'));
  }
  fs.writeFileSync(path.join(directory, 'migrations/migration_lock.toml'), 'provider = "postgresql"\n');
  fs.copyFileSync(path.join(root, 'prisma/schema.prisma'), path.join(directory, 'schema.prisma'));
  const configPath = path.join(directory, 'prisma.config.ts');
  fs.writeFileSync(configPath, 'export default { schema: ' + JSON.stringify(path.join(directory, 'schema.prisma')) + ', migrations: { path: ' + JSON.stringify(path.join(directory, 'migrations')) + ' }, datasource: { url: process.env.DIRECT_URL } };\n');
  const env = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, { DATABASE_URL: parsed.DATABASE_URL, DIRECT_URL: parsed.DIRECT_URL, NEXT_TELEMETRY_DISABLED: '1', CHECKPOINT_DISABLE: '1' });
  function cli(args) {
    const result = cp.spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args, '--config', configPath], { cwd: directory, env, encoding: 'utf8', timeout: 120000 });
    ensure(result.status === 0, 'PRISMA_' + args.join('_').toUpperCase() + '_FAILED');
  }
  await identity();
  ensure(sha(fs.readFileSync(envPath)) === envHash && sha(fs.readFileSync(planPath)) === planHash, 'LOCAL_INPUT_CHANGED');
  stage = 'approved-migration-deploy';
  console.log(JSON.stringify({ stage, stagingIdentityVerified: true, beforeCounts: Object.fromEntries(tables.map((table, i) => [table, before[i].length])), onlyPendingMigration: migration, initialMigrationAlreadyApplied: true, isolatedConfigWithoutEnvFallback: true }));
  cli(['migrate', 'deploy']); applied = true;
  stage = 'post-migration-verification';
  await identity();
  const [afterHistory, afterColumns, afterIndex, projects, moods, inspiration, settings] = await sql.transaction([
    sql`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at`,
    sql`SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Project' AND column_name='ownerUid'`,
    sql`SELECT i.indisvalid,i.indisunique,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='Project_ownerUid_idx'`,
    ...tables.map(table => sql.query('SELECT * FROM public."' + table + '" ORDER BY id')),
  ], { readOnly: true, isolationLevel: 'RepeatableRead' });
  ensure(afterHistory.length === 2 && afterHistory.every(row => row.finished_at && !row.rolled_back_at), 'UNEXPECTED_POST_MIGRATION_HISTORY');
  assert.deepEqual(afterHistory[0], history[0]);
  ensure(afterHistory[1].migration_name === migration && afterHistory[1].checksum === sha(sqlText), 'OWNERSHIP_MIGRATION_RECEIPT_MISMATCH');
  ensure(afterColumns.length === 1 && afterColumns[0].data_type === 'text' && afterColumns[0].is_nullable === 'YES' && afterColumns[0].column_default === null, 'OWNER_COLUMN_DIFFERENT');
  ensure(afterIndex.length === 1 && afterIndex[0].indisvalid && !afterIndex[0].indisunique && /\("ownerUid"\)/.test(afterIndex[0].definition), 'OWNER_INDEX_DIFFERENT');
  ensure(projects.length === 5 && projects.every(row => row.ownerUid === null), 'OWNERS_NOT_NULL');
  const withoutOwner = projects.map(row => { const copy = { ...row }; delete copy.ownerUid; return copy; });
  assert.deepEqual([withoutOwner, moods, inspiration, settings], before);
  cli(['migrate', 'status']);
  ensure(sha(fs.readFileSync(envPath)) === envHash && sha(fs.readFileSync(planPath)) === planHash, 'LOCAL_INPUT_CHANGED');
  const report = { verifiedAt: new Date().toISOString(), branchId: 'br-square-mud-b4xx4iwp', projectId: 'icy-sun-12796122', computeId: compute, database: 'neondb', appliedMigration: migration, migrationStatus: 'up-to-date', initialMigrationReplayed: false, initialMigrationHistoryUnchanged: true, ownerUidColumn: { type: 'text', nullable: true, default: null }, ownerIndexValid: true, projectIds: expectedIds, projectCount: 5, allProjectOwnersNull: true, allExistingProjectFieldsUnchanged: true, nestedRecordsUnchanged: true, counts: { Project: projects.length, MoodBoardImage: moods.length, InspirationImage: inspiration.length, ProjectSettings: settings.length }, stagingEnvironmentFileUnchanged: true, assignmentPlanUnchanged: true, productionConnected: false, ownersAssigned: false, deployed: false };
  fs.writeFileSync(path.join(root, 'reports/STAGING-OWNERSHIP-MIGRATION.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(error => {
  console.error(JSON.stringify({ stopped: true, stage, migrationCommandSucceeded: applied, safeCode: error.safeCode || 'CHECK_FAILED', ownersAssigned: false, rawDiagnosticsSuppressed: true }));
  process.exitCode = 1;
});
