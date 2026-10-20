"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import ThemeToggle from '@/components/navbar/theme-toggle';

function GoogleMark(){return <svg aria-hidden="true" viewBox="0 0 48 48" className="size-6 shrink-0"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32.1 15l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 32.1 15l5.7-5.7A20 20 0 0 0 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.1l-6.2-5.3A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-3.9 5.6l6.2 5.3A20 20 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z"/></svg>;}

export default function AuthScreen(){
  // Email/password extensions mutate inputs before React hydrates the page.
  // Keep SSR and the first client render identical, then mount the real fields.
  const [inputsReady,setInputsReady]=useState(false);
  useEffect(()=>setInputsReady(true),[]);
  const [mode,setMode]=useState<'signup'|'signin'>('signup');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [notice,setNotice]=useState('');
  const unavailable=()=>setNotice('Account authentication is not connected yet. No account was created and your password was not sent or saved.');
  return <main className="auth-page relative isolate flex min-h-dvh min-w-0 flex-col bg-background text-foreground">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-72 top-1/3 size-[540px] rounded-full border border-primary/50 bg-[radial-gradient(circle_at_75%_30%,var(--color-primary),transparent_70%)] opacity-25 shadow-[0_0_100px_var(--color-primary)] dark:opacity-40"/>
      <div className="absolute -right-56 -top-64 size-[560px] rounded-full border border-primary/60 bg-[radial-gradient(circle_at_20%_70%,var(--color-primary),transparent_65%)] opacity-25 dark:opacity-40"/>
      <div className="absolute -right-28 bottom-0 h-64 w-96 rotate-[-35deg] rounded-full bg-primary/10 blur-3xl"/>
      <div className="absolute -left-20 -top-28 h-52 w-96 rounded-br-[100px] border border-primary/35"/>
      <div className="absolute -right-32 top-1/2 size-96 rounded-full border border-primary/15"/>
      <div className="absolute left-5 top-32 h-36 w-28 bg-[radial-gradient(circle,var(--color-primary)_1.5px,transparent_2px)] bg-size-[26px_26px] opacity-30 sm:left-12"/>
      <div className="absolute bottom-24 right-6 h-52 w-40 bg-[radial-gradient(circle,var(--color-primary)_1.5px,transparent_2px)] bg-size-[26px_26px] opacity-30 sm:right-16"/>
    </div>
    <header className="flex shrink-0 items-center justify-between gap-3 px-3 sm:px-4 py-2 sm:px-8"><Link href="/" className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={15}/>Back to home</Link><ThemeToggle/></header>
    <div className="auth-content flex flex-1 items-center justify-center px-3 sm:px-4 pb-4 pt-2">
      <section aria-labelledby="auth-title" className="auth-card w-full min-w-0 max-w-md rounded-2xl sm:rounded-3xl border border-primary/45 bg-card/80 px-4 py-5 shadow-[0_0_70px_-30px_var(--color-primary)] backdrop-blur-xl sm:px-8 sm:py-6 dark:bg-card/45">
        <Link href="/" aria-label="OpenUI home" className="auth-brand mx-auto flex w-fit"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} priority className="h-7 sm:h-8 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} priority className="hidden h-7 sm:h-8 w-auto dark:block"/></Link>
        <h1 id="auth-title" className="mt-4 text-center font-heading text-xl sm:text-2xl font-semibold">{mode==='signup'?'Create your account':'Welcome back'}</h1>
        <p className="mt-2 text-center text-sm leading-5 text-muted-foreground">{mode==='signup'?'Turn your ideas into beautiful interfaces with AI.':'Sign in to continue your design journey.'}</p>
        <button type="button" onClick={unavailable} className="relative mt-5 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-primary"><span className="absolute left-4"><GoogleMark/></span><span className="pl-7">Continue with Google</span></button>
        <div className="auth-divider my-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>or continue with email</span><span className="h-px flex-1 bg-border"/></div>
        <form className="auth-form space-y-4" onSubmit={event=>{event.preventDefault();unavailable();}}>
          <div className="space-y-1"><label htmlFor="auth-email" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email address</label><div className="relative h-11"><Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"/>{inputsReady && <input id="auth-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" autoComplete="email" required maxLength={254} value={email} onChange={event=>{setEmail(event.target.value);setNotice('');}} placeholder="you@example.com" className="h-11 w-full min-w-0 scroll-mt-8 rounded-xl border border-border bg-secondary/40 py-3 pl-12 pr-4 text-base sm:text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"/>}</div></div>
          <div className="space-y-1"><label htmlFor="auth-password" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Password</label><div className="relative h-11"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"/>{inputsReady && <input id="auth-password" name="password" spellCheck={false} enterKeyHint="done" type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?8:1} maxLength={128} value={password} onChange={event=>{setPassword(event.target.value);setNotice('');}} placeholder="Enter your password" className="h-11 w-full min-w-0 scroll-mt-8 rounded-xl border border-border bg-secondary/40 py-3 pl-12 pr-12 text-base sm:text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"/>}<button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></div>
          <button type="submit" disabled={!inputsReady} className="min-h-11 disabled:opacity-60 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{mode==='signup'?'Create account':'Sign in'}</button>
        </form>
        {notice && <div role="status" className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-6 text-muted-foreground">{notice}<Link href="/dashboard/workspace" className="mt-2 block font-semibold text-primary hover:underline">Continue to local workspace</Link></div>}
        <p className="mt-4 text-center text-sm text-muted-foreground">{mode==='signup'?'Already have an account?':'New to OpenUI?'}{' '}<button type="button" onClick={()=>{setMode(mode==='signup'?'signin':'signup');setPassword('');setShowPassword(false);setNotice('');}} className="font-medium text-primary hover:underline">{mode==='signup'?'Sign in':'Create account'}</button></p>
        <p className="auth-legal mt-5 text-center text-[11px] leading-5 text-muted-foreground">By continuing, you agree to our <Link href="/terms" className="text-foreground underline underline-offset-2">Terms of Service</Link> and <Link href="/privacy" className="text-foreground underline underline-offset-2">Privacy Policy</Link>.</p>
      </section>
    </div>
  </main>;
}
