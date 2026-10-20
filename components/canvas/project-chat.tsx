"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { MessageSquare, Send, X, Square, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { AppStore, useAppDispatch, useAppSelector } from '@/redux/store';
import { addProjectChatMessage, applyProjectChatChanges, GeneratedUIShape, Shape } from '@/redux/slice/shapes';
import { useElementInspector } from '@/components/canvas/element-inspector/context';
import { identifyHtmlElements } from '@/lib/element-editing';
import { ChatChange, parseChatPlan, prepareChatChanges, ProjectChatPlan, ProjectChatMessage } from '@/lib/project-chat';
import { parseSSEStream } from '@/lib/stream-utils';

type Proposal={plan:ProjectChatPlan;changes:ChatChange[]};
export default function ProjectChat({projectId,isOpen,onClose,targetScreenId,initialPrompt=''}:{projectId:string;isOpen:boolean;onClose:()=>void;targetScreenId:string|null;initialPrompt?:string}) {
  const dispatch=useAppDispatch();const store=useStore.withTypes<AppStore>()();const inspector=useElementInspector();
  const messages:ProjectChatMessage[]=useAppSelector(state=>state.shapes.projectMessages);
  const [input,setInput]=useState('');const [busy,setBusy]=useState(false);const [progress,setProgress]=useState('');
  const [proposal,setProposal]=useState<Proposal|null>(null);const [retry,setRetry]=useState<string|null>(null);
  const request=useRef<AbortController|null>(null);const scroll=useRef<HTMLDivElement>(null);const lastRequest=useRef('');
  useEffect(()=>{if(initialPrompt)setInput(initialPrompt);},[initialPrompt]);
  const append=(content:string,error=false,role:'user'|'assistant'='assistant')=>dispatch(addProjectChatMessage({projectId,message:{id:crypto.randomUUID(),role,content,error,timestamp:new Date().toISOString()}}));
  const current=()=>store.getState().shapes.activeProjectId===projectId;
  useEffect(()=>()=>{request.current?.abort();},[]);
  useEffect(()=>{if(!isOpen)request.current?.abort();},[isOpen]);
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight});},[messages,progress,proposal]);
  useEffect(()=>{
    if(!isOpen)return;
    const media=matchMedia('(min-width:1024px)');const update=()=>document.documentElement.style.setProperty('--openui-chat-width',media.matches?'360px':'0px');
    update();media.addEventListener('change',update);return()=>{media.removeEventListener('change',update);document.documentElement.style.removeProperty('--openui-chat-width');};
  },[isOpen]);

  const apply=(pending:Proposal)=>{
    if(!current())return;
    const state=store.getState().shapes;
    for(const change of pending.changes){const shape=state.shapes.entities[change.id];if(shape?.type!=='generatedui'||shape.locked||shape.isGenerating||shape.uiSpecData!==change.before){append('The design changed while this proposal was being prepared. Send the request again to use the latest version.',true);setProposal(null);return;}}
    const creates=pending.plan.actions.filter(action=>action.type==='create');
    dispatch(applyProjectChatChanges({projectId,changes:pending.changes,creates}));
    setProposal(null);append(`Applied ${pending.changes.length+creates.length} screen change${pending.changes.length+creates.length===1?'':'s'}.`);
  };
  const send=async(text=input)=>{
    const prompt=text.trim();if(!prompt||request.current||proposal||!current())return;
    const controller=new AbortController();request.current=controller;lastRequest.current=prompt;setBusy(true);setRetry(null);setInput('');setProgress('Reading project…');append(prompt,false,'user');
    const state=store.getState();
    const screens=(Object.values(state.shapes.shapes.entities) as (Shape|undefined)[]).filter((shape):shape is GeneratedUIShape=>shape?.type==='generatedui');
    const selected=inspector.selection;
    const selection=selected?{shapeId:selected.shapeId,elementId:selected.elementId,info:selected.info}:null;
    const timeout=setTimeout(()=>controller.abort(new DOMException('The provider took too long. Please retry.','TimeoutError')),120000);
    try{
      const streamId=crypto.randomUUID();
      const response=await fetch('/api/generate/redesign',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({mode:'project-chat',projectId,streamId,userMessage:prompt,context:{
        screens:screens.map(screen=>({id:screen.id,name:screen.screenName||screen.id,html:identifyHtmlElements(screen.uiSpecData||''),width:screen.w,height:screen.h,x:screen.x,y:screen.y})),
        selectedScreenIds:Object.keys(state.shapes.selected).length?Object.keys(state.shapes.selected):targetScreenId?[targetScreenId]:[],selectedElement:selection,
        guide:state.styleGuide.guide,viewport:{scale:state.viewport.scale,translate:state.viewport.translate},history:(state.shapes.projectMessages as ProjectChatMessage[]).slice(-20).map(({role,content})=>({role,content:content.slice(0,12000)})),
      }})});
      if(!response.ok){const problem=await response.json().catch(()=>null);throw new Error(problem?.error||`Provider request failed (${response.status}).`);}
      if(!response.body)throw new Error('The provider returned no response stream.');
      const raw=await parseSSEStream(response.body.getReader(),streamId,accumulated=>{
        if(controller.signal.aborted||!current())return;
        // Stream only the human-readable reply; generated source never fills the chat bubbles.
        const partial=accumulated.match(/"message"\s*:\s*"((?:[^"\\]|\\[\s\S])*)/)?.[1];
        setProgress(partial?partial.replace(/\\n/g,'\n').replace(/\\"/g,'"'):'Preparing project changes…');
      });
      if(controller.signal.aborted||!current())return;
      const plan=parseChatPlan(raw);const changes=prepareChatChanges(plan,screens,selection);
      for(const action of plan.actions)if(action.type==='element')for(const [property,value] of Object.entries(action.patch.styles||{}))if(!CSS.supports(property,value))throw new Error(`The provider returned an invalid ${property} value. Retry with a specific value.`);
      if(plan.actions.length){const pending={plan,changes};
        if(changes.length+plan.actions.filter(action=>action.type==='create').length>1||plan.actions.some(action=>action.type==='redesign')){append('Prepared the requested changes. Review the previews below before applying them.');setProposal(pending);}
        else {apply(pending);append(plan.message);}
      } else append(plan.message);
    }catch(error){if(!current())return;if(controller.signal.aborted){const timedOut=controller.signal.reason?.name==='TimeoutError';append(timedOut?'The provider took too long. Please retry.':'Cancelled. No pending AI changes were applied.',timedOut);setRetry(prompt);}else {append(error instanceof Error?error.message:'Chat failed. Please retry.',true);setRetry(prompt);}}
    finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setBusy(false);setProgress('');}}
  };
  if(!isOpen)return null;
  return <aside aria-label="Project chat" className="z-60 flex h-full w-[360px] max-w-[100vw] shrink-0 flex-col border-l border-white/15 bg-[#111315] text-zinc-100 max-lg:absolute max-lg:right-0 openui-panel-overlay max-lg:!top-[var(--openui-header-height)] max-lg:bottom-28 max-lg:h-auto max-lg:rounded-l-2xl">
    <header className="flex items-center justify-between px-5 py-5"><h2 className="flex items-center gap-2 text-base font-semibold"><MessageSquare size={18}/>Chat</h2><button aria-label="Close chat" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X size={17}/></button></header>
    <div ref={scroll} aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 text-sm">
      {!messages.length&&<><div className="rounded-2xl bg-[#202327] p-4"><Sparkles className="mb-3 text-orange-400" size={25}/><p className="font-semibold">Hi! I’m your AI assistant.</p><p className="mt-2 text-xs leading-5 text-zinc-400">Ask me to create screens, edit selected elements, or explain this project’s design system.</p></div>{['Add a settings screen matching my existing design.','What colors and fonts does this project use?'].map(text=><button key={text} onClick={()=>setInput(text)} className="block rounded-full border border-white/15 px-3 py-2 text-left text-xs hover:bg-white/5">{text}</button>)}</>}
      {messages.map(message=><div key={message.id} className={`${message.role==='user'?'ml-7 bg-[#24282d]':'mr-3 bg-[#1d2024]'} rounded-2xl p-3.5`}><p className={`whitespace-pre-wrap text-sm leading-6 ${message.error?'text-red-300':''}`}>{message.content}</p><p className="mt-2 text-[10px] text-zinc-500">{message.role==='user'?'You':'Assistant'} · {new Date(message.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p></div>)}
      {busy&&<div className="rounded-2xl bg-[#1d2024] p-3 text-sm leading-6"><Loader2 size={15} className="mb-2 animate-spin text-orange-400"/>{progress}</div>}
      {retry&&!busy&&<button onClick={()=>void send(retry)} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs"><RotateCcw size={13}/>Retry</button>}
      {proposal&&<section aria-label="Proposed changes" className="space-y-3 rounded-xl border border-orange-500/40 p-3"><p className="font-semibold">Review changes</p><p className="text-xs text-zinc-400">{proposal.changes.length} existing screen(s) will change. Other screens keep their content and IDs.</p>{proposal.changes.map(change=><details key={change.id}><summary className="cursor-pointer text-xs">Preview {store.getState().shapes.shapes.entities[change.id]?.type==='generatedui'?(store.getState().shapes.shapes.entities[change.id] as GeneratedUIShape).screenName||change.id:change.id}</summary><iframe title={`Proposed ${change.id}`} sandbox="" srcDoc={change.html} className="mt-2 h-64 w-full rounded-lg bg-white"/></details>)}<div className="flex gap-2"><button onClick={()=>apply(proposal)} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold">Apply changes</button><button onClick={()=>{setProposal(null);append('Proposal dismissed. Existing screens were kept.');}} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Discard</button></div></section>}
    </div>
    <form onSubmit={event=>{event.preventDefault();void send();}} className="m-4 rounded-2xl border border-orange-600 bg-[#1b1d20] p-3 focus-within:ring-1 focus-within:ring-orange-500">
      <textarea aria-label="Chat message" value={input} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}} placeholder="Type your message here…" rows={3} disabled={busy||!!proposal} className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-zinc-500 disabled:opacity-60"/>
      <div className="flex items-center justify-between"><span className="truncate pr-2 text-[10px] text-zinc-500">{inspector.selection?`Selected: ${inspector.selection.info.name}`:'Entire active project'}</span>{busy?<button type="button" aria-label="Cancel response" onClick={()=>request.current?.abort()} className="rounded-full bg-zinc-700 p-2.5"><Square size={15}/></button>:<button type="submit" aria-label="Send message" disabled={!input.trim()||!!proposal} className="rounded-full bg-orange-600 p-2.5 hover:bg-orange-500 disabled:opacity-40"><Send size={16}/></button>}</div>
    </form>
  </aside>;
}
