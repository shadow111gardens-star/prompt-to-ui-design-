import { withImageContract } from '@/lib/images/generation-context';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { withUsageLogging } from '@/lib/ai/usage-logging';

export type ProviderKey =
  | "xai"
  | "openrouter"
  | "nvidia"
  | "ollama"
  | "anthropic"
  | "openai"
  | "google";

export function getLanguageModel(provider:ProviderKey,modelId:string){return withImageContract(createLanguageModel(provider,modelId));}
function createLanguageModel(provider: ProviderKey, modelId: string) {
  const context=personalProviderContext.getStore();
  const active=context?.settings.active;
  const personal=active?context?.settings.providers[active]:undefined;
  if(active&&personal?.model){provider=active;modelId=personal.model;}
  const ownKey=personal?.key;
  const tracked = <T,>(model: T) => withUsageLogging(model, provider);
  if(provider!=="ollama"&&!ownKey&&!hasProviderCredentials(provider))throw new Error(`No API key is configured for ${provider}. Add a provider key or select a configured model.`);
  // Strip provider prefix if present in the stored modelId (e.g. "openrouter/google/gemini" -> "google/gemini")
  let cleanModelId = modelId;
  const prefix = `${provider}/`;
  if (modelId.startsWith(prefix)) {
    cleanModelId = modelId.substring(prefix.length);
  }

  switch (provider) {
    case "xai":
      return tracked(createOpenAI({baseURL:"https://api.x.ai/v1",apiKey:ownKey||process.env.XAI_API_KEY||""}).chat(cleanModelId));
    case "openrouter":
      return tracked(createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY || "",
      })(cleanModelId, { usage: { include: true } }));
    case "nvidia":
      return tracked(createOpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: process.env.NVIDIA_NIM_API_KEY || "",
      }).chat(cleanModelId));
    case "ollama":
      return tracked(createOpenAI({
        baseURL: `${(process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
        apiKey: "ollama",
      }).chat(cleanModelId));
    case "anthropic":
      return tracked(createAnthropic({apiKey:ownKey||process.env.ANTHROPIC_API_KEY})(cleanModelId));
    case "openai":
      return tracked(createOpenAI({
        apiKey: ownKey || process.env.OPENAI_API_KEY || "",
      })(cleanModelId));
    case "google":
      return tracked(createGoogleGenerativeAI({
        apiKey: ownKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })(cleanModelId));
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Parse a prefixed model string like "openrouter/anthropic/claude-opus-4" */
export function parseModelString(fullId: string): {
  provider: ProviderKey;
  modelId: string;
} {
  const [provider, ...rest] = fullId.split("/");
  if (!provider || rest.length === 0) {
    throw new Error(`Invalid model ID format: ${fullId}`);
  }
  return { provider: provider as ProviderKey, modelId: rest.join("/") };
}

export function hasProviderCredentials(provider:ProviderKey){
  const variables:Record<ProviderKey,string|undefined>={openai:process.env.OPENAI_API_KEY,anthropic:process.env.ANTHROPIC_API_KEY,google:process.env.GEMINI_API_KEY||process.env.GOOGLE_GENERATIVE_AI_API_KEY,xai:process.env.XAI_API_KEY,openrouter:process.env.OPENROUTER_API_KEY,nvidia:process.env.NVIDIA_NIM_API_KEY,ollama:process.env.OLLAMA_ENABLED==='true'||process.env.NEXT_PUBLIC_OLLAMA_ENABLED==='true'||process.env.OLLAMA_BASE_URL?'configured':undefined};
  return !!variables[provider]?.trim();
}
export function getFallbackSelection():{provider:ProviderKey;modelId:string}{
  const personal=personalProviderContext.getStore()?.settings;
  if(personal?.active&&personal.providers[personal.active]?.model)return {provider:personal.active,modelId:personal.providers[personal.active]!.model};
  const fallback=process.env.NEXT_PUBLIC_OPENUI_FALLBACK_MODEL;
  if(fallback){const parsed=parseModelString(fallback);if(hasProviderCredentials(parsed.provider))return parsed;}
  const provider=(['google','openai','anthropic','xai','openrouter','nvidia','ollama'] as ProviderKey[]).find(hasProviderCredentials);
  if(!provider)throw new Error('No AI provider is configured. Add and test a key in Settings > AI Preferences before generating.');
  return {provider,modelId:provider==='google'&&process.env.GOOGLE_REDESIGN_FALLBACK_MODEL?process.env.GOOGLE_REDESIGN_FALLBACK_MODEL:PROVIDER_VISION_FALLBACKS[provider]};
}
export function getFallbackModel(){const {provider,modelId}=getFallbackSelection();return getLanguageModel(provider,modelId);}

// TODO: Change fallback vision-enabled models for different providers.
const PROVIDER_VISION_FALLBACKS: Record<ProviderKey, string> = {
  xai: "grok-4",
  openrouter: "qwen/qwen3.7-plus",
  openai: "gpt-5.5-2026-04-23",
  anthropic: "claude-fable-5",
  google: "gemini-3.5-flash",
  nvidia: "meta/llama-3.2-11b-vision-instruct",
  ollama: "gemma4",
};

export function isVisionModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("vision") ||
    id.includes("-vl") ||
    id.includes("vl-") ||
    id.includes("gemini") ||
    id.includes("gpt-4o") ||
    id.includes("gpt-5") ||
    id.includes("claude") ||
    id.includes("pixtral") ||
    id.includes("llava") ||
    id.includes("bakllava") ||
    id.includes("llama-3.2") ||
    id.includes("qwen2.5-vl") ||
    id.includes("qwen-2.5-vl") ||
    id.includes("qwen3.7-plus")
  );
}

export function getVisionLanguageModel(provider: ProviderKey, modelId: string) {
  if (isVisionModel(modelId)) {
    return getLanguageModel(provider, modelId);
  }

  const fallbackModelId =
    PROVIDER_VISION_FALLBACKS[provider] || PROVIDER_VISION_FALLBACKS.openrouter;
  console.warn(
    `Selected model "${modelId}" does not support vision. Falling back to vision model "${fallbackModelId}"`,
  );
  return getLanguageModel(provider, fallbackModelId);
}
