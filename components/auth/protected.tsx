"use client";
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/provider';
export default function ProtectedWorkspace({children,ownerUid}:{children:React.ReactNode;ownerUid:string}){
  const {user,ready,error,requiresVerification}=useAuth();const router=useRouter(),path=usePathname(),search=useSearchParams();
  useEffect(()=>{if(ready&&requiresVerification){router.replace('/verify-email');return;}if(ready&&!user)router.replace(`/sign-in?next=${encodeURIComponent(path+(search.size?'?'+search.toString():''))}`);},[ready,user,requiresVerification,router,path,search]);
  useEffect(()=>{
    // A retained RSC layout may have been authorized by a previous cookie.
    // Discard the router cache only after the new Firebase session is synced.
    if(ready&&user&&!requiresVerification&&user.uid!==ownerUid)window.location.replace('/dashboard/workspace');
  },[ready,user,requiresVerification,ownerUid]);
  if(!ready||!user||requiresVerification||user.uid!==ownerUid)return <div role="status" className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">{error||'Checking your session...'}</div>;
  return children;
}
