const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('generated Prisma client exposes PrismaClient and matches the locked CLI/adapter version', () => {
  const { PrismaClient, Prisma } = require('@prisma/client');
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const version = lock.packages['node_modules/prisma'].version;
  assert.equal(typeof PrismaClient, 'function');
  assert.equal(Prisma.prismaVersion.client, version);
  assert.equal(lock.packages['node_modules/@prisma/client'].version, version);
  assert.equal(lock.packages['node_modules/@prisma/adapter-neon'].version, version);
  assert.equal(lock.packages['node_modules/@prisma/adapter-better-sqlite3'].version, version);
  assert.equal(lock.packages['node_modules/@prisma/engines'].version, version);
});

test('PrismaClient accepts the Neon adapter without connecting to a database', async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaNeon } = require('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString: 'postgresql://phase1:phase1@127.0.0.1:1/phase1' });
  const client = new PrismaClient({ adapter });
  try {
    assert.equal(adapter.provider, 'postgres');
    assert.ok(client.project);
    assert.ok(client.moodBoardImage);
    assert.ok(client.inspirationImage);
    assert.ok(client.projectSettings);
  } finally { await client.$disconnect(); }
});

test('retained SQLite driver remains usable without opening the original database', () => {
  const Database = require('better-sqlite3');
  const database = new Database(':memory:');
  try { assert.equal(database.prepare('SELECT 1 AS value').get().value, 1); }
  finally { database.close(); }
});

test('missing generation reproduces TS2305, while the generated client resolves the existing application import', () => {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile).config;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
  const options = { ...parsed.options, types: ['node'], noEmit: true };
  function diagnostics(hideGeneratedClient) {
    const host = ts.createCompilerHost(options);
    const read = host.readFile, exists = host.fileExists;
    const hidden = file => hideGeneratedClient && file.replaceAll('\\', '/').includes('/node_modules/.prisma/client/');
    host.readFile = file => hidden(file) ? undefined : read(file);
    host.fileExists = file => !hidden(file) && exists(file);
    const program = ts.createProgram([path.resolve('lib/db.ts')], options, host);
    return ts.getPreEmitDiagnostics(program).filter(item => item.file?.fileName.replaceAll('\\', '/').endsWith('/lib/db.ts'));
  }
  const missing = diagnostics(true);
  assert.ok(missing.some(item => item.code === 2305 && ts.flattenDiagnosticMessageText(item.messageText, ' ').includes('PrismaClient')));
  assert.deepEqual(diagnostics(false).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, ' ') })), []);
});
