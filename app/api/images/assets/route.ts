import { z } from 'zod';
import { imageUser,imageProject,imageOrigin,imageError } from '@/lib/images/api-auth';
import { pixabay,ImageServiceError } from '@/lib/images/pixabay';
import { imageAssets,assetUrl,MAX_IMAGE_BYTES } from '@/lib/images/asset-store';
export const runtime='nodejs';
const schema=z.object({projectId:z.string().min(1).max(100),cacheKey:z.string().regex(/^[a-f0-9]{64}$/),imageId:z.number().int().positive(),alt:z.string().trim().max(300)}).strict();
export async function POST(request:Request){try{
 const uid=await imageUser(request);imageOrigin(request);let asset;
 if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
  if(Number(request.headers.get('content-length'))>MAX_IMAGE_BYTES+100000)throw new ImageServiceError('Image upload is too large.',413);
  const form=await request.formData(),file=form.get('file'),projectId=String(form.get('projectId')||''),alt=String(form.get('alt')||'Uploaded image').slice(0,300);await imageProject(projectId);
  if(!(file instanceof File)||!file.size||file.size>MAX_IMAGE_BYTES)throw new ImageServiceError('Upload a PNG, JPEG, WebP or GIF up to 10 MB.',400);
  asset=await imageAssets.save(uid,projectId,Buffer.from(await file.arrayBuffer()),alt);
 }else{
  const text=await request.text();if(text.length>2000)throw new ImageServiceError('Image request is too large.',413);const input=schema.parse(JSON.parse(text));await imageProject(input.projectId);const cached=await pixabay.cached(input.cacheKey);const hit=cached?.hits.find(hit=>hit.id===input.imageId);if(!hit)throw new ImageServiceError('Search results expired. Search again before selecting an image.',410);
  asset=await imageAssets.importHit(uid,input.projectId,hit,input.alt||hit.tags);
 }
 return Response.json({id:asset.id,url:assetUrl(asset.id),alt:asset.alt,width:asset.width,height:asset.height,source:asset.source,sourcePage:asset.sourcePage,author:asset.author},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return imageError(error);}}
