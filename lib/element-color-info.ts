import type { ColorProperty } from '@/lib/color-values';
import { COLOR_ORIGINAL, colorOriginals } from '@/lib/element-colors';
import { ELEMENT_ID } from '@/lib/element-editing';
export type ColorControlInfo={property:ColorProperty;label:string;value:string;computed:string;edited:boolean;targetId:string;gradient:boolean};
export function describeElementColors(element:Element):ColorControlInfo[]{
 const win=element.ownerDocument.defaultView!,css=win.getComputedStyle(element),tag=element.tagName.toLowerCase();
 const svg=element.namespaceURI==='http://www.w3.org/2000/svg',controls:ColorControlInfo[]=[];
 function add(property:ColorProperty,label:string,target=element){
  const id=target.getAttribute(ELEMENT_ID);if(!id)return;
  const inline=(target as HTMLElement|SVGElement).style;
  const pseudo=property==='placeholder-color',targetCSS=win.getComputedStyle(target,pseudo?'::placeholder':null);
  const value=inline.getPropertyValue(pseudo?'--openui-placeholder-color':property).trim();
  const computed=targetCSS.getPropertyValue(pseudo?'color':property);
  controls.push({property,label,value:value||computed,computed,edited:Object.hasOwn(colorOriginals(target.getAttribute(COLOR_ORIGINAL)),property),targetId:id,gradient:property==='background-color'?css.backgroundImage!=='none':/url\(/i.test(computed)});
 }
 if(svg){
  if(/^(svg|g|path|rect|circle|ellipse|polyline|polygon|text|tspan|use)$/.test(tag))add('fill','Fill');
  if(/^(svg|g|path|rect|circle|ellipse|line|polyline|polygon|text|tspan|use)$/.test(tag))add('stroke','Stroke');
  if(/^(text|tspan)$/.test(tag)||css.fill==='currentcolor'||css.stroke==='currentcolor')add('color','Text / currentColor');
 }else if(!/^(img|video|canvas|iframe|br|hr|source)$/.test(tag)){
  if(element.textContent?.trim()||/^(input|textarea|select|button)$/.test(tag))add('color','Text color');
  add('background-color','Background color');
  if(['top','right','bottom','left'].some(side=>parseFloat(css.getPropertyValue(`border-${side}-width`))>0&& !/^(none|hidden)$/.test(css.getPropertyValue(`border-${side}-style`))))add('border-color','Border color');
 }
 const inputs=[...(/^(input|textarea)$/.test(tag)?[element]:[]),...Array.from(element.querySelectorAll('input,textarea'))].filter(input=>!input.hasAttribute('disabled')&&!input.hasAttribute('readonly')&&input.hasAttribute('placeholder')&&(!input.matches('input')||/^(text|search|email|url|tel|password|number)$/.test(input.getAttribute('type')||'text')));
 inputs.forEach((input,index)=>add('placeholder-color',inputs.length===1?'Placeholder color':`Placeholder ${index+1}: ${input.getAttribute('aria-label')||input.getAttribute('placeholder')||'Input'}`,input));
 return controls;
}

/** html-to-image copies ::before/::after, but not native ::placeholder rules. */
export function placeholderExportCSS(root:HTMLElement):string{
 const win=root.ownerDocument.defaultView;if(!win)return '';
 return Array.from(root.querySelectorAll('input[placeholder],textarea[placeholder]')).flatMap(input=>{
  const id=input.getAttribute(ELEMENT_ID);if(!id)return [];
  const css=win.getComputedStyle(input,'::placeholder'),escaped=id.replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c.codePointAt(0)!.toString(16)+' ');
  return [`[${ELEMENT_ID}="${escaped}"]::placeholder{color:${css.color}!important;opacity:${css.opacity}!important}`];
 }).join('\n');
}
