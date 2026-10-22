// Reproduce authorization boundaries using synthetic identities and an in-memory
// Prisma stub. Never connect to Firebase, Neon, or real asset/provider-key stores.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
function load(source, mocks) {
  const filename = path.join(root, source), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = function (request) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return Module.prototype.require.call(this, request);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
async function main() {
  const calls = [];
  const project = { id: 'audit-private-project', name: 'Synthetic private project', projectNumber: 1, isPublic: false, thumbnail: null, sketchesData: '{}', viewportData: null, styleGuide: null, createdAt: new Date(0), lastModified: new Date(0), moodBoardImages: [], inspirationImages: [], settings: null };
  const database = load('lib/db/projects.ts', {
    '@/lib/project-design-system': { deriveProjectDesignSystem() { throw new Error('Unexpected probe call'); } },
    '@/lib/db': { prisma: { project: {
      async findMany(options) { calls.push({ method: 'list', where: options.where || null }); return [project]; },
      async findUnique(options) { calls.push({ method: 'detail', where: options.where }); return project; },
    } } },
  });
  const verifier = {
    AUTH_COOKIE: 'openui_firebase_session', EmailVerificationRequiredError: class extends Error {},
    async verifyFirebaseToken(token) {
      if (!['audit-user-a', 'audit-user-b'].includes(token)) throw new Error('Unauthenticated');
      return { sub: token, plan: 'local', exp: Math.floor(Date.now() / 1000) + 3600 };
    },
  };
  const guard = load('proxy.ts', { '@/lib/firebase/verify-token': verifier });
  const detail = load('app/api/projects/[id]/route.ts', { '@/lib/db/projects': database });
  const list = load('app/api/projects/route.ts', { '@/lib/db/projects': database });
  const results = [];
  for (const uid of ['audit-user-a', 'audit-user-b']) {
    const request = new NextRequest('https://audit.example.test/api/projects/audit-private-project', { headers: { cookie: 'openui_firebase_session=' + uid } });
    const gate = await guard.proxy(request);
    assert.equal(gate.headers.get('x-middleware-next'), '1');
    const response = await detail.GET(request, { params: Promise.resolve({ id: project.id }) });
    results.push(await response.json());
  }
  await list.GET();
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].isPublic, false);
  const anonymous = await guard.proxy(new NextRequest('https://audit.example.test/api/projects'));
  assert.equal(anonymous.status, 401);
  const report = {
    syntheticOnly: true, realNetworkOrDatabaseAccess: false,
    anonymousProjectAccessBlocked: true,
    twoAuthenticatedUsersReceiveSamePrivateProject: true,
    listingHasNoOwnerFilter: calls.some(call => call.method === 'list' && call.where === null),
    detailFilterContainsOnlyProjectId: calls.filter(call => call.method === 'detail').every(call => Object.keys(call.where).join(',') === 'id'),
    conclusion: 'Authentication is enforced, but project-level user isolation is absent. Production release blocker for private multi-user projects.',
  };
  fs.writeFileSync(path.join(root, 'reports', 'production-readiness-authorization.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('Synthetic authorization probe failed; no real services were accessed.'); process.exitCode = 1; });
