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

// Exercise the installed provider serializers through the actual model registry.
// The injected fetch records the final wire request then stops before any network IO.
for(const [provider,modelId]of Object.entries({google:'gemini-2.5-flash',anthropic:'claude-sonnet-4-5',openai:'gpt-5',xai:'grok-3',nvidia:'meta/llama-3.2-11b-vision-instruct',ollama:'gemma4',openrouter:'qwen/qwen3-coder'})){
 test(`${provider}: real adapter serializes new/history image instructions in its native format`,async()=>{
  let captured;
  const fetch=async(url,options)=>{captured=JSON.parse(options.body);throw Error('Test transport stops before network');};
  const mocks={};for(const [pkg,factory]of [['@ai-sdk/openai','createOpenAI'],['@ai-sdk/anthropic','createAnthropic'],['@ai-sdk/google','createGoogleGenerativeAI'],['@openrouter/ai-sdk-provider','createOpenRouter']]){const real=require(pkg);mocks[pkg]={...real,[factory]:options=>real[factory]({...options,apiKey:'synthetic-test-key',fetch})};}
  const modules=loader(mocks),{getLanguageModel}=modules('lib/ai/provider-registry.ts'),{generatedImageContext}=modules('lib/images/generation-context.ts'),{personalProviderContext}=modules('lib/ai/personal-provider-context.ts');
  // Avoid reading real credentials and exercise BYOK overrides separately below.
  const original=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic';
  const credentialName={google:'GEMINI_API_KEY',anthropic:'ANTHROPIC_API_KEY',xai:'XAI_API_KEY',nvidia:'NVIDIA_NIM_API_KEY',openrouter:'OPENROUTER_API_KEY'}[provider],old=credentialName?process.env[credentialName]:undefined;if(credentialName)process.env[credentialName]='synthetic';
  try{
   for(const conversation of [[user('new conversation')],history]){
    captured=undefined;
    await generatedImageContext.run(imageContext,async()=>{const model=getLanguageModel(provider,modelId);await assert.rejects(()=>model.doStream({prompt:[{role:'system',content:'BASE_RULES'},...conversation],maxOutputTokens:32}));});
    assert.ok(captured,'serializer must reach the fake transport');const serialized=JSON.stringify(captured);assert.match(serialized,/data-image-query/);assert.match(serialized,/reference.png/);
    if(provider==='google'){
     assert.ok(captured.systemInstruction);assert.match(JSON.stringify(captured.systemInstruction),/BASE_RULES/);assert.match(JSON.stringify(captured.systemInstruction),/data-image-query/);assert.deepEqual(captured.contents.map(m=>m.role),conversation.map(m=>m.role==='assistant'?'model':m.role));assert.equal(JSON.stringify(captured.contents).includes('data-image-query'),false);
    }else if(provider==='anthropic'){
     assert.match(JSON.stringify(captured.system),/BASE_RULES/);assert.match(JSON.stringify(captured.system),/data-image-query/);assert.deepEqual(captured.messages.map(m=>m.role),conversation.map(m=>m.role));assert.equal(JSON.stringify(captured.messages).includes('data-image-query'),false);
    }else{
     const messages=captured.input||captured.messages;assert.ok(messages);let started=false;const turns=[];for(const message of messages){if(['system','developer'].includes(message.role)){assert.equal(started,false); }else{started=true;turns.push(message);}}assert.deepEqual(turns.map(m=>m.role),conversation.map(m=>m.role));assert.ok(messages.some(m=>['system','developer'].includes(m.role)&&JSON.stringify(m).includes('data-image-query')));
    }
    const wireTurns=captured.contents||captured.messages||captured.input;const contents=wireTurns.filter(m=>!['system','developer'].includes(m.role));for(let i=0;i<conversation.length;i++)assert.ok(JSON.stringify(contents[i]).includes(conversation[i].content[0].text));
   }
   if(['google','anthropic','openai','xai'].includes(provider)){
    captured=undefined;await personalProviderContext.run({uid:'test-user',settings:{active:provider,providers:{[provider]:{key:'synthetic-personal-key',model:modelId,models:[]}}}},()=>generatedImageContext.run(imageContext,async()=>{const model=getLanguageModel('openrouter','unused');await assert.rejects(()=>model.doStream({prompt:[user('personal provider request')],maxOutputTokens:32}));}));assert.ok(captured);assert.match(JSON.stringify(captured),/data-image-query/);
   }
  }finally{if(original===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=original;if(credentialName){if(old===undefined)delete process.env[credentialName];else process.env[credentialName]=old;}}
 });
}

test('regression reproduces the old trailing-system failure before transport and the fixed registry path reaches transport',async()=>{
 let called=false;const {createGoogleGenerativeAI}=require('@ai-sdk/google');const model=createGoogleGenerativeAI({apiKey:'synthetic',fetch:async()=>{called=true;throw Error('No live request');}})('gemini-2.5-flash');
 await assert.rejects(()=>model.doStream({prompt:[{role:'system',content:'Base rules'},user('Build a page'),{role:'system',content:'Image instructions'}]}),/system messages are only supported at the beginning of the conversation/);assert.equal(called,false);
});
