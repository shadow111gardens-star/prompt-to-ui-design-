const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Configuration runs only in isolated synthetic environments. This test never
// reads a real .env/.env.local or opens a database connection.
function fixture(file, env, mocks, shared) {
  const sandbox = shared || { process: { env }, console };
  const module = { exports: {} };
  Object.assign(sandbox, { module, exports: module.exports, __dirname: path.resolve('.'), require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'node:path') return path;
    throw new Error('Unexpected fixture dependency: ' + name);
  } });
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext('(function(){\n' + code + '\n})();', sandbox, { filename: file });
  return { exports: module.exports, sandbox };
}

function configFixture(env, resolveFile = () => undefined) {
  const calls = [];
  const result = fixture('prisma.config.ts', env, {
    dotenv: { config(options) { calls.push(options); const value = resolveFile(options.path); if (value) env.DIRECT_URL = value; } },
    'prisma/config': { defineConfig: value => value },
  });
  return { config: result.exports.default, calls };
}

test('exported DIRECT_URL avoids all environment-file reads and targets separate PostgreSQL history', () => {
  const url = 'postgresql://synthetic:synthetic@127.0.0.1:1/test';
  const { config, calls } = configFixture({ DIRECT_URL: url });
  assert.equal(calls.length, 0);
  assert.equal(config.datasource.url, url);
  assert.equal(config.migrations.path, 'prisma/migrations-postgresql');
});

test('Prisma CLI loads .env.local first, falls back to .env, and rejects missing/SQLite URLs without exposing values', () => {
  const url = 'postgresql://synthetic:synthetic@127.0.0.1:1/test';
  const local = configFixture({}, file => file.endsWith('.env.local') ? url : undefined);
  assert.equal(local.config.datasource.url, url);assert.equal(local.calls.length, 1);assert.equal(local.calls[0].quiet, true);
  const fallback = configFixture({}, file => file.endsWith('.env') ? url : undefined);
  assert.equal(fallback.config.datasource.url, url);assert.equal(fallback.calls.length, 2);
  assert.throws(() => configFixture({}), /DIRECT_URL must be configured/);
  assert.throws(() => configFixture({ DIRECT_URL: 'file:forbidden.db' }), error => error.message.includes('DIRECT_URL must be configured') && !error.message.includes('forbidden.db'));
});

test('runtime uses pooled DATABASE_URL, retains the singleton and never falls back to SQLite', () => {
  let clients = 0, connections = 0;
  const mocks = {
    '@prisma/client': { PrismaClient: class { constructor(options) { clients++;this.options = options; } } },
    '@prisma/adapter-neon': { PrismaNeon: class { constructor(options) { connections++;this.connectionString = options.connectionString; } } },
  };
  const env = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/pooled', DIRECT_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/direct' };
  const first = fixture('lib/db.ts', env, mocks);
  const second = fixture('lib/db.ts', env, mocks, first.sandbox);
  assert.equal(first.exports.prisma, second.exports.prisma);assert.equal(clients, 1);assert.equal(connections, 1);
  assert.equal(first.exports.prisma.options.adapter.connectionString, env.DATABASE_URL);
  const legacy = fixture('lib/db.ts', env, mocks, { process: { env }, console, prisma: { legacySQLiteClient: true } });
  assert.equal(legacy.exports.prisma.legacySQLiteClient, undefined);
  assert.equal(legacy.exports.prisma.options.adapter.connectionString, env.DATABASE_URL);
  assert.throws(() => fixture('lib/db.ts', {}, mocks), /DATABASE_URL must be configured/);
  assert.throws(() => fixture('lib/db.ts', { DATABASE_URL: 'file:forbidden.db' }, mocks), error => error.message.includes('DATABASE_URL must be configured') && !error.message.includes('forbidden.db'));
});

test('PostgreSQL client preserves four models, string storage, identifiers and legacy SQLite history', () => {
  const { Prisma } = require('@prisma/client');
  const allModels = Prisma.dmmf.datamodel.models;
  const models=allModels.filter(model=>['InspirationImage','MoodBoardImage','Project','ProjectSettings'].includes(model.name));
  assert.deepEqual(allModels.filter(model=>!models.includes(model)).map(model=>model.name).sort(),['CreditAccount','CreditEntry','CreditPeriod','DodoBillingEvent','GenerationRun','ScreenGeneration']);
  assert.deepEqual(models.map(model => model.name).sort(), ['InspirationImage', 'MoodBoardImage', 'Project', 'ProjectSettings']);
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  for (const model of models) { const id = model.fields.find(field => field.name === 'id');assert.equal(id.type, 'String');const body = schema.match(new RegExp('model ' + model.name + ' \\{([\\s\\S]*?)\\n\\}'))[1];assert.match(body, /id\s+String\s+@id\s+@default\(cuid\(\)\)/); }
  const project = models.find(model => model.name === 'Project');
  for (const name of ['sketchesData', 'viewportData', 'styleGuide', 'tags']) assert.equal(project.fields.find(field => field.name === name).type, 'String');
  for (const name of ['MoodBoardImage', 'InspirationImage', 'ProjectSettings']) { const body = schema.match(new RegExp('model ' + name + ' \\{([\\s\\S]*?)\\n\\}'))[1];assert.match(body, /project\s+Project\s+@relation\(fields: \[projectId\], references: \[id\], onDelete: Cascade\)/); }
  assert.match(fs.readFileSync('prisma/schema.prisma', 'utf8'), /provider = "postgresql"/);
  assert.match(fs.readFileSync('prisma/migrations/migration_lock.toml', 'utf8'), /provider = "sqlite"/);
  assert.ok(fs.existsSync('prisma/migrations/20260609121243_init/migration.sql'));
});
