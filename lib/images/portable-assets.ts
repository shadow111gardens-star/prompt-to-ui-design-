// Client/export helper. Only authenticated same-origin project image routes are fetched.
export async function makeImagesPortable(source:string,fetcher:typeof fetch=fetch):Promise<string>{
 const paths=[...new Set(source.match(/\/api\/(?:images\/assets\/[a-f0-9-]{36}|uploads\/[A-Za-z0-9_./%~-]+)/g)||[])];
 const embedded=new Map<string,string>();
 for(const url of paths){if(url.includes('..'))throw new Error('Invalid project image path.');const response=await fetcher(url,{credentials:'same-origin'});if(!response.ok)throw new Error('A project image could not be included in the export. Sign in and retry.');const mime=response.headers.get('content-type')?.split(';')[0];if(!mime||!/^image\/(?:png|jpeg|gif|webp|svg\+xml)$/.test(mime))throw new Error('Invalid image response during export.');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>10*1024*1024)throw new Error('An image is too large to export.');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));embedded.set(url,'data:'+mime+';base64,'+btoa(binary));}
 // Remove an absolute localhost/app origin directly preceding a recognized asset path as well.
 for(const [url,data]of embedded){source=source.replace(new RegExp('https?:\\/\\/[^\\s"\'<>]+(?='+url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','g'),'');source=source.split(url).join(data);}
 return source;
}
