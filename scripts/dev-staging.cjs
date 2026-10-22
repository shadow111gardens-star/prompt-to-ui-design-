// Explicit staging runtime; never falls back to .env.local database credentials.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { neon } = require('@neondatabase/serverless');
const root = path.resolve(__dirname, '..');
async function main() {
  const checkOnly = process.argv[2] === '--check-only';
  if (process.argv.length > (checkOnly ? 3 : 2)) throw new Error('Invalid arguments');
  const parsed = require('dotenv').parse(fs.readFileSync(path.join(root, '.env.staging.local')));
  if (!parsed.DATABASE_URL?.trim() || !parsed.DIRECT_URL?.trim()) throw new Error('Missing staging URLs');
  const direct = new URL(parsed.DIRECT_URL), pooled = new URL(parsed.DATABASE_URL);
  const compute = 'ep-calm-mouse-b4nvpc6s';
  if (![direct, pooled].every(url => url.protocol === 'postgresql:' && url.hostname.endsWith('.neon.tech') && url.pathname === '/neondb' && ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) || !direct.hostname.startsWith(compute + '.') || pooled.hostname !== direct.hostname.replace(compute + '.', compute + '-pooler.') || direct.username !== pooled.username) throw new Error('Staging URL mismatch');
  const sql = neon(parsed.DIRECT_URL);
  const [identity, columns] = await sql.transaction([
    sql`SELECT current_database() AS database,current_user AS role,current_setting('neon.branch_id',true) AS branch,current_setting('neon.project_id',true) AS project,current_setting('neon.endpoint_id',true) AS compute`,
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Project'`,
  ], { readOnly: true });
  const row = identity[0];
  if (row?.database !== 'neondb' || row.role !== decodeURIComponent(direct.username) || row.branch !== 'br-square-mud-b4xx4iwp' || row.project !== 'icy-sun-12796122' || row.compute !== compute) throw new Error('Staging server mismatch');
  const model = require('@prisma/client').Prisma.dmmf.datamodel.models.find(model => model.name === 'Project');
  const actual = new Set(columns.map(column => column.column_name));
  if (!model || model.fields.filter(field => field.kind !== 'object').some(field => !actual.has(field.dbName || field.name))) throw new Error('Staging Project schema mismatch');
  console.log('Verified staging branch br-square-mud-b4xx4iwp, compute ep-calm-mouse-b4nvpc6s, database neondb; all Project columns present. No database writes.');
  if (checkOnly) return;
  // Explicit child env takes precedence over Next's .env.local. Separate port
  // and process ensure no previously cached Prisma singleton is reused.
  const env = { ...process.env, ...parsed, DATABASE_URL: parsed.DATABASE_URL, DIRECT_URL: parsed.DIRECT_URL, NODE_ENV: 'development' };
  const child = cp.spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--turbopack', '--hostname', 'localhost', '--port', '3001'], { cwd: root, env, stdio: 'inherit' });
  child.on('error', () => { console.error('Staging Next.js process failed to start.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
main().catch(() => { console.error('Staging preflight failed. No app started and no migration applied. Check staging URL configuration and schema; raw diagnostics suppressed to protect credentials.'); process.exitCode = 1; });
