const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
const { generateKeyPairSync, sign } = require('node:crypto');
const { NextRequest } = require('next/server');
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const now = Math.floor(Date.now() / 1000);

function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = function (name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/')) {
        const base = name.slice(2);
        return load([base + '.ts', base + '.tsx', base + '/index.ts'].find(file => fs.existsSync(file)));
      }
      return Module.prototype.require.call(this, name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
  };
}
const verifier = loader()('lib/firebase/verify-token.ts');
const options = { projectId: 'ownership-test', keys: { test: keys.publicKey.export({ type: 'spki', format: 'pem' }) }, now };
function token(uid, verified = true) {
  const parts = [{ alg: 'RS256', kid: 'test' }, { aud: 'ownership-test', iss: 'https://securetoken.google.com/ownership-test', sub: uid, exp: now + 3600, iat: now - 1, auth_time: now - 10, email_verified: verified, firebase: { sign_in_provider: 'password' } }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return parts + '.' + sign('RSA-SHA256', Buffer.from(parts), keys.privateKey).toString('base64url');
}
const tokens = { alice: token('alice'), bob: token('bob'), unverified: token('alice', false), forged: 'not-a-signed-token' };
function req(url, user = 'alice', method = 'GET', body, origin = 'http://localhost') {
  const headers = { ...(user ? { cookie: 'openui_firebase_session=' + tokens[user] } : {}), origin };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  return new NextRequest('http://localhost' + url, { method, headers, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) });
}
const params = id => ({ params: Promise.resolve({ id }) });

function fixture() {
  const records = ['alice', 'bob', null].map((ownerUid, index) => ({ id: ['pa', 'pb', 'legacy'][index], ownerUid, name: 'Synthetic ' + index, projectNumber: index + 1, description: null, isPublic: index === 1, thumbnail: null, sketchesData: '{}', viewportData: null, styleGuide: '{}', createdAt: new Date(0), lastModified: new Date(0), moodBoardImages: [], inspirationImages: [], settings: null }));
  const images = ['pa', 'pb', 'legacy'].map(projectId => ({ id: 'm-' + projectId, projectId, filePath: 'moodboard/' + projectId + '/original.svg', fileName: 'original.svg', mimeType: 'image/svg+xml', createdAt: new Date(0) }));
  const settings = ['pa', 'pb', 'legacy'].map(projectId => ({ id: 's-' + projectId, projectId, provider: 'openai', model: 'gpt-test' }));
  const writes = [], files = [], providerCalls = [];
  let serverToken;
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => key === 'project'
      ? matches(records.find(project => project.id === row.projectId) || {}, value)
      : row[key] === value);
  }
  const missing = () => { const error = new Error('No matching record'); error.code = 'P2025'; throw error; };
  const project = {
    async findMany({ where } = {}) { return structuredClone(records.filter(row => matches(row, where))); },
    async findFirst({ where } = {}) { return structuredClone(records.filter(row => matches(row, where)).at(-1) || null); },
    async findUnique({ where }) { return structuredClone(records.find(row => matches(row, where)) || null); },
    async create({ data }) { writes.push('create'); const row = { ...records[0], ...data, id: 'new-' + records.length }; records.push(row); return structuredClone(row); },
    async update({ where, data }) { const row = records.find(row => matches(row, where)); if (!row) missing(); Object.assign(row, data); writes.push('update'); return structuredClone(row); },
    async delete({ where }) { const index = records.findIndex(row => matches(row, where)); if (index < 0) missing(); writes.push('delete'); return records.splice(index, 1)[0]; },
  };
  function childDelegate(rows, kind) {
    return {
      async findMany({ where } = {}) { return structuredClone(rows.filter(row => matches(row, where))); },
      async findFirst({ where }) { return structuredClone(rows.find(row => matches(row, where)) || null); },
      async findUnique({ where }) { return structuredClone(rows.find(row => matches(row, where)) || null); },
      async create({ data }) { writes.push(kind + '-create'); const row = { id: 'new-child', createdAt: new Date(0), ...data }; rows.push(row); return structuredClone(row); },
      async delete({ where }) { const index = rows.findIndex(row => matches(row, where)); if (index < 0) missing(); writes.push(kind + '-delete'); return rows.splice(index, 1)[0]; },
      async upsert({ where, update, create }) { writes.push(kind + '-upsert'); const row = rows.find(row => matches(row, where)); if (row) Object.assign(row, update); else rows.push({ id: 'new-settings', ...create }); return row || rows.at(-1); },
    };
  }
  const prisma = { project, moodBoardImage: childDelegate(images, 'moodboard'), inspirationImage: childDelegate([], 'inspiration'), projectSettings: childDelegate(settings, 'settings') };
  const load = loader({
    '@/lib/firebase/verify-token': { ...verifier, verifyFirebaseToken: value => verifier.verifyFirebaseToken(value, options) },
    'next/headers': { cookies: async () => ({ get: () => serverToken ? { value: serverToken } : undefined }) },
    '@/lib/db': { prisma },
    'fs/promises': { __esModule: true, default: {
      async mkdir(...args) { files.push(['mkdir', ...args]); }, async writeFile(...args) { files.push(['write', ...args]); },
      async readFile(...args) { files.push(['read', ...args]); return Buffer.from('<svg/>'); }, async unlink(...args) { files.push(['unlink', ...args]); }, async rm(...args) { files.push(['rm', ...args]); },
    } },
    '@/lib/ai/personal-provider-store': { personalProviderStore: { read: async () => { providerCalls.push('read'); return { providers: {} }; } } },
    '@/lib/images/asset-store': { MAX_IMAGE_BYTES: 10000000, assetUrl: id => '/api/images/assets/' + id, imageAssets: {
      async save() { files.push(['asset-save']); return { id: 'asset-test', projectId: 'pa', alt: 'Test', width: 1, height: 1 }; },
      async read() { files.push(['asset-read']); return { meta: { projectId: 'pb', mime: 'image/png' }, data: Buffer.from('bytes') }; },
    } },
  });
  const access = load('lib/server/project-access.ts');
  const as = async (user, work) => access.withVerifiedIdentity(await verifier.verifyFirebaseToken(tokens[user], options), work);
  return { load, access, as, records, images, settings, writes, files, providerCalls, prisma, setServerUser(user) { serverToken = tokens[user]; } };
}

test('real signed Firebase identities scope listings, detail and server-side helpers; legacy and public flags grant no bypass', async () => {
  const f = fixture(), list = f.load('app/api/projects/route.ts'), detail = f.load('app/api/projects/[id]/route.ts');
  for (const [uid, id, other] of [['alice', 'pa', 'pb'], ['bob', 'pb', 'pa']]) {
    const rows = await (await list.GET(req('/api/projects', uid))).json(); assert.deepEqual(rows.map(row => row._id), [id]);
    assert.equal((await detail.GET(req('/api/projects/' + id, uid), params(id))).status, 200);
    for (const denied of [other, 'legacy', 'missing']) assert.equal((await detail.GET(req('/api/projects/' + denied, uid), params(denied))).status, 404);
    const helpers = f.load('lib/db/projects.ts');
    assert.equal(await f.as(uid, () => helpers.getProject(other)), null);
    assert.equal((await f.as(uid, () => helpers.getAllProjects())).length, 1);
  }
  for (const uid of [null, 'forged']) assert.equal((await list.GET(req('/api/projects', uid))).status, 401);
  assert.equal((await list.GET(req('/api/projects', 'unverified'))).status, 403);
});

test('both accounts can edit and delete only their own synthetic projects', async () => {
  for (const [user, own, other] of [['alice', 'pa', 'pb'], ['bob', 'pb', 'pa']]) {
    const f = fixture(), route = f.load('app/api/projects/[id]/route.ts');
    const untouched = structuredClone(f.records.filter(row => row.id !== own));
    assert.equal((await route.PATCH(req('/api/projects/' + other, user, 'PATCH', { name: 'Denied' }), params(other))).status, 404);
    assert.equal((await route.DELETE(req('/api/projects/' + other, user, 'DELETE'), params(other))).status, 404);
    assert.equal(f.writes.length, 0);
    assert.equal((await route.PATCH(req('/api/projects/' + own, user, 'PATCH', { name: 'Own edit' }), params(own))).status, 200);
    assert.equal(f.records.find(row => row.id === own).name, 'Own edit');
    assert.equal((await route.DELETE(req('/api/projects/' + own, user, 'DELETE'), params(own))).status, 200);
    assert.deepEqual(f.records, untouched);
  }
});

test('anonymous project and nested-resource requests fail before writes, files or provider work', async () => {
  const f = fixture(), detail = f.load('app/api/projects/[id]/route.ts');
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal((await detail[method](req('/api/projects/pa', null, method, method === 'PATCH' ? { name: 'Denied' } : undefined), params('pa'))).status, 401);
  }
  const calls = [
    ['app/api/projects/route.ts', 'POST', '/api/projects', { name: 'Denied' }],
    ['app/api/autosave/route.ts', 'POST', '/api/autosave', { projectId: 'pa', shapesData: {} }],
    ['app/api/models/select/route.ts', 'POST', '/api/models/select', { projectId: 'pa', provider: 'openai', model: 'test' }],
    ['app/api/upload/route.ts', 'DELETE', '/api/upload?id=m-pa&type=moodboard'],
    ['app/api/images/assets/route.ts', 'POST', '/api/images/assets', { projectId: 'pa' }],
  ];
  for (const [file, method, url, body] of calls) assert.equal((await f.load(file)[method](req(url, null, method, body))).status, 401);
  assert.equal((await f.load('app/api/projects/[id]/style-guide/route.ts').GET(req('/api/projects/pa/style-guide', null), params('pa'))).status, 401);
  const { withPersonalProvider } = f.load('lib/ai/with-personal-provider.ts');
  let called = false;
  assert.equal((await withPersonalProvider(async () => { called = true; return Response.json({}); })(req('/api/generate', null, 'POST', { projectId: 'pa' }))).status, 401);
  assert.equal(called, false);
  assert.deepEqual([f.writes, f.files, f.providerCalls], [[], [], []]);
});

test('new projects ignore forged owner fields and receive only the verified Firebase UID', async () => {
  const f = fixture(), route = f.load('app/api/projects/route.ts');
  const response = await route.POST(req('/api/projects', 'alice', 'POST', { name: 'New', ownerUid: 'bob', uid: 'bob', isPublic: true }));
  assert.equal(response.status, 200); const id = (await response.json()).projectId;
  assert.equal(f.records.find(row => row.id === id).ownerUid, 'alice');
  assert.equal((await f.load('app/api/projects/[id]/route.ts').GET(req('/api/projects/' + id, 'bob'), params(id))).status, 404);
});

test('rename/delete/autosave/thumbnail/style-guide mutations reject other or unassigned projects without side effects', async () => {
  const f = fixture(), detail = f.load('app/api/projects/[id]/route.ts'), style = f.load('app/api/projects/[id]/style-guide/route.ts');
  for (const id of ['pb', 'legacy', 'missing']) {
    assert.equal((await detail.PATCH(req('/api/projects/' + id, 'alice', 'PATCH', { name: 'Hacked', ownerUid: 'alice' }), params(id))).status, 404);
    assert.equal((await detail.DELETE(req('/api/projects/' + id, 'alice', 'DELETE'), params(id))).status, 404);
    assert.equal((await f.load('app/api/autosave/route.ts').POST(req('/api/autosave', 'alice', 'POST', { projectId: id, shapesData: {} }))).status, 404);
    assert.equal((await f.load('app/api/projects/[id]/thumbnail/route.ts').POST(req('/api/projects/' + id + '/thumbnail', 'alice', 'POST', { thumbnail: 'data:image/png;base64,AAA' }), params(id))).status, 404);
    for (const method of ['PATCH', 'PUT']) assert.equal((await style[method](req('/api/projects/' + id + '/style-guide', 'alice', method, { styleGuide: {} }), params(id))).status, 404);
  }
  assert.equal(f.writes.length, 0); assert.equal(f.files.length, 0);
  assert.equal((await detail.PATCH(req('/api/projects/pa', 'alice', 'PATCH', { name: 'Renamed', ownerUid: 'bob' }), params('pa'))).status, 200);
  assert.equal(f.records[0].ownerUid, 'alice'); assert.equal(f.records[0].name, 'Renamed');
  assert.equal((await f.load('app/api/autosave/route.ts').POST(req('/api/autosave', 'alice', 'POST', { projectId: 'pa', shapesData: { good: true } }))).status, 200);
  assert.equal((await detail.PATCH(req('/api/projects/pa', 'alice', 'PATCH', { name: 'CSRF' }, 'https://other.test'), params('pa'))).status, 403);
});

test('nested styles/settings/debug and direct DB helpers enforce parent ownership', async () => {
  const f = fixture(), style = f.load('app/api/projects/[id]/style-guide/route.ts');
  assert.equal((await style.GET(req('/api/projects/pb/style-guide'), params('pb'))).status, 404);
  const settings = f.load('lib/db/settings.ts');
  await assert.rejects(f.as('alice', () => settings.getProjectSettings('pb')), error => error.status === 404);
  await assert.rejects(f.as('alice', () => settings.updateProjectSettings('pb', { provider: 'x', model: 'x' })), error => error.status === 404);
  const select = f.load('app/api/models/select/route.ts');
  assert.equal((await select.GET(req('/api/models/select?projectId=pb'))).status, 404);
  assert.equal((await select.POST(req('/api/models/select', 'alice', 'POST', { projectId: 'pb', provider: 'x', model: 'x' }))).status, 404);
  const debug = await f.load('app/api/debug-settings/route.ts').GET(req('/api/debug-settings'));
  assert.deepEqual((await debug.json()).settings.map(row => row.projectId), ['pa']);
  assert.equal(f.writes.length, 0); assert.equal(f.providerCalls.length, 0);
});

test('legacy upload read/create/delete checks parent ownership before filesystem access and uses private caching', async () => {
  const f = fixture(), upload = f.load('app/api/upload/route.ts'), serve = f.load('app/api/uploads/[...path]/route.ts');
  const imageParams = project => ({ params: Promise.resolve({ path: ['moodboard', project, 'original.svg'] }) });
  for (const id of ['pb', 'legacy']) {
    assert.equal((await serve.GET(req('/api/uploads/moodboard/' + id + '/original.svg'), imageParams(id))).status, 404);
    const form = new FormData(); form.set('projectId', id); form.set('type', 'moodboard'); form.set('file', new File(['svg'], 'image.svg', { type: 'image/svg+xml' }));
    assert.equal((await upload.POST(req('/api/upload', 'alice', 'POST', form))).status, 404);
    assert.equal((await upload.DELETE(req('/api/upload?id=m-' + id + '&type=moodboard', 'alice', 'DELETE'))).status, 404);
  }
  assert.equal(f.files.length, 0); assert.equal(f.writes.length, 0);
  const own = await serve.GET(req('/api/uploads/moodboard/pa/original.svg'), imageParams('pa'));
  assert.equal(own.status, 200); assert.match(own.headers.get('cache-control'), /no-store/); assert.equal(own.headers.get('vary'), 'Cookie'); assert.match(own.headers.get('content-security-policy'), /sandbox/);
  const form = new FormData(); form.set('projectId', 'pa'); form.set('type', 'moodboard'); form.set('file', new File(['png'], '../../pb/stolen.png', { type: 'image/png' }));
  assert.equal((await upload.POST(req('/api/upload', 'alice', 'POST', form))).status, 200);
  const write = f.files.find(item => item[0] === 'write'); assert.ok(write[1].includes(path.join('moodboard', 'pa'))); assert.equal(write[1].includes('..'), false);
});

test('all generation/model entrypoints deny cross-user access before handler/provider/image processing', async () => {
  const f = fixture(), { withPersonalProvider } = f.load('lib/ai/with-personal-provider.ts');
  let called = 0;
  for (const pathname of ['/api/generate', ...['convert', 'redesign', 'workflow', 'workflow-redesign', 'style', 'theme', 'retheme'].map(name => '/api/generate/' + name), '/api/models/select']) {
    const guarded = withPersonalProvider(async () => { called++; return Response.json({ ok: true }); });
    for (const projectId of ['pb', 'legacy', 'missing']) {
      const form = pathname === '/api/generate' ? new FormData() : null; if (form) form.set('projectId', projectId);
      assert.equal((await guarded(req(pathname, 'alice', 'POST', form || { projectId, mode: 'project-chat', uid: 'bob' }))).status, 404);
      const actualRoute = f.load('app' + pathname + '/route.ts');
      const actualForm = pathname === '/api/generate' ? new FormData() : null; if(actualForm)actualForm.set('projectId',projectId);
      assert.equal((await actualRoute.POST(req(pathname, 'alice', 'POST', actualForm || { projectId, mode: 'project-chat', uid: 'bob' }))).status, 404);
    }
  }
  assert.equal(called, 0); assert.equal(f.providerCalls.length, 0); assert.equal(f.files.length, 0);
  const run = withPersonalProvider(async () => Response.json({ ok: true }));
  assert.equal((await run(req('/api/generate/theme', 'alice', 'POST', { projectId: 'pa' }))).status, 200);
  assert.equal((await run(req('/api/generate/theme', 'alice', 'POST', { projectId: 'pa' }, 'https://other.test'))).status, 403);
});

test('asset upload and serving require both image UID and current project ownership', async () => {
  const f = fixture(), save = f.load('app/api/images/assets/route.ts'), serve = f.load('app/api/images/assets/[id]/route.ts');
  const form = new FormData(); form.set('projectId', 'pb'); form.set('file', new File(['bytes'], 'image.png', { type: 'image/png' }));
  assert.equal((await save.POST(req('/api/images/assets', 'alice', 'POST', form))).status, 404);
  assert.equal(f.files.length, 0);
  assert.equal((await serve.GET(req('/api/images/assets/synthetic'), params('synthetic'))).status, 404);
  assert.equal((await serve.GET(req('/api/images/assets/synthetic', null), params('synthetic'))).status, 401);
});

test('owners retain nested style/model/thumbnail edits and upload/project deletion while other projects stay unchanged', async () => {
  const f = fixture(); const other = structuredClone(f.records[1]);
  const style = f.load('app/api/projects/[id]/style-guide/route.ts');
  assert.equal((await style.PUT(req('/api/projects/pa/style-guide','alice','PUT',{styleGuide:{theme:'Owner theme'}}),params('pa'))).status,200);
  assert.equal((await style.GET(req('/api/projects/pa/style-guide'),params('pa'))).status,200);
  assert.equal((await f.load('app/api/models/select/route.ts').POST(req('/api/models/select','alice','POST',{projectId:'pa',provider:'openai',model:'gpt-owner'}))).status,200);
  assert.equal(f.settings.find(row=>row.projectId==='pa').model,'gpt-owner');
  assert.equal((await f.load('app/api/projects/[id]/thumbnail/route.ts').POST(req('/api/projects/pa/thumbnail','alice','POST',{thumbnail:'data:image/png;base64,AAA'}),params('pa'))).status,200);
  assert.equal((await f.load('app/api/upload/route.ts').DELETE(req('/api/upload?id=m-pa&type=moodboard','alice','DELETE'))).status,200);
  assert.ok(f.files.some(row=>row[0]==='unlink'));
  assert.equal((await f.load('app/api/projects/[id]/route.ts').DELETE(req('/api/projects/pa','alice','DELETE'),params('pa'))).status,200);
  assert.deepEqual(f.records.find(row=>row.id==='pb'),other); assert.ok(f.records.find(row=>row.id==='legacy'));
});

test('server helper async identity context remains separate across concurrent users', async () => {
  const f = fixture(), { getAllProjects } = f.load('lib/db/projects.ts');
  const result = await Promise.all(['alice', 'bob'].map(user => f.as(user, async () => { await new Promise(resolve => setImmediate(resolve)); return (await getAllProjects()).map(row => row._id); })));
  assert.deepEqual(result, [['pa'], ['pb']]);
  await assert.rejects(getAllProjects(), error => error.status === 401);
});

test('server-rendered loaders verify their own Firebase cookie without relying on proxy or client guards', async () => {
  const f = fixture(), helpers = f.load('lib/db/projects.ts');
  f.setServerUser('bob'); assert.deepEqual((await helpers.getAllProjects()).map(row=>row._id),['pb']);
  assert.equal(await helpers.getProject('pa'),null);
  await assert.rejects(helpers.getProjectStyleGuide('pa'),error=>error.status===404);
  f.setServerUser('alice'); assert.equal((await helpers.getProject('pa')).id,'pa');
  f.setServerUser('forged'); await assert.rejects(helpers.getAllProjects(),error=>error.status===401);
});

test('verified identity survives asynchronous SSE work and cannot bleed into another generation stream', async () => {
  const f = fixture(), { withPersonalProvider } = f.load('lib/ai/with-personal-provider.ts');
  const handler = withPersonalProvider(async () => new Response(new ReadableStream({ async start(controller) {
    await new Promise(resolve => setImmediate(resolve));
    const where = await f.access.ownerFilter();
    controller.enqueue(new TextEncoder().encode(where.ownerUid)); controller.close();
  } })));
  const values = await Promise.all([['alice', 'pa'], ['bob', 'pb']].map(async ([uid, projectId]) => {
    const response = await handler(req('/api/generate/convert', uid, 'POST', { projectId }));
    assert.equal(response.status, 200); return response.text();
  }));
  assert.deepEqual(values, ['alice', 'bob']);
});

test('generated PostgreSQL client sends owner predicates on list, nested image reads and atomic updates', async () => {
  const { PrismaClient } = require('@prisma/client'); const queries = [];
  const connection = { provider: 'postgres', adapterName: '@prisma/adapter-neon',
    async queryRaw(query) { queries.push(query); return { columnNames: [], columnTypes: [], rows: [] }; },
    async executeRaw(query) { queries.push(query); return 0; }, async dispose() {},
  };
  const client = new PrismaClient({ adapter: { provider: 'postgres', adapterName: '@prisma/adapter-neon', async connect() { return connection; } }, log: [] });
  try {
    await client.project.findMany({ where: { ownerUid: 'alice' }, select: { id: true } });
    await client.moodBoardImage.findMany({ where: { projectId: 'pa', project: { ownerUid: 'alice' } }, select: { id: true } });
    await assert.rejects(client.project.update({ where: { id: 'pa', ownerUid: 'bob' }, data: { name: 'Denied' }, select: { id: true } }), error => error.code === 'P2025');
    assert.equal(queries.length, 3);
    for (const query of queries) assert.match(query.sql, /WHERE[\s\S]*ownerUid/);
    assert.ok(queries[0].args.includes('alice')); assert.ok(queries[1].args.includes('alice')); assert.ok(queries[2].args.includes('bob'));
  } finally { await client.$disconnect(); }
});

test('bearer integration keys are owner-bound; legacy keys fail closed; no key can list another owner projects', async () => {
  const f = fixture();
  const route = loader({ '@/lib/workspace-key': { workspaceKeyStore: { owner: async key => key === 'bound' ? 'alice' : null } }, '@/lib/db': { prisma: f.prisma } })('app/api/integration/projects/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/integration/projects', { headers: { authorization: 'Bearer legacy' } }))).status, 401);
  const response = await route.GET(new Request('http://localhost/api/integration/projects', { headers: { authorization: 'Bearer bound' } }));
  assert.deepEqual((await response.json()).projects.map(row => row.id), ['pa']);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openui-owner-key-'));
  try {
    const { createWorkspaceKeyStore } = loader()('lib/workspace-key.ts'); const store = createWorkspaceKeyStore(directory);
    const first = await store.generate('alice'); assert.equal(await store.owner(first.key), 'alice');
    await assert.rejects(store.generate('bob')); await assert.rejects(store.revoke('bob'));
    assert.deepEqual(await store.status('bob'), { configured: false });
    const file = path.join(directory, 'workspace-key.json'), record = JSON.parse(fs.readFileSync(file)); delete record.ownerUid; fs.writeFileSync(file, JSON.stringify(record));
    assert.equal(await store.owner(first.key), null); assert.equal(await store.verify(first.key), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('ownership migration is additive, nullable, without guessed owners or production backfill', () => {
  const sql = fs.readFileSync('prisma/migrations-postgresql/20261022010000_project_ownership/migration.sql', 'utf8');
  assert.match(sql, /ADD COLUMN\s+"ownerUid" TEXT;/); assert.match(sql, /CREATE INDEX "Project_ownerUid_idx"/);
  assert.equal(/\b(?:UPDATE|DELETE|DROP|TRUNCATE|NOT NULL|DEFAULT)\b/.test(sql), false);
});

test('offline owner planner inventories exactly five verified IDs, never guesses UIDs and refuses unexpected mappings', () => {
  const Database = require('better-sqlite3'); const { createHash } = require('node:crypto'); const { plan } = require('../scripts/plan-project-owners.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openui-owner-plan-'));
  try {
    const file = path.join(directory, 'openui.db'), db = new Database(file);
    db.exec('CREATE TABLE Project(id TEXT PRIMARY KEY)'); for(let i=0;i<5;i++)db.prepare('INSERT INTO Project(id) VALUES (?)').run('p'+i); db.close();
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({backupFileSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),inventory:{tables:{Project:{rows:5}}}}));
    const result = plan(directory); assert.equal(result.readyForReview,false); assert.equal(result.productionChanges,false); assert.ok(result.assignments.every(row=>row.ownerUid===null));
    assert.throws(()=>plan(directory,[{projectId:'unknown',ownerUid:'alice'}]));
    const mapping=result.assignments.map(row=>({...row,ownerUid:'explicitly-supplied-uid'})); assert.equal(plan(directory,mapping).readyForReview,true);
    mapping[0].ownerUid=''; assert.throws(()=>plan(directory,mapping));
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
