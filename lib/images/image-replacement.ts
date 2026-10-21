import type { ElementPatch } from '@/lib/element-editing';
export function imageReplacementPatch(url:string,alt:string,id:string,query:string,background=false):ElementPatch{
 if(!/^\/api\/images\/assets\/[a-f0-9-]{36}$/.test(url))throw new Error('Invalid project image URL.');
 return {attributes:{...(background?{'aria-label':alt}:{src:url,alt,srcset:null}),'data-openui-asset':id,'data-image-query':query,'data-openui-image-fallback':null},...(background?{styles:{'background-image':`url("${url}")`}}:{})};
}
