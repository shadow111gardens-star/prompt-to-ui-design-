import { COLOR_PROPERTIES, validColor, type ColorEdit, type ColorProperty } from '@/lib/color-values';
import { ELEMENT_ID, scanHtmlTags, htmlAttribute, setHtmlAttribute, parseInlineDeclarations } from '@/lib/element-editing';

export const COLOR_ORIGINAL = 'data-openui-color-original';
export const PLACEHOLDER_RULE = 'data-openui-placeholder';
const decode=(v:string)=>v.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
export function colorOriginals(value: string | null): Partial<Record<ColorProperty,string|null>> {
 try { const parsed=JSON.parse(value||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
  return Object.fromEntries(COLOR_PROPERTIES.filter(key=>Object.hasOwn(parsed,key)&&(parsed[key]===null||typeof parsed[key]==='string'&&parsed[key].length<2048)).map(key=>[key,parsed[key]]));
 } catch { return {}; }
}
export function placeholderCSS(id: string): string {
 const escaped=id.replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c.codePointAt(0)!.toString(16)+' ');
 return `[${ELEMENT_ID}="${escaped}"]::placeholder{color:var(--openui-placeholder-color)!important}`;
}

/** Changes only one opening tag and, for placeholders, one explicitly scoped rule. */
export function patchElementColor(html: string, selectedId: string, edit: ColorEdit): string {
 if (!COLOR_PROPERTIES.includes(edit.property)) throw new Error('Unsupported color property.');
 if (edit.value!==null&&!validColor(edit.value,edit.property==='fill'||edit.property==='stroke'))throw new Error('Enter a valid color, such as #FF5A36 or #FF5A3680.');
 const tags=scanHtmlTags(html),index=tags.findIndex(t=>!t.close&&t.id===selectedId),selected=tags[index];
 if(!selected)throw new Error('Select the element again before changing its color.');
 const targetId=edit.targetId||selectedId,target=tags.find(t=>!t.close&&t.id===targetId);
 if(!target)throw new Error('Color target no longer exists.');
 if(targetId!==selectedId){
  if(edit.property!=='placeholder-color'||selected.selfClosing)throw new Error('Color target must be inside the selected element.');
  let depth=1,end=html.length;for(let i=index+1;i<tags.length;i++){const t=tags[i];if(t.tag!==selected.tag)continue;if(t.close)depth--;else if(!t.selfClosing)depth++;if(!depth){end=t.start;break;}}
  if(target.start<selected.end||target.start>=end)throw new Error('Color target must be inside the selected element.');
 }
 if(edit.property==='placeholder-color'&&!/^(input|textarea)$/.test(target.tag))throw new Error('Select an input or textarea for placeholder colors.');
 if((edit.property==='fill'||edit.property==='stroke')&&!/^(svg|g|path|rect|circle|ellipse|line|polyline|polygon|text|tspan|use)$/.test(target.tag))throw new Error('Select an SVG paint element.');
 const property=edit.property==='placeholder-color'?'--openui-placeholder-color':edit.property;
 const styles=parseInlineDeclarations(decode(htmlAttribute(target.raw,'style')||''));
 const originals=colorOriginals(decode(htmlAttribute(target.raw,COLOR_ORIGINAL)||''));
 if(edit.value===null){if(!Object.hasOwn(originals,edit.property))return html;const original=originals[edit.property];if(original===null)styles.delete(property);else styles.set(property,original!);delete originals[edit.property];}
 else {if(!Object.hasOwn(originals,edit.property))originals[edit.property]=styles.get(property)??null;styles.set(property,edit.value.trim()+' !important');}
 let opening=setHtmlAttribute(target.raw,'style',[...styles].map(([key,value])=>key+': '+value).join('; ')||null);
 opening=setHtmlAttribute(opening,COLOR_ORIGINAL,Object.keys(originals).length?JSON.stringify(originals):null);
 html=html.slice(0,target.start)+opening+html.slice(target.end);
 if(edit.property==='placeholder-color'){
  const current=scanHtmlTags(html),rule=current.find(t=>!t.close&&t.tag==='style'&&decode(htmlAttribute(t.raw,PLACEHOLDER_RULE)||'')===targetId);
  if(edit.value===null){if(rule){const close=current.find(t=>t.close&&t.tag==='style'&&t.start>=rule.end);if(close)html=html.slice(0,rule.start)+html.slice(close.end);}}
  else if(!rule){const style=setHtmlAttribute('<style>',PLACEHOLDER_RULE,targetId)+placeholderCSS(targetId)+'</style>';html=/<body\b[^>]*>/i.test(html)?html.replace(/<body\b[^>]*>/i,opening=>opening+style):style+html;}
 }
 return html;
}
