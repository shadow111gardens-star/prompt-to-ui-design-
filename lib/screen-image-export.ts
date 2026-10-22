import JSZip from 'jszip';
import { downloadBlob } from '@/lib/frame-snapshot';
import type { GeneratedUIShape } from '@/redux/slice/shapes';
import { placeholderExportCSS } from '@/lib/element-color-info';
import { waitForScreenRender, embedScreenFonts, screenCaptureDimensions, screenFontSizeCSS } from '@/lib/screen-render-readiness';

export type ScreenImageFormat = 'png' | 'jpg' | 'svg';
type ScreenCaptureSource = Pick<GeneratedUIShape, 'id' | 'w' | 'h' | 'uiSpecData'> & Partial<Pick<GeneratedUIShape, 'isGenerating' | 'screenName'>>;

export function screenImageFilename(name:string,index:number,format:ScreenImageFormat) {
  const safe=name.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[.\s]+$/g,'').trim().slice(0,90)||'screen';
  return `${String(index+1).padStart(2,'0')}-${safe}.${format}`;
}

/** Capture only the rendered design root, never canvas transforms, selection or editor controls. */
export async function captureScreenImage(screen:ScreenCaptureSource,format:ScreenImageFormat):Promise<Blob> {
  if(screen.isGenerating||!screen.uiSpecData)throw new Error(`${screen.screenName||'Screen'} is not ready to export.`);
  const iframe=Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-openui-shape]')).find(frame=>frame.dataset.openuiShape===screen.id);
  const doc=iframe?.contentDocument;
  const root=doc?.getElementById('mockup-root')||doc?.body;
  if(!root||!doc||!root.childElementCount)throw new Error('Open the Canvas and wait for all screen previews to load before exporting images.');
  await waitForScreenRender(root);
  const view=doc.defaultView!;
  const background=[view.getComputedStyle(root).backgroundColor,view.getComputedStyle(doc.body).backgroundColor,view.getComputedStyle(doc.documentElement).backgroundColor]
    .find(color=>color&&color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')||'#ffffff';
  const dimensions=screenCaptureDimensions(screen.w,screen.h);
  if(iframe?.clientWidth && Math.abs(iframe.clientWidth-dimensions.width)>1)throw new Error('Canvas viewport dimensions changed. Wait for the selected frame to finish resizing and retry.');
  const {toBlob,toJpeg,toSvg,getFontEmbedCSS}=await import('html-to-image');
  const fontEmbedCSS=await embedScreenFonts(root,node=>getFontEmbedCSS(node));
  // Font embedding can discover imported font-face rules; settle their layout too.
  await waitForScreenRender(root);
  if(iframe?.clientHeight && Math.abs(iframe.clientHeight-dimensions.height)>1)throw new Error('Canvas viewport dimensions changed. Wait for the selected frame to finish resizing and retry.');
  const options={...dimensions,backgroundColor:background,fontEmbedCSS:fontEmbedCSS+'\n'+screenFontSizeCSS(root)+'\n'+placeholderExportCSS(root),cacheBust:false,includeQueryParams:true,skipAutoScale:true,
    filter:(node:HTMLElement)=>!['SCRIPT','NOSCRIPT'].includes(node.tagName)&&!node.hasAttribute?.('data-openui-editor'),
  };
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
