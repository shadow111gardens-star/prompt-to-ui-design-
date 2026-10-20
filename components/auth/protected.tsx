"use client";
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/provider';
export default function ProtectedWorkspace({children}:{children:React.ReactNode}){
  const {user,ready,error,requiresVerification}=useAuth();const router=useRouter(),path=usePathname(),search=useSearchParams();
  useEffect(()=>{if(ready&&requiresVerification){router.replace('/verify-email');return;}if(ready&&!user)router.replace(`/sign-in?next=${encodeURIComponent(path+(search.size?'?'+search.toString():''))}`);},[ready,user,requiresVerification,router,path,search]);
  if(!ready||!user||requiresVerification)return <div role="status" className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">{error||'Checking your session...'}</div>;
  return children;
}
