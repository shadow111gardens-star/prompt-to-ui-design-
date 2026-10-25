import { createOpenAI } from '@ai-sdk/openai';
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import { FIXED_AI_MODEL, AI_INPUT_TOKEN_LIMIT, AI_MAX_OUTPUT_TOKENS } from '@/lib/ai/fixed-model';

export class TokenHarborConfigurationError extends Error {}
export function tokenHarborConfiguration() {
  const key = process.env.TOKENHARBOR_API_KEY?.trim();
  const model = process.env.TOKENHARBOR_MODEL?.trim();
  if (!key) throw new TokenHarborConfigurationError('TokenHarbor is not configured. Set TOKENHARBOR_API_KEY on the server.');
  if (model !== FIXED_AI_MODEL) throw new TokenHarborConfigurationError(`Set TOKENHARBOR_MODEL to exactly ${FIXED_AI_MODEL} on the server.`);
  return { key, model };
}
export function tokenHarborConfigurationError(): string | null {
  try { tokenHarborConfiguration(); return null; }
  catch (error) { return error instanceof TokenHarborConfigurationError ? error.message : 'TokenHarbor configuration is unavailable.'; }
}

/** Conservative text bound, NOT a claimed count from DeepSeek's tokenizer. */
export function validateTokenHarborInput(prompt: unknown, extra?: unknown): number {
  const messages = Array.isArray(prompt) ? prompt : [];
  for (const message of messages) {
    const content = (message as { content?: unknown }).content;
    if (Array.isArray(content) && content.some(part => part && typeof part === 'object' && ['file', 'image'].includes(String((part as { type?: unknown }).type)))) {
      throw new Error('Image input cannot currently be verified against the 4,000-token limit. Generate from text with drawing/references turned off. No provider request was sent.');
    }
  }
  // Byte-level text tokens cannot exceed their UTF-8 bytes; reserve explicit
  // room for message framing. JSON also includes tools/schema when supplied.
  const upperBound = Buffer.byteLength(JSON.stringify({ prompt, extra }), 'utf8') + 512 + messages.length * 32;
  if (upperBound > AI_INPUT_TOKEN_LIMIT) throw new Error('Input exceeds the safe 4,000-token budget. Shorten the prompt, history, HTML or design context. No provider request was sent.');
  return upperBound;
}
export const tokenHarborLimitsMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    validateTokenHarborInput(params.prompt, { tools: params.tools, responseFormat: params.responseFormat });
    return { ...params, maxOutputTokens: Math.min(params.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS, AI_MAX_OUTPUT_TOKENS) };
  },
};
export function createTokenHarborModel() {
  const { key, model } = tokenHarborConfiguration();
  const client = createOpenAI({ apiKey: key, baseURL: 'https://tokenharbor.ai/v1',
    fetch: async (url, options) => {
      if (String(url) !== 'https://tokenharbor.ai/v1/chat/completions') throw new Error('Unsupported TokenHarbor endpoint.');
      let response: Response;
      try { response = await globalThis.fetch(url, { ...options, redirect: 'error' }); }
      catch { throw new Error('TokenHarbor connection failed. Retry manually.'); }
      if (response.ok) return response;
      // Provider error bodies may echo credentials. Never forward/log them.
      await response.body?.cancel();
      const message = response.status === 401 || response.status === 403 ? 'TokenHarbor rejected the server API key or free-model access.'
        : response.status === 429 ? 'TokenHarbor rate limit or free allowance reached. Retry manually later.' : 'TokenHarbor generation failed. Retry manually.';
      return Response.json({ error: { message } }, { status: response.status });
    },
  });
  return wrapLanguageModel({ model: client.chat(model), middleware: tokenHarborLimitsMiddleware });
}
