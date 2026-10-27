const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(source, mocks = {}){mocks={'@/lib/server/project-access':require('./helpers/project-feature-identity.cjs'),...mocks};
  const filename = path.resolve(source);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.require = function(request) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (request.startsWith('@/')) return load(request.slice(2) + '.ts', mocks);
    return Module.prototype.require.call(this, request);
  };
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
  return mod.exports;
}
const { parseSSEStream } = load('lib/stream-utils.ts');
const { getLanguageModel } = load('lib/ai/provider-registry.ts');
function readerFor(text) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  }}).getReader();
}
test('generation preserves valid HTML and scripts across fragmented Unicode packets', async () => {
  const html = '<div>नमस्ते</div><script>const data = {"products": [], "token": "demo"}; // status: 200\n</script>';
  const packet = text => `data: ${JSON.stringify({ streamId: 'ui', text })}\n\n`;
  let rendered;
  const output = await parseSSEStream(readerFor(packet('```html\n') + packet(html) + packet('\n```')), 'ui', value => rendered = value);
  assert.equal(output, html);
  assert.equal(rendered, html);
});
test('parallel generations remain isolated', async () => {
  const wire = [{streamId:'other', text:'wrong'}, {streamId:'ui', text:'<main>OK</main>'}].map(x => `data: ${JSON.stringify(x)}\n\n`).join('');
  assert.equal(await parseSSEStream(readerFor(wire), 'ui', () => {}), '<main>OK</main>');
});
test('legacy selections are mapped to the one fixed Gemini model',()=>{
 const registry=load('lib/ai/provider-registry.ts',{'@/lib/ai/gemini':{createGeminiModel:()=>({modelId:'gemini-3.5-flash-lite'}),geminiConfiguration:()=>({model:'gemini-3.5-flash-lite'})}});
 for(const provider of ['nvidia','ollama','google','openai'])assert.equal(registry.getLanguageModel(provider,'legacy').modelId,'gemini-3.5-flash-lite');
 assert.equal(registry.getFallbackSelection().provider,'google');
});

test('usage metadata does not contaminate generated HTML', async () => {
  const wire = [{streamId:'ui',text:'<main>OK</main>'},{streamId:'ui',type:'usage',usage:{inputTokens:12,outputTokens:8,totalTokens:20}}].map(x=>`data: ${JSON.stringify(x)}\n\n`).join('');
  assert.equal(await parseSSEStream(readerFor(wire),'ui',()=>{}),'<main>OK</main>');
});
test('empty and unrelated-only streams fail instead of completing a blank design', async () => {
  await assert.rejects(parseSSEStream(readerFor(''), 'ui', () => {}), /no design/i);
  await assert.rejects(parseSSEStream(readerFor('data: {"streamId":"other","text":"<main>Wrong</main>"}\n\n'), 'ui', () => {}), /no design/i);
});
test('provider errors reach the generation caller', async () => {
  const wire='data: '+JSON.stringify({streamId:'ui',type:'error',error:'Provider quota exceeded'})+'\n\n';
  await assert.rejects(parseSSEStream(readerFor(wire),'ui',()=>{}),/Provider quota exceeded/);
});
test('CRLF packets and the final unterminated packet are processed', async () => {
  const wire='data: '+JSON.stringify({streamId:'ui',text:'<main>'})+'\r\n\r\n'+'data: '+JSON.stringify({streamId:'ui',text:'Ready</main>'});
  assert.equal(await parseSSEStream(readerFor(wire),'ui',()=>{}),'<main>Ready</main>');
});
test('consumer failures are not silently swallowed as malformed JSON', async () => {
  const wire='data: '+JSON.stringify({streamId:'ui',text:'<main>Ready</main>'})+'\n\n';
  await assert.rejects(parseSSEStream(readerFor(wire),'ui',()=>{throw new Error('Update failed');}),/Update failed/);
});
test('reopening a project recovers interrupted generation instead of retaining a spinner', () => {
  const { default: reducer, loadProject } = load('redux/slice/shapes/index.ts');
  const shape={id:'pending',type:'generatedui',x:0,y:0,w:375,h:812,uiSpecData:null,sourceFrameId:'frame',isGenerating:true,stroke:'transparent',strokeWidth:0};
  const state=reducer(undefined,loadProject({shapes:{ids:['pending'],entities:{pending:shape}},tool:'select',selected:{},frameCounter:1}));
  assert.equal(state.shapes.entities.pending.isGenerating,false);
  assert.match(state.shapes.entities.pending.generationError,/interrupted/);
});
test('preview sizing preserves content while removing iframe viewport height dependencies', () => {
  const { normalizePreviewSizing, parseHtmlDocument }=load('lib/html-parser.ts');
  const input='<div class="min-h-screen p-6 md:h-[100dvh]"><main style="min-height:100vh"><h1>FitTrack</h1><article class="h-48">Workout</article></main></div>';
  const output=normalizePreviewSizing(input);
  const parsed=parseHtmlDocument(output);
  assert.match(parsed.bodyContent,/<h1>FitTrack<\/h1>/);
  assert.match(parsed.bodyContent,/class="h-48"/);
  assert.doesNotMatch(parsed.bodyContent,/min-h-screen|100d?vh/);
});
test('redesign retains content beyond the old truncation boundary and excludes conflicting defaults', () => {
 const {buildRedesignPrompt}=load('lib/ai/redesign-context.ts');
 const html='<style>'+'.card{padding:20px}'.repeat(300)+'</style><section>Alex Johnson · Fitness goals · Achievements</section>';
 const p=buildRedesignPrompt({userMessage:'Unique redesign',currentHTML:html,viewportWidth:375,fallbackGuide:{theme:'orange'}});
 assert.ok(p.includes(html));
 assert.match(p,/Alex Johnson/);
 assert.doesNotMatch(p,/Fallback project guide/);
 assert.match(p,/375px/);
});
test('chat provider failures stop the pending spinner and expose retry state', () => {
 const {default:reducer,initializeChat,startStreamingResponse,addErrorMessage}=load('redux/slice/chat/index.ts');
 let state=reducer(undefined,initializeChat('profile'));
 state=reducer(state,startStreamingResponse({generatedUIId:'profile',messageId:'pending'}));
 state=reducer(state,addErrorMessage({generatedUIId:'profile',error:'This model is currently experiencing high demand'}));
 assert.equal(state.chats.profile.isStreaming,false);
 assert.equal(state.chats.profile.messages[0].isStreaming,false);
 assert.equal(state.chats.profile.messages[0].isError,true);
 assert.match(state.chats.profile.messages[0].content,/provider is busy/);
 assert.equal(state.chats.profile.messages.length,1);
});
test('redesign includes the persisted original font and palette contract', () => {
 const {buildRedesignPrompt}=load('lib/ai/redesign-context.ts');
 const p=buildRedesignPrompt({userMessage:'redesign this profile page',currentHTML:'<main>Profile</main>',originalStyleReference:'font-family: Inter; background:#101114; color:#C6FF4D'});
 assert.match(p,/SELECTED SCREEN STYLE FALLBACK/);
 assert.match(p,/font-family: Inter/);
 assert.match(p,/#101114/);
});

test('redesign selects the other app screens instead of an unrelated legacy canvas', () => {
 const {relatedScreenStyleContext,buildRedesignPrompt}=load('lib/ai/redesign-context.ts');
 const screens=[{id:'legacy',uiSpecData:'<style>body{background:orange}</style>'},{id:'home',screenName:'FitTrack · Home',uiSpecData:'<style>body{background:#101114;color:#C6FF4D;font-family:Inter}</style>'},{id:'workout',screenName:'FitTrack · Workout',uiSpecData:'<style>body{background:#1C1D22}</style>'}];
 const context=relatedScreenStyleContext(screens,{id:'profile',screenName:'FitTrack · Profile'});
 assert.match(context,/#101114/);assert.match(context,/Inter/);assert.doesNotMatch(context,/orange/);
 const prompt=buildRedesignPrompt({userMessage:'redesign',currentHTML:'<main>Profile</main>',designContext:context,originalStyleReference:'background:white'});
 assert.match(prompt,/AUTHORITATIVE APP DESIGN SYSTEM/);
 assert.match(prompt,/overrides conflicting selected-screen styling/);
});

test('all existing app screens contribute to redesign, including screens after the first two', () => {
 const {relatedScreenStyleContext}=load('lib/ai/redesign-context.ts');
 const screens=Array.from({length:5},(_,i)=>({id:String(i),screenName:`App · Screen ${i}`,uiSpecData:`<style>.panel{font-family:Font${i};color:#101114}</style>`}));
 const context=relatedScreenStyleContext(screens,{id:'selected',screenName:'App · Selected'});
 for(let i=0;i<5;i++)assert.ok(context.includes(`Font${i}`));
});

test('framework streams remove language fences without removing component code', async () => {
 const code='<script setup lang="ts">const count = 1;</script><template>{{count}}</template>';
 const wire='data: '+JSON.stringify({streamId:'vue',text:'```vue\n'+code+'\n```'})+'\n\n';
 assert.equal(await parseSSEStream(readerFor(wire),'vue',()=>{}),code);
});
test('theme application persists one override, updates literal color classes and retains content', () => {
 const {applyPreviewTheme}=load('lib/preview-theme.ts');
 const original='<div data-generated-ui><style>.c-primary-bg{background:#ff0000}</style><button class="c-primary-bg">Keep me</button></div>';
 const vars={'--color-primary':'#3b82f6','--color-secondary':'#101114','--color-text':'#ffffff'};
 const first=applyPreviewTheme(original,vars),second=applyPreviewTheme(first,{...vars,'--color-primary':'#c6ff4d'});
 assert.equal((second.match(/id="openui-theme-override"/g)||[]).length,1);
 assert.match(second,/Keep me/);assert.match(second,/#c6ff4d/);assert.match(second,/!important/);
});
test('transient stream failure is surfaced once without fallback', async t => {
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';t.after(()=>{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;});
 const {createResilientStreamResponse}=load('lib/ai/resilient-stream.ts',{'@/lib/db':{prisma:{}}});
 let calls=0;
 const response=createResilientStreamResponse(()=>({fullStream:(async function*(){calls++;if(calls===1){yield {type:'error',error:Object.assign(new Error('high demand'),{statusCode:503})};}else{yield {type:'text-delta',text:'<main>Ready</main>'};}})(),totalUsage:Promise.resolve({totalTokens:10}),finishReason:Promise.resolve('stop')}),{},'ui','google','gemini-test');
 await assert.rejects(parseSSEStream(response.body.getReader(),'ui',()=>{}),/high demand/);assert.equal(calls,1);
});
test('stream failure after partial output never silently switches model', async () => {
 const {createResilientStreamResponse}=load('lib/ai/resilient-stream.ts',{'@/lib/db':{prisma:{}}});let calls=0;
 const response=createResilientStreamResponse(()=>({fullStream:(async function*(){calls++;yield {type:'text-delta',text:'<main>Partial'};yield {type:'error',error:new Error('high demand')};})(),totalUsage:Promise.resolve({}),finishReason:Promise.resolve('error')}),{},'ui','google','gemini-test');
 await assert.rejects(parseSSEStream(response.body.getReader(),'ui',()=>{}),/high demand/);assert.equal(calls,1);
});

const { deriveProjectDesignSystem, projectScreens } = load('lib/project-design-system.ts');
const fixtureGuide = {theme:'Unrelated default',description:'Default coral theme',colorSections:[],typographySections:[],designSystemDetails:{cardRadius:18,buttonRadius:9999,spacingUnit:15,designMd:''}};
const sketchesFor = (...screens) => ({shapes:{entities:Object.fromEntries(screens.map((html,i)=>['screen'+i,{id:'screen'+i,type:'generatedui',screenName:'Page '+(i+1),w:375,h:812,uiSpecData:html}]))}});
test('project tokens derive actual CSS variables and page-wise content, without unrelated defaults',()=>{
 const data=sketchesFor('<style>:root{--brand:#123abc;--bg:#fdfdfd;--text:#111}body{background:var(--bg);color:var(--text);font-family:Roboto,sans-serif}.card{background:#eee;border-radius:12px;padding:16px}button{background:var(--brand);border-radius:8px}h1{font-family:Sora}</style><h1>Orders</h1>', '<style>body{background:#fdfdfd;color:#111;font-family:Roboto}button{background:#123abc}</style><h1>Billing</h1>');
 const guide=deriveProjectDesignSystem('Shop',data,fixtureGuide);
 assert.equal(guide.colorSections.find(s=>s.title==='Primary Colors').swatches.find(s=>s.name==='Primary').hexColor,'#123ABC');
 assert.equal(guide.typographySections.find(s=>s.title==='Headings').styles[0].fontFamily,'Sora');
 assert.equal(guide.typographySections.find(s=>s.title==='Body').styles[0].fontFamily,'Roboto');
 assert.match(guide.designSystemDetails.designMd,/### 1\. Page 1/);assert.match(guide.designSystemDetails.designMd,/Billing/);assert.doesNotMatch(guide.designSystemDetails.designMd,/coral|fitness|Unrelated default/i);
});
test('project inventory excludes deleted history and pending frames, and stays isolated across projects',()=>{
 const data=sketchesFor('<style>body{background:#123456}</style><h1>First</h1>');data.past=[sketchesFor('<h1>Deleted page</h1>')];data.shapes.entities.pending={id:'pending',type:'generatedui',uiSpecData:'<h1>Pending</h1>',isGenerating:true};
 assert.equal(projectScreens(JSON.stringify(data)).length,1);
 const first=deriveProjectDesignSystem('A',data,fixtureGuide),second=deriveProjectDesignSystem('B',sketchesFor('<style>body{background:#abcdef}</style><h1>Second</h1>'),fixtureGuide);
 assert.doesNotMatch(second.designSystemDetails.designMd,/#123456|First|Deleted page/);assert.match(second.designSystemDetails.designMd,/#ABCDEF/);assert.notEqual(first.theme,second.theme);
 assert.equal(deriveProjectDesignSystem('Empty',{},fixtureGuide),fixtureGuide);
});
test('Tailwind colors, inline font declarations and variable cycles do not require provider calls',()=>{
 const guide=deriveProjectDesignSystem('Desk',sketchesFor('<style>:root{--a:var(--b);--b:var(--a)}</style><main class="bg-[#112233] text-[#abcdef]" style="font-family:Verdana"><h1>Desk</h1></main>'),fixtureGuide);
 assert.match(guide.designSystemDetails.designMd,/#112233/);assert.match(guide.designSystemDetails.designMd,/Verdana/);assert.doesNotMatch(guide.designSystemDetails.designMd,/coral/i);
});

test('visual token edits retain the project screen documentation in DESIGN.md',()=>{
 const {generateMarkdownFromGuide}=load('redux/slice/style-guide.ts');
 const guide=deriveProjectDesignSystem('Invoices',sketchesFor('<style>body{background:#ffffff;color:#111111;font-family:Inter}button{background:#2244aa}</style><h1>Invoice list</h1>'),fixtureGuide);
 const updated=generateMarkdownFromGuide(guide);
 assert.match(updated,/source: project-screens/);assert.match(updated,/### 1\. Page 1/);assert.match(updated,/Invoice list/);
});

test('straight horizontal and vertical lines/arrows are drawable, zero-size areas are not',()=>{
 const {hasDrawableSize}=load('lib/canvas-drawing.ts');
 for(const tool of ['line','arrow']) {assert.equal(hasDrawableSize(tool,100,0),true);assert.equal(hasDrawableSize(tool,0,-100),true);assert.equal(hasDrawableSize(tool,0,0),false);assert.equal(hasDrawableSize(tool,NaN,100),false);}
 for(const tool of ['frame','rect','ellipse']){assert.equal(hasDrawableSize(tool,100,0),false);assert.equal(hasDrawableSize(tool,100,50),true);}
});
test('eraser endpoint deletion removes linked connectors and undo restores the whole graph',()=>{
 const a=load('redux/slice/shapes/index.ts');let state=a.default(undefined,{type:'init'});
 state=a.default(state,a.addRect({x:0,y:0,w:100,h:100}));const first=state.shapes.ids[0];state=a.default(state,a.addEllipse({x:200,y:0,w:100,h:100}));const second=state.shapes.ids[1];
 state=a.default(state,a.addConnector({fromId:first,toId:second}));const connector=state.shapes.ids[2];state=a.default(state,a.selectShape(connector));
 state=a.default(state,a.removeShape(first));assert.deepEqual(state.shapes.ids,[second]);assert.equal(state.selected[connector],undefined);
 state=a.default(state,a.undo());assert.equal(state.shapes.ids.length,3);assert.equal(state.shapes.entities[connector].fromId,first);
 state=a.default(state,a.redo());assert.deepEqual(state.shapes.ids,[second]);
});
test('selection deletion respects locked shapes and cleans links to removed shapes',()=>{
 const a=load('redux/slice/shapes/index.ts');let state=a.default(undefined,{type:'init'});
 state=a.default(state,a.addRect({x:0,y:0,w:100,h:100}));const first=state.shapes.ids[0];state=a.default(state,a.addRect({x:200,y:0,w:100,h:100}));const second=state.shapes.ids[1];
 state=a.default(state,a.addConnector({fromId:first,toId:second}));state=a.default(state,a.updateShape({id:first,patch:{locked:true}}));state=a.default(state,a.selectAll());state=a.default(state,a.deleteSelected());
 assert.deepEqual(state.shapes.ids,[first]);assert.equal(state.selected[first],true);
 state=a.default(state,a.undo());assert.equal(state.shapes.ids.length,3);
});

const {loadProjectStyleGuide}=load('lib/load-project-style-guide.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function guideObserver(){const successes=[],errors=[],reports=[];return {successes,errors,reports,callbacks:{onSuccess:x=>successes.push(x),onError:x=>errors.push(x),reportError:x=>reports.push(x)}};}
test('Strict Mode setup-cleanup-setup starts only the active request and never aborts completed work',async()=>{
 const observer=guideObserver();const signals=[];
 const fetcher=async(_url,init)=>{signals.push(init.signal);return {ok:true,status:200,json:async()=>({styleGuide:fixtureGuide})};};
 const first=loadProjectStyleGuide('A',observer.callbacks,fetcher);first.cancel();
 const second=loadProjectStyleGuide('A',observer.callbacks,fetcher);await Promise.all([first.done,second.done]);
 assert.equal(signals.length,1);assert.equal(signals[0].aborted,false);assert.equal(observer.successes.length,1);
 second.cancel();assert.equal(signals[0].aborted,false);assert.deepEqual(observer.errors,[]);assert.deepEqual(observer.reports,[]);
});
test('native response.json abort is reproduced, consumed, and never updates an unmounted page',async()=>{
 const http=require('node:http');const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{"styleGuide":');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const bodyStarted=deferred();const observer=guideObserver();let rejection;
 try {
  const request=loadProjectStyleGuide('A',observer.callbacks,async(_url,init)=>{
   const response=await fetch(`http://127.0.0.1:${server.address().port}/`,init);
   return {ok:response.ok,status:response.status,json(){bodyStarted.resolve();return response.json().catch(error=>{rejection=error;throw error;});}};
  });
  await bodyStarted.promise;request.cancel();await request.done;
  assert.equal(rejection.name,'AbortError');assert.equal(observer.successes.length,0);assert.equal(observer.errors.length,0);assert.equal(observer.reports.length,0);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('aborting an in-flight fetch has a rejection handler before cleanup runs',async()=>{
 const observer=guideObserver();const started=deferred();let aborted;
 const request=loadProjectStyleGuide('A',observer.callbacks,(_url,{signal})=>new Promise((_resolve,reject)=>{
  signal.addEventListener('abort',()=>{aborted=signal.reason;reject(aborted);},{once:true});started.resolve();
 }));
 await started.promise;request.cancel();await request.done;
 assert.equal(aborted.name,'AbortError');assert.equal(observer.successes.length,0);assert.equal(observer.errors.length,0);assert.equal(observer.reports.length,0);
});
test('late fetch results and HTTP failures cannot overwrite a replacement project',async()=>{
 for(const ok of [true,false]) {
  const late=deferred(),old=guideObserver(),current=guideObserver();
  const first=loadProjectStyleGuide('old',old.callbacks,()=>late.promise);await Promise.resolve();first.cancel();
  const second=loadProjectStyleGuide('new',current.callbacks,async()=>({ok:true,status:200,json:async()=>({styleGuide:fixtureGuide})}));
  late.resolve({ok,status:ok?200:500,json:async()=>({styleGuide:fixtureGuide})});await Promise.all([first.done,second.done]);
  assert.deepEqual(old.successes,[]);assert.deepEqual(old.errors,[]);assert.equal(current.successes.length,1);
 }
});
test('genuine HTTP, JSON, network and unrelated AbortErrors stay visible',async()=>{
 const failures=[async()=>({ok:false,status:503}),async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('bad JSON');}}),async()=>{throw new TypeError('network down');},async()=>{throw new DOMException('other operation','AbortError');}];
 for(const fetcher of failures){const observer=guideObserver();const request=loadProjectStyleGuide('A',observer.callbacks,fetcher);await request.done;assert.equal(observer.errors.length,1);assert.equal(observer.reports.length,1);assert.equal(observer.successes.length,0);}
});
test('real errors racing with cancellation are reported without writing stale UI state',async()=>{
 const late=deferred(),observer=guideObserver();const request=loadProjectStyleGuide('A',observer.callbacks,()=>late.promise);await Promise.resolve();request.cancel();
 const failure=new TypeError('real failure');late.reject(failure);await request.done;
 assert.equal(observer.reports[0],failure);assert.equal(observer.errors.length,0);assert.equal(observer.successes.length,0);
});

test('a body reader that ignores abort cannot update stale project state',async()=>{
 const body=deferred(),started=deferred(),observer=guideObserver();
 const request=loadProjectStyleGuide('old',observer.callbacks,async()=>({ok:true,status:200,json(){started.resolve();return body.promise;}}));
 await started.promise;request.cancel();body.resolve({styleGuide:fixtureGuide});await request.done;
 assert.equal(observer.successes.length,0);assert.equal(observer.errors.length,0);
});

const {identifyHtmlElements,patchElementHtml,safeElementUrl}=load('lib/element-editing.ts');
test('element IDs are stable and do not rewrite scripts, comments, stylesheet or unrelated HTML',()=>{
 const source='<!DOCTYPE html><html><head><style>.card{color:red}</style><script>const text="<div>test</div>";</script></head><body><!-- <p>comment</p> --><main><h1>Hello</h1><img src="demo.png"><p>Neighbor</p></main></body></html>';
 const stamped=identifyHtmlElements(source);assert.equal(identifyHtmlElements(stamped),stamped);assert.match(stamped,/<script>const text="<div>test<\/div>";<\/script>/);assert.match(stamped,/<!-- <p>comment<\/p> -->/);
 const id=stamped.match(/<h1[^>]*data-openui-element="([^"]+)"/)[1];const changed=patchElementHtml(stamped,id,{styles:{'font-size':'32px',color:'#e11d48'},text:'Edited <heading>'});
 assert.match(changed,/Edited &lt;heading&gt;/);assert.match(changed,/font-size: 32px !important/);assert.equal(changed.slice(changed.indexOf('<img')),stamped.slice(stamped.indexOf('<img')));
});
test('button label edit preserves nested icon paths and inline label structure',()=>{
 const source=identifyHtmlElements('<button class="cta"><svg viewBox="0 0 24 24"><path d="M0 0L1 1"/></svg><span>Start</span></button><p>Keep me</p>');
 const id=source.match(/data-openui-element="([^"]+)"/)[1];const changed=patchElementHtml(source,id,{text:'Begin',styles:{'background-color':'#7c3aed','border-radius':'18px'}});
 assert.match(changed,/<path d="M0 0L1 1"/);assert.match(changed,/<span[^>]*>Begin<\/span>/);assert.doesNotMatch(changed,/>Start</);assert.match(changed,/Keep me/);
});
test('element source edits reject script URLs, event handlers and CSS injection',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hello','java\nscript:alert(1)'])assert.equal(safeElementUrl(url),false);
 assert.equal(safeElementUrl('data:image/svg+xml,%3Csvg/%3E',true),true);assert.equal(safeElementUrl('data:image/png;base64,AAAA',true),true);
 const source=identifyHtmlElements('<img src="old.png">');const id=source.match(/data-openui-element="([^"]+)"/)[1];
 assert.throws(()=>patchElementHtml(source,id,{attributes:{onerror:'bad()'}}),/Unsupported/);assert.throws(()=>patchElementHtml(source,id,{attributes:{src:'javascript:bad()'}}),/safe/);assert.throws(()=>patchElementHtml(source,id,{styles:{color:'red;display:none'}}),/Unsupported/);
});
test('element properties persist only to the chosen screen and participate in undo/redo',()=>{
 const a=load('redux/slice/shapes/index.ts');let state=a.default(undefined,{type:'init'});const source=identifyHtmlElements('<h1>Original</h1>');const id=source.match(/data-openui-element="([^"]+)"/)[1];
 for(const screen of ['mobile','desktop'])state=a.default(state,a.addGeneratedUI({id:screen,x:0,y:0,w:375,h:812,sourceFrameId:'frame',uiSpecData:source}));
 const changed=patchElementHtml(source,id,{text:'Edited'});state=a.default(state,a.editGeneratedElement({id:'mobile',html:changed}));assert.equal(state.shapes.entities.desktop.uiSpecData,source);assert.equal(state.shapes.entities.mobile.uiSpecData,changed);
 state=a.default(state,a.undo());assert.equal(state.shapes.entities.mobile.uiSpecData,source);state=a.default(state,a.redo());assert.equal(state.shapes.entities.mobile.uiSpecData,changed);
 state=a.default(state,a.updateShape({id:'desktop',patch:{locked:true}}));state=a.default(state,a.editGeneratedElement({id:'desktop',html:changed}));assert.equal(state.shapes.entities.desktop.uiSpecData,source);
});
test('dimension and icon patches keep surrounding markup and stable target IDs',()=>{
 const source=identifyHtmlElements('<section><img src="old.png" alt="Old"><svg width="16" height="16"><path d="M0 0"/></svg><p>Neighbor</p></section>');
 const img=source.match(/<img[^>]*data-openui-element="([^"]+)"/)[1],svg=source.match(/<svg[^>]*data-openui-element="([^"]+)"/)[1];
 let changed=patchElementHtml(source,img,{styles:{width:'120px',height:'60px'},attributes:{src:'new.png',alt:'New'}});changed=patchElementHtml(changed,svg,{icon:'heart'});
 assert.match(changed,/width: 120px !important/);assert.match(changed,/src="new.png"/);assert.match(changed,/viewBox="0 0 24 24"/);assert.match(changed,/stroke="currentColor"/);assert.match(changed,/Neighbor/);assert.ok(changed.includes(`data-openui-element="${svg}"`));
});

test('undo invalidates the live iframe edit cache so redo redraws the edited document',()=>{
 const {liveElementHtml,hasLiveElementEdit}=load('lib/element-editing.ts');const frame={};
 liveElementHtml.set(frame,'edited');assert.equal(hasLiveElementEdit(frame,'edited'),true);assert.equal(hasLiveElementEdit(frame,'original'),false);assert.equal(hasLiveElementEdit(frame,'edited'),false);
});

test('quoted attribute text cannot impersonate element IDs or style attributes',()=>{
 const source=identifyHtmlElements(`<p title="data-openui-element='fake' style='color:red'" style='padding: 8px'>Keep</p>`);const id=source.match(/ data-openui-element="([^"]+)"/)[1];
 assert.notEqual(id,'fake');const changed=patchElementHtml(source,id,{styles:{color:'blue'}});assert.match(changed,/title="data-openui-element='fake' style='color:red'"/);assert.match(changed,/padding: 8px/);
});
test('only elements owned by the registered screen iframe pass the editing bridge guard',()=>{
 const {ownsEditableElement}=load('lib/element-editing.ts');const doc={};const frame={contentDocument:doc,getAttribute:()=> 'screen-A'};const element={ownerDocument:doc,closest:()=>({})};
 assert.equal(ownsEditableElement(frame,'screen-A',element),true);assert.equal(ownsEditableElement(frame,'screen-B',element),false);assert.equal(ownsEditableElement(frame,'screen-A',{...element,ownerDocument:{}}),false);assert.equal(ownsEditableElement(frame,'screen-A',{...element,closest:()=>null}),false);
});
test('a custom font edit persists its stylesheet reference for reload and exports',()=>{
 const source=identifyHtmlElements('<html><head></head><body><h1>Title</h1></body></html>');const id=source.match(/data-openui-element="([^"]+)"/)[1];const changed=patchElementHtml(source,id,{styles:{'font-family':'Poppins, sans-serif'},loadFont:true});assert.match(changed,/fonts.googleapis.com/);assert.match(changed,/Poppins/);assert.equal((patchElementHtml(changed,id,{styles:{'font-family':'Poppins, sans-serif'},loadFont:true}).match(/fonts.googleapis.com/g)||[]).length,1);
});

test('grouped element edits undo once, redo the latest value, and new edits invalidate redo',()=>{
 const a=load('redux/slice/shapes/index.ts');let state=a.default(undefined,a.addGeneratedUI({id:'screen',x:0,y:0,w:375,h:812,sourceFrameId:'frame',uiSpecData:'original'}));
 state=a.default(state,a.editGeneratedElement({id:'screen',html:'first'}));const count=state.past.length;state=a.default(state,a.editGeneratedElement({id:'screen',html:'last',recordHistory:false}));assert.equal(state.past.length,count);
 state=a.default(state,a.undo());assert.equal(state.shapes.entities.screen.uiSpecData,'original');state=a.default(state,a.redo());assert.equal(state.shapes.entities.screen.uiSpecData,'last');state=a.default(state,a.undo());state=a.default(state,a.editGeneratedElement({id:'screen',html:'new branch'}));assert.equal(state.future.length,0);
});

test('framework conversion receives scoped priority rules for element-level overrides',()=>{
 const {prepareElementConversionHtml}=load('lib/element-editing.ts');const source=identifyHtmlElements('<html><head><style>h1{font-family:Inter!important}</style></head><body><h1 style="font-family:Georgia !important;color:#e11d48 !important">Edited</h1></body></html>');
 const prepared=prepareElementConversionHtml(source);assert.match(prepared,/openui-element-conversion-overrides/);assert.match(prepared,/\[data-openui-element="oui-e-1"\]\{font-family:Georgia !important;color:#e11d48 !important\}/);assert.match(prepared,/>Edited<\/h1>/);
});
const chatPlans = load('lib/project-chat.ts');
test('project chat parses bounded typed operations and rejects deletion/arbitrary patches', () => {
  assert.deepEqual(chatPlans.parseChatPlan('{"message":"Hello","actions":[]}').actions, []);
  assert.throws(() => chatPlans.parseChatPlan('{"message":"Delete","actions":[{"type":"delete","screenId":"a"}]}'));
  assert.throws(() => chatPlans.parseChatPlan('{"message":"Patch","actions":[{"type":"element","screenId":"a","elementId":"x","patch":{"onclick":"evil"}}]}'));
});
test('project chat patches only intended source and rejects absent or locked targets', () => {
  const html='<main><button data-openui-element="btn">Go</button><p>Keep</p></main>';
  const screens=[{id:'a',type:'generatedui',uiSpecData:html},{id:'b',type:'generatedui',uiSpecData:'<p>Other screen</p>'}];
  const plan={message:'Color',actions:[{type:'element',screenId:'a',elementId:'btn',patch:{styles:{'background-color':'blue'}}}]};
  const changes=chatPlans.prepareChatChanges(plan,screens,{shapeId:'a',elementId:'btn'});
  assert.equal(changes.length,1);assert.equal(changes[0].id,'a');assert.equal(changes[0].before,html);assert.match(changes[0].html,/<p data-openui-element="oui-e-\d+">Keep<\/p>/);
  assert.throws(()=>chatPlans.prepareChatChanges(plan,[{...screens[0],locked:true}]));
  assert.throws(()=>chatPlans.prepareChatChanges({...plan,actions:[{...plan.actions[0],screenId:'missing'}]},screens));
  assert.throws(()=>chatPlans.prepareChatChanges(plan,screens,{shapeId:'b',elementId:'other'}));
});
test('project chat creation never replaces existing sources and validates unsafe element values',()=>{
  const screens=[{id:'a',type:'generatedui',uiSpecData:'<button data-openui-element="btn">Go</button>'}];
  assert.deepEqual(chatPlans.prepareChatChanges({message:'New',actions:[{type:'create',name:'Settings',width:375,height:812,html:'<main>Settings screen</main>'}]},screens),[]);
  assert.throws(()=>chatPlans.prepareChatChanges({message:'Bad',actions:[{type:'element',screenId:'a',elementId:'btn',patch:{attributes:{href:'javascript:alert(1)'}}}]},screens));
});
test('project chat transactions preserve IDs, history and project ownership atomically',()=>{
  const shapes=load('redux/slice/shapes/index.ts'); const reducer=shapes.default;
  const a={id:'a',type:'generatedui',x:0,y:0,w:375,h:812,uiSpecData:'<p>Before</p>',sourceFrameId:''};
  let state=reducer(undefined,shapes.loadProject({projectId:'one',shapes:{ids:['a'],entities:{a}},tool:'select',selected:{},frameCounter:0}));
  state=reducer(state,shapes.addProjectChatMessage({projectId:'one',message:{id:'m',role:'user',content:'Hello',timestamp:'now'}}));
  const payload={projectId:'one',changes:[{id:'a',before:a.uiSpecData,html:'<p>After</p>'}],creates:[{name:'Settings',width:375,height:812,html:'<main>Settings</main>'}]};
  assert.equal(reducer(state,shapes.applyProjectChatChanges({...payload,projectId:'other'})),state);
  assert.equal(reducer(state,shapes.applyProjectChatChanges({...payload,changes:[{...payload.changes[0],before:'stale'}]})),state);
  const updated=reducer(state,shapes.applyProjectChatChanges(payload));assert.equal(updated.shapes.entities.a.uiSpecData,'<p>After</p>');assert.equal(updated.shapes.ids.length,2);assert.equal(updated.projectMessages.length,1);
  const undone=reducer(updated,shapes.undo());assert.equal(undone.shapes.ids.length,1);assert.equal(undone.shapes.entities.a.uiSpecData,a.uiSpecData);assert.equal(undone.projectMessages.length,1);
  const switched=reducer(updated,shapes.loadProject({projectId:'two',shapes:{ids:[],entities:{}},tool:'select',selected:{},frameCounter:0}));assert.equal(switched.projectMessages.length,0);assert.equal(reducer(switched,shapes.addProjectChatMessage({projectId:'one',message:{id:'late',role:'assistant',content:'Late',timestamp:'now'}})),switched);
});
test('SSE response cancellation stops writes without an unhandled AbortError', async()=>{
  const utils=load('lib/ai/route-utils.ts',{'@/lib/db':{prisma:{}},'@/lib/ai/provider-registry':{}});
  let proceed; const gate=new Promise(resolve=>proceed=resolve);
  async function* source(){yield 'first';await gate;throw new DOMException('Expected cancellation','AbortError');}
  const response=utils.createStreamResponse(source(),'text/event-stream','cancel');const reader=response.body.getReader();await reader.read();await reader.cancel();proceed();await new Promise(resolve=>setImmediate(resolve));
});
test('project chat API uses selected project model and streams complete project context',async()=>{
  let modelProject, captured;
  const endpoint=load('lib/ai/project-chat-response.ts',{
    '@/lib/db':{prisma:{project:{findUnique:async()=>({name:'QA',settings:{provider:'google',model:'selected-gemini'}})}}},
    '@/lib/ai/route-utils':{resolveModelForProject:async id=>(modelProject=id,{}),ProjectNotFoundError:class extends Error{}},
    '@/lib/ai/resilient-stream':{createResilientStreamResponse:(run,model,id,provider,modelId)=>{assert.equal(provider,'google');assert.equal(modelId,'selected-gemini');run(model);return new Response('stream');}},
    ai:{streamText:options=>(captured=options,{})},
  });
  const context={screens:[{id:'a',name:'A',html:'<p>A</p>',width:375,height:812,x:0,y:0},{id:'b',name:'B',html:'<p>B</p>',width:768,height:900,x:455,y:0}],selectedScreenIds:['a'],selectedElement:{elementId:'btn',shapeId:'a'},guide:{theme:'QA tokens'},viewport:{scale:0.5},history:[{role:'user',content:'Earlier request'}]};
  const signal=new AbortController().signal;
  const response=await endpoint.projectChatResponse({signal},{projectId:'project-a',streamId:'stream',userMessage:'Question',context});assert.equal(response.status,200);assert.equal(modelProject,'project-a');assert.equal(captured.abortSignal,signal);assert.match(captured.messages[0].content,/QA tokens/);assert.match(captured.messages[0].content,/Earlier request/);assert.match(captured.messages[0].content,/<p>B<\/p>/);
  const invalid=await endpoint.projectChatResponse({signal},{projectId:'a'});assert.equal(invalid.status,400);
});
test('screen image filenames stay unique, safe and keep the requested extension',()=>{
 const exporter=load('lib/screen-image-export.ts',{'@/lib/frame-snapshot':{downloadBlob(){}},jszip:{__esModule:true,default:require('jszip')}});
 assert.equal(exporter.screenImageFilename('../Settings:main',0,'jpg'),'01-..-Settings-main.jpg');
 assert.notEqual(exporter.screenImageFilename('Same',0,'svg'),exporter.screenImageFilename('Same',1,'svg'));
 assert.equal(exporter.screenImageFilename('',2,'png'),'03-screen.png');
});
test('screen image export captures the design root and produces all-screen archives without editor frames',async()=>{
 const downloads=[];const captures=[];const previous=global.document;
 const Zip=require('jszip');function TestZip(){const zip=new Zip();const file=zip.file.bind(zip);zip.file=(name,data)=>file(name,data instanceof Blob?data.arrayBuffer():data);return zip;}
 const root={childElementCount:1,scrollWidth:375,scrollHeight:812,getAttribute:()=>null,getBoundingClientRect:()=>({width:375,height:812}),querySelectorAll:()=>[]};
 const doc={body:root,documentElement:{},querySelectorAll:()=>[],createElement:()=>({style:{}}),fonts:{ready:Promise.resolve(),forEach:()=>{}},getElementById:id=>id==='mockup-root'?root:null,defaultView:{requestAnimationFrame:callback=>queueMicrotask(callback),getComputedStyle:()=>({backgroundColor:'rgb(16, 17, 20)',fontFamily:'DM Sans',fontSize:'16px',content:'none'})}};root.ownerDocument=doc;
 const htmlImage={getFontEmbedCSS:async()=> '@font-face{font-family:DM Sans;src:url(data:font/woff2;base64,AA==)}',toBlob:async(node,options)=>{captures.push({node,options});return new Blob(['png']);},toJpeg:async()=> 'data:image/jpeg;base64,/9j/',toSvg:async()=> 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'};
 const exporter=load('lib/screen-image-export.ts',{'@/lib/frame-snapshot':{downloadBlob:(blob,name)=>downloads.push({blob,name})},jszip:{__esModule:true,default:TestZip},'html-to-image':htmlImage});
 const screens=[{id:'one',w:375,h:904,screenName:'One',uiSpecData:'<main>One</main>'},{id:'two',w:375,h:874,screenName:'Two',uiSpecData:'<main>Two</main>'}];
 global.document={querySelectorAll:()=>[{dataset:{openuiShape:'fullscreen-one'},contentDocument:null},...screens.map(s=>({dataset:{openuiShape:s.id},contentDocument:doc}))]};
 try {
  await exporter.downloadScreenImages(screens,'png',true,()=>{});
  assert.equal(downloads.length,1);assert.equal(downloads[0].name,'openui-all-screens-png.zip');
  const zip=await require('jszip').loadAsync(await downloads[0].blob.arrayBuffer());assert.deepEqual(Object.keys(zip.files),['01-One.png','02-Two.png']);
  assert.equal(captures[0].node,root);assert.equal(captures[0].options.pixelRatio,2);assert.equal(captures[0].options.width,375);assert.equal(captures[0].options.height,904);assert.equal(captures[1].options.height,874);assert.match(captures[0].options.fontEmbedCSS,/DM Sans/);assert.match(captures[0].options.fontEmbedCSS,/font-size:16px!important/);assert.equal(captures[0].options.skipAutoScale,true);assert.equal(captures[0].options.filter({tagName:'SCRIPT'}),false);
  assert.equal((await exporter.captureScreenImage(screens[0],'jpg')).type,'image/jpeg');assert.equal((await exporter.captureScreenImage(screens[0],'svg')).type,'image/svg+xml');
  await assert.rejects(()=>exporter.captureScreenImage({...screens[0],isGenerating:true},'png'),/not ready/);
  global.document={querySelectorAll:()=>[]};await assert.rejects(()=>exporter.captureScreenImage(screens[0],'png'),/Open the Canvas/);
 } finally {global.document=previous;}
});

test('pricing yearly toggle applies 30 percent savings and leaves lifetime one-time',()=>{
 const {getPricing,pricingAmount}=load('lib/pricing.ts');
 assert.equal(getPricing('plus','monthly').displayCents,900);
 assert.equal(getPricing('pro','monthly').displayCents,2500);
 assert.deepEqual(getPricing('plus','yearly'),{displayCents:630,chargedCents:7560,recurring:true,yearly:true});
 assert.equal(getPricing('pro','yearly').chargedCents,21000);
 assert.deepEqual(getPricing('lifetime','monthly'),getPricing('lifetime','yearly'));
 assert.equal(pricingAmount(630),'$6.30');assert.equal(pricingAmount(3900),'$39');
});
