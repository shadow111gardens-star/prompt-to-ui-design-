import { createGateway } from 'ai';
import { beforeFundedCall, fundingScope } from '@/lib/billing/scope';
import { wrapLanguageModel } from 'ai';
import { withImageContract } from '@/lib/images/generation-context';
import { markProviderGenerationRequest, withUsageLogging } from '@/lib/ai/usage-logging';
import { createGeminiModel, geminiConfiguration } from '@/lib/ai/gemini';
import { FIXED_AI_PROVIDER, FIXED_AI_MODEL } from '@/lib/ai/fixed-model';

// Legacy names remain readable in historical project settings, but cannot route
// generation to a different provider or override the server-fixed model.
export type ProviderKey = 'tokenharbor' | 'xai' | 'openrouter' | 'nvidia' | 'ollama' | 'anthropic' | 'openai' | 'google';
export function getLanguageModel(_provider?: ProviderKey, _modelId?: string) {
  const ownKey=fundingScope.getStore()?.gatewayKey;
  if(ownKey){const gateway=createGateway({apiKey:ownKey,fetch:async(url,options)=>{await beforeFundedCall();markProviderGenerationRequest(true);let response:Response;try{response=await fetch(url,{...options,redirect:'error'});}catch{throw new Error('Your AI Gateway connection failed. Retry manually.');}if(response.ok)return response;await response.body?.cancel();return Response.json({error:{message:'Your AI Gateway request failed. Check your key, model access and account balance.'}},{status:response.status});}});
    const model=wrapLanguageModel({model:gateway('google/'+FIXED_AI_MODEL),middleware:{specificationVersion:'v3',transformParams:async({params})=>({...params,providerOptions:{...params.providerOptions,gateway:{only:['google'],models:[]}}})}});
    return withImageContract(withUsageLogging(model,'gateway'));
  }
  return withImageContract(withUsageLogging(createGeminiModel(), FIXED_AI_PROVIDER));
}
export function getVisionLanguageModel(_provider?: ProviderKey, _modelId?: string) { return getLanguageModel(); }
export function getFallbackModel() { return getLanguageModel(); }
export function getFallbackSelection(): { provider: ProviderKey; modelId: string } {
  geminiConfiguration(); return { provider: FIXED_AI_PROVIDER, modelId: FIXED_AI_MODEL };
}
export function hasProviderCredentials(provider: ProviderKey) {
  if (provider !== FIXED_AI_PROVIDER) return false;
  try { geminiConfiguration(); return true; } catch { return false; }
}
export function parseModelString(fullId: string): { provider: ProviderKey; modelId: string } {
  if (fullId === FIXED_AI_MODEL || fullId === FIXED_AI_PROVIDER + '/' + FIXED_AI_MODEL) return { provider: FIXED_AI_PROVIDER, modelId: FIXED_AI_MODEL };
  throw new Error('This deployment supports only ' + FIXED_AI_MODEL + '.');
}
export function isVisionModel(modelId: string) { return modelId.replace(/^google\//, '') === FIXED_AI_MODEL; }
