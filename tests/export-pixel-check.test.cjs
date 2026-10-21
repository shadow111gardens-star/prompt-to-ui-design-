const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditSVG,safePixelDifference}=require('./export-layout-pixels.js');
test('SVG resource audit distinguishes embedded foreignObject from external rendering resources',()=>{
 const old=global.location;global.location={href:'http://localhost/check'};try{
  assert.deepEqual(auditSVG('<svg><foreignObject><img src="data:image/png;base64,AA=="/><style>@font-face{src:url(data:font/woff2;base64,AA==)}</style></foreignObject></svg>'),{foreignObject:true,externalRenderResources:[]});
  assert.deepEqual(auditSVG('<svg><style>.a{fill:url(%23g)}</style></svg>').externalRenderResources,[]);
  assert.deepEqual(auditSVG('<svg><image href="https://example.com/image.png?private=redacted"/></svg>').externalRenderResources,['https://example.com/image.png']);
 }finally{global.location=old;}
});
test('pixel comparison loads data URLs and records blocked readback as skipped without crashing',async()=>{
 const old={Image:global.Image,FileReader:global.FileReader,document:global.document};let sources=[],reads=0,blocked=true;
 global.FileReader=class{readAsDataURL(blob){this.result='data:'+blob.type+';base64,AA==';queueMicrotask(()=>this.onload());}};
 global.Image=class{set src(value){sources.push(value);}async decode(){assert.equal(this.crossOrigin,'anonymous');}};
 global.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData(){reads++;if(blocked)throw new DOMException('Tainted','SecurityError');return{data:new Uint8ClampedArray([1,2,3,255])};}})})};
 try{
  const blob=new Blob(['svg'],{type:'image/svg+xml'}),audit={foreignObject:true,externalRenderResources:[]};const skipped=await safePixelDifference(blob,blob,10,10,audit);assert.equal(skipped.status,'skipped');assert.equal(skipped.errorType,'SecurityError');assert.equal(skipped.resourceAudit,audit);assert.ok(sources.every(url=>url.startsWith('data:')));
  blocked=false;const compared=await safePixelDifference(blob,blob,10,10);assert.equal(compared.status,'compared');assert.equal(compared.meanAbsoluteChannelDifference,0);
  const prior=reads;const external=await safePixelDifference(blob,blob,10,10,{externalRenderResources:['https://example.com/image.png']});assert.equal(external.status,'skipped');assert.equal(reads,prior);
 }finally{Object.assign(global,old);}
});
