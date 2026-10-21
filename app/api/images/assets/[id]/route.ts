import { imageUser,imageError } from '@/lib/images/api-auth';
import { imageAssets } from '@/lib/images/asset-store';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const uid=await imageUser(request),{id}=await params;const {meta,data}=await imageAssets.read(id,uid);return new Response(new Uint8Array(data),{headers:{'Content-Type':meta.mime,'Content-Length':String(data.length),'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=86400','Vary':'Cookie','Content-Disposition':'inline'}});}catch(error){return imageError(error);}}
