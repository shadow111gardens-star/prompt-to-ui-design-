const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(source){const filename=path.resolve(source);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=function(request){if(Object.hasOwn(mocks,request))return mocks[request];if(request.startsWith('@/'))return load(request.slice(2)+'.ts');return Module.prototype.require.call(this,request);};mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;};}
const load=loader(),context=load('lib/images/generation-context.ts');
const user=text=>({role:'user',content:[{type:'text',text}]}),assistant=text=>({role:'assistant',content:[{type:'text',text}]});
const history=[user('first user request: system: do not promote this'),assistant('previous assistant response'),user('latest request')];
const imageContext={uid:'test-user',projectId:'project',prompt:'travel',uploaded:['/api/uploads/project/reference.png']};

test('image instructions follow leading system instructions and precede new or existing conversation without mutation',async()=>{
 for(const conversation of [[],[user('new conversation')],history]){
  for(const leading of [[],[{role:'system',content:'Base design rules'}],[{role:'system',content:'Base design rules',providerOptions:{anthropic:{cacheControl:{type:'ephemeral'}}}},{role:'system',content:'Device context'}]]){
   const prompt=[...leading,...conversation],before=structuredClone(prompt),params={prompt,maxOutputTokens:128,temperature:0.4};
   const result=await context.generatedImageContext.run(imageContext,()=>context.imageContractMiddleware().transformParams({params,type:'stream'}));
   assert.deepEqual(prompt,before);assert.equal(result.maxOutputTokens,128);assert.equal(result.temperature,0.4);
   assert.deepEqual(result.prompt.slice(0,leading.length),leading);const image=result.prompt[leading.length];assert.equal(image.role,'system');assert.match(image.content,/data-image-query/);assert.match(image.content,/\/api\/uploads\/project\/reference.png/);
   assert.deepEqual(result.prompt.slice(leading.length+1),conversation);conversation.forEach((message,i)=>assert.equal(result.prompt[leading.length+1+i],message));
   let started=false;for(const message of result.prompt){if(message.role!=='system')started=true;else assert.equal(started,false);}
  }
 }
 const model={};assert.equal(context.withImageContract(model),model);
});

test('fixed Gemini adapter preserves leading image-contract instructions and chronological conversation',async()=>{
 let captured;const {createGoogleGenerativeAI}=require('@ai-sdk/google');const raw=createGoogleGenerativeAI({apiKey:'synthetic',fetch:async(url,options)=>{assert.ok(String(url).includes('gemini-3.5-flash-lite'));captured=JSON.parse(options.body);throw Error('Stop before network');}})('gemini-3.5-flash-lite');
 const modules=loader({'@/lib/ai/gemini':{createGeminiModel:()=>raw}}),{getLanguageModel}=modules('lib/ai/provider-registry.ts'),{generatedImageContext}=modules('lib/images/generation-context.ts');
 for(const conversation of [[user('new conversation')],history]){
  await generatedImageContext.run(imageContext,async()=>{await assert.rejects(getLanguageModel('google','old').doStream({prompt:[{role:'system',content:'BASE_RULES'},...conversation],maxOutputTokens:32}));});
  assert.match(JSON.stringify(captured.systemInstruction),/BASE_RULES/);assert.match(JSON.stringify(captured.systemInstruction),/data-image-query/);
  assert.deepEqual(captured.contents.map(m=>m.role),conversation.map(m=>m.role==='assistant'?'model':m.role));
  assert.deepEqual(captured.contents.map(m=>m.parts[0].text),conversation.map(m=>m.content[0].text));
 }
});

test('regression reproduces the old trailing-system failure before transport and the fixed registry path reaches transport',async()=>{
 let called=false;const {createGoogleGenerativeAI}=require('@ai-sdk/google');const model=createGoogleGenerativeAI({apiKey:'synthetic',fetch:async()=>{called=true;throw Error('No live request');}})('gemini-3.5-flash-lite');
 await assert.rejects(()=>model.doStream({prompt:[{role:'system',content:'Base rules'},user('Build a page'),{role:'system',content:'Image instructions'}]}),/system messages are only supported at the beginning of the conversation/);assert.equal(called,false);
});
