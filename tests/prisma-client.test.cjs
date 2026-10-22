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
  assert.equal(lock.packages['node_modules/@prisma/adapter-better-sqlite3'].version, version);
  assert.equal(lock.packages['node_modules/@prisma/engines'].version, version);
});

test('PrismaClient and the SQLite adapter execute a query using only an in-memory database', async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file::memory:' }) });
  try {
    const rows = await client.$queryRawUnsafe('SELECT 1 AS value');
    assert.equal(Number(rows[0].value), 1);
  } finally { await client.$disconnect(); }
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
