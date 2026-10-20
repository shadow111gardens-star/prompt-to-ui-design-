const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(source, mocks={}) {
  const filename=path.resolve(source), mod=new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require=function(request){return Object.hasOwn(mocks,request)?mocks[request]:Module.prototype.require.call(this,request);};
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}
const { createWorkspaceKeyStore, isLocalKeyAdmin }=load('lib/workspace-key.ts');
test('workspace keys persist only hashes; rotation and revocation invalidate earlier credentials',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openui-key-test-'));
  try{
    const store=createWorkspaceKeyStore(dir);
    assert.deepEqual(await store.status(),{configured:false});
    const first=await store.generate();
    assert.equal(await store.verify(first.key),true);
    assert.equal(await store.verify('wrong'),false);
    assert.equal(fs.readFileSync(path.join(dir,'workspace-key.json'),'utf8').includes(first.key),false);
    assert.equal('key' in await store.status(),false);
    assert.equal(await createWorkspaceKeyStore(dir).verify(first.key),true);
    const second=await store.generate();
    assert.notEqual(first.key,second.key);
    assert.equal(await store.verify(first.key),false);
    assert.equal(await store.verify(second.key),true);
    await store.revoke();
    assert.equal(await store.verify(second.key),false);
    assert.deepEqual(await store.status(),{configured:false});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('key administration rejects missing/cross-site origins and remote hosts',()=>{
  const request=(host,origin,site='same-origin')=>new Request(host,{headers:{...(origin?{origin}:{}),'sec-fetch-site':site}});
  assert.equal(isLocalKeyAdmin(request('http://localhost:3000/api/workspace-key','http://localhost:3000')),true);
  assert.equal(isLocalKeyAdmin(request('http://localhost:3000/api/workspace-key',null)),false);
  assert.equal(isLocalKeyAdmin(request('http://localhost:3000/api/workspace-key','https://attacker.test')),false);
  assert.equal(isLocalKeyAdmin(request('http://evil.test/api/workspace-key','http://evil.test')),false);
});
test('integration projects requires a valid Bearer key and never includes HTML or secrets',async()=>{
  const {GET}=load('app/api/integration/projects/route.ts',{
    '@/lib/workspace-key':{workspaceKeyStore:{verify:async value=>value==='valid'}},
    '@/lib/db':{prisma:{project:{findMany:async options=>{assert.deepEqual(Object.keys(options.select).sort(),['id','lastModified','name','projectNumber']);return [{id:'p1',name:'Test',projectNumber:1,lastModified:'today'}];}}}},
  });
  assert.equal((await GET(new Request('http://localhost/api/integration/projects'))).status,401);
  const response=await GET(new Request('http://localhost/api/integration/projects',{headers:{authorization:'Bearer valid'}}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).projects[0].id,'p1');
});
// Exercise component event handlers with isolated hooks; this is not a browser test.
function settingsHarness() {
 const slots=[],effects=[],cleanups=[];let index=0;
 const hooks={
  useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},
  useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(callback){const i=index++;if(!(i in slots)){slots[i]=true;effects.push(callback);}},
 };
 const filename=path.resolve('components/projects/workspace-settings.tsx'),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=function(request){if(request==='react')return hooks;if(request==='@/lib/load-workspace-key')return load('lib/load-workspace-key.ts');if(request==='@/lib/utils')return {cn:(...values)=>values.filter(Boolean).join(' ')};if(request==='next/link')return 'a';return Module.prototype.require.call(this,request);};
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 const render=()=>{index=0;return mod.exports.default({providers:[]});};
 const mount=()=>{const tree=render();for(const effect of effects)cleanups.push(effect());return tree;};
 return {render,mount,unmount:()=>cleanups.forEach(cleanup=>cleanup?.())};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
function find(tree,predicate){const node=nodes(tree).find(predicate);assert.ok(node,'Expected control exists');return node;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function browserMocks(t,fetcher){
 const saved={window:global.window,localStorage:global.localStorage,fetch:global.fetch,navigator:Object.getOwnPropertyDescriptor(global,'navigator')};
 const storage=new Map();
 global.window={location:{hash:''},history:{replaceState(){}},addEventListener(){},removeEventListener(){},dispatchEvent(){},confirm:()=>true};
 global.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 global.fetch=fetcher;
 Object.defineProperty(global,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{}}}});
 t.after(()=>{global.window=saved.window;global.localStorage=saved.localStorage;global.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(global,'navigator',saved.navigator);else delete global.navigator;});
 return storage;
}
test('settings profile save trims values and restores them after remount',async t=>{
 const storage=browserMocks(t,async()=>Response.json({configured:false}));
 let h=settingsHarness();h.mount();await flush();
 find(h.render(),n=>n.props?.id==='display-name').props.onChange({target:{value:'  Abhay  '}});
 find(h.render(),n=>n.props?.id==='profile-email').props.onChange({target:{value:'abhay@example.test'}});
 find(h.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.deepEqual(JSON.parse(storage.get('openui-workspace-profile')),{name:'Abhay',email:'abhay@example.test'});
 h.unmount();h=settingsHarness();h.mount();await flush();
 assert.equal(find(h.render(),n=>n.props?.id==='display-name').props.value,'Abhay');h.unmount();
});
test('settings generate, reveal, copy, clipboard failure and revoke update actual controls',async t=>{
 let copied='';browserMocks(t,async(_url,options={})=>Response.json(options.method==='POST'?{configured:true,key:'oui_test-key',suffix:'-key'}:{configured:false}));
 navigator.clipboard.writeText=async value=>{copied=value;};
 const h=settingsHarness();h.mount();await flush();
 find(h.render(),n=>n.props?.id==='tab-api').props.onClick();
 find(h.render(),n=>n.type==='button'&&n.props.children?.includes?.('Generate New Key')).props.onClick();await flush();
 assert.equal(find(h.render(),n=>n.props?.['aria-label']==='API key').props.type,'password');
 find(h.render(),n=>n.props?.['aria-label']==='Reveal API key').props.onClick();
 assert.equal(find(h.render(),n=>n.props?.['aria-label']==='API key').props.type,'text');
 find(h.render(),n=>n.props?.['aria-label']==='Copy API key').props.onClick();await flush();assert.equal(copied,'oui_test-key');
 navigator.clipboard.writeText=async()=>{throw Error('blocked');};
 find(h.render(),n=>n.props?.['aria-label']==='Copy API key').props.onClick();await flush();assert.ok(nodes(h.render()).some(n=>n.props?.role==='status'&&n.props.children.includes('Clipboard unavailable')));
 find(h.render(),n=>n.type==='button'&&n.props.children?.includes?.('Revoke key')).props.onClick();await flush();
 assert.equal(find(h.render(),n=>n.props?.['aria-label']==='Copy API key').props.disabled,true);h.unmount();
});
test('settings pending status fetch is cancelled on unmount without an unhandled rejection',async t=>{
 let signal;browserMocks(t,(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError'))));});
 const h=settingsHarness();h.mount();await Promise.resolve();h.unmount();await flush();assert.equal(signal.aborted,true);
});
const {loadWorkspaceKey}=load('lib/load-workspace-key.ts');
function keyObserver(){const successes=[],errors=[],reports=[];return {successes,errors,reports,callbacks:{onSuccess:value=>successes.push(value),onError:error=>errors.push(error),reportError:error=>reports.push(error)}};}
test('workspace cleanup after response consumption never aborts the completed request',async()=>{
 const observer=keyObserver();let signal;
 const request=loadWorkspaceKey(observer.callbacks,async(_url,options)=>{signal=options.signal;return Response.json({configured:true,suffix:'1234'});});
 await request.done;request.cancel();
 assert.equal(signal.aborted,false);assert.equal(observer.successes.length,1);assert.equal(observer.reports.length,0);
});
test('workspace Strict Mode effect replay skips discarded request and preserves active replacement',async()=>{
 let calls=0;const old=keyObserver(),current=keyObserver();
 const fetcher=async()=>{calls++;return Response.json({configured:false});};
 const first=loadWorkspaceKey(old.callbacks,fetcher);first.cancel();
 const second=loadWorkspaceKey(current.callbacks,fetcher);
 await Promise.all([first.done,second.done]);
 assert.equal(calls,1);assert.equal(old.successes.length,0);assert.equal(current.successes.length,1);
});
test('workspace cancels a pending body safely and ignores stale responses',async()=>{
 let release,signal;const observer=keyObserver();
 const body=new Promise(resolve=>{release=resolve;});
 const request=loadWorkspaceKey(observer.callbacks,async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>body};});
 await Promise.resolve();await Promise.resolve();request.cancel();release({configured:true,suffix:'old'});await request.done;
 assert.equal(signal.aborted,true);assert.equal(observer.successes.length,0);assert.equal(observer.errors.length,0);
});
test('workspace genuine failures remain visible, including failures racing with cancellation',async()=>{
 const observer=keyObserver();const failure=new Error('Network failed');
 const request=loadWorkspaceKey(observer.callbacks,async()=>{throw failure;});await request.done;
 assert.equal(observer.errors[0],failure);assert.equal(observer.reports[0],failure);
 let reject;const late=keyObserver();const pending=new Promise((_resolve,fail)=>{reject=fail;});
 const racing=loadWorkspaceKey(late.callbacks,()=>pending);await Promise.resolve();racing.cancel();reject(failure);await racing.done;
 assert.equal(late.errors.length,0);assert.equal(late.reports[0],failure);
});
