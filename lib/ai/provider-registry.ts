import { withImageContract } from '@/lib/images/generation-context';
import { withUsageLogging } from '@/lib/ai/usage-logging';
import { createGeminiModel, geminiConfiguration } from '@/lib/ai/gemini';
import { FIXED_AI_PROVIDER, FIXED_AI_MODEL } from '@/lib/ai/fixed-model';

// Legacy names remain readable in historical project settings, but cannot route
// generation to a different provider or override the server-fixed model.
export type ProviderKey = 'tokenharbor' | 'xai' | 'openrouter' | 'nvidia' | 'ollama' | 'anthropic' | 'openai' | 'google';
export function getLanguageModel(_provider?: ProviderKey, _modelId?: string) {
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
