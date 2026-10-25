import { getLanguageModel } from '@/lib/ai/provider-registry';
import { tokenHarborConfiguration } from '@/lib/ai/tokenharbor';
import { FIXED_AI_PROVIDER } from '@/lib/ai/fixed-model';
export async function getMoodboardModel(_settings?: {provider:string|null;model:string|null}|null) {
  const { model } = tokenHarborConfiguration();
  return { model: getLanguageModel(), provider: FIXED_AI_PROVIDER, modelId: model };
}
