import type { ExtendedStyleGuide } from "@/redux/slice/style-guide";

type Screen = { id: string; screenName?: string; w?: number; h?: number; uiSpecData: string; isGenerating?: boolean };
type Role = "primary" | "background" | "text" | "surface" | "muted" | "border" | "success" | "warning" | "error" | "info";
type Analysis = { name: string; width?: number; height?: number; colors: string[]; fonts: string[]; headingFont?: string; bodyFont?: string; roles: Partial<Record<Role, string>>; cardRadius?: number; buttonRadius?: number; spacing?: number; fontSizes: string[]; fontWeights: string[]; headings: string[] };
const cleanText = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
const color = (value: string): string | undefined => {
  const hex = value.match(/^#([\da-f]{3,8})\b/i)?.[1];
  if (hex && [3,4,6,8].includes(hex.length)) return `#${hex.length === 3 || hex.length === 4 ? [...hex].map(x => x+x).join("") : hex}`.toUpperCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+))?/i);
  if (rgb && (!rgb[4] || Number(rgb[4]) === 1)) return "#" + rgb.slice(1,4).map(x => Math.min(255,Number(x)).toString(16).padStart(2,"0")).join("").toUpperCase();
  return ({white:"#FFFFFF",black:"#000000",transparent:undefined} as Record<string,string|undefined>)[value.toLowerCase()];
};
const mostUsed = <T extends string | number>(values: T[]): T | undefined => [...new Set(values)].sort((a,b) => values.filter(x=>x===b).length-values.filter(x=>x===a).length)[0];

export function projectScreens(sketches: unknown): Screen[] {
  let data = sketches;
  try { if (typeof data === "string") data = JSON.parse(data); } catch { return []; }
  if (!data || typeof data !== "object") return [];
  const root = data as { shapes?: { entities?: Record<string,unknown> } };
  // Only current entities: history contains deleted and obsolete copies of screens.
  return Object.values(root.shapes?.entities || {}).filter((item): item is Screen => {
    const s = item as Partial<Screen> & { type?: string } | null;
    return !!s && s.type === "generatedui" && typeof s.uiSpecData === "string" && !!s.uiSpecData.trim() && !s.isGenerating && !/Generating mockup\.\.\./i.test(s.uiSpecData);
  });
}

export function analyzeScreen(screen: Screen, index = 0): Analysis {
  const html = screen.uiSpecData.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join("\n");
  const variables = new Map<string,string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) variables.set(m[1],m[2].trim());
  const resolve = (v: string): string => { for(let i=0;i<8 && /var\(/.test(v);i++) v=v.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g,(_,key,fallback)=>variables.get(key)||fallback||""); return v.replace(/!important/g,"").trim(); };
  const colors: string[] = [], fonts: string[] = [];
  const headingFonts:string[]=[], bodyFonts:string[]=[];
  const candidates: Partial<Record<Role, Array<{value:string;score:number}>>> = {};
  const add = (role:Role,value:string,score:number) => { const c=color(resolve(value));if(c){colors.push(c);(candidates[role] ||= []).push({value:c,score});} };
  const radius = {card:[] as number[],button:[] as number[]};const spacing:number[]=[]; const fontSizes:string[]=[], fontWeights:string[]=[];
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>[m[1],m[2]]);
  for (const m of html.matchAll(/<([\w-]+)\b([^>]*?)\bstyle\s*=\s*["']([^"']*)["'][^>]*>/gi)) blocks.push([m[1]+" "+(m[2].match(/class=["']([^"']*)/)?.[1]||""),m[3]]);
  for (const [selector,body] of blocks) {
    for (const m of body.matchAll(/([\w-]+)\s*:\s*([^;}]*)/g)) {
      const prop=m[1].toLowerCase(), value=resolve(m[2]), tag=selector.toLowerCase();
      const c=color(value); if(c) colors.push(c);
      if(prop==="font-size") fontSizes.push(value);
      if(prop==="font-weight") fontWeights.push(value);
      if(prop==="font-family") { const f=value.split(",")[0].replace(/["']/g,"").trim();if(f && !/^(inherit|initial|unset)$/i.test(f)) { fonts.push(f); if(/h[1-6]|heading|headline|title/.test(tag)) headingFonts.push(f); else if(/body|root|main|app|screen|font-body/.test(tag)) bodyFonts.push(f); } }
      if(prop.startsWith("--")) {
        if(/primary|accent|brand|lime/.test(prop) && !/foreground|text|fg/.test(prop)) add("primary",value,10);
        else if(/surface|card/.test(prop)) add("surface",value,10);
        else if(/background|(?:^|-)bg$/.test(prop)) add("background",value,10);
        else if(/muted/.test(prop) && /bg|background/.test(prop) && !/text|fg|foreground/.test(prop)) add("muted",value,10);
        else if(/foreground|(?:^|-)text$/.test(prop)) add("text",value,10);
        else if(/border/.test(prop)) add("border",value,10);
        for(const role of ["success","warning","error","info"] as const) if(prop.includes(role)) add(role,value,10);
      }
      if(/^(background|background-color)$/.test(prop)) {
        if(/primary-bg|accent-bg|button|btn|\.cta|\.active/.test(tag)) add("primary",value,6);
        else if(/card|panel|surface/.test(tag)) add("surface",value,7);
        else if(/body|:root|\.c-bg|screen|phone|app|main/.test(tag)) add("background",value,5);
      }
      if(prop==="color" && /body|:root|\.c-fg|screen|phone|app|main/.test(tag)) add("text",value,5);
      if(prop==="border-color") add("border",value,/active|hover|focus/.test(tag)?1:4);
      if(prop==="border-radius" && /^\d+(?:\.\d+)?px$/.test(value)) radius[/button|btn|pill|cta/.test(tag)?"button":"card"].push(parseFloat(value));
      if(/^(gap|padding)$/.test(prop) && /^\d+(?:\.\d+)?px$/.test(value)) spacing.push(parseFloat(value));
    }
  }
  // Literal Tailwind colors work without a runtime or provider call.
  for (const m of html.matchAll(/\b(bg|text|border)-\[(#[\da-f]{3,8}|rgba?\([^\]]+\))\]/gi)) {
    const c=color(m[2]);if(c) colors.push(c);
    if(m[1]==="bg") add("background",m[2],1); else if(m[1]==="text") add("text",m[2],1);else add("border",m[2],1);
  }
  const roles:Analysis["roles"]={};
  for(const role of Object.keys(candidates) as Role[]) { const list=candidates[role]!; const top=Math.max(...list.map(c=>c.score)); roles[role]=mostUsed(list.filter(c=>c.score===top).map(c=>c.value)); }
  const headings=[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map(m=>cleanText(m[1])).filter(Boolean);
  return {name:screen.screenName || headings[0] || `Screen ${index+1}`,width:screen.w,height:screen.h,colors:[...new Set(colors)],fonts:[...new Set(fonts)],headingFont:mostUsed(headingFonts)||mostUsed(bodyFonts),bodyFont:mostUsed(bodyFonts)||fonts[0],roles,cardRadius:mostUsed(radius.card),buttonRadius:mostUsed(radius.button),spacing:mostUsed(spacing),fontSizes:[...new Set(fontSizes)],fontWeights:[...new Set(fontWeights)],headings:[...new Set(headings)].slice(0,16)};
}

export function deriveProjectDesignSystem(projectName:string, sketches:unknown, fallback:ExtendedStyleGuide): ExtendedStyleGuide {
  const screens=projectScreens(sketches);if(!screens.length) return fallback;
  const pages=screens.map(analyzeScreen);
  const role=(key:Role)=>mostUsed(pages.map(p=>p.roles[key]).filter((x):x is string=>!!x));
  const allColors=[...new Set(pages.flatMap(p=>p.colors))];const fonts=[...new Set(pages.flatMap(p=>p.fonts))];
  const section=(title:ExtendedStyleGuide["colorSections"][number]["title"],items:Array<[string,string|undefined]>)=>({title,swatches:items.filter((x):x is [string,string]=>!!x[1]).map(([name,hexColor])=>({name,hexColor,description:"Detected in project screens"}))});
  const sections=[section("Primary Colors",[["Primary",role("primary")],["Background",role("background")]]),section("Secondary & Accent Colors",[["Text",role("text")],["Accent",role("primary")]]),section("UI Component Colors",[["Surface Variant",role("surface")],["Muted Background",role("muted")],["Border Color",role("border")]]),section("Status & Feedback Colors",["success","warning","error","info"].map(k=>[k[0].toUpperCase()+k.slice(1),role(k as Role)])),section("Utility & Form Colors",allColors.map((c,i)=>[`Screen color ${i+1}`,c]))].filter(s=>s.swatches.length);
  const font=mostUsed(pages.flatMap(p=>p.fonts)) || "sans-serif";
  const headingFont=mostUsed(pages.flatMap(p=>p.headingFont?[p.headingFont]:[]))||font;
  const bodyFont=mostUsed(pages.flatMap(p=>p.bodyFont?[p.bodyFont]:[]))||font;
  const typographySections=[headingFont,bodyFont,...fonts.filter(f=>f!==headingFont && f!==bodyFont)].map((f,i)=>({title:i===0?"Headings":i===1?"Body":`Screen font ${i+1}`,styles:[{name:i===0?"Headings":"Body Text",fontFamily:f,fontSize:"inherit",fontWeight:"inherit",lineHeight:"normal"}]}));
  if(typographySections.length === 1) typographySections.push({...typographySections[0],title:"Body",styles:typographySections[0].styles.map(style=>({...style,name:"Body Text"}))});
  if(!typographySections.length) typographySections.push({title:"Body",styles:[{name:"Browser default",fontFamily:font,fontSize:"inherit",fontWeight:"inherit",lineHeight:"normal"}]});
  const details={cardRadius:mostUsed(pages.flatMap(p=>p.cardRadius===undefined?[]:[p.cardRadius]))??0,buttonRadius:mostUsed(pages.flatMap(p=>p.buttonRadius===undefined?[]:[p.buttonRadius]))??0,spacingUnit:mostUsed(pages.flatMap(p=>p.spacing===undefined?[]:[p.spacing]))??0,designMd:""};
  const safeName=cleanText(projectName).replace(/[\r\n]/g," ");
  const markdown=["---",`name: ${JSON.stringify(safeName)}`,"source: project-screens","colors:",...([ ["primary","primary"],["surface","background"],["on-surface","text"],["surface-variant","surface"],["muted","muted"],["border","border"] ] as const).flatMap(([label,key])=>role(key)?[`  ${label}: "${role(key)}"`]:[]),"typography:",`  headline-md:\n    fontFamily: ${JSON.stringify(headingFont)}`,`  body-md:\n    fontFamily: ${JSON.stringify(bodyFont)}`,"rounded:",`  sm: ${details.buttonRadius}px`,`  md: ${details.cardRadius}px`,"spacing:",`  base: ${details.spacingUnit}px`,"---",`# ${safeName} — Design System`,"",`Automatically detected from ${pages.length} saved screen(s). No AI generation call is required.`,"","## Shared colors",...(["primary","background","text","surface"] as const).flatMap(key=>role(key)?[`- ${key}: ${role(key)}`]:[]),"","## Project fonts",...(fonts.length?fonts.map(f=>`- ${f}`):["- Browser default (no explicit font-family found)."]),"","## Screens",...pages.flatMap((p,i)=>["",`### ${i+1}. ${p.name}`,`- Canvas size: ${p.width ?? "auto"} × ${p.height ?? "auto"} px`,`- Colors: ${p.colors.join(", ") || "No explicit color found"}`,`- Fonts: ${p.fonts.join(", ") || "Inherited / browser default"}`,`- Font sizes: ${p.fontSizes.join(", ") || "Inherited / browser default"}`,`- Font weights: ${p.fontWeights.join(", ") || "Inherited / browser default"}`,`- Card radius: ${p.cardRadius===undefined?"Not explicitly detected":p.cardRadius+"px"}`,`- Button radius: ${p.buttonRadius===undefined?"Not explicitly detected":p.buttonRadius+"px"}`,`- Content sections: ${p.headings.join("; ") || "No heading elements"}`]),"","## Detection notes","Values come from saved HTML, inline CSS, CSS variables and literal Tailwind colors. External stylesheets and complex runtime styles may require manual confirmation. Per-screen differences are retained above; shared roles use the most common detected value. Missing declarations are not replaced with an unrelated theme."] .join("\n");
  return {theme:safeName,description:`Design tokens detected from ${pages.length} project screens.`,colorSections:sections,typographySections,designSystemDetails:{...details,designMd:markdown}};
}
