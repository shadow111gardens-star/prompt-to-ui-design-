// Explicitly approved, one-time staging assignment. No production env fallback.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const root = path.resolve(__dirname, '..');
const ids = ['cmvh5b97y00025guyv7jefm3t', 'cmvh5hwfh00045guyq5ik93eq', 'cmvht27jd0000m0uylzzqxrem', 'cmvhtlb0o0003m0uyylqeghtg', 'cmvj315os0002y4uylrjws5dc'];
const uid = 'XGHpu36d3ZUwhiY1Aoep2IcNn0z2';
const compute = 'ep-calm-mouse-b4nvpc6s';
const tables = ['Project', 'MoodBoardImage', 'InspirationImage', 'ProjectSettings', '_prisma_migrations'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
let committed = false;
let stage = 'local-validation';
const ensure = (condition, code) => { if (!condition) { const error = new Error(code); error.safeCode = code; throw error; } };
async function main() {
  ensure(process.argv.length === 3 && process.argv[2] === '--approved-five-staging-assignments', 'APPROVAL_FLAG_REQUIRED');
  const envFile = path.join(root, '.env.staging.local');
  const envHash = sha(fs.readFileSync(envFile));
  const parsed = require('dotenv').parse(fs.readFileSync(envFile));
  ensure(parsed.DATABASE_URL?.trim() && parsed.DIRECT_URL?.trim(), 'STAGING_URL_MISSING');
  const pooled = new URL(parsed.DATABASE_URL), direct = new URL(parsed.DIRECT_URL);
  ensure([pooled, direct].every(url => url.protocol === 'postgresql:' && url.hostname.endsWith('.neon.tech') && ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))), 'INVALID_URL');
  ensure(direct.hostname.startsWith(compute + '.') && pooled.hostname === direct.hostname.replace(compute + '.', compute + '-pooler.') && [pooled, direct].every(url => url.pathname === '/neondb') && pooled.username === direct.username, 'STAGING_URL_TARGET_MISMATCH');
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'reports/STAGING-OWNERSHIP-MIGRATION.json'), 'utf8'));
  assert.deepEqual([...receipt.projectIds].sort(), ids);
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: parsed.DIRECT_URL, max: 1, connectionTimeoutMillis: 20000 });
  let client;
  async function identity() {
    const { rows: [row] } = await client.query("SELECT current_database() AS database,current_user AS role,current_setting('neon.branch_id',true) AS branch,current_setting('neon.project_id',true) AS project,current_setting('neon.endpoint_id',true) AS compute");
    ensure(row.database === 'neondb' && row.role === decodeURIComponent(direct.username) && row.branch === 'br-square-mud-b4xx4iwp' && row.project === 'icy-sun-12796122' && row.compute === compute, 'SERVER_TARGET_MISMATCH');
  }
  // PostgreSQL builds the JSON text: timestamps retain full database precision.
  async function snapshot() {
    const result = {};
    for (const table of tables) {
      const { rows } = await client.query('SELECT id, row_to_json(t)::text AS document FROM public."' + table + '" t ORDER BY id');
      result[table] = rows.map(row => ({ id: row.id, document: JSON.parse(row.document) }));
    }
    return result;
  }
  function compare(before, after) {
    const expected = structuredClone(before);
    for (const row of expected.Project) row.document.ownerUid = uid;
    assert.deepEqual(after, expected);
  }
  try {
    stage = 'read-only-target-verification';
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    await identity();
    await client.query('COMMIT');
    stage = 'guarded-assignment-transaction';
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await identity();
    // Prevent concurrent edits to any compared records until verification/commit.
    await client.query('LOCK TABLE public."Project", public."MoodBoardImage", public."InspirationImage", public."ProjectSettings", public."_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE');
    const { rows: locked } = await client.query('SELECT id,"ownerUid" FROM public."Project" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE', [ids]);
    assert.deepEqual(locked.map(row => row.id), ids);
    ensure(locked.every(row => row.ownerUid === null), 'OWNER_NOT_NULL_ABORT');
    const before = await snapshot();
    assert.deepEqual(before.Project.map(row => row.id), ids);
    assert.deepEqual([before.Project.length, before.MoodBoardImage.length, before.InspirationImage.length, before.ProjectSettings.length], [5, 2, 0, 4]);
    const migration = before._prisma_migrations.find(row => row.document.migration_name === '20261022010000_project_ownership')?.document;
    ensure(migration?.finished_at && !migration.rolled_back_at && migration.checksum === sha(fs.readFileSync(path.join(root, 'prisma/migrations-postgresql/20261022010000_project_ownership/migration.sql'))), 'OWNERSHIP_MIGRATION_NOT_VERIFIED');
    const updated = await client.query('UPDATE public."Project" SET "ownerUid" = $1 WHERE id = ANY($2::text[]) AND "ownerUid" IS NULL RETURNING id', [uid, ids]);
    ensure(updated.rowCount === 5, 'UPDATE_COUNT_MISMATCH');
    assert.deepEqual(updated.rows.map(row => row.id).sort(), ids);
    compare(before, await snapshot());
    await identity();
    ensure(sha(fs.readFileSync(envFile)) === envHash, 'ENV_CHANGED');
    await client.query('COMMIT');
    committed = true;
    stage = 'post-commit-read-only-verification';
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await identity();
    const after = await snapshot();
    compare(before, after);
    await client.query('COMMIT');
    const report = { verifiedAt: new Date().toISOString(), committed: true, branchId: 'br-square-mud-b4xx4iwp', computeId: compute, database: 'neondb', assignments: ids.map(projectId => ({ projectId, ownerUid: uid })), updatedRows: 5, allOtherProjectFieldsAndTimestampsUnchanged: true, nestedRecordsUnchanged: true, migrationHistoryUnchanged: true, counts: { Project: 5, MoodBoardImage: 2, InspirationImage: 0, ProjectSettings: 4 }, productionConnected: false, keysRotated: false, pushed: false, deployed: false };
    fs.writeFileSync(path.join(root, 'reports/STAGING-OWNER-ASSIGNMENT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(JSON.stringify({ stopped: true, stage, committed, safeCode: error.safeCode || 'VERIFICATION_OR_CONNECTION_FAILED', rawDiagnosticsSuppressed: true })); process.exitCode = 1; });
