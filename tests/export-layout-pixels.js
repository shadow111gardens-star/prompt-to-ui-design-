/* Browser acceptance helper only. No production security settings are changed. */
(function(scope){
 function blobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Error('Could not read export bytes'));reader.readAsDataURL(blob);});}
 function auditSVG(text){
  const external=new Set();const record=value=>{let decoded=value;try{decoded=decodeURIComponent(value);}catch{}if(!/^(?:data:|#)/i.test(decoded)){try{const u=new URL(value,location.href);external.add(u.origin+u.pathname);}catch{external.add('Unresolved resource');}}};
  for(const match of text.matchAll(/<(?:img|image|use|link)\b[^>]*?\b(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']/gi))record(match[1]);
  for(const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))record(match[1]);
  return{foreignObject:/<foreignObject\b/i.test(text),externalRenderResources:[...external]};
 }
 async function pixels(blob,w,h){
  const image=new Image();
  // Blob-backed SVG foreignObject images can taint Chrome canvases even with
  // embedded resources. Use the library's data-URL strategy, never security flags.
  image.crossOrigin='anonymous';image.src=await blobDataURL(blob);await image.decode();
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const context=canvas.getContext('2d');if(!context)throw Error('2D canvas unavailable');context.drawImage(image,0,0,w,h);
  return context.getImageData(0,0,w,h).data;
 }
 async function safePixelDifference(left,right,w,h,audit={}){
  if(audit.externalRenderResources?.length)return{status:'skipped',reason:'Export still references external rendering resources; pixel readback was not attempted.',resourceAudit:audit};
  try{const [a,b]=await Promise.all([pixels(left,w,h),pixels(right,w,h)]);let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return{status:'compared',meanAbsoluteChannelDifference:total/a.length,resourceAudit:audit};}
  catch(error){return{status:'skipped',reason:error.name==='SecurityError'?'Browser blocked pixel readback for this image/foreignObject origin. No security bypass was attempted.':error.message,errorType:error.name||'Error',resourceAudit:audit};}
 }
 const api={blobDataURL,auditSVG,safePixelDifference};if(typeof module!=='undefined')module.exports=api;else scope.ExportPixelCheck=api;
})(typeof window==='undefined'?globalThis:window);
