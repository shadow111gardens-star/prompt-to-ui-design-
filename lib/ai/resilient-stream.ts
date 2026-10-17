import type { LanguageModel } from "ai";
import { getLanguageModel } from "@/lib/ai/provider-registry";
import { createStreamResponse } from "@/lib/ai/route-utils";

type Run = {
  fullStream: AsyncIterable<{ type: string; text?: string; error?: unknown }>;
  totalUsage: PromiseLike<unknown>;
  finishReason: PromiseLike<string>;
};

export function createResilientStreamResponse(
  generate: (model: LanguageModel) => Run,
  model: LanguageModel,
  streamId: string,
  provider?: string | null,
  modelId?: string | null,
): Response {
  let result = generate(model);
  let providerAttempts = 1;
  async function* text() {
    let emitted = false;
    try {
      for await (const part of result.fullStream) {
        if (part.type === "error") throw part.error;
        if (part.type === "text-delta" && typeof part.text === "string") { emitted = true; yield part.text; }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
      const fallback = process.env.GOOGLE_REDESIGN_FALLBACK_MODEL || "gemini-3.5-flash-lite";
      if (emitted || provider !== "google" || modelId?.replace(/^google\//, "") === fallback ||
          !(status === 503 || /high demand|overload|temporarily unavailable|no longer available|not found/i.test(message))) throw error;
      providerAttempts = 2;
      result = generate(getLanguageModel("google", fallback) as LanguageModel);
      for await (const part of result.fullStream) {
        if (part.type === "error") throw part.error;
        if (part.type === "text-delta" && typeof part.text === "string") yield part.text;
      }
    }
  }
  return createStreamResponse(text(), "text/event-stream; charset=utf-8", streamId, async () => ({
    providerAttempts, usage: await result.totalUsage, finishReason: await result.finishReason,
  }));
}
