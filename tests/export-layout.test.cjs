const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file){const m=new Module(path.resolve(file),module);m.filename=path.resolve(file);m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m.filename);return m.exports;}
const {usedScreenFontFamilies,embedScreenFonts,waitForScreenRender,screenCaptureDimensions}=load('lib/screen-render-readiness.ts');
function fixture(){
 const heading={font:'Host Grotesk, sans-serif'},bodyText={font:'DM Sans, sans-serif'};
 const root={font:'DM Sans, sans-serif',clientWidth:375,clientHeight:904,scrollWidth:520,scrollHeight:1000,getBoundingClientRect:()=>({width:375,height:904}),querySelectorAll:selector=>selector==='*'?[heading,bodyText]:[]};
 const doc={createElement:()=>({ownerDocument:doc,style:{}}),querySelectorAll:()=>[],fonts:{ready:Promise.resolve(),forEach:callback=>['Host Grotesk','DM Sans'].forEach(family=>callback({family}))},defaultView:{getComputedStyle:(node,pseudo)=>({fontFamily:node.font||'',content:pseudo?'none':''}),requestAnimationFrame:callback=>queueMicrotask(callback)}};root.ownerDocument=doc;return {root,doc};
}
test('iframe font collection includes descendant heading fonts without parent-window instanceof',async()=>{
 const {root,doc}=fixture();assert.deepEqual(usedScreenFontFamilies(root),['DM Sans','sans-serif','Host Grotesk']);let probe;
 const css=await embedScreenFonts(root,async node=>{probe=node;return '@font-face{font-family:DM Sans;src:url(data:font/woff2;base64,AA==)}@font-face{font-family:Host Grotesk;src:url(data:font/woff2;base64,AA==)}';});assert.match(probe.style.fontFamily,/Host Grotesk/);assert.match(css,/Host Grotesk/);assert.equal(probe.ownerDocument,doc);
 await assert.rejects(()=>embedScreenFonts(root,async()=> '@font-face{font-family:DM Sans;src:url(data:font/woff2;base64,AA==)}'),/Could not embed.*Host Grotesk/);
});
test('real html-to-image font scanner misses cross-realm children; explicit family probe embeds both',async()=>{
 const old={CSSRule:global.CSSRule,HTMLElement:global.HTMLElement,getComputedStyle:global.getComputedStyle};
 class ParentElement{};class FrameElement{constructor(family,doc,children=[]){this.style={fontFamily:family};this.ownerDocument=doc;this.children=children;}}
 global.HTMLElement=ParentElement;global.CSSRule={FONT_FACE_RULE:5,IMPORT_RULE:3};global.getComputedStyle=node=>node.style;
 const doc={styleSheets:[{href:null,cssRules:['DM Sans','Host Grotesk'].map(family=>({type:5,style:{fontFamily:family,getPropertyValue:()=> 'url(data:font/woff2;base64,AA==)'},cssText:`@font-face{font-family:'${family}';src:url(data:font/woff2;base64,AA==)}`}))}],fonts:{forEach:callback=>['DM Sans','Host Grotesk'].forEach(family=>callback({family}))},createElement:()=>new FrameElement('',doc),defaultView:{getComputedStyle:(node,pseudo)=>({fontFamily:node.style.fontFamily,content:pseudo?'none':''})}};
 const heading=new FrameElement('Host Grotesk',doc),root=new FrameElement('DM Sans',doc,[heading]);root.querySelectorAll=()=>[heading];
 try{const {getFontEmbedCSS}=require('html-to-image');const oldCSS=await getFontEmbedCSS(root);assert.match(oldCSS,/DM Sans/);assert.doesNotMatch(oldCSS,/Host Grotesk/);const fixedCSS=await embedScreenFonts(root,node=>getFontEmbedCSS(node));assert.match(fixedCSS,/DM Sans/);assert.match(fixedCSS,/Host Grotesk/);}finally{Object.assign(global,old);}
});
test('frame dimensions remain independent of overflowing content and high-DPI capture never auto-stretches',()=>{
 assert.deepEqual(screenCaptureDimensions(375,904),{width:375,height:904,pixelRatio:2});assert.equal(screenCaptureDimensions(375,874).height,874);for(const [w,h]of [[0,100],[NaN,100],[100,Infinity],[20000,500]])assert.throws(()=>screenCaptureDimensions(w,h));
});
test('readiness waits for fonts, image decode and stable layout frames; restores lazy loading',async()=>{
 const {root,doc}=fixture(),events=[];let release;doc.fonts.ready=new Promise(resolve=>release=resolve);let frames=0;doc.defaultView.requestAnimationFrame=callback=>{frames++;queueMicrotask(callback);};const image={loading:'lazy',naturalWidth:20,decode:async()=>events.push('decoded')};root.querySelectorAll=selector=>selector==='img'?[image]:[];
 const pending=waitForScreenRender(root).then(()=>events.push('ready'));await Promise.resolve();assert.deepEqual(events,[]);release();await pending;assert.deepEqual(events,['decoded','ready']);assert.equal(image.loading,'lazy');assert.equal(frames,3);
 image.decode=async()=>{throw Error('Image failed');};await assert.rejects(()=>waitForScreenRender(root),/Image failed/);assert.equal(image.loading,'lazy');
});


test('installed preferred-format filter drops alternating font subsets; unfiltered embedding preserves all sources',async()=>{
 const {embedResources}=require('html-to-image/lib/embed-resources.js');
 const rules=[0,1,2,3].map((_,i)=>`@font-face{font-family:'StudyFont';font-weight:${i<2?400:700};src:url("data:font/woff2;base64,AA==") format("woff2");unicode-range:${i%2?'U+0-FF':'U+100-2BA'};}`);
 const broken=[];for(const rule of rules)broken.push(await embedResources(rule,null,{preferredFontFormat:'woff2'}));assert.equal(broken.filter(rule=>/src:/.test(rule)).length,2);
 const fixed=[];for(const rule of rules)fixed.push(await embedResources(rule,null,{}));assert.equal(fixed.filter(rule=>/src:/.test(rule)).length,4);
 const {root}=fixture();await assert.rejects(()=>embedScreenFonts(root,async()=>broken.join('')),/font subset has no embedded source/);
});


test('export-only font rules preserve exact original sizes without mutating live elements',()=>{
 const {screenFontSizeCSS}=load('lib/screen-render-readiness.ts');
 const child={getAttribute:()=> 'oui-e-24',fontSize:'13px'},fractional={getAttribute:()=> 'oui-e-25',fontSize:'14.75px'};
 const root={getAttribute:()=>null,fontSize:'16px',querySelectorAll:()=>[child,fractional],ownerDocument:{defaultView:{getComputedStyle:node=>({fontSize:node.fontSize})}}};
 const before=child.fontSize,css=screenFontSizeCSS(root);assert.match(css,/foreignObject > :first-child\{font-size:16px!important\}/);assert.match(css,/oui-e-24"\]\{font-size:13px!important\}/);assert.match(css,/oui-e-25"\]\{font-size:14.75px!important\}/);assert.equal(child.fontSize,before);assert.equal(css.includes('12.9px'),false);
});
