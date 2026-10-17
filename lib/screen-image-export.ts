import JSZip from 'jszip';
import { downloadBlob } from '@/lib/frame-snapshot';
import type { GeneratedUIShape } from '@/redux/slice/shapes';

export type ScreenImageFormat = 'png' | 'jpg' | 'svg';

export function screenImageFilename(name:string,index:number,format:ScreenImageFormat) {
  const safe=name.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[.\s]+$/g,'').trim().slice(0,90)||'screen';
  return `${String(index+1).padStart(2,'0')}-${safe}.${format}`;
}

/** Capture only the rendered design root, never canvas transforms, selection or editor controls. */
export async function captureScreenImage(screen:GeneratedUIShape,format:ScreenImageFormat):Promise<Blob> {
  if(screen.isGenerating||!screen.uiSpecData)throw new Error(`${screen.screenName||'Screen'} is not ready to export.`);
  const iframe=Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-openui-shape]')).find(frame=>frame.dataset.openuiShape===screen.id);
  const doc=iframe?.contentDocument;
  const root=doc?.getElementById('mockup-root')||doc?.body;
  if(!root||!doc||!root.childElementCount)throw new Error('Open the Canvas and wait for all screen previews to load before exporting images.');
  await doc.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async image=>{
    if(!image.complete)await new Promise<void>((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',failed);};
      const loaded=()=>{done();resolve();};const failed=()=>{done();reject(new Error('A screen image could not load. Check the image URL and retry.'));};
      const timer=setTimeout(failed,15000);image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});
    });
    if(!image.naturalWidth)throw new Error('A screen image is missing. Check its URL before exporting.');
  }));
  const view=doc.defaultView!;
  const background=[view.getComputedStyle(root).backgroundColor,view.getComputedStyle(doc.body).backgroundColor,view.getComputedStyle(doc.documentElement).backgroundColor]
    .find(color=>color&&color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')||'#ffffff';
  const width=Math.ceil(root.scrollWidth||root.clientWidth||screen.w);
  const height=Math.ceil(root.scrollHeight||root.clientHeight||screen.h);
  if(width*height>40_000_000)throw new Error('This screen is too large to export as one image. Reduce its dimensions and retry.');
  const options={width,height,backgroundColor:background,pixelRatio:2,cacheBust:false,
    filter:(node:HTMLElement)=>!['SCRIPT','NOSCRIPT'].includes(node.tagName),
  };
  const {toBlob,toJpeg,toSvg}=await import('html-to-image');
  if(format==='png') {const blob=await toBlob(root,options);if(!blob)throw new Error('PNG capture failed. Please retry.');return blob;}
  const url=format==='jpg'?await toJpeg(root,{...options,quality:0.95}):await toSvg(root,options);
  const response=await fetch(url);
  if(!response.ok)throw new Error('Could not encode the exported screen.');
  return response.blob();
}

export async function downloadScreenImages(screens:GeneratedUIShape[],format:ScreenImageFormat,all:boolean,onProgress:(done:number,total:number)=>void) {
  if(!screens.length)throw new Error('No completed screens are available to export.');
  const zip=all?new JSZip():null;
  for(let index=0;index<screens.length;index++) {
    const screen=screens[index];onProgress(index,screens.length);
    const blob=await captureScreenImage(screen,format);
    const filename=screenImageFilename(screen.screenName||'screen',index,format);
    if(zip)zip.file(filename,blob);else downloadBlob(blob,filename);
  }
  if(zip)downloadBlob(await zip.generateAsync({type:'blob'}),`openui-all-screens-${format}.zip`);
  onProgress(screens.length,screens.length);
}
