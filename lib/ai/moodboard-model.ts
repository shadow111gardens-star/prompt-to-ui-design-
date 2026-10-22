import { getFallbackSelection, getLanguageModel, type ProviderKey } from '@/lib/ai/provider-registry';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';

/** Unlike the older vision resolver, never silently substitute the selected model. */
export async function getMoodboardModel(settings?: { provider: string | null; model: string | null } | null) {
  const personal = personalProviderContext.getStore()?.settings;
  const active = personal?.active;
  const selection = active && personal?.providers[active]?.model
    ? { provider: active as ProviderKey, modelId: personal.providers[active]!.model }
    : settings?.provider && settings.model
      ? { provider: settings.provider as ProviderKey, modelId: settings.model }
      : getFallbackSelection();
  const { provider } = selection;
  const modelId = selection.modelId.replace(new RegExp(`^${provider}/`), '');
  let supported = false;
  if (provider === 'openrouter') {
    const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error('Could not verify image support for the selected OpenRouter model. Retry or select a vision model.');
    const data = await response.json() as { data?: Array<{ id: string; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }> };
    const model = data.data?.find(item => item.id === modelId);
    supported = !!model?.architecture?.input_modalities?.includes('image') && !!model.architecture.output_modalities?.includes('text');
  } else if (provider === 'ollama') {
    const base = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '').replace(/\/v1$/, '');
    const response = await fetch(`${base}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not verify the selected Ollama model. Ensure it is installed and the Ollama server is running.');
    const data = await response.json() as { capabilities?: string[] };
    supported = !!data.capabilities?.includes('vision') && !!data.capabilities.includes('completion');
  } else {
    const families: Partial<Record<ProviderKey, RegExp>> = {
      google: /^gemini-(?:1\.5|2(?:\.|-)|3(?:\.|-))/i,
      openai: /^(?:gpt-4o(?:-|$)|gpt-4\.1(?:-|$)|gpt-5(?:\.|-|$))/i,
      anthropic: /^claude-(?:3(?:\.|-)|(?:sonnet|opus|haiku)-4(?:\.|-|$)|4(?:\.|-|$))/i,
      xai: /^grok-(?:4(?:\.|-|$)|2-vision)/i,
      nvidia: /^meta\/llama-3\.2-(?:11b|90b)-vision-instruct$/i,
    };
    supported = !!families[provider]?.test(modelId) && !/audio|realtime|tts|transcri|embedding|imagine|image-generation/i.test(modelId);
  }
  if (!supported) throw new Error(`Image input is not confirmed for ${provider}/${modelId}. Select an image-capable model in AI settings; Moodboard images were not sent or analyzed. No model was substituted.`);
  return { model: getLanguageModel(provider, modelId), provider, modelId };
}
