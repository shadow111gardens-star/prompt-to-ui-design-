"use client";
import React, { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { GeneratedUIShape } from '@/redux/slice/shapes';
import { downloadScreenImages, ScreenImageFormat } from '@/lib/screen-image-export';

export default function ImageExportControls({screens,currentId}:{screens:GeneratedUIShape[];currentId?:string}) {
  const [selectedId,setSelectedId]=useState(currentId||screens[0]?.id||'');
  const [busy,setBusy]=useState(false);const [progress,setProgress]=useState('');
  const current=screens.find(screen=>screen.id===selectedId)||screens[0];
  const ready=screens.filter(screen=>!!screen.uiSpecData&&!screen.isGenerating);
  const exporting=React.useRef(false);
  const download=async(format:ScreenImageFormat,all:boolean)=>{
    if(exporting.current)return;
    const targets=all?screens:current?[current]:[];
    if(targets.some(screen=>screen.isGenerating||!screen.uiSpecData)){toast.error('Wait for screen generation to finish before exporting.');return;}
    exporting.current=true;setBusy(true);
    try{await downloadScreenImages(targets,format,all,(done,total)=>setProgress(`Exporting ${format.toUpperCase()} · ${Math.min(done+1,total)} / ${total}`));toast.success(all?`All ${targets.length} screens downloaded as ${format.toUpperCase()} in a ZIP.`:`${format.toUpperCase()} downloaded.`);}
    catch(error){toast.error(error instanceof Error?error.message:'Image export failed. Please retry.');}
    finally{exporting.current=false;setBusy(false);setProgress('');}
  };
  return <section aria-label="Download screen images" className="mb-5 space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
    <div className="flex items-center gap-2 text-sm font-semibold"><Download size={16}/>Download screen images</div>
    <div className="space-y-2"><label htmlFor="export-current-screen" className="block text-xs font-medium text-muted-foreground">Current screen</label><select id="export-current-screen" value={current?.id||''} onChange={event=>setSelectedId(event.target.value)} disabled={busy||!screens.length} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">{screens.map((screen,index)=><option key={screen.id} value={screen.id}>{screen.screenName||`Screen ${index+1}`}</option>)}</select><div className="flex gap-2">{(['png','jpg','svg'] as const).map(format=><button key={format} disabled={busy||!current||current.isGenerating||!current.uiSpecData} onClick={()=>void download(format,false)} className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40">Current screen · {format.toUpperCase()}</button>)}</div></div>
    <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">All screens ({ready.length}/{screens.length} ready) · ZIP download</p><div className="flex gap-2">{(['png','jpg','svg'] as const).map(format=><button key={format} disabled={busy||!screens.length||ready.length!==screens.length} onClick={()=>void download(format,true)} className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40">All screens · {format.toUpperCase()}</button>)}</div></div>
    {busy&&<p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin"/>{progress}</p>}
    <p className="text-[11px] leading-5 text-muted-foreground">PNG/JPG export at 2× resolution. SVG retains HTML/CSS using foreignObject; use a browser for full rendering.</p>
  </section>;
}
