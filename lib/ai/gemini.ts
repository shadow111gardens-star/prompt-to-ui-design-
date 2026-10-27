import { wrapLanguageModel } from 'ai';
import { fundingScope } from '@/lib/billing/scope';
import { beforeFundedCall } from '@/lib/billing/scope';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { markProviderGenerationRequest } from '@/lib/ai/usage-logging';
import { FIXED_AI_MODEL } from '@/lib/ai/fixed-model';

export class GeminiConfigurationError extends Error {}
export function geminiConfiguration() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || FIXED_AI_MODEL;
  if (!key) throw new GeminiConfigurationError('Gemini is not configured. Set GEMINI_API_KEY on the server.');
  if (model !== FIXED_AI_MODEL) throw new GeminiConfigurationError(`Set GEMINI_MODEL to exactly ${FIXED_AI_MODEL} on the server, or leave it unset.`);
  return { key, model };
}
export function geminiConfigurationError(): string | null {
  try { geminiConfiguration(); return null; }
  catch (error) { return error instanceof GeminiConfigurationError ? error.message : 'Gemini configuration is unavailable.'; }
}

export function createGeminiModel() {
  const { key, model } = geminiConfiguration();
  const client = createGoogleGenerativeAI({ apiKey: key,
    fetch: async (url, options) => {
      const target = new URL(String(url));
      if (target.origin !== 'https://generativelanguage.googleapis.com' ||
          ![`/v1beta/models/${model}:generateContent`, `/v1beta/models/${model}:streamGenerateContent`].includes(target.pathname)) {
        throw new Error('Unsupported Gemini endpoint.');
      }
      await beforeFundedCall();
      markProviderGenerationRequest(true);
      let response: Response;
      try { response = await globalThis.fetch(url, { ...options, redirect: 'error' }); }
      catch { throw new Error('Gemini connection failed. Retry manually.'); }
      if (response.ok) return response;
      // Never forward provider error bodies: they can contain private request data.
      await response.body?.cancel();
      const message = response.status === 401 || response.status === 403 ? 'Gemini rejected the server API key or model access.'
        : response.status === 429 ? 'Gemini rate limit or quota reached. Retry manually later.'
        : response.status === 404 ? 'The configured Gemini model is unavailable for this API key.'
        : 'Gemini generation failed. Retry manually.';
      return Response.json({ error: { code: response.status, message, status: 'REQUEST_FAILED' } }, { status: response.status });
    },
  });
  return wrapLanguageModel({model:client(model),middleware:{specificationVersion:'v3',transformParams:async({params})=>{
    if(fundingScope.getStore()&&!fundingScope.getStore()?.gatewayKey){
      if(params.tools?.length)throw new Error('Additional billable AI tools are not enabled for platform-funded generation.');
      const options=params.providerOptions?.google||{};
      if(Object.keys(options).some(key=>!['thinkingConfig','structuredOutputs'].includes(key)))throw new Error('This AI billing option needs an explicit spending configuration.');
    }
    return params;
  }}});
}
