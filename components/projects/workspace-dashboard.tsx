"use client";
import CreditsCard from '@/components/billing/credits-card';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronsLeft, ChevronsRight, Info, Menu, Plus, Settings, FolderKanban } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ProjectsList from '@/components/projects/list';
import LogoutButton from '@/components/auth/logout-button';
import ThemeToggle from '@/components/navbar/theme-toggle';
import { useProjectCreation } from '@/hooks/use-project';
import { cn } from '@/lib/utils';

export default function WorkspaceDashboard({children}:{children:React.ReactNode}){
  const [open,setOpen]=useState(false),[collapsed,setCollapsed]=useState(false);
  const {createProject,isCreating}=useProjectCreation();
  const navigation=<>
    <div className="mb-6 flex items-center justify-between gap-3 px-1">
      <Link href="/" aria-label="OpenUI home"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="h-7 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-7 w-auto dark:block"/></Link>
      <button onClick={()=>setCollapsed(true)} aria-label="Collapse sidebar" className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary lg:flex"><ChevronsLeft size={19}/></button>
    </div>
    <button disabled={isCreating} onClick={()=>void createProject()} className="flex min-h-10 w-full items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground shadow-lg shadow-primary/10 bg-linear-to-r from-primary to-primary/90 disabled:opacity-50"><Plus size={20}/>{isCreating?'Creating...':'New Chat'}</button>
    <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <section aria-label="Favorites" className="mb-5 px-2">
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Favorites</h2>
        <p className="py-1 text-[11px] text-muted-foreground/70">No favorites yet</p>
      </section>
      <h2 className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">All projects</h2>
      <ProjectsList compact/>
    </div>
    <CreditsCard/>
    <Link href="/dashboard/workspace/settings" className="mt-2 flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-xs text-foreground/85 hover:bg-secondary/60"><Settings size={18} strokeWidth={1.6}/>Settings</Link>
    <div className="shrink-0"><LogoutButton plain/></div>
  </>;
  return <div className={cn('workspace-redesign min-h-dvh min-w-0 bg-background text-foreground transition-[padding] duration-200',collapsed?'lg:pl-20':'lg:pl-64')}>
    <aside aria-label="Projects sidebar" className={cn('fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background/95 px-5 py-5 lg:flex',collapsed?'w-20 items-center px-3':'w-64')}>
      {collapsed?<><button aria-label="Expand sidebar" onClick={()=>setCollapsed(false)} className="flex size-11 items-center justify-center rounded-xl border border-border text-primary"><ChevronsRight size={20}/></button><button aria-label="New Chat" disabled={isCreating} onClick={()=>void createProject()} className="mt-7 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Plus size={20}/></button><button aria-label="Show projects" onClick={()=>setCollapsed(false)} className="mt-3 flex size-11 items-center justify-center rounded-xl hover:bg-secondary"><FolderKanban size={20}/></button><Link href="/dashboard/workspace/settings" aria-label="Settings" className="mt-auto flex size-11 items-center justify-center rounded-xl hover:bg-secondary"><Settings size={20}/></Link></>:navigation}
    </aside>
    <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-7 lg:absolute lg:right-0 lg:top-0 lg:z-10 lg:justify-end">
      <button onClick={()=>setOpen(true)} aria-label="Open workspace navigation" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm lg:hidden"><Menu size={20}/>Workspace</button><ThemeToggle/>
    </header>
    <main className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full min-w-0 items-center px-4 py-8 sm:px-8 lg:min-h-dvh lg:px-8 lg:py-20 xl:px-12">{children}</main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="inset-y-0 left-0 flex h-dvh max-h-none w-64 max-w-[88vw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-r border-border bg-background p-5 sm:rounded-none"><DialogTitle className="sr-only">Workspace navigation</DialogTitle>{navigation}</DialogContent></Dialog>
  </div>;
}
