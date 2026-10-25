const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}
function configured(t){const names=['TOKENHARBOR_API_KEY','TOKENHARBOR_MODEL'],before=names.map(name=>process.env[name]),fetch=global.fetch;t.after(()=>{names.forEach((name,i)=>{if(before[i]===undefined)delete process.env[name];else process.env[name]=before[i];});global.fetch=fetch;});process.env.TOKENHARBOR_API_KEY='synthetic-secret-tokenharbor-key';process.env.TOKENHARBOR_MODEL='deepseek-v4.1-flash:free';}
const modelId='deepseek-v4.1-flash:free';
const answer=()=>Response.json({id:'test',object:'chat.completion',model:modelId,choices:[{index:0,message:{role:'assistant',content:'<main>Editable design</main>'},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}});

test('fixed TokenHarbor configuration fails closed and ignores legacy/personal provider selection',async t=>{
 configured(t);const load=loader(),config=load('lib/ai/tokenharbor.ts'),registry=load('lib/ai/provider-registry.ts');
 const personal=load('lib/ai/personal-provider-context.ts');
 personal.personalProviderContext.run({uid:'test',settings:{active:'google',providers:{google:{key:'other-key',model:'different-model',models:[]}}}},()=>{assert.equal(registry.getLanguageModel('google','gemini-old').modelId,modelId);assert.equal(registry.getFallbackSelection().provider,'tokenharbor');});
 delete process.env.TOKENHARBOR_API_KEY;assert.match(config.tokenHarborConfigurationError(),/TOKENHARBOR_API_KEY/);assert.throws(()=>registry.getFallbackModel());
 process.env.TOKENHARBOR_API_KEY='synthetic-secret-tokenharbor-key';process.env.TOKENHARBOR_MODEL='other';assert.match(config.tokenHarborConfigurationError(),/exactly/);assert.throws(()=>registry.getLanguageModel('openai','gpt-other'));
});

test('real OpenAI-compatible adapter uses the exact endpoint/model, server key, output cap and zero retries',async t=>{
 configured(t);let calls=0;const wires=[];global.fetch=async(url,options)=>{calls++;wires.push({url:String(url),headers:new Headers(options.headers),body:JSON.parse(options.body)});return answer();};
 const load=loader(),registry=load('lib/ai/provider-registry.ts'),sdk=load('lib/ai/generation-sdk.ts');
 const result=await sdk.generateText({model:registry.getLanguageModel('openai','wrong'),prompt:'Design a dashboard',maxRetries:9,maxOutputTokens:20000});
 assert.match(result.text,/Editable design/);assert.equal(calls,1);assert.equal(wires[0].url,'https://tokenharbor.ai/v1/chat/completions');assert.equal(wires[0].body.model,modelId);assert.equal(wires[0].body.max_tokens,4000);assert.match(wires[0].headers.get('authorization'),/^Bearer /);assert.equal(JSON.stringify(wires[0].body).includes(process.env.TOKENHARBOR_API_KEY),false);
 global.fetch=async()=>{calls++;return new Response('private '+process.env.TOKENHARBOR_API_KEY,{status:429});};calls=0;
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),prompt:'Short prompt',maxRetries:9}),error=>{assert.equal(String(error).includes(process.env.TOKENHARBOR_API_KEY),false);assert.equal(String(error.responseBody).includes(process.env.TOKENHARBOR_API_KEY),false);assert.match(error.message,/rate limit|allowance/);return true;});assert.equal(calls,1);
});

test('full input validation includes system instructions and rejects oversized and uncountable image input before fetch',async t=>{
 configured(t);let calls=0;global.fetch=async()=>{calls++;return answer();};const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts');
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),prompt:'small',system:'x'.repeat(4001)}),/4,000-token/);
 await assert.rejects(sdk.generateText({model:registry.getFallbackModel(),messages:[{role:'user',content:[{type:'image',image:new Uint8Array([1,2,3]),mediaType:'image/png'}]}]}),/Image input.*4,000-token/);
 assert.equal(calls,0);const validate=load('lib/ai/tokenharbor.ts').validateTokenHarborInput;assert.ok(validate([{role:'user',content:[{type:'text',text:'Hello'}]}])<4000);
});

test('fixed selector renders its label and configuration error without making a catalog request or exposing key',t=>{
 configured(t);let calls=0;global.fetch=async()=>{calls++;throw Error('No requests expected');};const load=loader();const Component=load('components/canvas/model-selector.tsx').default;const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(Component,{configurationError:'Set TOKENHARBOR_API_KEY on the server.'}));assert.match(html,/DeepSeek V4.1 Flash \(Free\)/);assert.match(html,/role="alert"/);assert.equal(calls,0);assert.equal(html.includes(process.env.TOKENHARBOR_API_KEY),false);
});

test('structured generation keeps the existing schema, validates JSON locally, and never retries malformed output',async t=>{
 configured(t);const load=loader(),sdk=load('lib/ai/generation-sdk.ts'),registry=load('lib/ai/provider-registry.ts'),{z}=require('zod');const schema=z.object({name:z.string()});
 for(const content of ['{"name":"valid"}','{"name":42}','{"name":']){
  let calls=0;global.fetch=async(_url,options)=>{calls++;const wire=JSON.parse(options.body);assert.equal(wire.max_tokens,4000);return Response.json({id:'json',model:modelId,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:8,completion_tokens:4,total_tokens:12}});};
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

test('FRAME route streams real SDK generated HTML through existing SSE, ignores stored Google model, and makes one TokenHarbor call',async t=>{
 configured(t);let calls=0,wire;const measurements=[],originalInfo=console.info;console.info=value=>{try{const item=JSON.parse(value);if(item.event==='ai_input_preflight')measurements.push(item);}catch{}};t.after(()=>console.info=originalInfo);
 const source=fs.readFileSync('lib/db/projects.ts','utf8');const defaultGuide=Function('return '+source.split('const DEFAULT_STYLE_GUIDE = ')[1].split('export async function createProject')[0].trim().replace(/;$/,''))();let target;
 global.fetch=async(url,options)=>{calls++;wire=JSON.parse(options.body);const chunk=(delta,finish)=>'data: '+JSON.stringify({id:'completion',object:'chat.completion.chunk',model:modelId,choices:[{index:0,delta,finish_reason:finish}]})+'\n\n';return new Response(chunk({role:'assistant',content:'<main>FRAME result</main>'},null)+chunk({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
 const load=loader({'@/lib/server/project-access':{ownedProjectWhere:async id=>({id}),requireOwnedProject:async id=>({id}),withVerifiedIdentity:(_identity,work)=>work(),projectAccessResponse:()=>undefined},'@/lib/ai/personal-provider-auth':{personalProviderIdentity:async()=>({sub:'synthetic-user'}),canUsePersonalProviders:()=>false},'@/lib/db':{prisma:{project:{findUnique:async()=>({settings:{provider:'google',model:'google/old'},styleGuide:JSON.stringify(defaultGuide),sketchesData:JSON.stringify({designTarget:target}),inspirationImages:[],moodBoardImages:[]})}}},'@/lib/images/generation-pipeline':{withGeneratedImages:(_request,uid,work)=>load('lib/images/generation-context.ts').generatedImageContext.run({uid,projectId:'synthetic-frame-project',prompt:'A clean website',uploaded:[]},work)}});
 const route=load('app/api/generate/route.ts');
 async function run(device,prompt){const form=new FormData();form.set('projectId','synthetic-frame-project');form.set('prompt',prompt);form.set('deviceType',device);form.set('streamId','synthetic-stream');return route.POST(new Request('http://localhost/api/generate',{method:'POST',headers:{origin:'http://localhost'},body:form}));}
 const prompt='A clean minimal website with an accessible navigation and pricing section';
 for(const [device,designTarget] of [['custom',undefined],['web','web'],['tablet','web'],['mobile','app']]){
 target=designTarget;const response=await run(device,prompt);const output=await response.text();assert.equal(response.status,200);assert.match(output,/FRAME result/,'preflight '+device+': '+JSON.stringify(measurements.at(-1)));assert.equal(wire.model,modelId);assert.equal(wire.max_tokens,4000);assert.match(JSON.stringify(wire.messages),/data-image-query/);assert.ok(wire.messages.some(message=>JSON.stringify(message).includes(prompt)));assert.equal(output.includes(process.env.TOKENHARBOR_API_KEY),false);
 const measured=measurements.at(-1);assert.equal(measured.accepted,true);assert.equal(measured.components.conversationHistory,0);assert.equal(measured.components.jsonSchema,0);assert.ok(measured.components.designContext>1000);assert.ok(measured.upperBound<=4000);
 // Safe, content-free evidence for each real SDK route fixture.
 originalInfo(JSON.stringify({event:'frame_preflight_test',device,...measured}));
 }
 assert.equal(calls,4);const response=await run('mobile','Essential requirement '.repeat(1000));assert.match(await response.text(),/4,000-token/);assert.equal(calls,4);assert.equal(measurements.at(-1).accepted,false);
 assert.equal(JSON.stringify(measurements).includes(process.env.TOKENHARBOR_API_KEY),false);assert.equal(JSON.stringify(measurements).includes(prompt),false);
});
