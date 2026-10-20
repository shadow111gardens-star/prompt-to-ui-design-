"use client";
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/components/auth/provider';
import { refreshVerifiedUser, sendVerification, verificationWait } from '@/lib/firebase/email-verification';
import { authErrorMessage } from '@/lib/firebase/errors';
import ThemeToggle from '@/components/navbar/theme-toggle';

export default function VerifyEmail(){
  const {user,ready,requiresVerification,error,establish,logout}=useAuth();
  const [wait,setWait]=useState(0),[busy,setBusy]=useState<'resend'|'check'|'logout'|null>(null),[notice,setNotice]=useState(''),[failure,setFailure]=useState('');
  const working=useRef(false);
  useEffect(()=>{
    if(!ready)return;
    if(!user){window.location.replace('/sign-in');return;}
    if(!requiresVerification){window.location.replace('/dashboard/workspace');return;}
    if(new URLSearchParams(window.location.search).get('send')==='failed')setFailure('Your account was created, but the verification email could not be sent. Please try resending below.');
    const update=()=>setWait(verificationWait(user.uid));update();
    const timer=setInterval(update,1000);return()=>clearInterval(timer);
  },[ready,user,requiresVerification]);
  async function act(action:'resend'|'check'|'logout'){
    if(!user||working.current)return;
    working.current=true;setBusy(action);setFailure('');setNotice('');
    try{
      if(action==='logout'){await logout();return;}
      if(action==='resend'){await sendVerification(user);setNotice('Verification email sent. Check your inbox and spam folder.');}
      else if(await refreshVerifiedUser(user)){await establish(user);window.location.replace('/dashboard/workspace');}
      else setNotice("Your email is not verified yet. Open the verification link in your inbox, then try again.");
    }catch(reason){setFailure(authErrorMessage(reason));}
    finally{working.current=false;setBusy(null);setWait(verificationWait(user.uid));}
  }
  return <main className="relative flex min-h-dvh flex-col bg-background text-foreground">
    <header className="flex items-center justify-between px-4 py-2 sm:px-8"><Link href="/" className="text-sm text-muted-foreground">Back to home</Link><ThemeToggle/></header>
    <div className="flex flex-1 items-center justify-center px-4 py-6"><section className="w-full max-w-md rounded-3xl border border-primary/45 bg-card/80 p-6 shadow-[0_0_70px_-30px_var(--color-primary)] sm:p-8">
      <Link href="/" className="mx-auto flex w-fit"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="h-8 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-8 w-auto dark:block"/></Link>
      <h1 className="mt-6 text-center font-heading text-2xl font-semibold">Verify your email address</h1>
      <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">We've sent a verification link to your email. Please open your inbox and click the link to verify your account.</p>
      {user?.email&&<p className="mt-3 break-all text-center text-sm font-medium">{user.email}</p>}
      <div className="mt-6 space-y-3">
        <button disabled={!ready||!user||!!busy} onClick={()=>void act('check')} className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy==='check'?'Checking...':"I've verified my email"}</button>
        <button disabled={!ready||!user||!!busy||wait>0} onClick={()=>void act('resend')} className="min-h-11 w-full rounded-xl border border-primary/40 px-4 py-3 text-sm font-medium text-primary disabled:opacity-60">{busy==='resend'?'Sending...':wait>0?`Resend verification email (${wait}s)`:'Resend verification email'}</button>
      </div>
      {(failure||error)&&<p role="alert" className="mt-4 text-sm leading-6 text-destructive">{failure||error}</p>}
      {notice&&<p role="status" className="mt-4 text-sm leading-6 text-muted-foreground">{notice}</p>}
      {!ready&&<p role="status" className="mt-4 text-center text-sm text-muted-foreground">Checking your session...</p>}
      <button disabled={!!busy||!ready} onClick={()=>void act('logout')} className="mx-auto mt-5 block min-h-11 text-sm text-muted-foreground hover:text-primary">Sign out</button>
    </section></div>
  </main>;
}
