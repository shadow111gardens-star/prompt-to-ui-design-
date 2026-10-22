import { withProjectRoute } from '@/lib/server/project-access';
import { imageUser,imageProject,imageError } from '@/lib/images/api-auth';
import { imageAssets } from '@/lib/images/asset-store';
export const runtime='nodejs';
export const GET=withProjectRoute(async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const uid=await imageUser(request),{id}=await params;const {meta,data}=await imageAssets.read(id,uid);await imageProject(meta.projectId);return new Response(new Uint8Array(data),{headers:{'Content-Type':meta.mime,'Content-Length':String(data.length),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Vary':'Cookie','Content-Disposition':'inline'}});}catch(error){return imageError(error);}});
