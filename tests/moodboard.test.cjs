const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const filename=path.resolve(file),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.prototype.require.call(m,name);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function moodboardHarness(fetcher,initial=[]){
 const slots=[];let cursor=0,images=[],dirty=false,effects=[],current,refreshes=0,guide=initial;const revoked=[],messages=[];
 const globals={fetch:global.fetch,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let blobs=0;
 global.fetch=fetcher;URL.createObjectURL=()=>`blob:local-${++blobs}`;URL.revokeObjectURL=url=>revoked.push(url);
 const hooks={useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return[slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!deps.every((v,j)=>Object.is(v,slots[i].deps[j]))){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}}};
 const form={watch:()=>images,getValues:()=>images,setValue:(_,value)=>{images=value;dirty=true;}};
 const {useMoodBoard}=load('hooks/use-styles.ts',{react:hooks,'next/navigation':{useRouter:()=>({refresh:()=>refreshes++}),useSearchParams:()=>new URLSearchParams('project=project')},'react-hook-form':{useForm:()=>form},sonner:{toast:{error:msg=>messages.push(msg),success(){}}},'@/redux/api/style-guide':{},'@/redux/slice/shapes':{},'@/redux/store':{}});
 function render(){cursor=0;dirty=false;current=useMoodBoard(guide);const queue=effects;effects=[];queue.forEach(fn=>fn());return current;}
 async function settle(){for(let i=0;i<15;i++){if(dirty)render();await tick();if(!dirty)return current;}throw Error('Moodboard effects did not settle');}
 render();return{render,settle,get current(){return current;},get images(){return images;},revoked,messages,get refreshes(){return refreshes;},setGuide(value){guide=value;render();},dispose(){for(const slot of slots)slot?.cleanup?.();global.fetch=globals.fetch;URL.createObjectURL=globals.create;URL.revokeObjectURL=globals.revoke;}};
}
const file=name=>new File([Buffer.from('image fixture')],name,{type:'image/jpeg'});

test('multiple uploads retain all cards, upload each file once and switch to durable API URLs',async()=>{
 const calls=[];const h=moodboardHarness(async(url,options)=>{const name=options.body.get('file').name;calls.push(name);return Response.json({storageId:name,url:'/api/uploads/moodboard/project/'+name});});
 try{h.current.handleFileInput({target:{files:[file('one.jpg'),file('two.jpg'),file('three.jpg')],value:'files'}});assert.equal(h.images.length,3);await h.settle();assert.deepEqual(calls.sort(),['one.jpg','three.jpg','two.jpg']);assert.equal(h.images.length,3);for(const image of h.images){assert.equal(image.uploaded,true);assert.equal(image.uploading,false);assert.equal(image.preview,image.url);assert.match(image.preview,/^\/api\/uploads\//);}assert.equal(h.revoked.length,0);h.render();await h.settle();assert.equal(calls.length,3);const firstID=h.images[0].id;h.setGuide(h.images.map(img=>({_id:img.storageId,url:img.url})));await h.settle();assert.equal(h.images.length,3);assert.equal(h.images[0].id,firstID);}finally{h.dispose();}assert.equal(h.revoked.length,3);
});

test('failed and invalid upload responses never mark a local preview as successfully uploaded',async()=>{
 for(const response of [()=>Response.json({error:'Storage unavailable'},{status:500}),()=>Response.json({storageId:'saved-but-no-url'})]){
  const h=moodboardHarness(async()=>response());try{h.current.addImage(file('failed.jpg'));await h.settle();assert.equal(h.images[0].uploaded,false);assert.equal(h.images[0].uploading,false);assert.ok(h.images[0].error);assert.match(h.images[0].preview,/^blob:/);assert.equal(h.refreshes,0);}finally{h.dispose();}
 }
});

test('saved Moodboard URLs load on remount without reuploading and additions enforce the batch limit',async()=>{
 const stored=[{_id:'existing',url:'/api/uploads/moodboard/project/existing.jpg'}];let calls=0;
 const h=moodboardHarness(async()=>{calls++;return Response.json({error:'offline'},{status:503});},stored);
 try{await h.settle();assert.equal(h.images[0].preview,stored[0].url);assert.equal(h.images[0].uploaded,true);assert.equal(calls,0);for(let i=0;i<6;i++)h.current.addImage(file(i+'.jpg'));assert.equal(h.images.length,5);assert.ok(h.messages.some(msg=>msg.includes('Maximum')));await h.settle();assert.equal(calls,4);}finally{h.dispose();}
 const reopened=moodboardHarness(async()=>{throw Error('No upload expected');},stored);try{await reopened.settle();assert.equal(reopened.images[0].preview,stored[0].url);}finally{reopened.dispose();}
});

function children(node){if(!node||typeof node!=='object')return[];return[node,...(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];}
test('card uses an authenticated direct image URL, requires onLoad for success and reports decode errors',()=>{
 let state=null;const Image=()=>null;
 const Board=load('components/style/moodboard/images.board.tsx',{'next/image':{__esModule:true,default:Image},react:{...require('react'),useState:()=>[state,value=>{state=value;}]}}).default;
 const props={image:{id:'id',preview:'/api/uploads/moodboard/p/a.jpg',uploaded:true,uploading:false},removeImage(){},xOffset:5,yOffset:9,rotation:12,zIndex:1,marginLeft:'0',marginTop:'0'};
 let tree=Board(props),nodes=children(tree),img=nodes.find(node=>node.type===Image),status=nodes.find(node=>typeof node.type==='function'&&node.type!==Image);
 assert.equal(img.props.unoptimized,true);assert.equal(img.props.src,props.image.preview);assert.equal(status.props.uploaded,false);assert.match(tree.props.style.transform,/rotate\(12deg\)/);
 img.props.onLoad();nodes=children(Board(props));status=nodes.find(node=>typeof node.type==='function'&&node.type!==Image);assert.equal(status.props.uploaded,true);
 nodes.find(node=>node.type===Image).props.onError();nodes=children(Board(props));status=nodes.find(node=>typeof node.type==='function'&&node.type!==Image);assert.equal(status.props.uploaded,false);assert.match(status.props.error,/could not load/);assert.ok(children(status.type(status.props)).some(node=>node.props?.role==='alert'));
 const changed=children(Board({...props,image:{...props.image,preview:'/api/uploads/other.jpg'}})).find(node=>typeof node.type==='function'&&node.type!==Image);assert.equal(changed.props.uploaded,false);
 const failure=children(Board({...props,image:{...props.image,error:'Upload failed'}})).find(node=>typeof node.type==='function'&&node.type!==Image);assert.ok(children(failure.type(failure.props)).some(node=>node.props?.role==='alert'));
});

test('Next image optimizer loses cookies; protected uploads reject it while direct authenticated requests pass',async()=>{
 const {fetchInternalImage}=require('next/dist/server/image-optimizer');const {NextRequest}=require('next/server');
 const {proxy}=load('proxy.ts',{'@/lib/firebase/verify-token':{AUTH_COOKIE:'session',EmailVerificationRequiredError:class extends Error{},verifyFirebaseToken:async()=>({sub:'user',plan:'lifetime'})}});
 const href='/api/uploads/moodboard/project/a.jpg';const direct=await proxy(new NextRequest('http://localhost'+href,{headers:{cookie:'session=valid'}}));assert.equal(direct.headers.get('x-middleware-next'),'1');
 let internalStatus;
 await fetchInternalImage(href,{method:'GET',headers:{cookie:'session=valid'},socket:null},{},5*1024*1024,async(req,res)=>{
  assert.equal(req.headers.cookie,undefined);const response=await proxy(new NextRequest('http://localhost'+href,{headers:req.headers}));internalStatus=response.status;res.statusCode=response.status;res.setHeader('Content-Type',response.headers.get('content-type'));res.end(await response.text());
 });assert.equal(internalStatus,401);
});

test('stored URLs encode filenames and persisted JFIF files return an image MIME type',async()=>{
 const records=[{id:'saved',projectId:'p',filePath:'moodboard/p/a #1%?.jfif',createdAt:new Date()}];
 const db=load('lib/db/images.ts',{'../db':{prisma:{moodBoardImage:{findMany:async()=>records}}}});const images=await db.getMoodBoardImages('p');assert.equal(images[0].url,'/api/uploads/moodboard/p/a%20%231%25%3F.jfif');
 const bytes=Buffer.from([0xff,0xd8,0xff,0xd9]);const route=load('app/api/uploads/[...path]/route.ts',{'fs/promises':{__esModule:true,default:{readFile:async()=>bytes}}});const response=await route.GET(new Request('http://localhost/api/uploads/moodboard/p/a.jfif'),{params:Promise.resolve({path:['moodboard','p','a.jfif']})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
});
