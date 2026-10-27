const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}

function fixture(){let load;load=loader({
 '@/lib/ai/gemini':{geminiConfiguration:()=>({model:'gemini-3.5-flash-lite',key:'synthetic'})},
 '@/lib/ai/personal-provider-auth':{personalProviderIdentity:async()=>({sub:'private-user'}),canUsePersonalProviders:()=>false},
 '@/lib/server/project-access':{withVerifiedIdentity:(_identity,work)=>work(),requireOwnedProject:async id=>{if(id!=='owned')throw Error('Unexpected project');},projectAccessResponse:()=>undefined},
 '@/lib/images/generation-pipeline':{withGeneratedImages:async(request,_uid,work)=>{await load('lib/ai/generation-request.ts').readGenerationBody(request);return work();}},
 '@/lib/ai/usage-logging':{withGenerationUsage:(_request,work)=>work()},
 });return load;}
const jsonRequest=(data)=>new Request('http://localhost/api/generate/redesign',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(data)});

test('authorization, fingerprint and image context reuse one parse; downstream keeps the original JSON body',async()=>{
 const load=fixture(),request=jsonRequest({projectId:'owned',userMessage:'private prompt',context:{html:'<main>Original content</main>'}}),clone=request.clone.bind(request);let clones=0;
 request.clone=()=>{if(++clones>1)throw new TypeError('Repeated request clone failed');return clone();};
 const {withPersonalProvider}=load('lib/ai/with-personal-provider.ts');
 const response=await withPersonalProvider(async req=>{const body=await req.json();assert.equal(body.context.html,'<main>Original content</main>');return Response.json({ok:true});})(request);
 assert.equal(response.status,200);await response.text();assert.equal(clones,1);
});

test('streamed multipart form and file content survive the full guard and only one body clone',async()=>{
 const load=fixture(),form=new FormData();form.set('projectId','owned');form.set('prompt','Complete app requirements '.repeat(1500));form.set('image',new Blob(['real fixture bytes'],{type:'image/png'}),'drawing.png');
 const encoded=new Request('http://localhost/api/generate',{method:'POST',body:form});
 const request=new Request(encoded.url,{method:'POST',headers:{origin:'http://localhost','content-type':encoded.headers.get('content-type')},body:encoded.body,duplex:'half'}),clone=request.clone.bind(request);let clones=0;request.clone=()=>{if(++clones>1)throw Error('Second clone is unavailable');return clone();};
 const response=await load('lib/ai/with-personal-provider.ts').withPersonalProvider(async req=>{const data=await req.formData();assert.equal(data.get('prompt'),form.get('prompt'));assert.equal(await data.get('image').text(),'real fixture bytes');return Response.json({ok:true});})(request);assert.equal(response.status,200);await response.text();assert.equal(clones,1);
});

test('malformed JSON and malformed multipart return actionable errors and content-free reason logs',async t=>{
 const load=fixture(),logs=[],original=console.warn;console.warn=value=>logs.push(JSON.parse(value));t.after(()=>console.warn=original);let called=0;
 for(const [type,body,reason] of [['application/json','PRIVATE broken JSON','invalid_json'],['multipart/form-data; boundary=missing','PRIVATE invalid form','invalid_multipart']]){
  const request=new Request('http://localhost/api/generate',{method:'POST',headers:{origin:'http://localhost','content-type':type},body});const response=await load('lib/ai/with-personal-provider.ts').withPersonalProvider(async()=>{called++;return new Response('No');})(request);assert.equal(response.status,400);assert.equal((await response.json()).code,reason);
 }
 assert.equal(called,0);assert.equal(logs.length,2);assert.equal(JSON.stringify(logs).includes('PRIVATE'),false);assert.equal(JSON.stringify(logs).includes('private-user'),false);
});

test('duplicate protection remains active for equivalent multipart uploads with different stream IDs',async()=>{
 const load=fixture(),guard=load('lib/ai/generation-guard.ts');let controller,calls=0;
 const request=id=>{const body=new FormData();body.set('projectId','owned');body.set('prompt','Same requirements');body.set('streamId',id);body.set('image',new Blob(['identical bytes']),'drawing.png');return new Request('http://localhost/api/generate',{method:'POST',body});};
 const first=await guard.withFixedGeneration(request('one'),'uid',async()=>{calls++;return new Response(new ReadableStream({start(c){controller=c;}}));});const duplicate=await guard.withFixedGeneration(request('two'),'uid',async()=>{calls++;return new Response('No');});assert.equal(duplicate.status,409);assert.equal(calls,1);controller.close();await first.text();
 const next=await guard.withFixedGeneration(request('three'),'uid',async()=>new Response('Allowed'));assert.equal(next.status,200);await next.text();
});
