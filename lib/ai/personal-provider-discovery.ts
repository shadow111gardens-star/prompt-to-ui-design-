import type { PersonalProvider,PersonalModel } from '@/lib/ai/personal-provider-types';
export async function discoverPersonalModels(provider:PersonalProvider,key:string,fetcher:typeof fetch=fetch):Promise<PersonalModel[]>{
 const endpoints={openai:'https://api.openai.com/v1/models',anthropic:'https://api.anthropic.com/v1/models',google:'https://generativelanguage.googleapis.com/v1beta/models',xai:'https://api.x.ai/v1/models'};
 const headers:Record<string,string>=provider==='google'?{'x-goog-api-key':key}:provider==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+key};
 const models:PersonalModel[]=[];let next:string|undefined;let after:string|undefined;
 for(let page=0;page<20;page++){
   const url=new URL(endpoints[provider]);if(provider==='google'){url.searchParams.set('pageSize','1000');if(next)url.searchParams.set('pageToken',next);}if(provider==='anthropic'){url.searchParams.set('limit','1000');if(after)url.searchParams.set('after_id',after);}
   let response:Response;try{response=await fetcher(url,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new Error('Could not reach the provider. Check your connection and retry.');}
   if(!response.ok){if(response.status===401||response.status===403)throw new Error('The provider rejected this API key. Check the key and its permissions.');if(response.status===429)throw new Error('Provider rate limit reached. Wait and retry.');throw new Error('The provider could not list models. Please try again later.');}
   const body=await response.json() as {data?:Array<{id:string;display_name?:string}>;models?:Array<{name:string;displayName?:string;supportedGenerationMethods?:string[]}>;nextPageToken?:string;has_more?:boolean;last_id?:string};
   if(provider==='google'){for(const item of body.models||[]){const id=item.name.replace(/^models\//,'');if(item.supportedGenerationMethods?.includes('generateContent')&&!/tts|image|robotics|computer-use/.test(id))models.push({id,name:item.displayName||id});}next=body.nextPageToken;if(!next)break;}
   else {for(const item of body.data||[]){if(provider==='openai'&&(!/^(gpt-|o[134](?:-|$)|chatgpt-)/.test(item.id)||/audio|image|realtime|transcribe|tts/.test(item.id)))continue;if(provider==='xai'&&/image|video|audio|embed/.test(item.id))continue;models.push({id:item.id,name:item.display_name||item.id});}if(provider!=='anthropic'||!body.has_more||!body.last_id)break;after=body.last_id;}
 }
 if(!models.length)throw new Error('No compatible text-generation models are available for this key.');
 return [...new Map(models.map(model=>[model.id,model])).values()].sort((a,b)=>a.name.localeCompare(b.name));
}
