// Explicitly invoked operational tool. Never logs connection URLs or record values.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { neon } = require('@neondatabase/serverless');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { ensure, sha256, loadBackup, importData, verifyData } = require('./sqlite-neon-import-core.cjs');

const root = path.resolve(__dirname, '..');
const backup = 'C:/Users/Abhay Solanki/Downloads/openui-main-sqlite-backups/phase1-2026-10-22-1792650848214';
const expectedTarget = 'ea283bf46c069a080be318f4057d19ef6ae7e9e6b32ee1c3cb71aa87dc6bc6b9';
const migration = '20261022000000_initial_postgresql';
const migrationFile = path.join(root, 'prisma/migrations-postgresql', migration, 'migration.sql');
const mode = process.argv[2];
let stage = 'local-validation';

function cli(args, env) {
  const result = cp.spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], {
    cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
  });
  // Prisma diagnostics may contain connection details: do not forward them.
  ensure(result.status === 0, 'PRISMA_CLI_FAILED_' + args.slice(0, 2).join('_'));
  return result.stdout;
}

async function main() {
  ensure(['--apply-initial-and-import', '--import', '--verify-only', '--preflight'].includes(mode), 'EXPLICIT_MODE_REQUIRED');
  const parsed = require('dotenv').parse(fs.readFileSync(path.join(root, '.env.local')));
  ensure(parsed.DATABASE_URL?.trim() && parsed.DIRECT_URL?.trim(), 'CONNECTION_VARIABLE_MISSING');
  const runtime = new URL(parsed.DATABASE_URL), direct = new URL(parsed.DIRECT_URL);
  ensure([runtime, direct].every(url => ['postgres:', 'postgresql:'].includes(url.protocol)), 'POSTGRES_URL_REQUIRED');
  ensure(runtime.hostname.replace('-pooler.', '.') === direct.hostname && runtime.hostname.includes('-pooler.') && !direct.hostname.includes('-pooler.'), 'ENDPOINT_MISMATCH');
  ensure(runtime.pathname === direct.pathname && runtime.username === direct.username, 'DATABASE_OR_ROLE_MISMATCH');
  const fingerprint = sha256([direct.hostname, decodeURIComponent(direct.pathname.slice(1)), decodeURIComponent(direct.username)].join('|'));
  ensure(fingerprint === expectedTarget, 'PREVIOUSLY_VERIFIED_TARGET_CHANGED');
  const { data, backupSha256 } = loadBackup(backup);
  const migrationSql = fs.readFileSync(migrationFile, 'utf8');
  const offlineSql = cli(['migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { ...process.env, DIRECT_URL: 'postgresql://offline:offline@localhost:5432/offline' });
  ensure(migrationSql === 'BEGIN;\n\n' + offlineSql.trim() + '\n\nCOMMIT;\n', 'MIGRATION_DIFF_CHANGED');
  const history = fs.readdirSync(path.join(root, 'prisma/migrations-postgresql'), { withFileTypes: true }).filter(entry => entry.isDirectory());
  ensure(history.length === 1 && history[0].name === migration, 'UNEXPECTED_MIGRATION_FILES');

  stage = 'connection-identity';
  for (const url of [parsed.DIRECT_URL, parsed.DATABASE_URL]) {
    const identity = await neon(url)`SELECT current_database() AS database, current_user AS role`;
    ensure(identity.length === 1 && identity[0].database === 'neondb' && identity[0].role === 'neondb_owner', 'SERVER_IDENTITY_CHANGED');
  }
  stage = 'object-inspection';
  const sql = neon(parsed.DIRECT_URL);
  const objects = await sql`SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY 1,2`;
  const routines = await sql`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')`;
  const types = await sql`SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND t.typtype IN ('e','d')`;
  ensure(routines.length === 0 && types.length === 0, 'UNEXPECTED_ROUTINES_OR_TYPES');
  console.log(JSON.stringify({ stage: 'preflight', targetMatchesPrevious: true, bothConnectionsVerified: true, backupVerified: true, objectCount: objects.length }));
  if (mode === '--preflight') { ensure(objects.length === 0, 'TARGET_NO_LONGER_EMPTY'); return; }
  if (mode !== '--apply-initial-and-import') {
    const expectedObjects = new Set([
      'Project:r', 'Project_pkey:i', 'MoodBoardImage:r', 'MoodBoardImage_pkey:i',
      'InspirationImage:r', 'InspirationImage_pkey:i', 'ProjectSettings:r', 'ProjectSettings_pkey:i',
      'ProjectSettings_projectId_key:i', '_prisma_migrations:r', '_prisma_migrations_pkey:i',
    ]);
    ensure(objects.length === expectedObjects.size && objects.every(row => row.schema === 'public' && expectedObjects.has(row.name + ':' + row.kind)), 'UNEXPECTED_TARGET_OBJECTS');
  }
  if (mode === '--apply-initial-and-import') {
    ensure(objects.length === 0, 'TARGET_NO_LONGER_EMPTY');
    // The only allowed migration contains CREATEs/ADD constraints in one transaction.
    stage = 'migration-deploy';
    cli(['migrate', 'deploy'], { ...process.env, DIRECT_URL: parsed.DIRECT_URL });
    console.log(JSON.stringify({ stage: 'initialSchema', applied: true }));
  }
  stage = 'migration-verification';
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
  ensure(tables.map(row => row.table_name).join('|') === ['InspirationImage', 'MoodBoardImage', 'Project', 'ProjectSettings', '_prisma_migrations'].join('|'), 'UNEXPECTED_TARGET_TABLES');
  const applied = await sql`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations`;
  ensure(applied.length === 1 && applied[0].migration_name === migration && applied[0].checksum === sha256(migrationSql) && applied[0].finished_at && !applied[0].rolled_back_at, 'MIGRATION_HISTORY_MISMATCH');
  cli(['migrate', 'status'], { ...process.env, DIRECT_URL: parsed.DIRECT_URL });

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: parsed.DIRECT_URL }), log: [] });
  let outcome;
  try {
    stage = 'transaction-start';
    outcome = await prisma.$transaction(async tx => {
      stage = 'transaction-lock';
      await tx.$executeRawUnsafe('SET LOCAL lock_timeout = \'10s\'');
      await tx.$executeRawUnsafe('LOCK TABLE public."Project", public."MoodBoardImage", public."InspirationImage", public."ProjectSettings" IN EXCLUSIVE MODE');
      stage = mode === '--verify-only' ? 'transaction-verify' : 'transaction-import';
      if (mode === '--verify-only') return { counts: await verifyData(tx, data), allFieldsMatch: true, relationshipsValid: true };
      return importData(tx, data);
    }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 120000 });
    // Independent post-commit read through pooled runtime path, as the app uses it.
    stage = 'pooled-postcommit-verification';
    const pooled = new PrismaClient({ adapter: new PrismaNeon({ connectionString: parsed.DATABASE_URL }), log: [] });
    try { await pooled.$transaction(tx => verifyData(tx, data), { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 60000 }); }
    finally { await pooled.$disconnect(); }
  } finally { await prisma.$disconnect(); }
  stage = 'foreign-key-verification';
  const foreignKeys = await sql`SELECT conname,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f'`;
  ensure(foreignKeys.length === 3 && foreignKeys.every(row => row.convalidated), 'FOREIGN_KEY_CONSTRAINT_CHECK_FAILED');
  const result = { verifiedAt: new Date().toISOString(), targetFingerprint: fingerprint, targetLabelsSuppliedByUser: { project: 'openui-production', branch: 'production' }, backupSha256, migration, migrationSha256: sha256(migrationSql), migrationStatus: 'up-to-date', ...outcome, pooledPostCommitReadMatches: true, validatedForeignKeys: 3 };
  const reportFile = mode === '--verify-only' ? 'neon-phase2-postcheck.json' : 'neon-phase2-result.json';
  fs.writeFileSync(path.join(root, 'reports', reportFile), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

if (require.main === module) main().catch(error => {
  // Never print raw SDK/CLI errors; they can contain connection strings/row data.
  console.error('Phase 2 stopped. No further operations attempted. Raw diagnostics suppressed to protect secrets. Inspect migration status read-only before retrying; do not reset or force-overwrite.');
  if (error.safeCode) console.error('Check failed: ' + error.safeCode);
  console.error(JSON.stringify({ stage, prismaCode: /^P\d{4}$/.test(error.code || '') ? error.code : null, diagnostics: {
    websocket: /websocket/i.test(error.message || ''), connection: /connect|socket|network|fetch/i.test(error.message || ''),
    timeout: /timeout|timed out/i.test(error.message || ''), unsupportedType: /unsupported|deserialize/i.test(error.message || ''),
    transactionStartDeadline: /Unable to start a transaction in the given time/i.test(error.message || ''),
  } }));
  process.exitCode = 1;
});
