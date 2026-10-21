import { createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile,rename,rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
export const IMAGE_CACHE_MS=24*60*60*1000;
const categories=['backgrounds','fashion','nature','science','education','feelings','health','people','religion','places','animals','industry','computer','food','sports','transportation','travel','buildings','business','music'] as const;
export const imageSearchSchema=z.object({q:z.string().trim().min(2).max(100),imageType:z.enum(['all','photo','illustration','vector']).default('photo'),orientation:z.enum(['all','horizontal','vertical']).default('all'),category:z.enum(categories).optional(),minWidth:z.coerce.number().int().min(0).max(6000).default(640),minHeight:z.coerce.number().int().min(0).max(6000).default(360),page:z.coerce.number().int().min(1).max(25).default(1)}).strict();
export type ImageSearch=z.infer<typeof imageSearchSchema>;
export type ImageHit={id:number;pageURL:string;previewURL:string;downloadURL:string;webURL?:string;width:number;height:number;tags:string;author:string;likes:number;downloads:number};
export type SearchResult={cacheKey:string;query:string;hits:ImageHit[];total:number;expiresAt:number};
export class ImageServiceError extends Error{constructor(message:string,public status=503,public code='IMAGE_SERVICE_UNAVAILABLE'){super(message);}}
export function allowedPixabayUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['pixabay.com','cdn.pixabay.com'].includes(url.hostname)&&!url.search&&!url.hash&&/^\/(?:photo|illustrations|vectors|get|en|images|users)\//.test(url.pathname);}catch{return false;}}
const hitSchema=z.object({id:z.number().int().positive(),pageURL:z.string().url(),previewURL:z.string().url(),largeImageURL:z.string().url().optional(),webformatURL:z.string().url(),imageWidth:z.number().positive(),imageHeight:z.number().positive(),tags:z.string().max(2000),user:z.string().max(200),likes:z.number().nonnegative().optional(),downloads:z.number().nonnegative().optional()});
function isSourcePage(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pixabay.com'&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{return false;}}
export function createPixabaySearch(directory:string,key:()=>string|undefined,fetcher:typeof fetch=fetch,now:()=>number=Date.now){
 const inflight=new Map<string,Promise<SearchResult>>();let blockedUntil=0;
 async function cached(cacheKey:string):Promise<SearchResult|undefined>{if(!/^[a-f0-9]{64}$/.test(cacheKey))return;try{const data=JSON.parse(await readFile(path.join(directory,cacheKey+'.json'),'utf8')) as SearchResult;if(data.expiresAt>now()&&Array.isArray(data.hits)&&data.cacheKey===cacheKey)return data;}catch{} }
 async function search(raw:unknown):Promise<SearchResult>{
  const input=imageSearchSchema.parse(raw);const normalized={...input,q:input.q.replace(/\s+/g,' ').toLowerCase()};const cacheKey=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const previous=await cached(cacheKey);if(previous)return previous;if(inflight.has(cacheKey))return inflight.get(cacheKey)!;
  const operation=(async()=>{
   const apiKey=key()?.trim();if(!apiKey)throw new ImageServiceError('Image search is not configured. Add PIXABAY_API_KEY on the server.',503,'IMAGE_KEY_MISSING');
   if(blockedUntil>now())throw new ImageServiceError('Image search is temporarily rate limited. Try again shortly.',429,'IMAGE_RATE_LIMIT');
   const url=new URL('https://pixabay.com/api/');for(const [name,value]of Object.entries({key:apiKey,q:normalized.q,image_type:input.imageType,orientation:input.orientation,category:input.category,min_width:input.minWidth,min_height:input.minHeight,page:input.page,per_page:24,safesearch:true,order:'popular'}))if(value!==undefined)url.searchParams.set(name,String(value));
   let response:Response;try{response=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw new ImageServiceError('Image search could not reach Pixabay. Please retry.');}
   if(response.status===429){const seconds=Math.min(3600,Math.max(60,Number(response.headers.get('X-RateLimit-Reset'))||60));blockedUntil=now()+seconds*1000;throw new ImageServiceError('Pixabay search limit reached. Try again shortly.',429,'IMAGE_RATE_LIMIT');}
   if(!response.ok)throw new ImageServiceError(response.status===400||response.status===401||response.status===403?'Pixabay rejected the server configuration. Check the API key.':'Pixabay image search is temporarily unavailable.');
   let data:unknown;try{const text=await response.text();if(text.length>2_000_000)throw Error();data=JSON.parse(text);}catch{throw new ImageServiceError('Pixabay returned an invalid response.');}
   const parsed=z.object({totalHits:z.number().nonnegative(),hits:z.array(z.unknown()).max(200)}).safeParse(data);if(!parsed.success)throw new ImageServiceError('Pixabay returned an invalid response.');
   const hits:ImageHit[]=[];
   for(const value of parsed.data.hits){const hit=hitSchema.safeParse(value);if(!hit.success)continue;const h=hit.data,downloadURL=h.largeImageURL||h.webformatURL;if(!allowedPixabayUrl(downloadURL)||!allowedPixabayUrl(h.previewURL)||!isSourcePage(h.pageURL))continue;hits.push({id:h.id,pageURL:h.pageURL,previewURL:h.previewURL,downloadURL,webURL:allowedPixabayUrl(h.webformatURL)?h.webformatURL:undefined,width:h.imageWidth,height:h.imageHeight,tags:h.tags,author:h.user,likes:h.likes||0,downloads:h.downloads||0});}
   const result={cacheKey,query:normalized.q,hits,total:parsed.data.totalHits,expiresAt:now()+IMAGE_CACHE_MS};await mkdir(directory,{recursive:true,mode:0o700});const target=path.join(directory,cacheKey+'.json'),temp=target+'.'+randomBytes(6).toString('hex');try{await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,target);}finally{await rm(temp,{force:true});}return result;
  })();inflight.set(cacheKey,operation);try{return await operation;}finally{inflight.delete(cacheKey);}
 }
 return {search,cached};
}
export const pixabay=createPixabaySearch(path.join(process.cwd(),'.openui','pixabay-cache'),()=>process.env.PIXABAY_API_KEY);
export function publicImageResults(result:SearchResult){return {cacheKey:result.cacheKey,query:result.query,total:result.total,source:'Pixabay',hits:result.hits.map(({downloadURL,webURL,...hit})=>hit)};}
export function imageScore(hit:ImageHit,query:string,ratio:number){const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(term=>term.length>2),tags=hit.tags.toLowerCase();const matched=terms.filter(term=>tags.includes(term));if(!matched.length)return -Infinity;const aspect=hit.width/hit.height;return matched.length/Math.max(terms.length,1)*10-Math.abs(Math.log(aspect/ratio))*3+Math.min(Math.log1p(hit.downloads)/12,1)+Math.min(hit.width*hit.height/2_000_000,1);}
