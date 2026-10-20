"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FolderKanban, Settings2, Crown, Menu, ChevronDown, CircleHelp } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePathname, useParams } from 'next/navigation';
import ProjectSearch from '@/components/projects/project-search';
import ThemeToggle from '@/components/navbar/theme-toggle';
import { cn } from '@/lib/utils';

export default function DashboardShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const params=useParams<{session:string}>();
  const workspace=`/dashboard/${params.session || "workspace"}`;
  const isSettings=pathname.endsWith("/settings");
  const navClass=(active:boolean)=>cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",active?"border-primary/30 bg-primary/10 text-foreground":"border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground");
  const [menuOpen,setMenuOpen]=useState(false);
  const [initial,setInitial]=useState('A');
  useEffect(()=>{const update=()=>{try{const profile=JSON.parse(localStorage.getItem('openui-workspace-profile')||'{}');setInitial(typeof profile.name==='string'&&profile.name.trim()?profile.name.trim()[0].toUpperCase():'A');}catch{setInitial('A');}};update();window.addEventListener('openui-profile-updated',update);window.addEventListener('storage',update);return ()=>{window.removeEventListener('openui-profile-updated',update);window.removeEventListener('storage',update);};},[]);
  const navigation=<>
    <Link href="/" aria-label="OpenUI home" className="mb-8 block w-fit px-3 pt-2">
      <Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="block h-7 w-auto dark:hidden"/>
      <Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-7 w-auto dark:block"/>
    </Link>
    <nav aria-label="Workspace navigation" className="space-y-2">
      <Link href={workspace} aria-current={!isSettings?"page":undefined} onClick={()=>setMenuOpen(false)} className={navClass(!isSettings)}><FolderKanban className="size-5 text-primary"/>Projects</Link>
      <Link href={`${workspace}/settings`} aria-current={isSettings?"page":undefined} onClick={()=>setMenuOpen(false)} className={navClass(isSettings)}><Settings2 className="size-5 text-primary"/>Settings</Link>
    </nav>
    <div className="mt-auto rounded-2xl border border-border bg-card/50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Crown className="size-4"/></span>Upgrade to Pro</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Explore plans for more projects, AI credits, and premium features.</p>
      <Link href="/#pricing" className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90">Upgrade</Link>
    </div>
  </>;
  return <div className="min-h-dvh min-w-0 bg-background lg:pl-60">
    <aside aria-label="Projects sidebar" className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-border bg-background p-4 lg:flex">{navigation}</aside>
    {isSettings && <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between gap-2 sm:gap-6 border-b border-border bg-background/95 px-3 sm:px-7 backdrop-blur-md lg:left-60">
      <ProjectSearch workspace={workspace}/>
      <div className="flex shrink-0 items-center gap-2 sm:gap-5"><ThemeToggle/><Link href="/#faq" aria-label="Help" className="text-muted-foreground"><CircleHelp className="size-7"/></Link><Link href="#tab-account" aria-label="Account settings" className="hidden items-center gap-3 sm:flex"><span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base font-semibold">{initial}</span><ChevronDown className="size-5 text-muted-foreground"/></Link></div>
    </header>}
    <main className="mx-auto w-full min-w-0 px-4 sm:px-6 pb-10 pt-24 lg:px-8">
      <button type="button" onClick={()=>setMenuOpen(true)} aria-label="Open workspace navigation" className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground lg:hidden"><Menu className="size-4"/>Workspace menu</button>
      {children}
    </main>
    <Dialog open={menuOpen} onOpenChange={setMenuOpen}><DialogContent className="top-0 bottom-0 left-0 flex h-dvh max-h-none w-64 max-w-[85vw] translate-x-0 translate-y-0 flex-col rounded-none border-r border-border bg-background p-4 sm:max-w-64 sm:rounded-none"><DialogTitle className="sr-only">Workspace navigation</DialogTitle>{navigation}</DialogContent></Dialog>

  </div>;
}
