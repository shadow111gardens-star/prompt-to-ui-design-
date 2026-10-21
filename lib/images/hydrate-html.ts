import { scanHtmlTags,htmlAttribute,setHtmlAttribute } from '@/lib/element-editing';
import { designedImageFallback,imageNeed,type ImageNeed } from '@/lib/images/image-contract';
import { pixabay,imageScore,ImageServiceError,type ImageHit,type ImageSearch } from '@/lib/images/pixabay';
import { imageAssets,assetUrl,type ImageAsset } from '@/lib/images/asset-store';
type Dependencies={search:(query:ImageSearch)=>ReturnType<typeof pixabay.search>;importHit:(uid:string,project:string,hit:ImageHit,alt:string)=>Promise<ImageAsset>};
const decode=(value:string)=>value.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'");
export function createImageHydrator(uid:string,projectId:string,prompt:string,dependencies:Dependencies={search:input=>pixabay.search(input),importHit:(...args)=>imageAssets.importHit(...args)}){
 const used=new Set<number>(),queries=new Map<string,Promise<ImageHit[]>>();let imported=0,unavailable=false;const deadline=Date.now()+25000;const warnings=new Set<string>();
 async function select(need:ImageNeed):Promise<ImageHit|undefined>{
  if(!need.query||need.product||unavailable||imported>=8||Date.now()>deadline)return;
  for(const query of [...new Set([need.query,need.broader])]){
   const queryKey=query+'|'+need.orientation;
   if(!queries.has(queryKey)){
    if(queries.size>=8)return;
    const input:ImageSearch={q:query,imageType:'photo',orientation:need.orientation,minWidth:need.role==='hero'?960:640,minHeight:360,page:1};
    queries.set(queryKey,dependencies.search(input).then(result=>result.hits).catch(error=>{warnings.add(error instanceof ImageServiceError?error.message:'Image search is unavailable.');unavailable=true;return [];}));
   }
   const hits=await queries.get(queryKey)!;const scored=hits.filter(hit=>!used.has(hit.id)&&hit.width>=640&&hit.height>=360).map(hit=>({hit,score:imageScore(hit,need.query,need.ratio)})).filter(item=>Number.isFinite(item.score)).sort((a,b)=>b.score-a.score);
   if(scored.length)return scored[0].hit;
  }
 }
 async function html(source:string){
  const edits:Array<{start:number;end:number;value:string}>=[];let order=0;
  for(const tag of scanHtmlTags(source)){
   if(tag.close)continue;const query=decode(htmlAttribute(tag.raw,'data-image-query')||''),isImage=tag.tag==='img';if(!isImage&&!query)continue;
   const src=decode(htmlAttribute(tag.raw,'src')||'');
   if(!isImage&&htmlAttribute(tag.raw,'data-openui-asset')&&/\/api\/images\/assets\//.test(htmlAttribute(tag.raw,'style')||''))continue;
   if(isImage&&(/^(?:\/api\/images\/assets\/|\/api\/uploads\/)/i.test(src)||/^data:image\//i.test(src)&&htmlAttribute(tag.raw,'data-openui-image-fallback')!=='true'||/^\/(?:[^/].*)$/.test(src)&&!/^\/(?:placeholder|image|api)/i.test(src)))continue;
   // Existing explicit non-placeholder image sources survive edits; AI-created unresolved slots use the contract.
   if(isImage&&!query&&/^https:\/\//.test(src)&&!/(?:placeholder|placehold|unsplash|picsum|pixabay)/i.test(src))continue;
   const role=htmlAttribute(tag.raw,'data-image-role')||(order===0?'hero':'card');const alt=decode(htmlAttribute(tag.raw,'alt')||'');const need=imageNeed(query,alt,role,prompt,Number(htmlAttribute(tag.raw,'width')),Number(htmlAttribute(tag.raw,'height')));let url=designedImageFallback(need.alt,need.product),asset:ImageAsset|undefined;
   const explicitOrientation=htmlAttribute(tag.raw,'data-image-orientation');if(explicitOrientation==='horizontal'||explicitOrientation==='vertical')need.orientation=explicitOrientation;
   const hit=await select(need);
   if(hit){used.add(hit.id);try{asset=await dependencies.importHit(uid,projectId,hit,need.alt);url=assetUrl(asset.id);imported++;}catch(error){warnings.add(error instanceof ImageServiceError?error.message:'A selected image could not be saved. Choose another image or upload your own.');if(error instanceof ImageServiceError&&error.status===429)unavailable=true;}}
   if(!asset&&!need.product)warnings.add('No suitable image was available for '+need.alt+'.');
   let opening=tag.raw;
   if(isImage){opening=setHtmlAttribute(opening,'src',url);opening=setHtmlAttribute(opening,'srcset',null);opening=setHtmlAttribute(opening,'alt',need.alt);opening=setHtmlAttribute(opening,'loading',order===0&&role==='hero'?'eager':'lazy');opening=setHtmlAttribute(opening,'decoding','async');opening=setHtmlAttribute(opening,'onerror',asset?`this.onerror=null;this.src=${JSON.stringify(designedImageFallback(need.alt,need.product))}`:null);}
   else {const original=decode(htmlAttribute(opening,'style')||'').replace(/background-image\s*:[^;]*(?:;|$)/gi,'');opening=setHtmlAttribute(opening,'style',original+`;background-image:url("${url}");${/background-size\s*:/i.test(original)?'':'background-size:cover;'}${/background-position\s*:/i.test(original)?'':'background-position:center;'}`);opening=setHtmlAttribute(opening,'role','img');opening=setHtmlAttribute(opening,'aria-label',need.alt);}
   if(asset){opening=setHtmlAttribute(opening,'data-openui-asset',asset.id);if(asset.sourcePage)opening=setHtmlAttribute(opening,'data-image-source',asset.sourcePage);if(asset.author)opening=setHtmlAttribute(opening,'data-image-author',asset.author);}
   opening=setHtmlAttribute(opening,'data-openui-image-fallback',asset?null:'true');
   opening=setHtmlAttribute(opening,'data-image-query',need.query);edits.push({start:tag.start,end:tag.end,value:opening});order++;
  }
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
  return source;
 }
 async function document(source:string):Promise<string>{
  const trimmed=source.trim().replace(/^```(?:json|html)?\s*/i,'').replace(/\s*```$/,'');
  if(trimmed.startsWith('{')||trimmed.startsWith('[')){
   let value:unknown;try{value=JSON.parse(trimmed);}catch{return source;}
   async function visit(node:unknown):Promise<unknown>{if(typeof node==='string'&&/<(?:img\b|[a-z][^>]*data-image-query)/i.test(node))return html(node);if(Array.isArray(node)){const items:unknown[]=[];for(const item of node)items.push(await visit(item));return items;}if(node&&typeof node==='object'){const result:Record<string,unknown>={};for(const [key,value]of Object.entries(node))result[key]=await visit(value);return result;}return node;}
   return JSON.stringify(await visit(value));
  }
  return html(source);
 }
 return {html,document,warnings};
}
