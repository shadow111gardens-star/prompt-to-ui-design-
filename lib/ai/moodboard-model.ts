import { getLanguageModel } from '@/lib/ai/provider-registry';
import { fundingScope } from '@/lib/billing/scope';
import { geminiConfiguration } from '@/lib/ai/gemini';
import { FIXED_AI_PROVIDER, FIXED_AI_MODEL } from '@/lib/ai/fixed-model';
export async function getMoodboardModel(_settings?: {provider:string|null;model:string|null}|null) {
  const model=fundingScope.getStore()?.gatewayKey?FIXED_AI_MODEL:geminiConfiguration().model;
  return { model: getLanguageModel(), provider: FIXED_AI_PROVIDER, modelId: model };
}
