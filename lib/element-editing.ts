/** Source-preserving HTML edits: only the target opening tag/text ranges change. */
export const ELEMENT_ID = "data-openui-element";
const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const EXCLUDED = new Set("html head body script style meta link title base noscript template".split(" "));
type Tag = { start: number; end: number; tag: string; close: boolean; raw: string; id?: string; selfClosing: boolean };
export type ElementPatch = { styles?: Record<string, string>; attributes?: Record<string, string | null>; text?: string; icon?: string; loadFont?:boolean };
export const EDITABLE_STYLES = new Set("box-sizing width height min-width max-width min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left display align-items justify-content align-self flex-direction flex-wrap flex-grow flex-shrink flex-basis gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row border-radius font-family font-size font-weight line-height letter-spacing text-align color background-color background-image border-color border-width border-style opacity box-shadow visibility translate".split(" "));
const ATTRIBUTES = new Set(["src", "alt", "href", "disabled", "placeholder", "type", "value", "aria-label", "srcset", "data-openui-asset", "data-image-query", "data-openui-image-fallback"]);
const escapeAttribute = (value: string) => value.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const escapeText = (value: string) => escapeAttribute(value).replace(/>/g,"&gt;");
const decode = (value:string) => value.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");

function attributeRanges(tag:string) {
  const result:Array<{name:string;start:number;end:number;value:string}>=[];
  const pattern=/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  pattern.lastIndex=tag.match(/^<\/?[\w:-]+/)?.[0].length||0;
  let match:RegExpExecArray|null;
  while((match=pattern.exec(tag)))result.push({name:match[1].toLowerCase(),start:match.index,end:pattern.lastIndex,value:match[2]??match[3]??match[4]??''});
  return result;
}
const attributeValue=(tag:string,name:string)=>attributeRanges(tag).find(attr=>attr.name===name.toLowerCase())?.value;

function tags(html: string): Tag[] {
  const found: Tag[] = [];
  const pattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][\w:-]*(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const raw = match[0];
    const name = raw.match(/^<\/?([\w:-]+)/)?.[1]?.toLowerCase();
    if (!name) continue;
    const close = raw.startsWith("</");
    found.push({ start: match.index, end: pattern.lastIndex, tag: name, close, raw,
      id: attributeValue(raw,ELEMENT_ID), selfClosing:VOID.has(name) || /\/\s*>$/.test(raw) });
    if (!close && /^(script|style|textarea|title)$/.test(name)) {
      const end = new RegExp(`</${name}\\s*>`, "ig"); end.lastIndex = pattern.lastIndex;
      const closing = end.exec(html);
      if (closing) { found.push({start:closing.index,end:end.lastIndex,tag:name,close:true,raw:closing[0],selfClosing:false}); pattern.lastIndex=end.lastIndex; }
      else break;
    }
  }
  return found;
}

export function identifyHtmlElements(html: string): string {
  const all = tags(html); const used = new Set(all.flatMap(t=>t.id?[t.id]:[])); let next=1;
  const edits:Array<{start:number;end:number;value:string}>=[];
  const seen = new Set<string>();
  for (const t of all) {
    if(t.close || EXCLUDED.has(t.tag)) continue;
    if(t.id && !seen.has(t.id)){seen.add(t.id);continue;}
    let id:string; do {id=`oui-e-${next++}`;} while(used.has(id)); used.add(id);seen.add(id);
    const raw=setAttribute(t.raw,ELEMENT_ID,null);
    edits.push({start:t.start,end:t.end,value:raw.replace(/\s*\/?\s*>$/,ending=>` ${ELEMENT_ID}="${id}"${ending}`)});
  }
  return replaceRanges(html,edits);
}
function replaceRanges(html:string, edits:Array<{start:number;end:number;value:string}>):string {
  for(const edit of edits.sort((a,b)=>b.start-a.start)) html=html.slice(0,edit.start)+edit.value+html.slice(edit.end);
  return html;
}
function setAttribute(tag:string,key:string,value:string|null):string {
  const stripped=replaceRanges(tag,attributeRanges(tag).filter(attr=>attr.name===key.toLowerCase()).map(attr=>({...attr,value:""})));
  return value===null?stripped:stripped.replace(/\s*\/?\s*>$/,ending=>` ${key}="${escapeAttribute(value)}"${ending}`);
}

function declarations(style:string):Map<string,string> {
  const parts:string[]=[];let part="",quote="",depth=0;
  for(const char of style){if(quote){part+=char;if(char===quote)quote="";}else if(char==='"'||char==="'"){quote=char;part+=char;}else if(char==='('){depth++;part+=char;}else if(char===')'){depth--;part+=char;}else if(char===';'&&depth===0){parts.push(part);part="";}else part+=char;}
  parts.push(part);
  return new Map(parts.flatMap(p=>{const colon=p.indexOf(':');return colon<0?[]:[[p.slice(0,colon).trim().toLowerCase(),p.slice(colon+1).trim()]];}));
}
export function safeElementUrl(value:string,image=false):boolean {
  const url=value.trim();if(!url)return true;
  if(image && /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)(?:;[a-z0-9=+.-]+)*,/i.test(url))return true;
  if(/[\u0000-\u0020]/.test(url))return false;
  return !/^[a-z][\w+.-]*:/i.test(url) || /^(https?:|mailto:|tel:)/i.test(url) && (!image || /^https?:/i.test(url));
}
export const INSPECTOR_ICONS:Record<string,string>={
  activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
};
export function patchElementHtml(html:string,id:string,patch:ElementPatch):string {
  const all=tags(html), index=all.findIndex(t=>!t.close && t.id===id);
  if(index<0)throw new Error("The selected element no longer exists. Select it again.");
  const target=all[index];let opening=target.raw;
  if(patch.styles){const style=declarations(decode(attributeValue(opening,"style")||""));
    for(const [key,value] of Object.entries(patch.styles)){
      const assetBackground=key==='background-image'&&/^url\(["']?\/api\/images\/assets\/[a-f0-9-]{36}["']?\)$/.test(value);
      if(!EDITABLE_STYLES.has(key) || !assetBackground&&/[{};<>]|expression\s*\(|url\s*\(/i.test(value))throw new Error("Unsupported style value.");
      if(value.trim())style.set(key,`${value.replace(/\s*!important\s*$/i,"")} !important`);else style.delete(key);
    }
    opening=setAttribute(opening,"style",[...style].map(([k,v])=>`${k}: ${v}`).join("; "));
  }
  for(const [key,value] of Object.entries(patch.attributes||{})){
    if(key==='srcset'&&value!==null)throw new Error("Clear responsive sources before replacing an image.");
    if(!ATTRIBUTES.has(key))throw new Error("Unsupported element attribute.");
    if(value!==null && (key==='src'||key==='href') && !safeElementUrl(value,key==='src'))throw new Error("Use a safe image or link URL.");
    opening=setAttribute(opening,key,value);
  }
  if(patch.icon && target.tag==='svg'){for(const [key,value] of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"2"}))opening=setAttribute(opening,key,value);}
  const edits=[{start:target.start,end:target.end,value:opening}];
  if(patch.text!==undefined || patch.icon){
    if(target.selfClosing)throw new Error("This element does not support text content.");
    let depth=1,endIndex=index+1;
    for(;endIndex<all.length;endIndex++){const t=all[endIndex];if(t.tag!==target.tag)continue;if(t.close)depth--;else if(!t.selfClosing)depth++;if(depth===0)break;}
    const closing=all[endIndex];if(!closing)throw new Error("Cannot edit content in incomplete HTML.");
    if(patch.icon){if(target.tag!=='svg'||!INSPECTOR_ICONS[patch.icon])throw new Error("Unsupported icon.");edits.push({start:target.end,end:closing.start,value:INSPECTOR_ICONS[patch.icon]});}
    else {
      const inner=all.slice(index+1,endIndex);let cursor=target.end,blocked=0,inserted=false;
      for(const t of [...inner,closing]){
        const text=html.slice(cursor,t.start);
        if(!blocked && text.trim() && !text.startsWith('<!--')){edits.push({start:cursor,end:t.start,value:inserted?"":escapeText(patch.text!)});inserted=true;}
        if(/^(svg|script|style)$/.test(t.tag)){if(t.close)blocked=Math.max(0,blocked-1);else if(!t.selfClosing)blocked++;}
        cursor=t.end;
      }
      if(!inserted)edits.push({start:target.end,end:target.end,value:escapeText(patch.text!)});
    }
  }
  let result=replaceRanges(html,edits);
  const family=patch.styles?.['font-family']?.split(',')[0].replace(/["']/g,'').trim();
  if(patch.loadFont && family && !/^(Arial|Helvetica|Georgia|Times New Roman|Courier New|Monaco|system-ui|sans-serif|serif|monospace|inherit)$/i.test(family)){
    const href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700;800&display=swap`;
    if(!result.includes(escapeAttribute(href)) && !result.includes(href)){
      const link=`<link rel="stylesheet" href="${escapeAttribute(href)}">`;
      result=/<\/head\s*>/i.test(result)?result.replace(/<\/head\s*>/i,link+'$&'):link+result;
    }
  }
  return result;
}

// A live DOM edit already applied to this iframe must not reset its contents or pointer capture.
export const liveElementHtml = new WeakMap<HTMLIFrameElement,string>();

export function hasLiveElementEdit(frame: HTMLIFrameElement, html: string | null): boolean {
  if (liveElementHtml.get(frame) === html) return true;
  liveElementHtml.delete(frame);
  return false;
}

export function ownsEditableElement(frame: HTMLIFrameElement, shapeId: string, element: Element): boolean {
  return frame.getAttribute("data-openui-shape") === shapeId && element.ownerDocument === frame.contentDocument && !!element.closest("#mockup-root");
}

/** Preserve editor priority even when a framework cannot express inline !important. */
export function prepareElementConversionHtml(html: string): string {
  const identified = identifyHtmlElements(html);
  const rules: string[] = [];
  for (const tag of tags(identified)) {
    if (tag.close || !tag.id) continue;
    const important = [...declarations(decode(attributeValue(tag.raw, "style") || ""))]
      .filter(([,value]) => /!important\s*$/i.test(value));
    if (!important.length) continue;
    const escapedId = tag.id.replace(/[\\"\n\r]/g, character => "\\" + character.codePointAt(0)!.toString(16) + " ");
    rules.push(`[${ELEMENT_ID}="${escapedId}"]{${important.map(([key,value])=>`${key}:${value.replace(/[<>]/g,"")}`).join(";")}}`);
  }
  if (!rules.length) return identified;
  const style = `<style id="openui-element-conversion-overrides">${rules.join("\n")}</style>`;
  return /<\/head>/i.test(identified) ? identified.replace(/<\/head>/i, style + "</head>") : identified + style;
}

// Shared source-preserving scanner for generated image hydration.
export { tags as scanHtmlTags,attributeValue as htmlAttribute,setAttribute as setHtmlAttribute };
