const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}

test('a B session never renders or hydrates an A dashboard snapshot; fresh B snapshot and empty lists work', () => {
  let auth = { ready: true, user: { uid: 'B' } }, refreshes = 0;
  const effects = [], dispatched = [];
  const slice = load('redux/slice/projects/index.ts', {});
  let state = slice.default(undefined, { type: 'init' });
  const dispatch = action => { dispatched.push(action); state = slice.default(state, action); };
  const router = { refresh: () => { refreshes++; } };
  const Provider = load('components/projects/list/provider.tsx', {
    react: { useEffect: fn => effects.push(fn) },
    '@/components/auth/provider': { useAuth: () => auth },
    '@/redux/store': { useAppDispatch: () => dispatch },
    '@/redux/slice/projects': slice,
    'next/navigation': { useRouter: () => router },
  }).default;
  const a = [{ _id: 'A-project', name: 'Private A' }], b = [{ _id: 'B-project', name: 'Private B' }];
  dispatch(slice.fetchProjectsSuccess({ projects: a, total: 1 }));
  assert.equal(Provider({ children: 'private dashboard', initialProjects: a, ownerUid: 'A' }), null);
  effects.splice(0).forEach(fn => fn());
  assert.deepEqual(state.projects, []);
  assert.equal(refreshes, 1);
  assert.ok(!dispatched.slice(1).some(action => action.payload?.projects === a));
  assert.equal(Provider({ children: 'B dashboard', initialProjects: b, ownerUid: 'B' }).props.children, 'B dashboard');
  effects.splice(0).forEach(fn => fn());
  assert.deepEqual(state.projects, b);
  Provider({ children: 'empty dashboard', initialProjects: [], ownerUid: 'B' });
  effects.splice(0).forEach(fn => fn());
  assert.deepEqual(state.projects, []);
  auth = { ready: false, user: { uid: 'B' } };
  assert.equal(Provider({ children: 'private', initialProjects: b, ownerUid: 'B' }), null);
});

test('private canvas/layout children stay hidden until session sync and UID match, discarding stale router state', t => {
  const previous = global.window; t.after(() => { global.window = previous; });
  const navigations = [], effects = [];
  global.window = { location: { replace: url => navigations.push(url) } };
  let auth = { ready: true, user: { uid: 'B' }, requiresVerification: false };
  const Protected = load('components/auth/protected.tsx', {
    react: { useEffect: fn => effects.push(fn) },
    '@/components/auth/provider': { useAuth: () => auth },
    'next/navigation': { useRouter: () => ({ replace: url => navigations.push(url) }), usePathname: () => '/dashboard/workspace/canvas', useSearchParams: () => new URLSearchParams('project=A-project') },
  }).default;
  const hidden = Protected({ children: 'PRIVATE A CANVAS', ownerUid: 'A' });
  assert.equal(hidden.props.role, 'status');
  assert.ok(!JSON.stringify(hidden).includes('PRIVATE A CANVAS'));
  effects.splice(0).forEach(fn => fn());
  assert.deepEqual(navigations, ['/dashboard/workspace']);
  auth = { ...auth, ready: false };
  Protected({ children: 'private', ownerUid: 'A' }); effects.splice(0).forEach(fn => fn());
  assert.equal(navigations.length, 1, 'must not refresh using an old cookie while session sync is pending');
  auth = { ...auth, ready: true };
  assert.equal(Protected({ children: 'PRIVATE B CANVAS', ownerUid: 'B' }), 'PRIVATE B CANVAS');
});

test('account store is keyed per UID and unmounted while identity is changing; old in-flight writes cannot reach B store', () => {
  let auth = { ready: true, user: { uid: 'A' } };
  const slots = []; let cursor = 0;
  const { configureStore } = require('@reduxjs/toolkit');
  const slice = load('redux/slice/projects/index.ts', {});
  const Boundary = load('redux/provider.tsx', {
    react: { useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; } },
    './store': { makeStore: () => configureStore({ reducer: { projects: slice.default } }) },
    '@/components/auth/provider': { useAuth: () => auth },
  }).default;
  const aBoundary = Boundary({ children: 'private' });
  assert.equal(aBoundary.key, 'A');
  cursor = 0;
  const aStore = aBoundary.type(aBoundary.props).props.store;
  aStore.dispatch(slice.fetchProjectsSuccess({ projects: [{ _id: 'A-project' }], total: 1 }));
  auth = { ready: false, user: { uid: 'A' } };
  assert.equal(Boundary({ children: 'private' }), null);
  auth = { ready: true, user: { uid: 'B' } };
  const bBoundary = Boundary({ children: 'private' });
  assert.equal(bBoundary.key, 'B');
  // React creates new hook state when the key changes or subtree unmounts.
  slots.length = 0; cursor = 0;
  const bStore = bBoundary.type(bBoundary.props).props.store;
  assert.notEqual(aStore, bStore);
  assert.deepEqual(bStore.getState().projects.projects, []);
  aStore.dispatch(slice.addProject({ _id: 'late-A-response' }));
  assert.deepEqual(bStore.getState().projects.projects, []);
  cursor = 0;
  assert.equal(bBoundary.type(bBoundary.props).props.store, bStore, 'same account rerenders retain state');
});
