import { getLanguageModel } from '@/lib/ai/provider-registry';
import { geminiConfiguration } from '@/lib/ai/gemini';
import { FIXED_AI_PROVIDER } from '@/lib/ai/fixed-model';
export async function getMoodboardModel(_settings?: {provider:string|null;model:string|null}|null) {
  const { model } = geminiConfiguration();
  return { model: getLanguageModel(), provider: FIXED_AI_PROVIDER, modelId: model };
}
