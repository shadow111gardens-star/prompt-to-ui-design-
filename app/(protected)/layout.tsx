import { Suspense } from 'react';
import ProtectedWorkspace from '@/components/auth/protected';
import { serverIdentity, ProjectAccessError } from '@/lib/server/project-access';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function ProtectedLayout({children}:{children:React.ReactNode}){
  let identity;
  try { identity=await serverIdentity(); }
  catch(error){if(error instanceof ProjectAccessError)redirect(error.status===403?'/verify-email':'/sign-in');throw error;}
  return <Suspense fallback={<div className="p-6 text-sm">Checking your session...</div>}><ProtectedWorkspace ownerUid={identity.sub}>{children}</ProtectedWorkspace></Suspense>;
}
