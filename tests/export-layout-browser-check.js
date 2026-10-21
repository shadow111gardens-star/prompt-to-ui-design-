/* Browser-only acceptance harness. Uses actual saved content and production exports. */
const exportsCache={},downloads=[];
const RUN_VERSION='4-exact-font-sizes';
function save(blob,name){downloads.push({name,blob});}
function requireModule(name){
 if(name==='html-to-image')return window.htmlToImage;
 if(name==='jszip')return window.JSZip;
 if(name==='@/lib/frame-snapshot')return{downloadBlob:save};
 if(exportsCache[name])return exportsCache[name].exports;
 const source=window.EXPORT_MODULES[name];if(!source)throw Error('Missing module '+name);
 const module={exports:{}};exportsCache[name]=module;
 new Function('require','module','exports',source)(requireModule,module,module.exports);return module.exports;
}
const {captureScreenImage,downloadScreenImages}=requireModule('@/lib/screen-image-export');
const {renderedScreenHTML}=requireModule('@/lib/screen-html-export');
const {parseHtmlDocument,cleanBodyClass,normalizePreviewSizing}=requireModule('@/lib/html-parser');
const {identifyHtmlElements}=requireModule('@/lib/element-editing');
const {waitForScreenRender}=requireModule('@/lib/screen-render-readiness');
function iframeLoad(frame,html){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview loading timed out')),30000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=html;});}
const box=r=>({x:r.x,y:r.y,w:r.width,h:r.height});
function metrics(root){
 return [...root.querySelectorAll('[data-openui-element]')].map(node=>{
  const bounds=node.getBoundingClientRect(),style=node.ownerDocument.defaultView.getComputedStyle(node),texts=[];
  for(const text of node.childNodes){if(text.nodeType!==3||!text.textContent.trim())continue;const range=node.ownerDocument.createRange();range.selectNodeContents(text);texts.push(...[...range.getClientRects()].filter(r=>r.width&&r.height).map(box));}
  const lines=new Set(texts.map(rect=>Math.round(rect.y*2)/2)).size;
  return{id:node.getAttribute('data-openui-element'),tag:node.tagName,text:[...node.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),...box(bounds),font:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,whiteSpace:style.whiteSpace,overflowX:style.overflowX,overflowY:style.overflowY,textRects:texts,textLines:lines,textOverflow:texts.some(r=>r.x<bounds.x-1||r.y<bounds.y-1||r.x+r.w>bounds.right+1||r.y+r.h>bounds.bottom+1)};
 });
}
function compare(before,after){
 if(!before.length||!after.length)throw Error('No elements measured; empty geometry is not a passing test.');
 const originals=new Map(before.map(node=>[node.id,node])),seen=new Set(),geometry=[],textLayout=[];
 const differs=(a,b)=>['x','y','w','h'].some(key=>Math.abs(a[key]-b[key])>1);
 for(const current of after){const original=originals.get(current.id);seen.add(current.id);if(!original||differs(original,current))geometry.push({before:original,after:current});if(original?.text&&(original.textLines!==current.textLines||original.textRects.length!==current.textRects.length||current.textRects.some((r,i)=>!original.textRects[i]||differs(original.textRects[i],r))||!original.textOverflow&&current.textOverflow))textLayout.push({before:original,after:current});}
 for(const original of before)if(!seen.has(original.id))geometry.push({before:original,after:null});
 return{elementsCompared:before.length,geometryMismatches:geometry.length,textLayoutMismatches:textLayout.length,introducedTextOverflow:textLayout.filter(m=>!m.before.textOverflow&&m.after.textOverflow).length,geometry,textLayout};
}
async function showBlob(parent,blob,width,label){const pane=document.createElement('div'),caption=document.createElement('strong');caption.textContent=label||'Export';pane.appendChild(caption);pane.appendChild(document.createElement('br'));const image=document.createElement('img');image.width=width;image.src=await ExportPixelCheck.blobDataURL(blob);pane.appendChild(image);parent.appendChild(pane);await image.decode();return{width:image.naturalWidth,height:image.naturalHeight};}
async function compareDocument(row,html,screen,before){
 const frame=document.createElement('iframe');frame.width=screen.w;frame.height=screen.h;frame.style.border='0';row.appendChild(frame);await iframeLoad(frame,html);const root=frame.contentDocument.getElementById('mockup-root');if(!root)throw Error('Export mockup root missing');await waitForScreenRender(root);const after=metrics(root),comparison=compare(before,after);frame.hidden=true;return{before,after,comparison};
}
let zip;
document.getElementById('run').onclick=async()=>{
 const status=document.getElementById('status');document.getElementById('run').disabled=true;downloads.length=0;zip=null;document.getElementById('cases').replaceChildren();const results=[];let currentResult;
 try{
  for(const screen of window.EXPORT_CASES){
   currentResult={screen:screen.screenName,errors:[]};results.push(currentResult);
   try{
   status.textContent=RUN_VERSION+': Rendering '+screen.screenName;
   // Canvas assigns IDs to every screen; the first harness omitted this step for Library.
   const parsed=parseHtmlDocument(normalizePreviewSizing(identifyHtmlElements(screen.uiSpecData)));
   const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=screen.screenName+' — source canvas | old PNG | new PNG | new JPG | SVG';section.appendChild(heading);const row=document.createElement('div');row.className='row';section.appendChild(row);document.getElementById('cases').appendChild(section);
   const frame=document.createElement('iframe');frame.dataset.openuiShape=screen.id;frame.width=screen.w;frame.height=screen.h;frame.style.width=screen.w+'px';frame.style.height=screen.h+'px';frame.style.border='0';frame.setAttribute('sandbox','allow-scripts allow-same-origin');const sourcePane=document.createElement('div');sourcePane.innerHTML='<strong>Source canvas at saved viewport</strong><br>';sourcePane.appendChild(frame);row.appendChild(sourcePane);
   const html='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"><\/script><style>:root{--color-primary:#FFFFFF;--color-secondary:#FAF8F5;--color-text:#2E2925;--font-heading:"Host Grotesk",sans-serif;--font-body:"DM Sans",sans-serif;--border-radius-button:9999px}body{font-family:var(--font-body);color:var(--color-text);background-color:transparent;margin:0;padding:0;overflow:hidden}h1,h2,h3,h4,h5,h6{font-family:var(--font-heading)}[data-generated-ui]{width:100%;display:flex;flex-direction:column;align-items:center}</style>'+parsed.headContent+'</head><body><div id="mockup-root" class="'+cleanBodyClass(parsed.bodyClass)+'" style="padding:0;box-sizing:border-box;width:100%;'+parsed.bodyStyle+'">'+parsed.bodyContent+'</div></body></html>';
   await iframeLoad(frame,html);const root=frame.contentDocument.getElementById('mockup-root');await waitForScreenRender(root);const before=metrics(root);currentResult.sourceFonts=[...frame.contentDocument.fonts].map(face=>({family:face.family,weight:face.weight,style:face.style,status:face.status,unicodeRange:face.unicodeRange}));
   const old=await window.htmlToImage.toBlob(root,{width:root.scrollWidth,height:root.scrollHeight,pixelRatio:2,backgroundColor:'#faf8f5'});save(old,screen.screenName+'-old.png');await showBlob(row,old,screen.w,'OLD PNG - known broken baseline');
   const dimensions={},blobs={},perFormatSource={};let svgComparison,svgAudit;
   for(const format of ['png','jpg','svg']){
    const blob=await captureScreenImage(screen,format);blobs[format]=blob;save(blob,screen.screenName+'.'+format);dimensions[format]=await showBlob(row,blob,screen.w,'NEW '+format.toUpperCase());await waitForScreenRender(root);perFormatSource[format]=compare(before,metrics(root));
    if(format==='svg'){
     const text=await blob.text();svgAudit=ExportPixelCheck.auditSVG(text);const faces=text.match(/@font-face\s*\{[^}]*\}/gi)||[];if(!faces.length||faces.some(face=>!face.includes('src:')))throw Error('SVG has a font subset without a source');
     svgComparison=await compareDocument(row,'<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body>'+text+'</body></html>',screen,before);
     svgComparison.sourcePerFormat=perFormatSource;save(new Blob([JSON.stringify(svgComparison,null,2)],{type:'application/json'}),screen.screenName+'-geometry.json');
    }
   }
   if(dimensions.png.width!==screen.w*2||dimensions.png.height!==screen.h*2||dimensions.jpg.width!==screen.w*2||dimensions.jpg.height!==screen.h*2||dimensions.svg.width!==screen.w||dimensions.svg.height!==screen.h)throw Error('Incorrect export dimensions');
   const standalone=await renderedScreenHTML(screen.id,screen.screenName),htmlComparison=await compareDocument(row,standalone,screen,before);save(new Blob([standalone],{type:'text/html'}),screen.screenName+'.html');save(new Blob([JSON.stringify(htmlComparison,null,2)],{type:'application/json'}),screen.screenName+'-html-geometry.json');
   const {geometry,textLayout,...svgSummary}=svgComparison.comparison,{geometry:unusedGeometry,textLayout:unusedText,...htmlSummary}=htmlComparison.comparison;
   Object.assign(currentResult,{dimensions,svgComparison:svgSummary,htmlComparison:htmlSummary,sourceStableAcrossFormats:Object.fromEntries(Object.entries(perFormatSource).map(([format,value])=>[format,{geometryMismatches:value.geometryMismatches,textLayoutMismatches:value.textLayoutMismatches}])),pixelComparisons:{pngVersusSvg:await ExportPixelCheck.safePixelDifference(blobs.png,blobs.svg,screen.w*2,screen.h*2,svgAudit),jpgVersusPng:await ExportPixelCheck.safePixelDifference(blobs.jpg,blobs.png,screen.w*2,screen.h*2)}});
   }catch(error){currentResult.errors.push({message:error.message,stack:error.stack});}
  }
  for(const format of ['png','jpg','svg']){try{await downloadScreenImages(window.EXPORT_CASES,format,true,()=>{});}catch(error){results.push({stage:'archive-'+format,error:error.message});}}
  const report={version:RUN_VERSION,results};zip=new window.JSZip();for(const item of downloads)zip.file(item.name,await item.blob.arrayBuffer());zip.file('results.json',JSON.stringify(report,null,2));status.textContent=JSON.stringify(report,null,2)+'\nInspect all previews. Zero box mismatches alone is not visual acceptance.';document.getElementById('download').disabled=false;
 }catch(error){results.push({stage:'harness',error:error.stack||error.message});status.textContent=JSON.stringify({version:RUN_VERSION,results},null,2);}finally{if(!zip){zip=new window.JSZip();for(const item of downloads)zip.file(item.name,await item.blob.arrayBuffer());zip.file('results.json',JSON.stringify({version:RUN_VERSION,results},null,2));}document.getElementById('download').disabled=false;document.getElementById('run').disabled=false;}
};
document.getElementById('download').onclick=async()=>{const blob=await zip.generateAsync({type:'blob'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='study-export-comparison-v4.zip';link.click();};

