const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(source){const filename=path.resolve(source);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=function(request){if(Object.hasOwn(mocks,request))return mocks[request];if(request.startsWith('@/'))return load(request.slice(2)+'.ts');return Module.prototype.require.call(this,request);};mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}return load;}
const load=loader(),{createPixabaySearch,IMAGE_CACHE_MS,ImageServiceError,imageScore,publicImageResults}=load('lib/images/pixabay.ts');const {createImageAssetStore}=load('lib/images/asset-store.ts');
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSp0AAAAASUVORK5CYII=','base64');
const hit=(id,tags='beach tropical sand')=>({id,pageURL:`https://pixabay.com/photos/image-${id}/`,previewURL:`https://cdn.pixabay.com/photo/2024/01/01/${id}_150.jpg`,downloadURL:`https://cdn.pixabay.com/photo/2024/01/01/${id}_1280.jpg`,width:1600,height:1000,tags,author:'Test Creator',likes:30,downloads:100});
const rawHit=id=>({id,pageURL:`https://pixabay.com/photos/image-${id}/`,previewURL:`https://cdn.pixabay.com/photo/2024/01/01/${id}_150.jpg`,largeImageURL:`https://cdn.pixabay.com/photo/2024/01/01/${id}_1280.jpg`,webformatURL:`https://cdn.pixabay.com/photo/2024/01/01/${id}_640.jpg`,imageWidth:1600,imageHeight:1000,tags:'beach sand',user:'Creator'});
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openui-images-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('Pixabay search validates/encodes filters, caches for 24h across restarts and never returns the API key',async t=>{
 const dir=temp(t);let now=1000,calls=0;const secret='synthetic-private-api-key';const fetcher=async(url,options)=>{calls++;assert.equal(url.origin+url.pathname,'https://pixabay.com/api/');assert.equal(url.searchParams.get('q'),'beach & ocean');assert.equal(url.searchParams.get('image_type'),'photo');assert.equal(url.searchParams.get('orientation'),'horizontal');assert.equal(url.searchParams.get('safesearch'),'true');assert.equal(options.redirect,'error');return Response.json({totalHits:1,hits:[rawHit(1)]});};
 const service=createPixabaySearch(dir,()=>secret,fetcher,()=>now);const query={q:'Beach & Ocean',orientation:'horizontal',category:'travel'};
 const results=await Promise.all([service.search(query),service.search(query)]);assert.equal(calls,1);assert.equal(results[0].expiresAt,now+IMAGE_CACHE_MS);assert.equal(JSON.stringify(publicImageResults(results[0])).includes(secret),false);assert.equal(JSON.stringify(publicImageResults(results[0])).includes('downloadURL'),false);assert.equal(fs.readFileSync(path.join(dir,results[0].cacheKey+'.json'),'utf8').includes(secret),false);
 await createPixabaySearch(dir,()=>secret,fetcher,()=>now).search(query);assert.equal(calls,1);now+=IMAGE_CACHE_MS+1;await service.search(query);assert.equal(calls,2);await assert.rejects(()=>service.search({q:'a',orientation:'sideways'}));await assert.rejects(()=>service.search({q:'beach',minWidth:-1}));
});
test('missing keys, malformed results and rate limits fail safely without leaking upstream responses',async t=>{
 const directory=temp(t);await assert.rejects(()=>createPixabaySearch(directory,()=>undefined).search({q:'beach'}),error=>error.code==='IMAGE_KEY_MISSING');
 let calls=0;const service=createPixabaySearch(directory,()=> 'secret',async()=>{calls++;return new Response('secret raw upstream',{status:429,headers:{'X-RateLimit-Reset':'120'}});});for(let i=0;i<2;i++)await assert.rejects(()=>service.search({q:'beach'}),error=>error.status===429&&!error.message.includes('secret'));assert.equal(calls,1);
 await assert.rejects(()=>createPixabaySearch(directory,()=> 'secret',async()=>Response.json({hits:'bad'})).search({q:'flowers'}),/invalid response/);
 const filtered=await createPixabaySearch(directory,()=> 'secret',async()=>Response.json({totalHits:1,hits:[{...rawHit(3),largeImageURL:'http://127.0.0.1/private'}]})).search({q:'river'});assert.equal(filtered.hits.length,0);
});
test('selected assets persist locally per user, reject hostile URLs/redirects and validate raster uploads',async t=>{
 const dir=temp(t);let calls=0;const fetcher=async()=>{calls++;return new Response(pixel,{headers:{'content-type':'image/png'}});};const store=createImageAssetStore(dir,fetcher);
 const saved=await store.importHit('alice','project',hit(10),'A tropical beach');assert.equal(saved.width,1);assert.equal(saved.height,1);assert.ok((await createImageAssetStore(dir,fetcher).read(saved.id,'alice')).data.equals(pixel));await store.importHit('alice','project',hit(10),'A tropical beach');assert.equal(calls,1);await assert.rejects(()=>store.read(saved.id,'bob'),/not found/);
 await assert.rejects(()=>store.importHit('alice','project',{...hit(11),downloadURL:'http://127.0.0.1/admin'},'Bad'),/Invalid image source/);assert.equal(calls,1);
 const redirected=createImageAssetStore(path.join(dir,'redirect'),async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}}));await assert.rejects(()=>redirected.importHit('alice','project',hit(12),'Bad'),/Invalid image source/);
 await assert.rejects(()=>store.save('alice','project',Buffer.from('<svg onload="alert(1)"/>'),'Unsafe'),/valid PNG/);const uploaded=await store.save('alice','project',pixel,'My own image');assert.equal(uploaded.source,'upload');
});
test('image downloads respect upstream rate-limit cooldown rather than retrying repeatedly',async t=>{let calls=0;const store=createImageAssetStore(temp(t),async()=>{calls++;return new Response('Busy',{status:429,headers:{'retry-after':'60'}});});for(const id of [1,2])await assert.rejects(()=>store.importHit('a','p',hit(id),'beach'),error=>error.status===429);assert.equal(calls,1);});
test('five website categories receive distinct relevant assets while preserving responsive layout/crop/alt/loading',async()=>{
 const {createImageHydrator}=load('lib/images/hydrate-html.ts');let id=0;
 for(const [category,subjects]of [['travel',['beach sand','mountain lake','hotel pool']],['food',['pizza tomatoes','pasta basil','coffee beans']],['ecommerce',['running shoes','leather bag','cotton shirt']],['real-estate',['house interior','modern kitchen','garden terrace']],['fitness',['gym equipment','yoga exercise','running workout']]]){
  const queries=[],selected=[];const hydrate=createImageHydrator('user','project',category,{search:async input=>{queries.push(input.q);return {cacheKey:'x',expiresAt:1,total:3,hits:[hit(++id,input.q),hit(++id,'unrelated airplane cloud')]};},importHit:async(_uid,_project,h,alt)=>{selected.push(h.id);return{id:`00000000-0000-4000-8000-${String(h.id).padStart(12,'0')}`,source:'pixabay',alt,sourcePage:h.pageURL,author:h.author};}});
  const html='<div class="grid grid-cols-1 md:grid-cols-3">'+subjects.map((subject,i)=>`<img src="" data-image-query="${subject}" data-image-role="${i?'card':'hero'}" alt="${subject}" class="w-full aspect-[4/3] object-cover rounded-xl" width="800" height="600">`).join('')+'</div>';
  const output=await hydrate.html(html);assert.equal(queries.length,3);assert.equal(new Set(selected).size,3);assert.match(output,/grid-cols-1 md:grid-cols-3/);assert.match(output,/object-cover rounded-xl/);assert.match(output,/loading="eager"/);assert.match(output,/loading="lazy"/);assert.match(output,/decoding="async"/);assert.equal((output.match(/data-openui-asset=/g)||[]).length,3);assert.equal(output.includes('src=""'),false);assert.equal(hydrate.warnings.size,0);
 }
 assert.equal(imageScore(hit(1,'airplane cloud'),'pizza tomatoes',4/3),-Infinity);
});
test('broader retry avoids unrelated substitutes and repeated image IDs; SaaS product UI and uploaded assets remain genuine',async()=>{
 const {createImageHydrator}=load('lib/images/hydrate-html.ts');const queries=[];let downloads=0;
 const service=createImageHydrator('u','p','travel',{search:async input=>{queries.push(input.q);return {hits:input.q==='tropical beach sunset'?[]:[hit(1)],total:1,expiresAt:1,cacheKey:'x'};},importHit:async()=>{downloads++;return{id:'00000000-0000-4000-8000-000000000001',source:'pixabay'};}});
 const result=await service.html('<img data-image-query="tropical beach sunset" alt="Beach"><img data-image-query="tropical beach sunset" alt="Other beach"><img data-image-role="product-ui" alt="Analytics dashboard screenshot"><img src="/api/uploads/project/photo.jpg" alt="Uploaded work">');assert.deepEqual(queries,['tropical beach sunset','tropical beach']);assert.equal(downloads,1);assert.match(result,/data:image\/svg\+xml/);assert.match(result,/src="\/api\/uploads\/project\/photo.jpg"/);assert.ok(service.warnings.size>0);
 const unavailable=createImageHydrator('u','p','food',{search:async()=>{throw new ImageServiceError('Image search unavailable');},importHit:async()=>{throw Error('must not run');}});const fallback=await unavailable.html('<img alt="Pizza" data-image-query="pizza tomatoes">');assert.match(fallback,/data:image\/svg\+xml/);assert.ok(unavailable.warnings.has('Image search unavailable'));
});
test('stream transformation emits final replacement for HTML and structured project-chat without appending a second page',async()=>{
 const {hydrateImageStream}=loader({'@/lib/db':{prisma:{}}})('lib/images/generation-pipeline.ts'),{parseSSEStream}=load('lib/stream-utils.ts');
 for(const source of ['<main><img data-image-query="beach"></main>',JSON.stringify({message:'Created',actions:[{type:'create',html:'<main><img data-image-query="beach"></main>'}]})]){
  const response=new Response('data: '+JSON.stringify({streamId:'x',text:source})+'\n\n',{headers:{'content-type':'text/event-stream'}});
  const transformed=hydrateImageStream(response,async value=>value.replace('data-image-query="beach"','src="/api/images/assets/00000000-0000-4000-8000-000000000001"'),new Set());let final;const output=await parseSSEStream(transformed.body.getReader(),'x',value=>final=value);assert.equal(final,output);assert.equal((output.match(/<main>/g)||[]).length,1);
 }
 const failed=new Response('data: '+JSON.stringify({streamId:'e',type:'error',error:'Provider failed'})+'\n\n',{headers:{'content-type':'text/event-stream'}});let called=false;await assert.rejects(()=>parseSSEStream(hydrateImageStream(failed,async()=>{called=true;return '';},new Set()).body.getReader(),'e',()=>{}),/Provider failed/);assert.equal(called,false);
});
test('actual autosave/reopen flow retains image selections, and HTML/code export embeds bytes once',async t=>{
 const dir=temp(t),store=createImageAssetStore(dir);const asset=await store.save('alice','project',pixel,'Uploaded project');const url='/api/images/assets/'+asset.id;let persisted;
 const mocks={'@/lib/db':{prisma:{project:{update:async({data})=>{persisted={id:'project',...data,viewportData:null,lastModified:new Date(),createdAt:new Date()};},findUnique:async()=>persisted}}}};
 const modules=loader(mocks);const autosave=modules('app/api/autosave/route.ts');const html=`<img src="${url}" alt="Uploaded project" class="w-full rounded-xl object-cover">`;
 const response=await autosave.POST(new Request('http://localhost/api/autosave',{method:'POST',body:JSON.stringify({projectId:'project',shapesData:{shapes:{ids:['screen'],entities:{screen:{id:'screen',type:'generatedui',uiSpecData:html}}}}})}));assert.equal(response.status,200);
 const {getProject}=modules('lib/db/projects.ts');const reopened=await getProject('project');assert.equal(reopened.sketchesData.shapes.entities.screen.uiSpecData,html);assert.ok((await createImageAssetStore(dir).read(asset.id,'alice')).data.equals(pixel));
 const {makeImagesPortable}=load('lib/images/portable-assets.ts');let fetches=0;const portable=await makeImagesPortable(html+`<style>.hero{background-image:url('${url}')}</style>`,async(request,options)=>{fetches++;assert.equal(options.credentials,'same-origin');assert.equal(request,url);return new Response(pixel,{headers:{'content-type':'image/png'}});});assert.equal(fetches,1);assert.equal(portable.includes('/api/images/assets/'),false);assert.match(portable,/data:image\/png;base64,/);assert.match(portable,/object-cover/);
 await assert.rejects(()=>makeImagesPortable(html,async()=>new Response('',{status:401})),/Sign in/);
});

test('image API routes enforce authentication, origin, validated filters, expired selections and private asset reads',async t=>{
 const store=createImageAssetStore(temp(t));
 const mocks={
  '@/lib/ai/personal-provider-auth':{personalProviderIdentity:async request=>{if(request.headers.get('authorization')!=='test-user')throw Error('Unauthorized');return{sub:'alice'};}},
  '@/lib/db':{prisma:{project:{findUnique:async({where})=>where.id==='project'?{id:'project'}:null}}},
  '@/lib/images/asset-store':{imageAssets:store,assetUrl:id=>'/api/images/assets/'+id,MAX_IMAGE_BYTES:10*1024*1024},
  '@/lib/images/pixabay':{...load('lib/images/pixabay.ts'),pixabay:{search:async input=>({cacheKey:'a'.repeat(64),query:input.q,hits:[hit(1)],total:1,expiresAt:Date.now()+86400000}),cached:async()=>null}}
 };
 const modules=loader(mocks),search=modules('app/api/images/search/route.ts'),assets=modules('app/api/images/assets/route.ts'),serve=modules('app/api/images/assets/[id]/route.ts');
 const headers={authorization:'test-user',origin:'http://localhost'};
 assert.equal((await search.GET(new Request('http://localhost/api/images/search?q=beach'))).status,401);
 assert.equal((await search.GET(new Request('http://localhost/api/images/search?q=x',{headers}))).status,400);
 const found=await search.GET(new Request('http://localhost/api/images/search?q=beach',{headers}));assert.equal(found.status,200);assert.equal(found.headers.get('vary'),'Cookie');assert.equal(JSON.stringify(await found.json()).includes('downloadURL'),false);
 const body=JSON.stringify({projectId:'project',cacheKey:'a'.repeat(64),imageId:1,alt:'Beach'});
 assert.equal((await assets.POST(new Request('http://localhost/api/images/assets',{method:'POST',headers:{...headers,origin:'https://evil.example'},body}))).status,403);
 assert.equal((await assets.POST(new Request('http://localhost/api/images/assets',{method:'POST',headers,body}))).status,410);
 const form=new FormData();form.set('projectId','project');form.set('alt','User image');form.set('file',new File([pixel],'photo.png',{type:'image/png'}));
 const upload=await assets.POST(new Request('http://localhost/api/images/assets',{method:'POST',headers,body:form}));assert.equal(upload.status,200);const saved=await upload.json();
 const response=await serve.GET(new Request('http://localhost/api/images/assets/'+saved.id,{headers}),{params:Promise.resolve({id:saved.id})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),pixel);
 assert.equal((await serve.GET(new Request('http://localhost/api/images/assets/'+saved.id),{params:Promise.resolve({id:saved.id})})).status,401);
});

test('image replacement edits persist metadata and crop while restricting CSS asset URLs',()=>{
 const {imageReplacementPatch}=load('lib/images/image-replacement.ts'),{patchElementHtml}=load('lib/element-editing.ts');
 const id='00000000-0000-4000-8000-000000000001',url='/api/images/assets/'+id;
 const patch=imageReplacementPatch(url,'New beach',id,'beach');assert.equal(patch.attributes.src,url);assert.equal(patch.attributes.srcset,null);
 const patched=patchElementHtml('<img data-openui-element="img1" src="old.jpg" class="w-full object-cover rounded-xl">','img1',patch);assert.match(patched,/object-cover rounded-xl/);assert.ok(patched.includes(url));
 const bg=imageReplacementPatch(url,'Mountain',id,'mountain',true);assert.match(bg.styles['background-image'],/api\/images\/assets/);assert.ok(patchElementHtml('<div data-openui-element="bg1" style="background-size:cover"></div>','bg1',bg).includes(url));assert.throws(()=>patchElementHtml('<div data-openui-element="bg1"></div>','bg1',{styles:{'background-image':'url(https://evil.example/a.jpg)'}}),/Unsupported style/);
 assert.throws(()=>imageReplacementPatch('https://evil.example/a.jpg','Bad',id,''));
});

test('image contract joins the existing model context and preserves uploaded assets without stock product screenshots',async()=>{
 const {generatedImageContext,imageContractMiddleware,withImageContract}=load('lib/images/generation-context.ts');const model={unchanged:true};assert.equal(withImageContract(model),model);
 await generatedImageContext.run({uid:'a',projectId:'p',prompt:'portfolio',uploaded:['/api/uploads/p/work.png']},async()=>{const result=await imageContractMiddleware().transformParams({params:{prompt:[{role:'user',content:'Build a portfolio'}]}});assert.equal(result.prompt[1].content,'Build a portfolio');assert.equal(result.prompt[0].role,'system');assert.match(result.prompt[0].content,/data-image-query/);assert.match(result.prompt[0].content,/\/api\/uploads\/p\/work.png/);assert.match(result.prompt[0].content,/screenshot/i);});
});
