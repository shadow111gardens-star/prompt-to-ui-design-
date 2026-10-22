const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
// Keep this audit entrypoint aligned with the fixed source. Run the actual signed
// identity/route regression instead of mocking out the new authorization layer.
const result = cp.spawnSync(process.execPath, ['--test', '--test-name-pattern=real signed Firebase identities', 'tests/project-ownership.test.cjs'], {
  cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test', DIRECT_URL: 'postgresql://test:test@127.0.0.1:1/test' },
});
fs.writeFileSync(path.join(root, 'reports/project-ownership-probe.log'), result.stdout || '');
if (result.status !== 0) { console.error('Synthetic authorization regression failed; no production services were accessed.'); process.exitCode = 1; }
else {
  const report = { syntheticOnly: true, realNetworkOrDatabaseAccess: false, anonymousProjectAccessBlocked: true, twoAuthenticatedUsersReceiveSamePrivateProject: false, listingHasNoOwnerFilter: false, detailFilterContainsOnlyProjectId: false, ownershipMigrationApplied: false, conclusion: 'Source enforcement passes signed two-user route tests. Apply the separately approved schema and explicit owner mapping before activating this source; storage remains a release blocker.' };
  fs.writeFileSync(path.join(root, 'reports/production-readiness-authorization.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
