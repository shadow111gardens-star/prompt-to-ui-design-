const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');const {randomBytes}=require('node:crypto');
function loader(mocks={}){mocks={'@/lib/server/project-access':require('./helpers/project-feature-identity.cjs'),...mocks};const cache=new Map();function load(source){const filename=path.resolve(source);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=function(request){if(Object.hasOwn(mocks,request))return mocks[request];if(request.startsWith('@/')){const file=request.slice(2);return load(fs.existsSync(file+'.ts')?file+'.ts':file+'.tsx');}return Module.prototype.require.call(this,request);};mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}return load;}
const secret=randomBytes(32).toString('base64');
test('personal provider storage encrypts keys, isolates users, rejects tampering and serializes updates',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openui-byok-'));try{
 const {createPersonalProviderStore}=loader()('lib/ai/personal-provider-store.ts'),store=createPersonalProviderStore(dir,()=>secret);
 await store.update('user-a',s=>s.providers.openai={key:'sk-test-sensitive-a',model:'model-a',models:[{id:'model-a',name:'Model A'}]});
 const file=path.join(dir,fs.readdirSync(dir)[0]);assert.equal(fs.readFileSync(file,'utf8').includes('sk-test-sensitive-a'),false);assert.equal((await store.read('user-b')).providers.openai,undefined);
 await Promise.all(['anthropic','google','xai'].map(provider=>store.update('user-a',s=>s.providers[provider]={key:'key-'+provider,model:'',models:[]})));assert.equal(Object.keys((await store.read('user-a')).providers).length,4);
 const reopened=createPersonalProviderStore(dir,()=>secret);assert.equal((await reopened.read('user-a')).providers.openai.key,'sk-test-sensitive-a');
 const envelope=JSON.parse(fs.readFileSync(file,'utf8'));envelope.tag=randomBytes(16).toString('base64');fs.writeFileSync(file,JSON.stringify(envelope));await assert.rejects(()=>store.read('user-a'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('provider model discovery uses fixed official URLs, headers, pagination and safe errors',async()=>{
 const {discoverPersonalModels}=loader()('lib/ai/personal-provider-discovery.ts');
 for(const provider of ['openai','anthropic','google','xai']){
 const models=await discoverPersonalModels(provider,'test-secret',async(url,options)=>{assert.ok(['api.openai.com','api.anthropic.com','generativelanguage.googleapis.com','api.x.ai'].includes(url.hostname));assert.equal(url.toString().includes('test-secret'),false);assert.equal(options.redirect,'error');assert.ok(Object.values(options.headers).some(value=>value.includes('test-secret')));return Response.json(provider==='google'?{models:[{name:'models/gemini-unit',supportedGenerationMethods:['generateContent']}]}:{data:[{id:provider==='openai'?'gpt-unit':'unit-model'}]});});assert.equal(models.length,1);
 }
 await assert.rejects(()=>discoverPersonalModels('openai','secret',async()=>new Response('SENSITIVE SECRET',{status:401})),error=>!error.message.includes('SENSITIVE')&&/rejected/.test(error.message));
 let pages=0;const models=await discoverPersonalModels('google','secret',async()=>Response.json({models:[{name:'models/gemini-'+pages++,supportedGenerationMethods:['generateContent']}],...(pages===1?{nextPageToken:'next'}:{})}));assert.equal(models.length,2);
});
test('provider API validates entitlement/origin, persists models, activates keys and never returns secrets',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openui-byok-api-'));try{
 const store=loader()('lib/ai/personal-provider-store.ts').createPersonalProviderStore(dir,()=>secret);let plan='lifetime',uid='api-user',allowed=true;
 const api=loader({'@/lib/ai/personal-provider-store':{personalProviderStore:store},'@/lib/ai/personal-provider-auth':{personalProviderIdentity:async()=>{if(!allowed)throw Error('Missing');return{sub:uid,plan};},canUsePersonalProviders:identity=>identity.plan==='lifetime'},'@/lib/ai/personal-provider-discovery':{discoverPersonalModels:async()=>[{id:'gpt-unit',name:'GPT Unit'}]}})('app/api/ai-provider-keys/route.ts');
 const req=(method,data,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/ai-provider-keys',{method,headers:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data)})});
 allowed=false;assert.equal((await api.GET(req('GET'))).status,401);allowed=true;plan='pro';assert.equal((await api.GET(req('GET'))).status,403);plan='lifetime';
 assert.equal((await api.PUT(req('PUT',{provider:'openai',apiKey:'sk-test-private-key'},'https://evil.test'))).status,403);
 assert.equal((await api.PUT(req('PUT',{provider:'unknown',apiKey:'sk-test-private-key'}))).status,400);
 let response=await api.PUT(req('PUT',{provider:'openai',apiKey:'sk-test-private-key'}));assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes('sk-test-private-key'),false);
 response=await api.POST(req('POST',{provider:'openai'}));assert.equal(response.status,200);let body=await response.json();assert.equal(body.active,'openai');assert.equal(body.providers.openai.model,'gpt-unit');
 assert.equal((await api.PUT(req('PUT',{provider:'openai',model:'unlisted'}))).status,400);
 response=await api.PUT(req('PUT',{provider:'openai',model:'gpt-unit',active:true}));assert.equal(response.status,200);
 const visible=await (await api.GET(req('GET'))).json();assert.equal(visible.providers.openai.configured,true);assert.equal(JSON.stringify(visible).includes('private-key'),false);
 uid='other-user';assert.equal((await (await api.GET(req('GET'))).json()).providers.openai.configured,false);uid='api-user';
 assert.equal((await api.DELETE(req('DELETE',{provider:'openai'}))).status,200);assert.equal((await store.read(uid)).active,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('saved personal provider keys cannot override fixed TokenHarbor generation',async()=>{
 const load=loader({'@/lib/ai/tokenharbor':{createTokenHarborModel:()=>({modelId:'deepseek-v4.1-flash:free'}),tokenHarborConfiguration:()=>({model:'deepseek-v4.1-flash:free'})}});const {personalProviderContext}=load('lib/ai/personal-provider-context.ts'),registry=load('lib/ai/provider-registry.ts');
 await Promise.all(['openai','google'].map(provider=>personalProviderContext.run({uid:'synthetic-'+provider,settings:{active:provider,providers:{[provider]:{key:'synthetic-personal',model:'other-model',models:[]}}}},async()=>{await new Promise(r=>setImmediate(r));assert.equal(registry.getLanguageModel(provider,'old').modelId,'deepseek-v4.1-flash:free');assert.equal(registry.getFallbackSelection().provider,'tokenharbor');})));assert.equal(personalProviderContext.getStore(),undefined);
});

test('localhost testing override works only in development, never for remote hosts or production',()=>{
 const previous={mode:process.env.NODE_ENV,flag:process.env.OPENUI_LOCAL_BYOK_TESTING};try{const {localByokTesting}=loader()('lib/ai/personal-provider-auth.ts');process.env.OPENUI_LOCAL_BYOK_TESTING='true';process.env.NODE_ENV='development';assert.equal(localByokTesting(new Request('http://localhost:3000')),true);assert.equal(localByokTesting(new Request('https://example.com')),false);process.env.NODE_ENV='production';assert.equal(localByokTesting(new Request('http://localhost:3000')),false);}finally{if(previous.mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous.mode;if(previous.flag===undefined)delete process.env.OPENUI_LOCAL_BYOK_TESTING;else process.env.OPENUI_LOCAL_BYOK_TESTING=previous.flag;}
});
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('provider controls save, reveal, test, select a model, activate and remove keys with loading/error feedback',async t=>{
 const previous={fetch:global.fetch,window:global.window};t.after(()=>{global.fetch=previous.fetch;global.window=previous.window;});global.window={confirm:()=>true};
 let status,active=false;const calls=[];global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);calls.push({method:options.method,...body});if(options.method==='DELETE')status={configured:false,model:'',models:[]};else if(options.method==='POST')status={configured:true,suffix:'unit',model:'gpt-unit',models:[{id:'gpt-unit',name:'GPT Unit'},{id:'gpt-next',name:'GPT Next'}],testedAt:'2026-01-01'};else status={...status,configured:true,models:status?.models||[],model:body.model||status?.model||''};if(body.active)active=true;return Response.json({active:active?'openai':undefined,providers:{openai:status}});};
 const slots=[],effects=[];let cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useEffect:fn=>effects.push(fn)};
 const Card=loader({react:hooks,'next/image':{__esModule:true,default:'img'}})('components/projects/provider-keys-preview.tsx').ProviderCard;const render=()=>{cursor=0;return Card({provider:'openai',status,active,onUpdate:value=>{status=value.providers.openai;active=value.active==='openai';}});};const find=predicate=>{const node=nodes(render()).find(predicate);assert.ok(node);return node;};render();effects.splice(0).forEach(fn=>fn());
 find(n=>n.props?.id==='provider-key-openai').props.onChange({target:{value:'sk-private-unit-key'}});find(n=>n.props?.['aria-label']==='Reveal OpenAI key').props.onClick();assert.equal(find(n=>n.props?.id==='provider-key-openai').props.type,'text');
 find(n=>n.type==='button'&&n.props.children?.includes?.('Save Key')).props.onClick();await flush();assert.equal(calls[0].method,'PUT');assert.equal(find(n=>n.props?.id==='provider-key-openai').props.value,'');
 find(n=>n.type==='button'&&n.props.children?.includes?.('Test Connection')).props.onClick();await flush();assert.equal(calls.at(-1).method,'POST');
 find(n=>n.props?.id==='provider-model-openai').props.onChange({target:{value:'gpt-next'}});await flush();assert.equal(calls.at(-1).model,'gpt-next');
 find(n=>n.type==='button'&&n.props.children==='Use for generation').props.onClick();await flush();assert.equal(calls.at(-1).active,true);
 find(n=>n.props?.['aria-label']==='Remove OpenAI key').props.onClick();await flush();assert.equal(calls.at(-1).method,'DELETE');
 global.fetch=async()=>Response.json({error:'Invalid key'},{status:400});find(n=>n.props?.id==='provider-key-openai').props.onChange({target:{value:'sk-invalid-unit-key'}});find(n=>n.type==='button'&&n.props.children?.includes?.('Save Key')).props.onClick();await flush();assert.ok(nodes(render()).some(n=>n.props?.role==='alert'&&n.props.children==='Invalid key'));
});
test('fixed model catalog requests never activate personal provider credentials',async()=>{
 const load=loader({'@/lib/db':{prisma:{}},'@/lib/ai/personal-provider-auth':{personalProviderIdentity:async request=>({sub:request.headers.get('x-user'),plan:'lifetime'}),canUsePersonalProviders:()=>true},'@/lib/ai/personal-provider-store':{personalProviderStore:{read:async uid=>({active:'openai',providers:{openai:{key:'private-'+uid,model:'model-'+uid,models:[]}}})}}});
 const {personalProviderContext}=load('lib/ai/personal-provider-context.ts'),{withPersonalProvider}=load('lib/ai/with-personal-provider.ts');
 const handler=withPersonalProvider(async()=>new Response(new ReadableStream({async start(controller){await new Promise(resolve=>setImmediate(resolve));assert.equal(personalProviderContext.getStore(),undefined);controller.enqueue(new TextEncoder().encode('fixed-model'));controller.close();}})));
 const results=await Promise.all(['alice','bob'].map(async uid=>(await handler(new Request('http://localhost/api/models',{headers:{'x-user':uid}}))).text()));assert.deepEqual(results,['fixed-model','fixed-model']);assert.equal(personalProviderContext.getStore(),undefined);
});
