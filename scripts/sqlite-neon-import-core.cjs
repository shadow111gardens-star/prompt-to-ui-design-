const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

const models = [
  ['Project', 'project'], ['MoodBoardImage', 'moodBoardImage'],
  ['InspirationImage', 'inspirationImage'], ['ProjectSettings', 'projectSettings'],
];
const expectedCounts = { Project: 5, MoodBoardImage: 2, InspirationImage: 0, ProjectSettings: 4 };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function ensure(condition, code) {
  if (!condition) { const error = new Error(code); error.safeCode = code; throw error; }
}

function dateValue(value) {
  // SQLite Prisma dates are UTC. Never interpret a timezone-less value locally.
  let input = value;
  ensure(typeof input === 'string' || typeof input === 'number' || input instanceof Date, 'INVALID_TIMESTAMP');
  if (typeof input === 'string') {
    ensure(!/\.\d{3}[0-9]*[1-9]\d*(?:Z|[+-]\d\d:\d\d)?$/.test(input), 'SUB_MILLISECOND_TIMESTAMP');
    if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(input)) input = input.replace(' ', 'T') + 'Z';
  }
  const date = new Date(input);
  ensure(!Number.isNaN(date.valueOf()), 'INVALID_TIMESTAMP');
  return date;
}

function normalizeRow(table, row) {
  const normalized = { ...row };
  for (const key of ['createdAt', 'lastModified']) if (Object.hasOwn(normalized, key)) normalized[key] = dateValue(normalized[key]);
  if (table === 'Project') {
    ensure([0, 1, false, true].includes(row.isPublic), 'INVALID_BOOLEAN');
    normalized.isPublic = Boolean(row.isPublic);
  }
  return normalized;
}

function loadBackup(directory) {
  const manifest = JSON.parse(fs.readFileSync(directory + '/verification.json', 'utf8'));
  const file = directory + '/openui.db';
  ensure(sha256(fs.readFileSync(file)) === manifest.backupFileSha256, 'BACKUP_CHECKSUM_CHANGED');
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    ensure(db.pragma('integrity_check', { simple: true }) === 'ok', 'BACKUP_INTEGRITY_FAILED');
    ensure(db.pragma('foreign_key_check').length === 0, 'BACKUP_FOREIGN_KEYS_FAILED');
    const data = {};
    for (const [table] of models) {
      const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all();
      ensure(rows.length === expectedCounts[table] && rows.length === manifest.inventory.tables[table].rows, 'BACKUP_COUNTS_CHANGED');
      data[table] = rows.map(row => normalizeRow(table, row));
    }
    return { data, backupSha256: manifest.backupFileSha256 };
  } finally { db.close(); }
}

function equalRow(actual, expected) {
  try { assert.deepStrictEqual(actual, expected); return true; } catch { return false; }
}

async function verifyData(tx, data) {
  const counts = {};
  const projectIds = new Set(data.Project.map(row => row.id));
  for (const [table, delegate] of models) {
    const rows = await tx[delegate].findMany({ orderBy: { id: 'asc' } });
    const expected = [...data[table]].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const actual = [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    ensure(equalRow(actual, expected), 'IMPORTED_FIELDS_OR_COUNTS_DIFFER');
    if (table !== 'Project') ensure(rows.every(row => projectIds.has(row.projectId)), 'IMPORTED_RELATIONSHIP_FAILED');
    counts[table] = rows.length;
  }
  return counts;
}

async function importData(tx, data) {
  const stats = {};
  // Caller holds table locks. Inspect ALL rows before writing, including unexpected IDs.
  for (const [table, delegate] of models) {
    const source = new Map(data[table].map(row => [row.id, row]));
    const existing = await tx[delegate].findMany();
    ensure(existing.every(row => source.has(row.id) && equalRow(row, source.get(row.id))), 'IMPORT_CONFLICT');
    stats[table] = { inserted: 0, skippedIdentical: existing.length };
  }
  for (const [table, delegate] of models) {
    for (const row of data[table]) {
      const existing = await tx[delegate].findUnique({ where: { id: row.id } });
      if (existing) { ensure(equalRow(existing, row), 'IMPORT_CONFLICT'); continue; }
      await tx[delegate].create({ data: row });
      stats[table].inserted++;
    }
  }
  const counts = await verifyData(tx, data);
  return { stats, counts, allFieldsMatch: true, relationshipsValid: true };
}

module.exports = { models, expectedCounts, sha256, ensure, normalizeRow, loadBackup, verifyData, importData };
