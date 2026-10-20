const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(source){const filename=path.resolve(source),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const {pinchStep}=load('lib/canvas-touch.ts');
const viewport=load('redux/slice/viewport/index.ts');
test('two-finger zoom preserves midpoint anchor and pans by finger movement',()=>{
 const before=[{x:100,y:100},{x:200,y:100}],after=[{x:60,y:120},{x:260,y:120}];
 const step=pinchStep(before,after);
 assert.equal(step.factor,2);assert.deepEqual(step.origin,{x:150,y:100});assert.equal(step.dx,10);assert.equal(step.dy,20);
 let state=viewport.default(undefined,{type:'init'});
 const worldBefore=viewport.screenToWorld(step.origin,state.translate,state.scale);
 state=viewport.default(state,viewport.zoomBy({factor:step.factor,originScreen:step.origin}));
 state=viewport.default(state,viewport.wheelPan({dx:step.dx/state.wheelPanSpeed,dy:step.dy/state.wheelPanSpeed}));
 const projected=viewport.worldToScreen(worldBefore,state.translate,state.scale);
 assert.deepEqual(projected,{x:160,y:120});
});
test('touch pan at constant span does not change zoom and coincident fingers remain finite',()=>{
 const step=pinchStep([{x:0,y:0},{x:100,y:0}],[{x:20,y:30},{x:120,y:30}]);
 assert.equal(step.factor,1);assert.equal(step.dx,20);assert.equal(step.dy,30);
 const zero=pinchStep([{x:0,y:0},{x:0,y:0}],[{x:0,y:0},{x:10,y:10}]);assert.equal(Number.isFinite(zero.factor),true);
});
test('repeated mobile pinch cannot exceed existing viewport zoom limits',()=>{
 let state=viewport.default(undefined,{type:'init'});
 for(let i=0;i<20;i++)state=viewport.default(state,viewport.zoomBy({factor:4,originScreen:{x:160,y:240}}));
 assert.equal(state.scale,state.maxScale);
 for(let i=0;i<30;i++)state=viewport.default(state,viewport.zoomBy({factor:0.25,originScreen:{x:160,y:240}}));
 assert.equal(state.scale,state.minScale);assert.ok(Number.isFinite(state.translate.x));
});
