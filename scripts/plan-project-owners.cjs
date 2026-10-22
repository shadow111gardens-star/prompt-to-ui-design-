// Offline planner only: no environment loading, database client, or apply mode.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

function plan(directory, mapping) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'verification.json'), 'utf8'));
  const file = path.join(directory, 'openui.db');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== manifest.backupFileSha256) throw new Error('Backup verification failed.');
  const db = new Database(file, { readonly: true, fileMustExist: true });
  let ids;
  try {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Backup integrity failed.');
    ids = db.prepare('SELECT id FROM Project ORDER BY id').all().map(row => row.id);
  } finally { db.close(); }
  if (ids.length !== 5 || manifest.inventory.tables.Project.rows !== 5) throw new Error('Expected project inventory changed.');
  const assignments = mapping || ids.map(projectId => ({ projectId, ownerUid: null }));
  if (!Array.isArray(assignments) || assignments.length !== ids.length || new Set(assignments.map(row => row.projectId)).size !== ids.length || assignments.some(row => !ids.includes(row.projectId))) throw new Error('Mapping must contain each verified project exactly once.');
  if (assignments.some(row => row.ownerUid !== null && (typeof row.ownerUid !== 'string' || !row.ownerUid.trim() || row.ownerUid.length > 128))) throw new Error('Invalid UID mapping.');
  return { mode: 'offline-plan-only', productionChanges: false, backupSha256: digest, expectedProjectCount: 5, expectedCurrentOwnerUid: null, identitySourceRequired: 'Explicit Firebase Authentication UID confirmed in the correct Firebase project; never inferred from email/project order.', readyForReview: assignments.every(row => row.ownerUid !== null), assignments };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg.startsWith('--'))) throw new Error('No apply mode exists.');
    const directory = args[0]; if (!directory) throw new Error('Provide verified backup directory.');
    const mapping = args[1] ? JSON.parse(fs.readFileSync(args[1], 'utf8')) : undefined;
    const result = plan(directory, mapping);
    fs.writeFileSync(path.resolve(__dirname, '../reports/project-owner-assignment-plan.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ mode: result.mode, expectedProjects: result.expectedProjectCount, readyForReview: result.readyForReview, productionChanges: false }));
  } catch { console.error('Owner plan stopped: verify the backup and mapping. No database changes were attempted.'); process.exitCode = 1; }
}
module.exports = { plan };
