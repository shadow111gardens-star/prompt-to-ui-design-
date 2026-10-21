"use client";
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { Shape, GeneratedUIShape, editGeneratedElement, clearSelection, selectShape } from "@/redux/slice/shapes";
import { ELEMENT_ID, ElementPatch, identifyHtmlElements, patchElementHtml, liveElementHtml, ownsEditableElement } from "@/lib/element-editing";
import { toast } from "sonner";

export type ElementInfo = { tag: string; name: string; text: string; textEditable: boolean; isIcon:boolean; parentDisplay:string; x: number; y: number; width: number; height: number; styles: Record<string,string>; attributes: Record<string,string>; parents: Array<{id:string;name:string}> };
export type ElementSelection = { shapeId:string; elementId:string; info:ElementInfo };
type InspectorContext = {
  selection:ElementSelection|null; open:boolean; setOpen:(open:boolean)=>void;
  select:(iframe:HTMLIFrameElement,shapeId:string,element:Element)=>void;
  refresh:()=>void; clear:()=>void; apply:(patch:ElementPatch,group?:string)=>boolean;
  pickParent:(id:string)=>void;
};
const Context=createContext<InspectorContext|null>(null);
export const useElementInspector=()=>{const value=useContext(Context);if(!value)throw new Error("Element inspector must be inside its canvas provider.");return value;};
export function describeElement(element:Element):ElementInfo {
  const doc=element.ownerDocument, win=doc.defaultView!;const css=win.getComputedStyle(element),box=element.getBoundingClientRect(),parent=element.parentElement?.getBoundingClientRect();
  const styles:Record<string,string>={};
  for(const prop of ["display","margin","padding","gap","flex-direction","flex-wrap","align-items","justify-content","align-self","flex-grow","flex-shrink","flex-basis","grid-column","grid-row","grid-template-columns","grid-template-rows","border-radius","font-family","font-size","font-weight","line-height","letter-spacing","text-align","color","background-color","background-image","border-color","border-width","border-style","opacity","box-shadow","visibility","translate"])styles[prop]=css.getPropertyValue(prop);
  const attributes:Record<string,string>={};for(const prop of ["src","alt","href","disabled","placeholder","type","value","aria-label","data-openui-asset","data-image-query"]) {const attr=element.getAttribute(prop);if(attr!==null)attributes[prop]=attr;}
  if(element.tagName.toLowerCase()==='textarea')attributes.value=(element as HTMLTextAreaElement).value;
  const parents:ElementInfo["parents"]=[];let ancestor=element.parentElement;
  while(ancestor && ancestor.id!=="mockup-root"){const id=ancestor.getAttribute(ELEMENT_ID);if(id)parents.push({id,name:ancestor.tagName.toLowerCase()+(ancestor.id?`#${ancestor.id}`:"")});ancestor=ancestor.parentElement;}
  const tag=element.tagName.toLowerCase();
  const hasBlocks=[...element.children].some(child=>! /^(span|strong|em|b|i|u|small|br|svg|path)$/i.test(child.tagName));
  const walker=doc.createTreeWalker(element,4);let text="",node:Node|null;
  while((node=walker.nextNode()))if(!node.parentElement?.closest('svg,script,style'))text+=node.textContent||"";
  return {tag,name:element.getAttribute('aria-label')||element.id||text.trim().slice(0,45)||tag,text:text.trim(),parentDisplay:element.parentElement?win.getComputedStyle(element.parentElement).display:'',isIcon:tag==='svg'&&box.width<=64&&box.height<=64,textEditable:!/^(img|svg|input|select|textarea|video|canvas|iframe)$/.test(tag)&&(!hasBlocks||/^(h[1-6]|p|button|a|label)$/.test(tag)),x:box.x-(parent?.x||0),y:box.y-(parent?.y||0),width:box.width,height:box.height,styles,attributes,parents};
}
function synchronizeTextTree(target: Node, source: Node) {
  let cursor = target.firstChild;
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === 3) {
      if (cursor?.nodeType === 3) { cursor.nodeValue = child.nodeValue; cursor = cursor.nextSibling; }
      else target.insertBefore(target.ownerDocument!.createTextNode(child.nodeValue || ""), cursor);
    } else {
      while (cursor?.nodeType === 3) { const next = cursor.nextSibling; target.removeChild(cursor); cursor = next; }
      if (cursor?.nodeType === child.nodeType) {
        if (child.nodeType === 1) synchronizeTextTree(cursor, child);
        cursor = cursor.nextSibling;
      }
    }
  }
  while (cursor) { const next = cursor.nextSibling; if (cursor.nodeType === 3) target.removeChild(cursor); cursor = next; }
}

function synchronizeTarget(element:Element,html:string,id:string,patch:ElementPatch){
  const parsed=new DOMParser().parseFromString(html,'text/html');const updated=parsed.querySelector(`[${ELEMENT_ID}="${CSS.escape(id)}"]`);if(!updated)return;
  if(patch.styles)element.setAttribute('style',updated.getAttribute('style')||'');
  for(const key of Object.keys(patch.attributes||{})){const value=updated.getAttribute(key);if(value===null)element.removeAttribute(key);else element.setAttribute(key,value);if(key==='value' && 'value' in element)(element as HTMLInputElement).value=value||'';}
  if(patch.icon) {element.innerHTML=updated.innerHTML;element.setAttribute('viewBox','0 0 24 24');element.setAttribute('fill','none');element.setAttribute('stroke','currentColor');element.setAttribute('stroke-width','2');}
  if(patch.text!==undefined){if(element.tagName.toLowerCase()==='textarea')(element as HTMLTextAreaElement).value=patch.text;synchronizeTextTree(element,updated);}
}
export function ElementInspectorProvider({children}:{children:React.ReactNode}){
  useEffect(()=>{const notice=(event:Event)=>{const warnings=(event as CustomEvent<unknown>).detail;if(Array.isArray(warnings)&&typeof warnings[0]==='string')toast.warning(warnings[0]);};window.addEventListener('openui-image-status',notice);return()=>window.removeEventListener('openui-image-status',notice);},[]);
  const dispatch=useAppDispatch();const entities=useAppSelector(state=>state.shapes.shapes.entities) as Record<string,Shape|undefined>;
  const selectedShapes=useAppSelector(state=>state.shapes.selected) as Record<string,boolean>;
  const entitiesRef=useRef(entities);entitiesRef.current=entities;
  const [selection,setSelection]=useState<ElementSelection|null>(null);const [open,setOpen]=useState(false);
  const selectedRef=useRef<{iframe:HTMLIFrameElement;shapeId:string;id:string}|null>(null);
  const lastEdit=useRef({key:'',time:0});
  const clear=useCallback(()=>{selectedRef.current=null;setSelection(null);lastEdit.current={key:'',time:0};},[]);
  const refresh=useCallback(()=>{const selected=selectedRef.current;if(!selected)return;const shape=entitiesRef.current[selected.shapeId];const element=selected.iframe.contentDocument?.querySelector(`[${ELEMENT_ID}="${CSS.escape(selected.id)}"]`);if(!shape||!element||shape.type!=='generatedui'||shape.isGenerating){clear();return;}setSelection({shapeId:selected.shapeId,elementId:selected.id,info:describeElement(element)});},[clear]);
  const select=useCallback((iframe:HTMLIFrameElement,shapeId:string,element:Element)=>{
    const shape=entitiesRef.current[shapeId];const id=element.getAttribute(ELEMENT_ID);
    // Direct same-origin bridge: no arbitrary message payload or foreign window can edit a screen.
    if(!id||!shape||shape.type!=='generatedui'||shape.locked||shape.isGenerating||!ownsEditableElement(iframe,shapeId,element))return;
    selectedRef.current={iframe,shapeId,id};lastEdit.current={key:'',time:0};dispatch(clearSelection());dispatch(selectShape(shapeId));setOpen(true);refresh();
  },[dispatch,refresh]);
  const apply=useCallback((patch:ElementPatch,group='property')=>{
    const selected=selectedRef.current;if(!selected)return false;const shape=entitiesRef.current[selected.shapeId] as GeneratedUIShape|undefined;
    const element=selected.iframe.contentDocument?.querySelector(`[${ELEMENT_ID}="${CSS.escape(selected.id)}"]`);
    if(!shape?.uiSpecData||shape.locked||shape.isGenerating||!element||!ownsEditableElement(selected.iframe,selected.shapeId,element))return false;
    try {
      if ((patch.styles?.width || patch.styles?.height) && /^(div|section|article|main|nav|header|footer|aside|form|ul|li|figure|p|h[1-6]|button|a|span|label)$/i.test(element.tagName)) patch={...patch,styles:{'min-height':'min-content',...patch.styles}};
      if ((patch.styles?.width || patch.styles?.height) && element.ownerDocument.defaultView?.getComputedStyle(element).display==='inline') patch={...patch,styles:{display:'inline-block',...patch.styles}};
      for(const [key,value] of Object.entries(patch.styles||{}))if(value&&!CSS.supports(key,value))return false;
      const source=identifyHtmlElements(shape.uiSpecData);const html=patchElementHtml(source,selected.id,patch);
      const key=`${shape.id}:${selected.id}:${group}`;const recordHistory=lastEdit.current.key!==key||Date.now()-lastEdit.current.time>800;
      synchronizeTarget(element,html,selected.id,patch);liveElementHtml.set(selected.iframe,html);
      entitiesRef.current={...entitiesRef.current,[shape.id]:{...shape,uiSpecData:html}};
      dispatch(editGeneratedElement({id:shape.id,html,recordHistory}));lastEdit.current={key,time:Date.now()};refresh();return true;
    }catch(error){toast.error(error instanceof Error?error.message:'Could not edit this element.');return false;}
  },[dispatch,refresh]);
  const pickParent=useCallback((id:string)=>{const selected=selectedRef.current;if(!selected)return;const element=selected.iframe.contentDocument?.querySelector(`[${ELEMENT_ID}="${CSS.escape(id)}"]`);if(element)select(selected.iframe,selected.shapeId,element);},[select]);
  useEffect(()=>{
    const selected=selectedRef.current;
    if(selected){const shape=entities[selected.shapeId];if(shape?.type==='generatedui'&&liveElementHtml.get(selected.iframe)!==shape.uiSpecData)lastEdit.current={key:'',time:0};}
    refresh();
  },[entities,refresh]);
  useEffect(()=>{const selected=selectedRef.current;if(selected&&!selectedShapes[selected.shapeId])clear();},[selectedShapes,clear]);
  useEffect(()=>{const media=matchMedia('(min-width: 1024px)');const update=()=>document.documentElement.style.setProperty('--openui-inspector-width',open&&media.matches?'320px':'0px');update();media.addEventListener('change',update);return()=>{media.removeEventListener('change',update);document.documentElement.style.removeProperty('--openui-inspector-width');};},[open]);
  return <Context.Provider value={{selection,open,setOpen,select,refresh,clear,apply,pickParent}}>{children}</Context.Provider>;
}
