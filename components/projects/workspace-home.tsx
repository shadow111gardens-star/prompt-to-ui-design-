"use client";
import { useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Image as ImageIcon, LayoutGrid, Lightbulb, Loader2, Paperclip, Search, SlidersHorizontal, Sparkles, Upload } from 'lucide-react';
import { useProjectCreation } from '@/hooks/use-project';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const suggestions=['Fitness tracking app','Personal finance app','Travel planner','Social networking app','Habit tracker','Food delivery'];
const canvasTools={Attach:'Upload files from the existing canvas tools after opening your project.',Reference:'Add a reference image using the existing canvas image and inspiration tools.',Options:'Choose your AI model and adjust your design settings in the canvas.'};
export default function WorkspaceHome(){
  const {createProject,isCreating}=useProjectCreation();
  const [prompt,setPrompt]=useState(''),[tool,setTool]=useState<keyof typeof canvasTools|null>(null);
  const input=useRef<HTMLTextAreaElement>(null);
  const opening=useRef(false);
  async function openCanvas(){
    if(isCreating||opening.current)return;
    opening.current=true;
    try{await createProject(undefined,prompt.trim()||undefined);}finally{opening.current=false;}
  }
  function start(){if(prompt.trim())void openCanvas();}
  const card='group flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card/25 px-4 py-5 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
  const icon='flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary';
  return <div className="mx-auto w-full min-w-0 max-w-6xl">
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl 2xl:text-7xl">Turn your idea<br/><span className="text-primary">into an app.</span></h1>
      <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Describe the app you want to build. OpenUI creates screens,<span className="hidden sm:inline"><br/></span> components, and editable UI ready to refine.</p>
    </div>
    <form onSubmit={e=>{e.preventDefault();start();}} className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-2xl border border-primary/60 bg-card/55 shadow-[0_0_45px_-30px_var(--color-primary)] focus-within:ring-2 focus-within:ring-primary/20 sm:mt-9">
      <label htmlFor="workspace-prompt" className="sr-only">Describe the app you want to build</label>
      <textarea ref={input} id="workspace-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();start();}}} disabled={isCreating} rows={4} maxLength={12000} placeholder="Describe the app you want to build..." className="block min-h-32 w-full resize-none bg-transparent p-5 text-base leading-6 outline-none placeholder:text-muted-foreground sm:min-h-36 sm:p-6"/>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-3 py-3 sm:px-5">
        <div hidden>{([{name:'Attach',icon:Paperclip},{name:'Reference',icon:ImageIcon},{name:'Options',icon:SlidersHorizontal}] as const).map(({name,icon:Icon})=><button key={name} type="button" onClick={()=>setTool(name)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"><Icon size={17}/>{name}</button>)}</div>
        <div className="ml-auto flex items-center gap-4"><span className="hidden text-[11px] text-muted-foreground xl:block">Shift + Enter for new line</span><button type="submit" disabled={!prompt.trim()||isCreating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:opacity-50">{isCreating?<Loader2 size={18} className="animate-spin"/>:<Sparkles size={18}/>} {isCreating?'Creating...':'Generate'}<ArrowRight size={18}/></button></div>
      </div>
    </form>
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" className={card} disabled={isCreating} onClick={()=>void openCanvas()}><span className={icon}><Lightbulb size={22}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5">Create from idea</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Describe what you want to build</span></span><ChevronRight size={16} className="mt-5 shrink-0 text-muted-foreground"/></button>
      <button type="button" className={card} disabled={isCreating} onClick={()=>void openCanvas()}><span className={icon}><LayoutGrid size={22}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5">Start from template</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Pre-built layouts for common apps</span></span><ChevronRight size={16} className="mt-5 shrink-0 text-muted-foreground"/></button>
      <button type="button" className={card} disabled={isCreating} onClick={()=>void openCanvas()}><span className={icon}><Upload size={22}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5">Import design</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Bring references into your canvas</span></span><ChevronRight size={16} className="mt-5 shrink-0 text-muted-foreground"/></button>
      <button type="button" className={card} disabled={isCreating} onClick={()=>void openCanvas()}><span className={icon}><Search size={22}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5">Research design patterns</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Get inspiration from proven patterns</span></span><ChevronRight size={16} className="mt-5 shrink-0 text-muted-foreground"/></button>
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2 pb-2 sm:mt-7"><span className="mr-2 text-xs text-muted-foreground">Try:</span>{suggestions.map(text=><button key={text} type="button" disabled={isCreating} onClick={()=>{setPrompt(text);input.current?.focus();}} className="min-h-9 rounded-full border border-border bg-card/35 px-3 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{text}</button>)}</div>
    <Dialog open={!!tool} onOpenChange={open=>{if(!open)setTool(null);}}><DialogContent className="max-w-sm rounded-2xl border-border bg-card"><DialogTitle>{tool}</DialogTitle><DialogDescription>{tool?canvasTools[tool]:''}</DialogDescription><button disabled={isCreating} onClick={()=>void createProject()} className="mt-2 min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{isCreating?'Creating...':'Open a new canvas'}</button></DialogContent></Dialog>
  </div>;
}
