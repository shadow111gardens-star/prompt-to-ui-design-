import { Suspense } from 'react';
import ProtectedWorkspace from '@/components/auth/protected';
export const dynamic='force-dynamic';
export default function ProtectedLayout({children}:{children:React.ReactNode}){return <Suspense fallback={<div className="p-6 text-sm">Checking your session...</div>}><ProtectedWorkspace>{children}</ProtectedWorkspace></Suspense>;}
