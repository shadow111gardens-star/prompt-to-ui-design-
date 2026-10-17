import { ProviderKey } from "./provider-registry";

export interface AvailableModel {
  id: string; // Prefixed ID: "openrouter/meta-llama/llama-3-70b-instruct"
  name: string; // Human-readable: "Llama 3 70B Instruct"
  provider: ProviderKey;
  rawId: string; // Provider-specific ID: "meta-llama/llama-3-70b-instruct"
  contextLength?: number;
  supportsVision?: boolean;
}

export function getEnabledProviders(): ProviderKey[] {
  const providers: ProviderKey[] = [];
  if (process.env.OPENROUTER_API_KEY) providers.push("openrouter");
  if (process.env.NVIDIA_NIM_API_KEY) providers.push("nvidia");
  if (
    process.env.OLLAMA_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_OLLAMA_ENABLED === "true" ||
    (process.env.OLLAMA_BASE_URL &&
      process.env.OLLAMA_ENABLED !== "false" &&
      process.env.NEXT_PUBLIC_OLLAMA_ENABLED !== "false")
  ) {
    providers.push("ollama");
  }
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) providers.push("google");
  return providers;
}

export async function fetchAllModels(): Promise<AvailableModel[]> {
  const enabled = getEnabledProviders();

  // H1 fix: Each provider collects into its own local array to avoid shared-mutation race
  const promises = enabled.map(async (provider): Promise<AvailableModel[]> => {
    const providerModels: AvailableModel[] = [];
    try {
      if (provider === "openrouter") {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
        });
        if (response.ok) {
          const json = await response.json();
          const models = json.data || [];
          models.forEach(
            (m: {
              id: string;
              name?: string;
              architecture?: { input_modalities?: string[] };
              description?: string;
              context_length?: number;
            }) => {
              const hasVision =
                m.architecture?.input_modalities?.includes("image") ||
                m.description?.toLowerCase().includes("vision") ||
                false;
              providerModels.push({
                id: `openrouter/${m.id}`,
                name: m.name || m.id,
                provider: "openrouter",
                rawId: m.id,
                contextLength: m.context_length,
                supportsVision: hasVision,
              });
            },
          );
        }
      }

      if (provider === "nvidia") {
        const response = await fetch(
          "https://integrate.api.nvidia.com/v1/models",
          {
            headers: {
              Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
            },
          },
        );
        if (response.ok) {
          const json = await response.json();
          const models = json.data || [];
          models.forEach((m: { id: string }) => {
            const lowerId = m.id.toLowerCase();
            const hasVision =
              lowerId.includes("vision") || lowerId.includes("vl");
            providerModels.push({
              id: `nvidia/${m.id}`,
              name: m.id.split("/").pop() || m.id,
              provider: "nvidia",
              rawId: m.id,
              supportsVision: hasVision,
            });
          });
        }
      }

      if (provider === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const response = await fetch(`${baseUrl}/api/tags`);
        if (response.ok) {
          const json = await response.json();
          const models = json.models || [];
          models.forEach(
            (m: { name: string; details?: { families?: string[] } }) => {
              const lowerName = m.name.toLowerCase();
              const hasVision =
                lowerName.includes("llava") ||
                lowerName.includes("bakllava") ||
                lowerName.includes("vision") ||
                m.details?.families?.includes("clip");
              providerModels.push({
                id: `ollama/${m.name}`,
                name: m.name,
                provider: "ollama",
                rawId: m.name,
                supportsVision: hasVision,
              });
            },
          );
        }
      }

      if (provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        });
        if (response.ok) {
          const data: { data?: Array<{id: string}> } = await response.json();
          for (const item of data.data || []) {
            if (!/^(gpt-|o[134](?:-|$))/.test(item.id) || /audio|image|realtime|transcribe|tts/.test(item.id)) continue;
            providerModels.push({id:`openai/${item.id}`,name:item.id,provider:"openai",rawId:item.id,supportsVision:/gpt-4o|gpt-5|gpt-4.1/.test(item.id)});
          }
        }
      }

      if (provider === "anthropic") {
        // Updated June 2026: Claude 4.x family + Fable 5
        const anthropicModels = [
          {
            rawId: "claude-fable-5",
            name: "Claude Fable 5",
            vision: true,
          },
          {
            rawId: "claude-opus-4-8",
            name: "Claude Opus 4.8",
            vision: true,
          },
          {
            rawId: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            vision: true,
          },
          {
            rawId: "claude-haiku-4-5",
            name: "Claude Haiku 4.5",
            vision: true,
          },
        ];
        anthropicModels.forEach((m) => {
          providerModels.push({
            id: `anthropic/${m.rawId}`,
            name: m.name,
            provider: "anthropic",
            rawId: m.rawId,
            supportsVision: m.vision,
          });
        });
      }

      if (provider === "google") {
        let pageToken: string | undefined;
        do {
          const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
          url.searchParams.set("pageSize", "1000");
          if (pageToken) url.searchParams.set("pageToken", pageToken);
          const response = await fetch(url, {
            headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) throw new Error(`Google model discovery failed: ${response.status}`);
          const data: { models?: Array<{ name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }>; nextPageToken?: string } = await response.json();
          for (const item of data.models || []) {
            if (!item.supportedGenerationMethods?.includes("generateContent")) continue;
            const rawId = item.name.replace(/^models\//, "");
            if (!/^(gemini|gemma)/.test(rawId) || /tts|image|transcribe|robotics|computer-use/.test(rawId)) continue;
            providerModels.push({ id: `google/${rawId}`, name: item.displayName || rawId, provider: "google", rawId, contextLength: item.inputTokenLimit });
          }
          pageToken = data.nextPageToken;
        } while (pageToken);
      }
    } catch (error) {
      console.warn(`Failed to fetch models for provider ${provider}:`, error);
    }
    return providerModels;
  });

  const settled = await Promise.allSettled(promises);
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
