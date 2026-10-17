"use client";
import React, { useState } from 'react';
import { Sparkles, SquarePen, Layers, Code2, Users, MessageSquareText, Send, Loader2 } from 'lucide-react';
import { useProjectCreation } from '@/hooks/use-project';

const features=[
  {title:'AI Screen Generation',description:'Turn your ideas into polished, production-ready UI screens with simple prompts.',icon:Sparkles,color:'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-500'},
  {title:'Live Canvas Editing',description:'Select, move, and customize every element. Adjust text, colors, spacing and more in real time.',icon:SquarePen,color:'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-400'},
  {title:'Multi-Screen Workflows',description:'Create and manage multiple screens in one project. Keep your design system consistent across all screens.',icon:Layers,color:'border-emerald-200 bg-emerald-50 text-emerald-500 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400'},
  {title:'Instant Code Export',description:'Export clean, production-ready code in HTML, React, Vue, and more. Go from design to development faster.',icon:Code2,color:'border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-500/45 dark:bg-rose-500/10 dark:text-rose-400'},
];

export default function WorkflowSection(){
  const [prompt,setPrompt]=useState('');const {createProject,isCreating}=useProjectCreation();
  return <section id="architecture" aria-labelledby="workflow-heading" className="scroll-mt-24 rounded-3xl bg-[#FBF9F5] px-5 py-10 text-slate-950 dark:bg-[#201a16] dark:text-stone-100 sm:px-8 sm:py-12 lg:px-0">
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-9">
      <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
        {features.map(({title,description,icon:Icon,color})=><article key={title} className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-white/[0.025] sm:min-h-56 lg:p-6 xl:p-7">
          <div className={`mb-4 flex size-14 items-center justify-center rounded-2xl border ${color}`}><Icon size={27} strokeWidth={2.2}/></div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-stone-400">{description}</p>
        </article>)}
      </div>
      <div>
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-bold text-orange-600 dark:border-orange-600/70 dark:bg-orange-500/5 dark:text-orange-500"><Users size={16} className="shrink-0"/>BUILT FOR DESIGNERS &amp; DEVELOPERS</div>
        <h2 id="workflow-heading" className="mt-5 font-heading text-3xl font-black leading-tight sm:text-4xl">Design faster.<br/>Iterate <span className="text-[#ff4b19] dark:text-[#ff6948]">without limits.</span></h2>
        <p className="mt-6 text-sm leading-relaxed text-slate-500 dark:text-stone-400">OpenUI helps you generate UI screens, refine layouts, and keep a consistent design system — all in one powerful canvas. Turn your ideas into real products, faster.</p>
        <div className="mt-7 rounded-2xl border border-orange-200 bg-orange-50/30 p-5 dark:border-orange-500/20 dark:bg-orange-500/[0.035]">
          <h3 className="flex items-center gap-3 text-xs font-bold"><Sparkles size={23} className="shrink-0 text-orange-600 dark:text-orange-500"/>Your next idea starts here</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-stone-400">Describe the interface you want to build and let AI create it for you.</p>
          <form onSubmit={event=>{event.preventDefault();if(prompt.trim()&&!isCreating)void createProject(undefined,prompt.trim());}} className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-1.5 focus-within:ring-2 focus-within:ring-orange-500/30 dark:border-white/15 dark:bg-[#141313] sm:flex-row lg:flex-col xl:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3"><MessageSquareText size={18} className="shrink-0 text-slate-600 dark:text-stone-400"/><input aria-label="Describe your interface" value={prompt} onChange={event=>setPrompt(event.target.value)} maxLength={16000} required disabled={isCreating} placeholder="Describe the interface you want to build..." className="min-h-11 w-full min-w-0 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:text-stone-100"/></div>
            <button type="submit" disabled={!prompt.trim()||isCreating} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#ff4b0b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">{isCreating?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>}Start designing</button>
          </form>
        </div>
      </div>
    </div>
  </section>;
}
