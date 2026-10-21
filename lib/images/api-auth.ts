import { personalProviderIdentity } from '@/lib/ai/personal-provider-auth';
import { prisma } from '@/lib/db';
import { ImageServiceError } from '@/lib/images/pixabay';
export async function imageUser(request:Request){try{return (await personalProviderIdentity(request)).sub;}catch{throw new ImageServiceError('Sign in to use project images.',401,'IMAGE_AUTH_REQUIRED');}}
export async function imageProject(projectId:string){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)||!await prisma.project.findUnique({where:{id:projectId},select:{id:true}}))throw new ImageServiceError('Project not found.',404);}
export function imageOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new ImageServiceError('Invalid request origin.',403);}
export function imageError(error:unknown){const known=error instanceof ImageServiceError;return Response.json({error:known?error.message:'Invalid image request.',code:known?error.code:'INVALID_IMAGE_REQUEST'},{status:known?error.status:400,headers:{'Cache-Control':'no-store'}});}
