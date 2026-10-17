"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { undo, redo } from "@/redux/slice/shapes";
import { ELEMENT_ID, ElementPatch } from "@/lib/element-editing";
import { useElementInspector } from "@/components/canvas/element-inspector/context";

export function useEditableFrame(iframeRef:React.RefObject<HTMLIFrameElement|null>,shapeId:string,loaded:number,isPlayMode:boolean,isGenerating:boolean){
  const inspector=useElementInspector(),current=useRef(inspector);current.current=inspector;
  const dispatch=useAppDispatch();
  const tool=useAppSelector(state=>state.shapes.tool) as string;
  const mode=useAppSelector(state=>state.viewport.mode) as string;
  const locked=useAppSelector(state=>state.shapes.shapes.entities[shapeId]?.locked) as boolean|undefined;
  const enabled=!isPlayMode&&!isGenerating&&!locked&&tool==='select'&&mode==='idle';
  const painter=useRef<(()=>void)|null>(null);
  useLayoutEffect(()=>{painter.current?.();});
  useEffect(()=>{if(isPlayMode&&current.current.selection?.shapeId===shapeId)current.current.clear();},[isPlayMode,shapeId]);
  useEffect(()=>{
    const win=iframeRef.current?.contentWindow;if(!loaded||!win||isPlayMode)return;
    const forward=(event:KeyboardEvent)=>{if(event.code==='Space'||(!event.ctrlKey&&!event.metaKey&&['KeyV','KeyH','KeyF','KeyR','KeyO','KeyA','KeyL','KeyT','KeyP'].includes(event.code))){event.preventDefault();event.stopImmediatePropagation();document.dispatchEvent(new KeyboardEvent(event.type,{code:event.code,key:event.key,bubbles:true}));}};
    win.addEventListener('keydown',forward,true);win.addEventListener('keyup',forward,true);
    return()=>{win.removeEventListener('keydown',forward,true);win.removeEventListener('keyup',forward,true);};
  },[iframeRef,loaded,isPlayMode]);
  useEffect(()=>{
    const frame=iframeRef.current,doc=frame?.contentDocument,win=doc?.defaultView;
    if(!enabled||!loaded||!frame||!doc||!win)return;
    if(frame.contentWindow!==win || (doc.location.origin!==window.location.origin && doc.URL!=='about:srcdoc'))return;
    const editingStyle=doc.createElement('style');editingStyle.textContent='[data-openui-element]{transition:none!important;animation-play-state:paused!important}';doc.head.appendChild(editingStyle);
    const overlay=doc.createElement('div');overlay.setAttribute('data-openui-editor','selection');
    overlay.style.cssText='position:fixed;border:2px solid #ff4d68;pointer-events:none;z-index:2147483646;box-sizing:border-box;display:none;';
    const move=doc.createElement('button');move.type='button';move.textContent='Move';move.setAttribute('aria-label','Move selected element');move.setAttribute('data-openui-handle','move');
    move.style.cssText='position:absolute;right:0;top:-25px;height:24px;font:12px sans-serif;background:#ff4d68;color:white;border:0;border-radius:4px;pointer-events:auto;cursor:grab;';overlay.appendChild(move);
    const resize=doc.createElement('button');resize.type='button';resize.setAttribute('aria-label','Resize selected element');resize.setAttribute('data-openui-handle','resize');
    resize.style.cssText='position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:white;border:2px solid #ff4d68;pointer-events:auto;cursor:nwse-resize;';overlay.appendChild(resize);
    doc.body.appendChild(overlay);
    const element=()=>{const selection=current.current.selection;return selection?.shapeId===shapeId?doc.querySelector(`[${ELEMENT_ID}="${CSS.escape(selection.elementId)}"]`):null;};
    const paint=()=>{const target=element();if(!target){overlay.style.display='none';return;}const box=target.getBoundingClientRect();Object.assign(overlay.style,{display:'block',left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`});resize.style.right=`${Math.max(-6,box.right-win.innerWidth+8)}px`;resize.style.bottom=`${Math.max(-6,box.bottom-win.innerHeight+8)}px`;move.style.right=`${Math.max(0,box.right-win.innerWidth+8)}px`;resize.style.display=/^(path|input|select|textarea|img|svg|div|section|article|main|nav|header|footer|aside|button|a|h[1-6]|p|span|figure|ul|li|table|form|label)$/i.test(target.tagName)?'block':'none';};
    painter.current=paint;
    let gesture:{x:number;y:number;width:number;height:number;tx:number;ty:number;kind:string;pointerId:number;capture:Element;group:string}|null=null;
    const suppress=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const target=event.target as Element;
      const action=target.closest('[data-openui-handle]');
      if(target.closest('[data-openui-editor]')&&!action)return;
      if(!action&&!target.closest('#mockup-root'))return;
      const hit=action?element():(target.closest('svg')||target.closest('input,textarea,select')||target.closest('button,a')||target).closest(`[${ELEMENT_ID}]`);
      if(!hit)return;
      suppress(event);
      win.focus();
      const alreadySelected=hit===element();
      if(!action)current.current.select(frame,shapeId,hit);
      if(action||alreadySelected){const box=hit.getBoundingClientRect(),css=win.getComputedStyle(hit),translate=css.translate.split(/\s+/);const capture=(action||hit) as Element;capture.setPointerCapture?.(event.pointerId);
        gesture={x:event.clientX,y:event.clientY,width:box.width,height:box.height,tx:parseFloat(translate[0])||0,ty:parseFloat(translate[1])||0,kind:action?.getAttribute('data-openui-handle')||'move',pointerId:event.pointerId,capture,group:`gesture-${Date.now()}`};
      }
      paint();
    };
    const movePointer=(event:PointerEvent)=>{if(!gesture)return;suppress(event);const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.abs(dx)+Math.abs(dy)<1)return;
      const patch:ElementPatch=gesture.kind==='resize'?{styles:{width:`${Math.max(8,gesture.width+dx)}px`,height:`${Math.max(8,gesture.height+dy)}px`,'box-sizing':'border-box','max-width':'100%'}}:{styles:{translate:`${gesture.tx+dx}px ${gesture.ty+dy}px`}};
      current.current.apply(patch,gesture.group);paint();
    };
    const up=(event:PointerEvent)=>{if(!gesture)return;suppress(event);gesture.capture.releasePointerCapture?.(gesture.pointerId);gesture=null;current.current.refresh();paint();};
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();event.stopPropagation();
      const bounds=frame.getBoundingClientRect(),scale=bounds.width/frame.clientWidth;
      frame.dispatchEvent(new WheelEvent('wheel',{deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,clientX:bounds.x+event.clientX*scale,clientY:bounds.y+event.clientY*scale,bubbles:true,cancelable:true}));
    };
    const click=(event:Event)=>{const target=event.target as Element;if(target.closest('#mockup-root,[data-openui-editor]'))suppress(event);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){suppress(event);current.current.clear();paint();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){suppress(event);dispatch(event.shiftKey?redo():undo());return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){suppress(event);dispatch(redo());return;}
    };
    win.addEventListener('pointerdown',down,true);win.addEventListener('pointermove',movePointer,true);win.addEventListener('pointerup',up,true);win.addEventListener('pointercancel',up,true);win.addEventListener('click',click,true);win.addEventListener('dblclick',click,true);win.addEventListener('submit',click,true);win.addEventListener('keydown',key,true);win.addEventListener('keyup',key,true);win.addEventListener('scroll',paint,true);win.addEventListener('wheel',wheel,{passive:false});
    const observer=new ResizeObserver(paint);observer.observe(doc.getElementById('mockup-root')||doc.body);paint();
    return()=>{observer.disconnect();overlay.remove();editingStyle.remove();painter.current=null;win.removeEventListener('pointerdown',down,true);win.removeEventListener('pointermove',movePointer,true);win.removeEventListener('pointerup',up,true);win.removeEventListener('pointercancel',up,true);win.removeEventListener('click',click,true);win.removeEventListener('dblclick',click,true);win.removeEventListener('submit',click,true);win.removeEventListener('keydown',key,true);win.removeEventListener('keyup',key,true);win.removeEventListener('scroll',paint,true);win.removeEventListener('wheel',wheel);};
  },[enabled,loaded,iframeRef,shapeId,dispatch]);
  return enabled;
}
