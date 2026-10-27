const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}
const load=loader({'@/lib/db':{prisma:{}}});
test('token-cap constants and preflight are absent from active generation code',()=>{
 const fixed=load('lib/ai/fixed-model.ts'),gemini=load('lib/ai/gemini.ts');assert.equal(fixed.AI_INPUT_TOKEN_LIMIT,undefined);assert.equal(fixed.AI_MAX_OUTPUT_TOKENS,undefined);assert.equal(gemini.validateGeminiRequest,undefined);
 for(const file of ['lib/ai/gemini.ts','lib/ai/generation-sdk.ts','lib/ai/project-chat-response.ts'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/countTokens|AI_INPUT_TOKEN_LIMIT|AI_MAX_OUTPUT_TOKENS|maxOutputTokens\s*:\s*(?:4_000|4000)/);
});

test('malformed, truncated and schema-invalid JSON never reaches renderable SSE text',async()=>{
 const {createStreamResponse}=load('lib/ai/route-utils.ts'),{parseChatPlan}=load('lib/project-chat.ts');
 for(const raw of ['{"message":','{"message":"reply","actions":[{"type":"delete","screenId":"x"}]}','{"message":42,"actions":[]}']){
  const response=createStreamResponse((async function*(){yield raw.slice(0,8);yield raw.slice(8);})(),'text/event-stream','json',undefined,parseChatPlan);
  const wire=await response.text();const packets=wire.trim().split('\n\n').map(chunk=>JSON.parse(chunk.slice(6)));
  assert.ok(packets.some(packet=>packet.type==='error'));assert.ok(packets.every(packet=>packet.text===undefined));
 }
});

test('JSON waits for full schema validation before rendering, while HTML continues to stream progressively',async()=>{
 const {createStreamResponse}=load('lib/ai/route-utils.ts'),{parseChatPlan}=load('lib/project-chat.ts');
 const raw=JSON.stringify({message:'Valid response',actions:[]});let release;const pending=new Promise(resolve=>release=resolve);
 const response=createStreamResponse((async function*(){yield raw.slice(0,12);await pending;yield raw.slice(12);})(),'text/event-stream','json',undefined,parseChatPlan);
 const reader=response.body.getReader();let received=false;const first=reader.read().then(value=>{received=true;return value;});await new Promise(resolve=>setImmediate(resolve));assert.equal(received,false);release();
 const packet=JSON.parse(new TextDecoder().decode((await first).value).trim().slice(6));assert.equal(packet.text,raw);assert.equal(parseChatPlan(packet.text).message,'Valid response');assert.equal((await reader.read()).done,true);
 let finish;const pause=new Promise(resolve=>finish=resolve);const html=createStreamResponse((async function*(){yield '<main>';await pause;yield '</main>';})(),'text/event-stream','html');const htmlReader=html.body.getReader();assert.match(new TextDecoder().decode((await htmlReader.read()).value),/<main>/);finish();while(!(await htmlReader.read()).done){}
});
