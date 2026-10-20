"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Project = { _id: string; name?: string; projectNumber?: number };
export default function ProjectSearch({ workspace }: { workspace: string }) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [projects,setProjects]=useState<Project[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(current=>!current);}};
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/projects',{signal:controller.signal,cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Unable to load projects.');const body:unknown=await response.json();if(!Array.isArray(body))throw new Error('Invalid project response.');if(!controller.signal.aborted)setProjects(body.filter((item):item is Project=>!!item&&typeof item==='object'&&typeof item._id==='string'));})
      .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Unable to load projects.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[open,attempt]);
  const filtered=projects.filter(project=>(project.name||`Project ${project.projectNumber}`).toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <button type="button" onClick={()=>setOpen(true)} aria-label="Search projects" className="flex h-10 w-full max-w-[694px] items-center gap-4 rounded-2xl border border-border bg-secondary/40 px-4 text-left text-sm text-muted-foreground"><Search className="size-5"/><span>Search projects...</span><span className="ml-auto hidden gap-1 sm:flex"><kbd className="rounded-md bg-secondary px-2 py-1 text-xs">Ctrl</kbd><kbd className="rounded-md bg-secondary px-2 py-1 text-xs">K</kbd></span></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-card text-foreground" onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus();}}><DialogTitle>Search projects</DialogTitle><input ref={input} aria-label="Project name" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Type a project name…" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"/><div className="max-h-80 space-y-1 overflow-y-auto" aria-live="polite">{loading?<p className="p-3 text-sm text-muted-foreground">Loading projects…</p>:error?<div className="p-3 text-sm"><p role="alert">{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)} className="mt-2 text-primary">Retry</button></div>:filtered.length?filtered.map(project=><Link key={project._id} href={`${workspace}/canvas?project=${encodeURIComponent(project._id)}`} onClick={()=>setOpen(false)} className="block rounded-lg p-3 text-sm hover:bg-secondary focus:bg-secondary">{project.name||`Project ${project.projectNumber}`}</Link>):<p className="p-3 text-sm text-muted-foreground">No matching projects.</p>}</div></DialogContent></Dialog>
  </>;
}
