"use client";
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { RotateCcw } from 'lucide-react';
import type { ElementPatch } from '@/lib/element-editing';
import type { ColorControlInfo } from '@/lib/element-color-info';
import { colorHex, colorWithAlpha, replaceColorRGB, validColor } from '@/lib/color-values';

type Preset={name:string;color:string};
function themePresets():Preset[]{
 const dark=document.documentElement.classList.contains('dark');
 const token=(name:string,fallback:string)=>{
  const probe=document.createElement('span');probe.style.color=`var(${name}, ${fallback})`;probe.style.display='none';document.body.appendChild(probe);
  const color=getComputedStyle(probe).color;probe.remove();return colorHex(color)||fallback;
 };
 return [{name:'Orange accent',color:token('--primary','#FF5A36')},{name:'Dark espresso',color:token(dark?'--background':'--foreground','#2E2925')},{name:'White',color:'#FFFFFF'},{name:'Neutral gray',color:token('--muted-foreground','#7E746B')}];
}
function ColorField({control,apply,presets}:{control:ColorControlInfo;apply:(patch:ElementPatch,group?:string)=>boolean;presets:Preset[]}){
 const [draft,setDraft]=useState(control.value),[invalid,setInvalid]=useState(false);const focused=useRef(false);
 const group=useRef('');const newGroup=()=>{group.current=`color:${control.targetId}:${control.property}:${Date.now()}`;};
 useEffect(()=>{if(!focused.current)setDraft(control.value);},[control.value]);
 const resolved=/^(?:var\(|inherit$|currentcolor$|unset$|revert$)/i.test(control.value)?control.computed:control.value;
 const hex=colorHex(resolved),rgb=hex?.slice(0,7)||'#000000',alpha=hex?.length===9?Math.round(parseInt(hex.slice(7),16)/255*100):100;
 function change(value:string|null){
  if(value!==null&&!validColor(value,control.property==='fill'||control.property==='stroke')){setInvalid(true);return false;}
  const ok=apply({color:{property:control.property,value,targetId:control.targetId}},group.current||`color:${control.targetId}:${control.property}`);
  setInvalid(!ok);if(ok&&value!==null)setDraft(value);return ok;
 }
 return <div className="space-y-2">
  <div className="flex items-center justify-between gap-2"><label htmlFor={`color-${control.targetId}-${control.property}`} className="text-xs text-muted-foreground">{control.label}</label><button type="button" aria-label={`Reset ${control.label}`} title="Restore original inline color or inherited/class color" disabled={!control.edited} onClick={()=>{newGroup();if(change(null)){focused.current=false;setInvalid(false);}}} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><RotateCcw size={13}/></button></div>
  <div className="flex items-center gap-2">
   <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border" title={`Choose ${control.label}`} style={{backgroundImage:'conic-gradient(#ddd 25%,#fff 0 50%,#ddd 0 75%,#fff 0)',backgroundSize:'8px 8px'}}>
    <span className="absolute inset-0" style={{background:control.value==='none'?'transparent':resolved}}/>
    <input aria-label={`${control.label} picker`} type="color" value={rgb} onPointerDown={newGroup} onFocus={newGroup} onChange={event=>change(replaceColorRGB(event.target.value,hex||'#000000'))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
   </label>
   <input id={`color-${control.targetId}-${control.property}`} aria-label={control.label} aria-invalid={invalid} value={draft} spellCheck={false} onFocus={()=>{focused.current=true;newGroup();}} onChange={event=>{setDraft(event.target.value);if(event.target.value.trim())change(event.target.value);else setInvalid(true);}} onBlur={()=>{focused.current=false;if(!invalid)setDraft(control.value);}} onKeyDown={event=>{if(event.key==='Escape'){setDraft(control.value);setInvalid(false);event.currentTarget.blur();}}} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs aria-invalid:border-red-500"/>
  </div>
  {invalid&&<p role="alert" className="text-xs text-red-500">Enter a valid color, such as #FF5A36 or #FF5A3680.</p>}
  <div className="flex items-center gap-2"><label className="text-[10px] text-muted-foreground" htmlFor={`alpha-${control.targetId}-${control.property}`}>Alpha</label><input id={`alpha-${control.targetId}-${control.property}`} aria-label={`${control.label} alpha`} type="range" min="0" max="100" value={alpha} disabled={!hex} onPointerDown={newGroup} onFocus={newGroup} onChange={event=>{const color=colorWithAlpha(hex||'',Number(event.target.value));if(color)change(color);}} className="min-w-0 flex-1 accent-primary"/><span className="w-8 text-right text-[10px] text-muted-foreground">{hex?`${alpha}%`:'—'}</span></div>
  <div className="flex flex-wrap gap-1.5">{presets.map(preset=><button key={preset.name} type="button" aria-label={`${control.label}: ${preset.name}`} title={preset.name} onClick={()=>{newGroup();change(replaceColorRGB(preset.color.slice(0,7),hex||preset.color));}} className="h-5 w-5 rounded border" style={{backgroundColor:preset.color}}/>)}<button type="button" aria-label={`${control.label}: Transparent`} title="Transparent" onClick={()=>{newGroup();change('transparent');}} className="h-5 rounded border px-1 text-[9px]">Clear</button>{/^(fill|stroke)$/.test(control.property)&&<button type="button" aria-label={`${control.label}: None`} onClick={()=>{newGroup();change('none');}} className="h-5 rounded border px-1 text-[9px]">None</button>}</div>
  {control.gradient&&<p className="text-[10px] text-muted-foreground">{control.property==='background-color'?'Existing gradient/image stays above this background color.':'This paint uses a gradient. Choosing a color replaces only the selected paint.'}</p>}
 </div>;
}
export default function ColorControls({controls,apply,svgChildren,pick}:{controls:ColorControlInfo[];apply:(patch:ElementPatch,group?:string)=>boolean;svgChildren:Array<{id:string;name:string}>;pick:(id:string)=>void}){
 const {resolvedTheme}=useTheme();const [presets,setPresets]=useState<Preset[]>([]);
 useEffect(()=>{setPresets(themePresets());},[resolvedTheme]);
 return <div className="space-y-4">{controls.map(control=><ColorField key={`${control.targetId}:${control.property}`} control={control} apply={apply} presets={presets}/>)}{svgChildren.length>0&&<div><p className="mb-2 text-[10px] text-muted-foreground">Paths with their own paint remain unchanged. Select a shape to edit it:</p><div className="flex flex-wrap gap-1">{svgChildren.map(child=><button type="button" key={child.id} onClick={()=>pick(child.id)} className="rounded border px-2 py-1 text-[10px]">{child.name}</button>)}</div></div>}<p className="text-[10px] text-muted-foreground">Hex supports RGB and alpha (#RRGGBBAA). Reset restores the original or inherited color. Text colors naturally inherit to unstyled children.</p></div>;
}
