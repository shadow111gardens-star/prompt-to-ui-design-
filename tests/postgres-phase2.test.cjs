const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { normalizeRow, importData, verifyData, models } = require('../scripts/sqlite-neon-import-core.cjs');

function source() {
  return {
    Project: [normalizeRow('Project', { id: 'p1', name: 'Original', projectNumber: 3, description: null, thumbnail: null, sketchesData: '{ "original": true }', viewportData: '', styleGuide: null, isPublic: 0, tags: '["a"]', createdAt: '2026-01-02 03:04:05.123', lastModified: '2026-02-03T04:05:06.789Z' })],
    MoodBoardImage: [normalizeRow('MoodBoardImage', { id: 'm1', projectId: 'p1', filePath: '/original/path', fileName: 'original.png', mimeType: 'image/png', createdAt: '2026-01-02T03:04:05Z' })],
    InspirationImage: [], ProjectSettings: [{ id: 's1', projectId: 'p1', provider: null, model: 'original/model' }],
  };
}

function fixture(initial = {}) {
  const writes = [], tables = Object.fromEntries(models.map(([table]) => [table, structuredClone(initial[table] || [])]));
  const tx = {};
  for (const [table, delegate] of models) tx[delegate] = {
    async findMany() { return structuredClone(tables[table]); },
    async findUnique({ where }) { return structuredClone(tables[table].find(row => row.id === where.id) || null); },
    async create({ data }) {
      if (table !== 'Project') assert.ok(tables.Project.some(row => row.id === data.projectId));
      tables[table].push(structuredClone(data)); writes.push(table);
      return data;
    },
  };
  return { tx, tables, writes };
}

test('normalization preserves nulls, stored strings, IDs, milliseconds and UTC timestamps', () => {
  const data = source(); const p = data.Project[0];
  assert.equal(p.createdAt.toISOString(), '2026-01-02T03:04:05.123Z');
  assert.equal(p.lastModified.toISOString(), '2026-02-03T04:05:06.789Z');
  assert.equal(p.sketchesData, '{ "original": true }'); assert.equal(p.description, null); assert.equal(p.viewportData, ''); assert.equal(p.isPublic, false);
  assert.throws(() => normalizeRow('Project', { isPublic: 2 }), /INVALID_BOOLEAN/);
  assert.throws(() => normalizeRow('MoodBoardImage', { createdAt: null }), /INVALID_TIMESTAMP/);
  assert.throws(() => normalizeRow('MoodBoardImage', { createdAt: 'invalid' }), /INVALID_TIMESTAMP/);
  assert.throws(() => normalizeRow('MoodBoardImage', { createdAt: '2026-01-02T03:04:05.1234Z' }), /SUB_MILLISECOND/);
});

test('imports parents before children and verifies every field and relationship', async () => {
  const data = source(), f = fixture();
  const result = await importData(f.tx, data);
  assert.deepEqual(f.writes, ['Project', 'MoodBoardImage', 'ProjectSettings']);
  assert.deepEqual(result.counts, { Project: 1, MoodBoardImage: 1, InspirationImage: 0, ProjectSettings: 1 });
  assert.equal(result.allFieldsMatch, true); assert.equal(result.relationshipsValid, true);
  assert.deepEqual(f.tables, data);
});

test('repeat import is idempotent and performs no writes for identical records', async () => {
  const data = source(), f = fixture(data); const result = await importData(f.tx, data);
  assert.equal(f.writes.length, 0); assert.equal(result.stats.Project.skippedIdentical, 1);
  assert.equal(result.stats.Project.inserted, 0);
});

test('conflicting values or unexpected rows abort before any write, including child conflicts', async () => {
  for (const table of ['Project', 'MoodBoardImage', 'ProjectSettings']) {
    const data = source(), existing = structuredClone(data); existing[table][0].id += '-conflict';
    const f = fixture(existing); await assert.rejects(importData(f.tx, data), /IMPORT_CONFLICT/); assert.equal(f.writes.length, 0);
  }
  const data = source(), changed = structuredClone(data); changed.Project[0].name = 'Changed';
  const f = fixture(changed); await assert.rejects(importData(f.tx, data), /IMPORT_CONFLICT/); assert.equal(f.writes.length, 0);
});

test('verification rejects altered field values, missing rows and broken relationships', async () => {
  const data = source(); const f = fixture(data); f.tables.Project[0].sketchesData = '{}';
  await assert.rejects(verifyData(f.tx, data), /FIELDS_OR_COUNTS/);
  const g = fixture(data); g.tables.MoodBoardImage = []; await assert.rejects(verifyData(g.tx, data), /FIELDS_OR_COUNTS/);
  const bad = source(); bad.MoodBoardImage[0].projectId = 'missing'; await assert.rejects(verifyData(fixture(bad).tx, bad), /RELATIONSHIP/);
});

test('initial migration contains only the approved additive schema operations and atomic boundaries', () => {
  const sql = fs.readFileSync('prisma/migrations-postgresql/20261022000000_initial_postgresql/migration.sql', 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
  assert.equal(statements.length, 11); assert.equal(statements[0], 'BEGIN'); assert.equal(statements.at(-1), 'COMMIT');
  assert.ok(statements.slice(1, -1).every(s => /^CREATE (SCHEMA|TABLE|UNIQUE INDEX)\b|^ALTER TABLE\s+"\w+"\s+ADD CONSTRAINT\b/.test(s)));
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 4); assert.equal((sql.match(/FOREIGN KEY/g) || []).length, 3);
});

test('operational entrypoint protects target identity, empty schema and transactional pre-commit verification', () => {
  const script = fs.readFileSync('scripts/neon-phase2.cjs', 'utf8');
  for (const guard of ['PREVIOUSLY_VERIFIED_TARGET_CHANGED', 'TARGET_NO_LONGER_EMPTY', 'MIGRATION_DIFF_CHANGED', 'MIGRATION_HISTORY_MISMATCH', 'UNEXPECTED_TARGET_TABLES']) assert.ok(script.includes(guard));
  assert.ok(script.includes("isolationLevel: 'Serializable'")); assert.ok(script.includes('LOCK TABLE public.'));
  assert.ok(script.includes('return importData(tx, data)')); assert.ok(script.includes('pooledPostCommitReadMatches: true'));
});
