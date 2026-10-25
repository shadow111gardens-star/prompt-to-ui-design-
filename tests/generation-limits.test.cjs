const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}
const load=loader({'@/lib/db':{prisma:{}}});
test('preflight measures content once, separates schema/history/design and avoids JSON escape inflation',()=>{
 const {measureTokenHarborInput,validateTokenHarborInput}=load('lib/ai/tokenharbor.ts');
 const requirement='Keep "quotes", \\paths,\nnewlines and Gujarati: નમસ્તે';
 const prompt=[{role:'system',content:'rules'},{role:'user',content:[{type:'text',text:'old request'}]},{role:'assistant',content:[{type:'text',text:'old reply'}]},{role:'user',content:[{type:'text',text:requirement},{type:'text',text:'DESIGN SYSTEM:\nrequired tokens'},{type:'text',text:'DEVICE RULES: mobile'}]}];
 const extra={responseFormat:{type:'json',schema:{type:'object'}},tools:[{name:'test'}]},snapshot=JSON.stringify(prompt),m=measureTokenHarborInput(prompt,extra),b=value=>Buffer.byteLength(value,'utf8');
 assert.equal(m.components.systemPrompt,b('rules'));assert.equal(m.components.conversationHistory,b('old requestold reply'));assert.equal(m.components.userPrompt,b(requirement));assert.equal(m.components.designContext,b('DESIGN SYSTEM:\nrequired tokensDEVICE RULES: mobile'));assert.equal(m.components.jsonSchema,b(JSON.stringify(extra.responseFormat)));assert.equal(m.components.tools,b(JSON.stringify(extra.tools)));assert.equal(m.upperBound,Object.values(m.components).reduce((a,b)=>a+b,0));assert.equal(JSON.stringify(prompt),snapshot);
 // HTTP JSON must escape these newlines/quotes, but those escape bytes are not model input.
 const quoted=[{role:'user',content:[{type:'text',text:'"\n'.repeat(1200)}]}];assert.ok(validateTokenHarborInput(quoted)<4000);assert.ok(Buffer.byteLength(JSON.stringify({prompt:quoted}))+512>4000);
 assert.throws(()=>validateTokenHarborInput([...prompt,{role:'assistant',content:[{type:'text',text:'history'.repeat(1000)}]}]),/conversationHistory/);
});
test('4,000-token input bound accepts the boundary, rejects the next byte, includes schema/context and never edits requirements',()=>{
 const {validateTokenHarborInput}=load('lib/ai/tokenharbor.ts'),constants=load('lib/ai/fixed-model.ts');assert.equal(constants.AI_INPUT_TOKEN_LIMIT,4000);assert.equal(constants.AI_MAX_OUTPUT_TOKENS,4000);
 const make=text=>[{role:'user',content:[{type:'text',text}]}],base=validateTokenHarborInput(make(''));
 const atLimit=make('x'.repeat(4000-base)),before=JSON.stringify(atLimit);assert.equal(validateTokenHarborInput(atLimit),4000);assert.equal(JSON.stringify(atLimit),before);
 assert.throws(()=>validateTokenHarborInput(make('x'.repeat(4001-base))),/4,000-token/);
 assert.throws(()=>validateTokenHarborInput(make('small'),{schema:'required schema'.repeat(1000)}),/4,000-token/);
 assert.throws(()=>validateTokenHarborInput(make('界'.repeat(2000))),/4,000-token/);
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
