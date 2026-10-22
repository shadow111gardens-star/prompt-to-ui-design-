const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){mocks={'@/lib/server/project-access':require('./helpers/project-feature-identity.cjs'),...mocks};const cache=new Map();return function load(file){const filename=path.resolve(file);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename,module);cache.set(filename,m);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.require=function(name){if(Object.hasOwn(mocks,name))return mocks[name];if(name.startsWith('@/')){const base=name.slice(2),file=[base+'.ts',base+'.tsx',base+'/index.ts'].find(candidate=>fs.existsSync(candidate));if(!file)throw Error('Missing test module '+name);return load(file);}return Module.prototype.require.call(this,name);};m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;};}
const load=loader(),{identifyHtmlElements,scanHtmlTags,htmlAttribute}=load('lib/element-editing.ts'),{patchElementColor,colorOriginals,COLOR_ORIGINAL}=load('lib/element-colors.ts'),{validColor,colorHex,replaceColorRGB,colorWithAlpha}=load('lib/color-values.ts');
const id=(html,tag)=>scanHtmlTags(html).find(n=>!n.close&&n.tag===tag).id;
const opening=(html,target)=>scanHtmlTags(html).find(n=>!n.close&&n.id===target).raw;

test('hex validation and native color conversion retain alpha instead of becoming opaque',()=>{
 for(const value of ['#abc','#abcd','#FF5A36','#FF5A3680','transparent','inherit','var(--brand)'])assert.equal(validColor(value),true,value);
 for(const value of ['#12','#GGFFFF','#1234567','red;display:none','url(https://evil.test/image)','<style>',''])assert.equal(validColor(value),false,value);
 assert.equal(validColor('none',true),true);assert.equal(validColor('none'),false);assert.equal(colorHex('#f008'),'#FF000088');assert.equal(colorHex('rgba(255, 90, 54, 0.5)'),'#FF5A3680');assert.equal(replaceColorRGB('#00FF00','#FF5A3680'),'#00FF0080');assert.equal(colorWithAlpha('#FF5A36',0),'#FF5A3600');assert.equal(colorWithAlpha('#FF5A36',100),'#FF5A36FF');assert.equal(colorWithAlpha('#FF5A36',50),'#FF5A3680');
});
test('text/background/border edits preserve classes, gradients, responsive styles and neighboring elements',()=>{
 const source=identifyHtmlElements('<style>@media(min-width:700px){.card{padding:24px}}</style><section class="card md:grid-cols-2" style="background:linear-gradient(red,blue);padding:20px;border:1px solid gray"><h2 style="font-size:22px;color:var(--brand) !important">Title</h2><p style="color:green">Neighbor</p></section>');const heading=id(source,'h2'),card=id(source,'section'),neighbor=id(source,'p'),originalNeighbor=opening(source,neighbor);
 let edited=patchElementColor(source,heading,{property:'color',value:'#FF5A3680'});edited=patchElementColor(edited,card,{property:'background-color',value:'transparent'});edited=patchElementColor(edited,card,{property:'border-color',value:'#FFFFFF'});
 assert.match(opening(edited,heading),/color: #FF5A3680 !important/);assert.match(opening(edited,card),/background: linear-gradient\(red,blue\)/);assert.match(edited,/md:grid-cols-2/);assert.match(edited,/@media\(min-width:700px\)/);assert.equal(opening(edited,neighbor),originalNeighbor);assert.match(opening(edited,card),/padding: 20px/);
 const reset=patchElementColor(edited,heading,{property:'color',value:null});assert.match(opening(reset,heading),/color: var\(--brand\) !important/);assert.equal(htmlAttribute(opening(reset,heading),COLOR_ORIGINAL),undefined);
});
test('reset removes only the override to recover inherited/class styling; repeated editing keeps original',()=>{
 const source=identifyHtmlElements('<div class="parent"><p class="text-theme" style="padding:8px">Text</p></div>'),target=id(source,'p');let edited=patchElementColor(source,target,{property:'color',value:'#112233'});edited=patchElementColor(edited,target,{property:'color',value:'#445566'});const reset=patchElementColor(edited,target,{property:'color',value:null});assert.match(opening(reset,target),/padding: 8px/);assert.equal(opening(reset,target).includes('color:'),false);assert.match(reset,/class="text-theme"/);assert.equal(patchElementColor(source,target,{property:'color',value:null}),source);
});
test('placeholder colors are scoped to the chosen descendant, survive serialization and reject unrelated targets',()=>{
 const source=identifyHtmlElements('<html><head></head><body><section><input placeholder="Search"><textarea placeholder="Notes"></textarea></section><input placeholder="Other"></body></html>'),section=id(source,'section'),input=id(source,'input'),outside=scanHtmlTags(source).filter(t=>t.tag==='input')[1].id;
 const changed=patchElementColor(source,section,{property:'placeholder-color',targetId:input,value:'#FF5A3680'});assert.match(changed,/::placeholder\{color:var\(--openui-placeholder-color\)!important\}/);assert.match(opening(changed,input),/--openui-placeholder-color: #FF5A3680 !important/);assert.equal(opening(changed,outside),opening(source,outside));assert.match(changed,/<body><style/);assert.throws(()=>patchElementColor(source,section,{property:'placeholder-color',targetId:outside,value:'#fff'}),/inside the selected/);
 const reset=patchElementColor(changed,section,{property:'placeholder-color',targetId:input,value:null});assert.equal(reset.includes('::placeholder'),false);assert.equal(reset.includes('--openui-placeholder-color'),false);assert.equal(colorOriginals('bad json').color,undefined);
});
test('SVG paint changes only selected paint and reset restores inherited gradient/attributes and alpha',()=>{
 const source=identifyHtmlElements('<svg fill="none" stroke="currentColor"><path fill="url(#gradient)" style="stroke-width:2" d="M0 0"/><circle fill="red" cx="2"/></svg>'),target=id(source,'path'),neighbor=id(source,'circle');let changed=patchElementColor(source,target,{property:'fill',value:'#FF5A3680'});changed=patchElementColor(changed,target,{property:'stroke',value:'none'});assert.match(opening(changed,target),/fill="url\(#gradient\)"/);assert.match(opening(changed,target),/fill: #FF5A3680 !important/);assert.match(opening(changed,target),/stroke: none !important/);assert.equal(opening(changed,neighbor),opening(source,neighbor));changed=patchElementColor(changed,target,{property:'fill',value:null});assert.equal(opening(changed,target).includes('fill:'),false);assert.match(opening(changed,target),/fill="url\(#gradient\)"/);
});
test('actual Redux edit/undo/redo and autosave/reopen retain serialized colors independently per screen',async()=>{
 let saved;const modules=loader({'@/lib/db':{prisma:{project:{update:async({data})=>saved={id:'project',createdAt:new Date(),lastModified:new Date(),...data},findUnique:async()=>saved}}}}),shapes=modules('redux/slice/shapes/index.ts');let state=shapes.default(undefined,{type:'init'});const source=identifyHtmlElements('<h1 class="title">Study</h1>'),target=id(source,'h1');for(const screen of ['home','library'])state=shapes.default(state,shapes.addGeneratedUI({id:screen,x:0,y:0,w:375,h:812,sourceFrameId:'frame',uiSpecData:source}));
 const edited=patchElementColor(source,target,{property:'color',value:'#FF5A3680'});state=shapes.default(state,shapes.editGeneratedElement({id:'home',html:edited}));assert.equal(state.shapes.entities.library.uiSpecData,source);state=shapes.default(state,shapes.undo());assert.equal(state.shapes.entities.home.uiSpecData,source);state=shapes.default(state,shapes.redo());assert.equal(state.shapes.entities.home.uiSpecData,edited);
 const route=modules('app/api/autosave/route.ts');assert.equal((await route.POST(new Request('http://localhost/api/autosave',{method:'POST',body:JSON.stringify({projectId:'project',shapesData:state})}))).status,200);const reopened=await modules('lib/db/projects.ts').getProject('project');assert.equal(reopened.sketchesData.shapes.entities.home.uiSpecData,edited);await modules('lib/db/projects.ts').updateProjectSketches('project',state);assert.equal((await modules('lib/db/projects.ts').getProject('project')).sketchesData.shapes.entities.home.uiSpecData,edited);
 const portable=await modules('lib/images/portable-assets.ts').makeImagesPortable(edited,async()=>{throw Error('No image fetch needed');});assert.match(portable,/color: #FF5A3680 !important/);assert.match(portable,/class="title"/);
});
test('native placeholder export CSS preserves computed color and opacity with element-scoped selectors',()=>{
 const {placeholderExportCSS}=load('lib/element-color-info.ts');const input={getAttribute:()=> 'search-field'};const css=placeholderExportCSS({querySelectorAll:()=>[input],ownerDocument:{defaultView:{getComputedStyle:()=>({color:'rgba(255, 90, 54, 0.5)',opacity:'0.54'})}}});assert.match(css,/data-openui-element="search-field"/);assert.match(css,/color:rgba\(255, 90, 54, 0.5\)!important;opacity:0.54!important/);assert.equal(css.startsWith('input::placeholder'),false);
});


test('live placeholder rule synchronization removes stale undo rules and restores only saved scoped rules',()=>{
 const modules=loader({'@/redux/store':{},sonner:{toast:{}}});const {synchronizePlaceholderColors}=modules('components/canvas/element-inspector/context.tsx');let live=[];
 const doc={querySelectorAll:()=>live,importNode:rule=>({...rule,remove(){live=live.filter(item=>item!==this);}}),head:{appendChild:rule=>live.push(rule)}};
 synchronizePlaceholderColors(doc,{querySelectorAll:()=>[{textContent:'input scope 1'}]});assert.equal(live.length,1);assert.equal(live[0].textContent,'input scope 1');synchronizePlaceholderColors(doc,{querySelectorAll:()=>[]});assert.equal(live.length,0);synchronizePlaceholderColors(doc,{querySelectorAll:()=>[{textContent:'input scope 2'}]});assert.equal(live.length,1);assert.equal(live[0].textContent,'input scope 2');
});

// Run the actual provider with deterministic hook scheduling and a small DOM fixture.
// This counts state commits/dispatches; it is not a browser or React DOM test.
function inspectorHarness(){
 const slots=[];let cursor=0,pending=false,commits=0,effects=[],value;const actions=[];
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((item,i)=>Object.is(item,b[i]));
 const hooks={...require('react'),useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{const result=typeof next==='function'?next(slots[i].value):next;if(!Object.is(result,slots[i].value)){slots[i].value=result;pending=true;commits++;}}];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useMemo(factory,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={value:factory(),deps};return slots[i].value;},useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const source=identifyHtmlElements('<h1 style="padding:8px">Title</h1>'),target=id(source,'h1');
 const slice=load('redux/slice/shapes/index.ts');let shapeState=slice.default(undefined,{type:'init'});shapeState=slice.default(shapeState,slice.addGeneratedUI({id:'home',x:0,y:0,w:375,h:812,sourceFrameId:'frame',uiSpecData:source}));
 const attrs=new Map([['data-openui-element',target],['style','padding:8px']]);let color='rgb(0, 0, 0)';
 const css={display:'block',getPropertyValue:property=>property==='color'?color:property==='display'?'block':''};
 const doc={defaultView:{getComputedStyle:()=>css},createTreeWalker:()=>({nextNode:()=>null}),querySelector:()=>element,querySelectorAll:()=>[],head:{appendChild(){}}};
 const element={tagName:'H1',ownerDocument:doc,parentElement:null,children:[],textContent:'Title',id:'',closest:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:200,height:32}),getAttribute:name=>attrs.get(name)??null,setAttribute:(name,v)=>{attrs.set(name,v);},removeAttribute:name=>attrs.delete(name)};
 const globals={window:global.window,document:global.document,matchMedia:global.matchMedia,CSS:global.CSS,DOMParser:global.DOMParser};
 global.window={addEventListener(){},removeEventListener(){}};global.document={documentElement:{style:{setProperty(){},removeProperty(){}}}};global.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});global.CSS={escape:v=>v,supports:()=>true};
 global.DOMParser=class{parseFromString(html){const tag=scanHtmlTags(html).find(t=>t.id===target);return{querySelector:()=>({getAttribute:name=>htmlAttribute(tag.raw,name)??null}),querySelectorAll:()=>[]};}};
 const dispatch=action=>{actions.push(action);shapeState=slice.default(shapeState,action);};
 const modules=loader({react:hooks,'@/redux/store':{useAppDispatch:()=>dispatch,useAppSelector:selector=>selector({shapes:shapeState})},'@/lib/element-editing':{...load('lib/element-editing.ts'),ownsEditableElement:()=>true},'@/lib/element-color-info':{describeElementColors:()=>[{property:'color',label:'Text color',value:color,computed:color,targetId:target,edited:false,gradient:false}]},sonner:{toast:{error:error=>{throw Error(error);}}}});
 const {ElementInspectorProvider}=modules('components/canvas/element-inspector/context.tsx');
 function render(){cursor=0;pending=false;value=ElementInspectorProvider({children:null}).props.value;const queue=effects;effects=[];queue.forEach(fn=>fn());return value;}
 function settle(){let count=0;do{render();assert.ok(++count<20,'inspector did not settle within 20 renders');}while(pending);return value;}
 settle();
 return{select(){value.select({contentDocument:doc},'home',element);return settle();},settle,render,get value(){return value;},get commits(){return commits;},get actions(){return actions;},get pending(){return pending;},setColor(v){color=v;},dispatch,dispose(){for(const slot of slots)slot?.cleanup?.();for(const[key,v]of Object.entries(globals)){if(v===undefined)delete global[key];else global[key]=v;}}};
}

test('unchanged selected-element refreshes settle without repeated state commits or context identity changes',()=>{
 const h=inspectorHarness();try{h.select();const initial=h.value,commits=h.commits;for(let i=0;i<100;i++)h.value.refresh();assert.equal(h.commits,commits);assert.equal(h.pending,false);assert.equal(h.render(),initial);h.setColor('rgba(255, 90, 54, 0.5)');h.value.refresh();assert.equal(h.commits,commits+1);assert.equal(h.settle().selection.info.colors[0].value,'rgba(255, 90, 54, 0.5)');}finally{h.dispose();}
});

test('same color events and reset do not redispatch or add history; undo/redo still work',()=>{
 const h=inspectorHarness();try{h.select();const patch={color:{property:'color',value:'#FF5A3680'}};assert.equal(h.value.apply(patch,'color:test'),true);h.settle();const actions=h.actions.length,commits=h.commits;for(let i=0;i<100;i++)assert.equal(h.value.apply(patch,'color:test'),true);assert.equal(h.actions.length,actions);assert.equal(h.commits,commits);const slice=load('redux/slice/shapes/index.ts');h.dispatch(slice.undo());h.settle();assert.equal(h.value.apply(patch,'color:after-undo'),true);h.settle();h.dispatch(slice.undo());h.settle();h.dispatch(slice.redo());h.settle();const reset={color:{property:'color',value:null}};assert.equal(h.value.apply(reset,'color:reset'),true);h.settle();const resetActions=h.actions.length;assert.equal(h.value.apply(reset,'color:reset'),true);assert.equal(h.actions.length,resetActions);}finally{h.dispose();}
});

test('identical placeholder synchronization performs no DOM mutations and changed rules update once',()=>{
 const modules=loader({'@/redux/store':{},sonner:{toast:{}}}),{synchronizePlaceholderColors}=modules('components/canvas/element-inspector/context.tsx');let live=[],writes=0;
 const rule=text=>({textContent:text,getAttribute:()=> 'field',remove(){writes++;live=live.filter(item=>item!==this);}});
 const doc={querySelectorAll:()=>live,importNode:item=>rule(item.textContent),head:{appendChild:item=>{writes++;live.push(item);}}};
 const parsed=text=>({querySelectorAll:()=>[rule(text)]});synchronizePlaceholderColors(doc,parsed('color: red'));const count=writes;for(let i=0;i<100;i++)synchronizePlaceholderColors(doc,parsed('color: red'));assert.equal(writes,count);synchronizePlaceholderColors(doc,parsed('color: blue'));assert.equal(writes,count+2);assert.equal(live[0].textContent,'color: blue');
});
