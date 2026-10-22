import { generatedImageContext } from '@/lib/images/generation-context';
import { createImageHydrator } from '@/lib/images/hydrate-html';
import { prisma } from '@/lib/db';
// The transformer preserves progressive previews, then replaces final markup with persisted assets.
export function hydrateImageStream(response:Response,hydrate:(source:string)=>Promise<string>,warnings:Set<string>):Response{
 if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))return response;
 const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='',text='',streamId='',failed=false,cancelled=false;
 const body=new ReadableStream<Uint8Array>({async start(controller){
  function packet(message:string){const payload=message.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');try{const data=JSON.parse(payload);if(typeof data.streamId==='string')streamId=data.streamId;if(data.type==='error'||data.finishReason==='error')failed=true;if(typeof data.text==='string')text=data.type==='replace'?data.text:text+data.text;}catch{}if(!cancelled)controller.enqueue(encoder.encode(message+'\n\n'));}
  try{while(!cancelled){const {done,value}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});let match:RegExpExecArray|null;while((match=/\r?\n\r?\n/.exec(buffer))){packet(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}if(done)break;}
   if(buffer.trim())packet(buffer);
   if(!cancelled&&!failed&&text&&streamId){const result=await hydrate(text);if(!cancelled&&result!==text)controller.enqueue(encoder.encode('data: '+JSON.stringify({streamId,type:'replace',text:result})+'\n\n'));if(!cancelled&&warnings.size)controller.enqueue(encoder.encode('data: '+JSON.stringify({streamId,type:'image-status',warnings:[...warnings]})+'\n\n'));}
   if(!cancelled)controller.close();
  }catch{if(!cancelled){controller.enqueue(encoder.encode('data: '+JSON.stringify({streamId,type:'error',error:'Image processing failed. Retry generation or replace the image in Properties.'})+'\n\n'));controller.close();}}
  finally{reader.releaseLock();}
 },async cancel(){cancelled=true;try{await reader.cancel();}catch{}}});
 return new Response(body,{status:response.status,headers:response.headers});
}
export async function withGeneratedImages<T extends Request>(request:T,uid:string,handler:()=>Promise<Response>){
 const pathname=new URL(request.url).pathname;if(!/^\/api\/generate(?:\/|$)/.test(pathname)||/\/(?:convert|style|theme)$/.test(pathname))return handler();
 let projectId='',prompt='',moodboardMode=false;try{const clone=request.clone();if(clone.headers.get('content-type')?.includes('multipart/form-data')){const form=await clone.formData();projectId=String(form.get('projectId')||'');prompt=String(form.get('prompt')||'');moodboardMode=form.get('generationMode')==='moodboard';}else{const data=await clone.json();projectId=typeof data.projectId==='string'?data.projectId:'';prompt=String(data.prompt||data.userMessage||data.description||'');}}catch{return handler();}
 if(!projectId)return handler();let uploaded:string[]=[];
 try{const project=await prisma.project.findUnique({where:{id:projectId},select:{inspirationImages:{select:{filePath:true}},moodBoardImages:{select:{filePath:true}}}});uploaded=[...(project?.inspirationImages||[]),...(moodboardMode?[]:project?.moodBoardImages||[])].slice(0,20).map(image=>'/api/uploads/'+image.filePath);}catch{}
 return generatedImageContext.run({uid,projectId,prompt,uploaded},async()=>{const result=await handler();const hydration=createImageHydrator(uid,projectId,prompt);return hydrateImageStream(result,hydration.document,hydration.warnings);});
}
