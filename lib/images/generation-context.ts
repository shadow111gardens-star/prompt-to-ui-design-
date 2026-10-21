import { AsyncLocalStorage } from 'node:async_hooks';
import { wrapLanguageModel,type LanguageModelMiddleware } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { GENERATED_IMAGE_INSTRUCTIONS } from '@/lib/images/image-contract';
export const generatedImageContext=new AsyncLocalStorage<{uid:string;projectId:string;prompt:string;uploaded:string[]}>();
export function imageContractMiddleware(): LanguageModelMiddleware {
 return {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
   const context = generatedImageContext.getStore();
   // This is the SDK's normalized prompt, not a provider's wire format. Keep
   // instructions before the conversation; adapters translate them to Gemini's
   // systemInstruction, Anthropic's system field or OpenAI's system/developer role.
   let instructionEnd = 0;
   while (params.prompt[instructionEnd]?.role === 'system') instructionEnd++;
   return {
    ...params,
    prompt: [
     ...params.prompt.slice(0, instructionEnd),
     {
      role: 'system',
      content: GENERATED_IMAGE_INSTRUCTIONS + (context?.uploaded.length
       ? '\nAvailable uploaded assets (use only when appropriate, not as fabricated product screenshots): ' + context.uploaded.join(', ')
       : ''),
     },
     ...params.prompt.slice(instructionEnd),
    ],
   };
  },
 };
}
export function withImageContract<T>(model:T):T{if(!generatedImageContext.getStore())return model;return wrapLanguageModel({model:model as LanguageModelV3,middleware:imageContractMiddleware()}) as T;}
