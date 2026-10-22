// HTTP smoke checks against the isolated build, with no real credentials or DB.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const net = require('node:net');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let stage = 'build-report';
async function main() {
  const build = JSON.parse(fs.readFileSync(path.join(root, 'reports/production-readiness-build.json')));
  assert.equal(build.exitCode, 0);
  assert.ok(path.basename(build.directory).startsWith('openui-production-check-'));
  assert.equal(path.dirname(build.directory), path.dirname(root));
  assert.equal(fs.existsSync(path.join(build.directory, '.env.local')), false);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const env = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke', DIRECT_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'synthetic-build' });
  const server = cp.spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: build.directory, env, stdio: 'ignore' });
  // Next.js normalizes loopback hosts to localhost in its request URL handling.
  // Use the matching browser origin for same-origin session endpoint checks.
  const origin = 'http://localhost:' + port;
  try {
    stage = 'server-startup';
    let ready = false;
    for (let count = 0; count < 90; count++) {
      if (server.exitCode !== null) throw new Error('Isolated server exited');
      try { if ((await fetch(origin, { signal: AbortSignal.timeout(2000) })).status === 200) { ready = true; break; } } catch {}
      await pause(500);
    }
    assert.ok(ready, 'Isolated production server did not start');
    const results = [];
    for (const pathname of ['/', '/sign-in', '/sign-up', '/verify-email']) {
      stage = pathname;
      const response = await fetch(origin + pathname, { redirect: 'manual' });
      assert.equal(response.status, 200);
      results.push({ path: pathname, status: response.status });
    }
    stage = 'dashboard-guard';
    const dashboard = await fetch(origin + '/dashboard/workspace', { redirect: 'manual' });
    assert.equal(dashboard.status, 307);
    assert.equal(new URL(dashboard.headers.get('location'), origin).pathname, '/sign-in');
    results.push({ path: '/dashboard/workspace', status: 307, redirectsTo: '/sign-in' });
    for (const pathname of ['/api/projects', '/api/uploads/not-a-file', '/api/integration/projects']) {
      stage = pathname;
      const response = await fetch(origin + pathname, { redirect: 'manual' });
      assert.equal(response.status, 401);
      results.push({ path: pathname, status: response.status });
    }
    stage = 'session-forgery';
    const forged = await fetch(origin + '/api/auth/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'invalid-synthetic-token' }) });
    assert.equal(forged.status, 401);
    results.push({ path: '/api/auth/session', check: 'forged token rejected', status: forged.status });
    stage = 'session-origin';
    const csrf = await fetch(origin + '/api/auth/session', { method: 'POST', headers: { origin: 'https://other.example.test', 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'invalid-synthetic-token' }) });
    assert.equal(csrf.status, 403);
    results.push({ path: '/api/auth/session', check: 'cross-origin request rejected', status: csrf.status });
    const report = { syntheticCredentialsOnly: true, productionDatabaseUsed: false, successfulRealFirebaseLoginTested: false, results };
    fs.writeFileSync(path.join(root, 'reports/production-readiness-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    server.kill();
    if (server.exitCode === null) await Promise.race([new Promise(resolve => server.once('exit', resolve)), pause(5000)]);
  }
}
main().catch(error => { console.error(JSON.stringify({ stage, failed: true, actualStatus: typeof error.actual === 'number' ? error.actual : null, expectedStatus: typeof error.expected === 'number' ? error.expected : null })); console.error('Isolated production smoke check failed. No production services were used.'); process.exitCode = 1; });
