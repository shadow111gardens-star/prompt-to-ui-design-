const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Database=require('better-sqlite3');
const out=path.resolve('reports/export-layout/browser-check');fs.mkdirSync(out,{recursive:true});
const db=new Database('data/openui.db',{readonly:true,fileMustExist:true});
let project,screens;
for(const row of db.prepare('SELECT id,name,sketchesData,styleGuide FROM Project').all()){
 let data;try{data=JSON.parse(row.sketchesData);}catch{continue;}
 const items=Object.values(data.shapes?.entities||data.entities||{}).filter(s=>s?.type==='generatedui'&&s.uiSpecData);
 if(items.some(s=>/study|library/i.test(s.screenName||''))&&items.length>=2){project=row;screens=items;break;}
}db.close();if(!project)throw Error('No saved study canvas found.');
// Prefer the immutable source snapshot captured alongside the user's broken exports.
const snapshot=path.resolve('reports/export-layout/source');
for(let i=0;i<screens.length;i++){const name=screens[i].screenName,meta=path.join(snapshot,name+'.json'),html=path.join(snapshot,name+'.html');if(fs.existsSync(meta)&&fs.existsSync(html))screens[i]={...JSON.parse(fs.readFileSync(meta,'utf8')),uiSpecData:fs.readFileSync(html,'utf8')};}
const modules={};for(const name of ['lib/screen-render-readiness','lib/screen-image-export','lib/images/portable-assets','lib/screen-html-export','lib/html-parser','lib/element-editing'])modules['@/'+name]=ts.transpileModule(fs.readFileSync(name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
fs.copyFileSync('node_modules/html-to-image/dist/html-to-image.js',path.join(out,'html-to-image.js'));fs.copyFileSync('node_modules/jszip/dist/jszip.min.js',path.join(out,'jszip.min.js'));
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
fs.writeFileSync(path.join(out,'cases.js'),'window.EXPORT_CASES='+safeJSON(screens)+';\nwindow.EXPORT_MODULES='+safeJSON(modules)+';');
fs.writeFileSync(path.join(out,'index.html'),`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenUI real-screen export comparison</title><style>body{font:14px system-ui;margin:24px;background:#eee;color:#222}button{padding:12px;cursor:pointer}.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}iframe,img{border:1px solid #aaa;max-width:none}pre{white-space:pre-wrap}section{margin:24px 0}.status{font-weight:bold}</style></head><body><h1>Actual saved study screens: export comparison</h1><p>Uses the real saved HTML and current production capture modules. No AI generation or database writes. Network access is needed for the same Google fonts used in Canvas.</p><button id="run">Run comparison and create exports</button> <button id="download" disabled>Download generated export files + results</button><pre id="status"></pre><div id="cases"></div><script src="html-to-image.js"></script><script src="jszip.min.js"></script><script src="cases.js"></script><script src="pixels.js"></script><script src="check.js"></script></body></html>`);
fs.copyFileSync('tests/export-layout-pixels.js',path.join(out,'pixels.js'));
fs.copyFileSync('tests/export-layout-browser-check.js',path.join(out,'check.js'));
console.log(JSON.stringify({project:project.name,screens:screens.map(s=>({name:s.screenName,width:s.w,height:s.h})),open:path.join(out,'index.html')},null,2));
