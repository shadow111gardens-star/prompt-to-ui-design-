const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}
function configured(t){const names=['GEMINI_API_KEY','GEMINI_MODEL'],before=names.map(name=>process.env[name]),fetch=global.fetch;t.after(()=>{names.forEach((name,i)=>{if(before[i]===undefined)delete process.env[name];else process.env[name]=before[i];});global.fetch=fetch;});process.env.GEMINI_API_KEY='synthetic-secret-gemini-key';process.env.GEMINI_MODEL='gemini-3.5-flash-lite';}
const modelId='gemini-3.5-flash-lite';
const payload=(text)=>({modelVersion:modelId,candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10,totalTokenCount:30}});
const answer=()=>Response.json(payload('<main>Editable design</main>'));
function withCount(handler,total=128){return async(url,options)=>String(url).endsWith(':countTokens')?Response.json({totalTokens:typeof total==='function'?total(JSON.parse(options.body)):total}):handler(url,options);}

test('fixed Gemini configuration fails closed and ignores legacy/personal provider selection',async t=>{
 configured(t);const load=loader(),config=load('lib/ai/gemini.ts'),registry=load('lib/ai/provider-registry.ts');
 const personal=load('lib/ai/personal-provider-context.ts');
 personal.personalProviderContext.run({uid:'test',settings:{active:'google',providers:{google:{key:'other-key',model:'different-model',models:[]}}}},()=>{assert.equal(registry.getLanguageModel('google','gemini-old').modelId,modelId);assert.equal(registry.getFallbackSelection().provider,'google');});
 delete process.env.GEMINI_MODEL;assert.equal(config.geminiConfiguration().model,modelId);
 delete process.env.GEMINI_API_KEY;assert.match(config.geminiConfigurationError(),/GEMINI_API_KEY/);assert.throws(()=>registry.getFallbackModel());
 process.env.GEMINI_API_KEY='synthetic-secret-gemini-key';process.env.GEMINI_MODEL='other';assert.match(config.geminiConfigurationError(),/exactly/);assert.throws(()=>registry.getLanguageModel('openai','gpt-other'));
});

test('real Google adapter uses the exact endpoint/model, server key, output cap and zero retries',async t=>{
 configured(t);let calls=0;const wires=[];global.fetch=withCount(async(url,options)=>{calls++;wires.push({url:String(url),headers:new Headers(options.headers),body:JSON.parse(options.body)});return answer();});
 const load=loader(),registry=load('lib/ai/provider-registry.ts'),sdk=load('lib/ai/generation-sdk.ts');
 const result=await sdk.generateText({model:registry.getLanguageModel('openai','wrong'),prompt:'Design a dashboard',maxRetries:9,maxOutputTokens:20000});
 assert.match(result.text,/Editable design/);assert.equal(calls,1);assert.equal(wires[0].url,'https://generativelanguage.googleapis.com/v1beta/models/'+modelId+':generateContent');assert.equal(wires[0].body.generationConfig.maxOutputTokens,4000);assert.equal(wires[0].headers.get('x-goog-api-key'),process.env.GEMINI_API_KEY);assert.equal(wires[0].headers.has('authorization'),false);assert.equal(JSON.stringify(wires[0].body).includes(process.env.GEMINI_API_KEY),false);
 global.fetch=withCount(async()=>{calls++;return new Response('private '+process.env.GEMINI_API_KEY,{status:429});});calls=0;
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),prompt:'Short prompt',maxRetries:9}),error=>{assert.equal(String(error).includes(process.env.GEMINI_API_KEY),false);assert.equal(String(error.responseBody).includes(process.env.GEMINI_API_KEY),false);assert.match(error.message,/rate limit|allowance/);return true;});assert.equal(calls,1);
});

test('preflight counts full native SDK request including system and media before allowing generation',async t=>{
 configured(t);let counts=0,generations=0;const inputs=[];
 global.fetch=async(url,options)=>{if(String(url).endsWith(':countTokens')){counts++;inputs.push(JSON.parse(options.body).generateContentRequest);return Response.json({totalTokens:4001});}generations++;return answer();};
 const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts');
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),prompt:'small',system:'x'.repeat(4001)}),/4001 Gemini-counted tokens/);
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),messages:[{role:'user',content:[{type:'image',image:new Uint8Array([1,2,3]),mediaType:'image/png'}]}]}),/4001 Gemini-counted tokens/);
 assert.equal(generations,0);assert.equal(counts,2);assert.ok(inputs[0].systemInstruction);assert.ok(inputs[1].contents[0].parts.some(part=>part.inlineData));
});

test('fixed selector renders its label and configuration error without making a catalog request or exposing key',t=>{
 configured(t);let calls=0;global.fetch=async()=>{calls++;throw Error('No requests expected');};const load=loader();const Component=load('components/canvas/model-selector.tsx').default;const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(Component,{configurationError:'Set GEMINI_API_KEY on the server.'}));assert.match(html,/Gemini 3.5 Flash-Lite/);assert.match(html,/role="alert"/);assert.equal(calls,0);assert.equal(html.includes(process.env.GEMINI_API_KEY),false);
});

test('structured generation keeps the existing schema, validates JSON locally, and never retries malformed output',async t=>{
 configured(t);const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts'),{z}=require('zod');const schema=z.object({name:z.string()});
 for(const content of ['{"name":"valid"}','{"name":42}','{"name":']){
  let calls=0;global.fetch=withCount(async(_url,options)=>{calls++;const wire=JSON.parse(options.body);assert.equal(wire.generationConfig.maxOutputTokens,4000);return Response.json(payload(content));});
  const generation=sdk.generateText({model:registry.getFallbackModel(),prompt:'Reply with a name.',output:sdk.Output.object({schema}),maxRetries:9});
  if(content.includes('valid'))assert.equal((await generation).output.name,'valid');else await assert.rejects(generation);
  assert.equal(calls,1);
 }
});

test('duplicate generations are denied while response is active and released after completion',async t=>{
 configured(t);const guard=loader()('lib/ai/generation-guard.ts');let calls=0,controller;
 const req=streamId=>new Request('http://localhost/api/generate/redesign',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'synthetic-project',streamId,prompt:'same'})});
 const first=await guard.withFixedGeneration(req('first'),'synthetic-user',async()=>{calls++;return new Response(new ReadableStream({start(c){controller=c;}}));});
 const duplicate=await guard.withFixedGeneration(req('second'),'synthetic-user',async()=>{calls++;return answer();});assert.equal(duplicate.status,409);assert.equal(calls,1);
 controller.close();await first.text();const again=await guard.withFixedGeneration(req('third'),'synthetic-user',async()=>{calls++;return answer();});assert.equal(again.status,200);await again.text();assert.equal(calls,2);
});

test('FRAME route streams real SDK generated HTML through existing SSE, ignores stored Google model, and makes one Gemini call',async t=>{
 configured(t);let calls=0,wire,urlForWire;const measurements=[],originalInfo=console.info;console.info=value=>{try{const item=JSON.parse(value);if(['ai_input_preflight','ai_input_components'].includes(item.event))measurements.push(item);}catch{}};t.after(()=>console.info=originalInfo);
 const source=fs.readFileSync('lib/db/projects.ts','utf8');const defaultGuide=Function('return '+source.split('const DEFAULT_STYLE_GUIDE = ')[1].split('export async function createProject')[0].trim().replace(/;$/,''))();let target;
 global.fetch=withCount(async(url,options)=>{calls++;urlForWire=String(url);wire=JSON.parse(options.body);return new Response('data: '+JSON.stringify(payload('<main>FRAME result</main>'))+'\n\n',{headers:{'content-type':'text/event-stream'}});},body=>JSON.stringify(body).includes('Essential requirement Essential requirement')?4001:3000);
 const load=loader({'@/lib/server/project-access':{ownedProjectWhere:async id=>({id}),requireOwnedProject:async id=>({id}),withVerifiedIdentity:(_identity,work)=>work(),projectAccessResponse:()=>undefined},'@/lib/ai/personal-provider-auth':{personalProviderIdentity:async()=>({sub:'synthetic-user'}),canUsePersonalProviders:()=>false},'@/lib/db':{prisma:{project:{findUnique:async()=>({settings:{provider:'google',model:'google/old'},styleGuide:JSON.stringify(defaultGuide),sketchesData:JSON.stringify({designTarget:target}),inspirationImages:[],moodBoardImages:[]})}}},'@/lib/images/generation-pipeline':{withGeneratedImages:(_request,uid,work)=>load('lib/images/generation-context.ts').generatedImageContext.run({uid,projectId:'synthetic-frame-project',prompt:'A clean website',uploaded:[]},work)}});
 const route=load('app/api/generate/route.ts');
 async function run(device,prompt){const form=new FormData();form.set('projectId','synthetic-frame-project');form.set('prompt',prompt);form.set('deviceType',device);form.set('streamId','synthetic-stream');return route.POST(new Request('http://localhost/api/generate',{method:'POST',headers:{origin:'http://localhost'},body:form}));}
 const prompt='A clean minimal website with an accessible navigation and pricing section';
 for(const [device,designTarget] of [['custom',undefined],['web','web'],['tablet','web'],['mobile','app']]){
 target=designTarget;const response=await run(device,prompt);const output=await response.text();assert.equal(response.status,200);assert.match(output,/FRAME result/,'preflight '+device+': '+JSON.stringify(measurements.at(-1)));assert.ok(String(urlForWire).includes(modelId));assert.equal(wire.generationConfig.maxOutputTokens,4000);assert.match(JSON.stringify(wire),/data-image-query/);assert.ok(wire.contents.some(message=>JSON.stringify(message).includes(prompt)));assert.equal(output.includes(process.env.GEMINI_API_KEY),false);
 const measured=measurements.at(-1);assert.equal(measured.accepted,true);assert.equal(measured.method,'gemini_count_tokens');assert.equal(measured.inputTokens,3000);const diagnostic=measurements.at(-2);assert.equal(diagnostic.components.conversationHistory,0);assert.equal(diagnostic.components.jsonSchema,0);assert.ok(diagnostic.components.designContext>1000);
 // Safe, content-free evidence for each real SDK route fixture.
 originalInfo(JSON.stringify({event:'frame_preflight_test',device,...measured}));
 }
 assert.equal(calls,4);const response=await run('mobile','Essential requirement '.repeat(1000));assert.match(await response.text(),/4,000-token/);assert.equal(calls,4);assert.equal(measurements.at(-1).accepted,false);
 assert.equal(JSON.stringify(measurements).includes(process.env.GEMINI_API_KEY),false);assert.equal(JSON.stringify(measurements).includes(prompt),false);
});

test('only Flash-Lite can reach transport even with stale selections; invalid server model sends no request',async t=>{
 configured(t);let calls=0;global.fetch=withCount(async(url)=>{calls++;assert.equal(new URL(String(url)).pathname,'/v1beta/models/gemini-3.5-flash-lite:generateContent');return answer();});
 const load=loader(),registry=load('lib/ai/provider-registry.ts'),sdk=load('lib/ai/generation-sdk.ts');
 for(const [provider,model] of [['tokenharbor','deepseek-v4.1-flash:free'],['google','gemini-3.8-flash'],['openai','gpt-legacy']]){
  const result=await sdk.generateText({model:registry.getLanguageModel(provider,model),prompt:'Short design prompt'});assert.match(result.text,/Editable design/);
 }
 assert.equal(calls,3);assert.equal(registry.getFallbackSelection().modelId,modelId);
 assert.throws(()=>registry.parseModelString('google/gemini-3.8-flash'),/supports only/);
 process.env.GEMINI_MODEL='gemini-3.8-flash';assert.throws(()=>registry.getLanguageModel(),/exactly gemini-3.5-flash-lite/);assert.equal(calls,3);
});

test('large byte-sized input that fits actual tokens passes unchanged; rejection logs zero generation calls',async t=>{
 configured(t);const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts'),usage=load('lib/ai/usage-logging.ts');
 const prompt='calm '.repeat(2999)+'ui',system='Design '.repeat(477)+'Rule';let counts=0,generations=0;const logs=[],original=console.info;console.info=text=>{try{logs.push(JSON.parse(text));}catch{}};t.after(()=>console.info=original);
 let totalTokens=3500;
 global.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(String(url).endsWith(':countTokens')){counts++;assert.equal(body.generateContentRequest.contents[0].parts[0].text,prompt);assert.equal(body.generateContentRequest.systemInstruction.parts[0].text,system);return Response.json({totalTokens});}generations++;assert.equal(body.contents[0].parts[0].text,prompt);return answer();};
 async function run(){return usage.withGenerationUsage(new Request('http://localhost/api/generate'),async()=>{try{const result=await sdk.generateText({model:registry.getLanguageModel(),prompt,system});return new Response(result.text);}catch{return new Response('Rejected',{status:400});}});}
 const accepted=await run();assert.equal(accepted.status,200);await accepted.text();
 totalTokens=4001;const rejected=await run();assert.equal(rejected.status,400);await rejected.text();assert.equal(counts,2);assert.equal(generations,1);
 const summary=logs.filter(row=>row.event==='ai_usage_summary').at(-1);assert.equal(summary.aiCalls,0);assert.equal(summary.aiAttempts,1);
 const failed=logs.find(row=>row.event==='ai_usage_call'&&row.generationRequestSent===false);assert.equal(failed.error,'input_preflight_rejected_or_unavailable');
 assert.equal(logs.find(row=>row.event==='ai_input_components').bytesWithFraming,18436);assert.equal(JSON.stringify(logs).includes(prompt),false);assert.equal(JSON.stringify(logs).includes(process.env.GEMINI_API_KEY),false);
});

test('token-count failures stop generation without retry, guessing or leaking provider responses',async t=>{
 configured(t);const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts');
 for(const failure of ['network','json','missing','negative','fractional',401,429,503]){
  let counts=0,generations=0;global.fetch=async(url)=>{if(!String(url).endsWith(':countTokens')){generations++;return answer();}counts++;if(failure==='network')throw Error(process.env.GEMINI_API_KEY);if(failure==='json')return new Response('not json');if(typeof failure==='number')return new Response(process.env.GEMINI_API_KEY,{status:failure});return Response.json(failure==='missing'?{}:{totalTokens:failure==='negative'?-1:1.5});};
  await assert.rejects(sdk.generateText({model:registry.getLanguageModel(),prompt:'Short prompt',maxRetries:9}),error=>{assert.equal(String(error).includes(process.env.GEMINI_API_KEY),false);assert.match(error.message,/token count/);return true;});assert.equal(counts,1);assert.equal(generations,0);
 }
});
