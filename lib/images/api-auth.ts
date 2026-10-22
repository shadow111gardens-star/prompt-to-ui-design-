import { personalProviderIdentity } from '@/lib/ai/personal-provider-auth';
import { prisma } from '@/lib/db';
import { ImageServiceError } from '@/lib/images/pixabay';
import { ownedProjectWhere,projectAccessResponse } from '@/lib/server/project-access';
export async function imageUser(request:Request){try{return (await personalProviderIdentity(request)).sub;}catch{throw new ImageServiceError('Sign in to use project images.',401,'IMAGE_AUTH_REQUIRED');}}
export async function imageProject(projectId:string){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)||!await prisma.project.findUnique({where:await ownedProjectWhere(projectId),select:{id:true}}))throw new ImageServiceError('Project not found.',404);}
export function imageOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new ImageServiceError('Invalid request origin.',403);}
export function imageError(error:unknown){const denied=projectAccessResponse(error);if(denied)return denied;const known=error instanceof ImageServiceError;return Response.json({error:known?error.message:'Invalid image request.',code:known?error.code:'INVALID_IMAGE_REQUEST'},{status:known?error.status:400,headers:{'Cache-Control':'no-store'}});}
