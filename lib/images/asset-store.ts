import { randomUUID,createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,rename,rm,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { allowedPixabayUrl,ImageServiceError,type ImageHit } from '@/lib/images/pixabay';
export type ImageAsset={id:string;uid:string;projectId:string;mime:string;alt:string;width:number;height:number;source:'pixabay'|'upload';pixabayId?:number;sourcePage?:string;author?:string;createdAt:string};
export const MAX_IMAGE_BYTES=10*1024*1024;
export function rasterType(data:Buffer):string|undefined{if(data.length<12)return;if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(data[0]===255&&data[1]===216&&data[2]===255)return 'image/jpeg';if(/^GIF8[79]a/.test(data.subarray(0,6).toString()))return 'image/gif';if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return 'image/webp';}
export function rasterDimensions(data:Buffer,mime:string):{width:number;height:number}|undefined{
 try{
  if(mime==='image/png'&&data.length>=33&&data.subarray(12,16).toString()==='IHDR')return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
  if(mime==='image/gif'&&data.length>=13)return {width:data.readUInt16LE(6),height:data.readUInt16LE(8)};
  if(mime==='image/webp'){
   const kind=data.subarray(12,16).toString();if(kind==='VP8X'&&data.length>=30)return {width:1+data.readUIntLE(24,3),height:1+data.readUIntLE(27,3)};
   if(kind==='VP8L'&&data.length>=25&&data[20]===47){const bits=data.readUInt32LE(21);return {width:(bits&16383)+1,height:((bits>>>14)&16383)+1};}
   if(kind==='VP8 '&&data.length>=30&&data.subarray(23,26).equals(Buffer.from([157,1,42])))return {width:data.readUInt16LE(26)&16383,height:data.readUInt16LE(28)&16383};
  }
  if(mime==='image/jpeg'){
   let offset=2;while(offset+4<data.length){if(data[offset++]!==255)continue;while(data[offset]===255)offset++;const marker=data[offset++];if(marker===218||marker===217)break;if(marker===216||marker===1||marker>=208&&marker<=215)continue;const length=data.readUInt16BE(offset);if(length<2||offset+length>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return {height:data.readUInt16BE(offset+3),width:data.readUInt16BE(offset+5)};offset+=length;}
  }
 }catch{}return;
}
export function createImageAssetStore(directory:string,fetcher:typeof fetch=fetch){
 const imports=new Map<string,Promise<ImageAsset>>();
 let downloadBlockedUntil=0;
 const file=(id:string,extension:string)=>{if(!/^[a-f0-9-]{36}$/.test(id))throw new ImageServiceError('Image asset not found.',404);return path.join(directory,id+extension);};
 async function read(id:string,uid:string){try{const meta=JSON.parse(await readFile(file(id,'.json'),'utf8')) as ImageAsset;if(meta.uid!==uid)throw Error();const data=await readFile(file(id,'.bin'));return {meta,data};}catch{throw new ImageServiceError('Image asset not found.',404);}}
 async function save(uid:string,projectId:string,data:Buffer,alt:string,metadata:Partial<ImageAsset>={}):Promise<ImageAsset>{
  if(!uid||!projectId||data.length>MAX_IMAGE_BYTES)throw new ImageServiceError('Invalid image upload.',400);const mime=rasterType(data);const dimensions=mime?rasterDimensions(data,mime):undefined;if(!mime||!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>16000||dimensions.height>16000||dimensions.width*dimensions.height>40_000_000)throw new ImageServiceError('Use a valid PNG, JPEG, WebP or GIF image.',400);
  const id=randomUUID(),meta:ImageAsset={...metadata,id,uid,projectId,mime,alt:alt.trim().slice(0,300)||'Uploaded project image',width:dimensions.width,height:dimensions.height,source:metadata.source||'upload',createdAt:new Date().toISOString()};
  await mkdir(directory,{recursive:true,mode:0o700});const temporary=file(id,'.tmp-'+randomBytes(6).toString('hex'));
  try{await writeFile(temporary,data,{mode:0o600});await rename(temporary,file(id,'.bin'));await writeFile(file(id,'.json'),JSON.stringify(meta),{mode:0o600});}finally{await rm(temporary,{force:true});}return meta;
 }
 async function importHit(uid:string,projectId:string,hit:ImageHit,alt:string){
  const key=createHash('sha256').update(uid+'\0'+projectId+'\0'+hit.id).digest('hex');if(imports.has(key))return imports.get(key)!;
  const task=(async()=>{
   // Persist the mapping as well as the bytes so reopened projects never depend on the CDN.
   try{const id=await readFile(path.join(directory,'pixabay-'+key+'.txt'),'utf8');return (await read(id,uid)).meta;}catch{}
   if(downloadBlockedUntil>Date.now())throw new ImageServiceError('Pixabay downloads are temporarily rate limited. Try again in a minute.',429,'IMAGE_DOWNLOAD_RATE_LIMIT');
   let url=hit.downloadURL;let response:Response|undefined;
   for(let hop=0;hop<4;hop++){
    if(!allowedPixabayUrl(url))throw new ImageServiceError('Invalid image source.',400);
    try{response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new ImageServiceError('Could not download the selected image.');}
    if(response.status===429){downloadBlockedUntil=Date.now()+Math.min(3600,Math.max(60,Number(response.headers.get('retry-after'))||60))*1000;throw new ImageServiceError('Pixabay downloads are temporarily rate limited. Try again in a minute.',429,'IMAGE_DOWNLOAD_RATE_LIMIT');}
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw new ImageServiceError('Invalid image redirect.');url=new URL(location,url).href;continue;}break;
   }
   if(!response?.ok||!/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(response.headers.get('content-type')||''))throw new ImageServiceError('Selected image could not be downloaded.');
   if(Number(response.headers.get('content-length'))>MAX_IMAGE_BYTES)throw new ImageServiceError('Selected image is too large.',400);
   const reader=response.body?.getReader();if(!reader)throw new ImageServiceError('Selected image is empty.');const chunks:Uint8Array[]=[];let length=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_IMAGE_BYTES){await reader.cancel();throw new ImageServiceError('Selected image is too large.',400);}chunks.push(value);}}finally{reader.releaseLock();}
   const asset=await save(uid,projectId,Buffer.concat(chunks),alt,{source:'pixabay',pixabayId:hit.id,sourcePage:hit.pageURL,author:hit.author,width:hit.width,height:hit.height});await writeFile(path.join(directory,'pixabay-'+key+'.txt'),asset.id,{mode:0o600});return asset;
  })();imports.set(key,task);try{return await task;}finally{imports.delete(key);}
 }
 return {read,save,importHit};
}
export const imageAssets=createImageAssetStore(path.join(process.cwd(),'.openui','image-assets'));
export const assetUrl=(id:string)=>'/api/images/assets/'+id;
