import type { LanguageModel } from 'ai';
import { createStreamResponse } from '@/lib/ai/route-utils';
type Run={fullStream:AsyncIterable<{type:string;text?:string;error?:unknown}>;totalUsage:PromiseLike<unknown>;finishReason:PromiseLike<string>};
export function createResilientStreamResponse(generate:(model:LanguageModel)=>Run,model:LanguageModel,streamId:string,_provider?:string|null,_modelId?:string|null):Response{
 const result=generate(model);
 async function* text(){for await(const part of result.fullStream){if(part.type==='error')throw part.error;if(part.type==='text-delta'&&typeof part.text==='string')yield part.text;}}
 return createStreamResponse(text(),'text/event-stream; charset=utf-8',streamId,async()=>({providerAttempts:1,usage:await result.totalUsage,finishReason:await result.finishReason}));
}
