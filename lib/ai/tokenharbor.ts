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

type InputComponents = { systemPrompt: number; jsonSchema: number; conversationHistory: number; designContext: number; userPrompt: number; tools: number; framing: number };
const bytes = (value: string) => Buffer.byteLength(value, 'utf8');
/** Count normalized message CONTENT, not SDK/HTTP JSON escaping and field names.
 * UTF-8 bytes remain a conservative proxy, not DeepSeek's exact tokenizer.
 * Framing allowance: 32 per message + 32 for assistant priming,
 * plus 16 per additional content part. Not an exact chat-template count. */
export function measureTokenHarborInput(prompt: unknown, extra?: unknown) {
  const messages = Array.isArray(prompt) ? prompt : [];
  const components: InputComponents = { systemPrompt: 0, jsonSchema: 0, conversationHistory: 0, designContext: 0, userPrompt: 0, tools: 0, framing: 32 + messages.length * 32 };
  const finalUser = messages.findLastIndex(message => message?.role === 'user');
  for (const [index, message] of messages.entries()) {
    const content = (message as { content?: unknown }).content;
    if (Array.isArray(content)) components.framing += Math.max(0, content.length - 1) * 16;
    if (Array.isArray(content) && content.some(part => part && typeof part === 'object' && ['file', 'image'].includes(String((part as { type?: unknown }).type)))) {
      throw new Error('Image input cannot currently be verified against the 4,000-token limit. Generate from text with drawing/references turned off. No provider request was sent.');
    }
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => {
      if (part?.type === 'text' && typeof part.text === 'string') return part.text;
      // Tool calls/results and any future non-text part must not escape accounting.
      return JSON.stringify(part) ?? '';
    }).join('') : JSON.stringify(content) ?? '';
    if (message.role === 'system') components.systemPrompt += bytes(text);
    else if (index !== finalUser) components.conversationHistory += bytes(text);
    else {
      // FRAME uses separate, labelled text parts. Classification affects telemetry
      // only: every byte is counted even if a user includes the same labels.
      const parts = Array.isArray(content) ? content : [{ type: 'text', text }];
      for (const part of parts) {
        const value = part?.type === 'text' ? part.text : JSON.stringify(part) ?? '';
        if (typeof value !== 'string') continue;
        if (value.startsWith('DESIGN SYSTEM:') || value.startsWith('DEVICE RULES:')) components.designContext += bytes(value);
        else components.userPrompt += bytes(value);
      }
    }
  }
  const options = extra && typeof extra === 'object' ? extra as Record<string, unknown> : {};
  if (options.responseFormat !== undefined) components.jsonSchema = bytes(JSON.stringify(options.responseFormat));
  if (options.tools !== undefined) components.tools = bytes(JSON.stringify(options.tools));
  // Include unfamiliar options rather than silently exempting future schema data.
  const other = Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'tools' && key !== 'responseFormat'));
  if (Object.keys(other).length) components.jsonSchema += bytes(JSON.stringify(other));
  const upperBound = Object.values(components).reduce((sum, value) => sum + value, 0);
  return { method: 'utf8_content_upper_bound' as const, components, upperBound, limit: AI_INPUT_TOKEN_LIMIT };
}
export function validateTokenHarborInput(prompt: unknown, extra?: unknown): number {
  const measurement = measureTokenHarborInput(prompt, extra);
  const { upperBound } = measurement;
  // No prompts, schema contents, project/user IDs, keys or headers are logged.
  console.info(JSON.stringify({ event: 'ai_input_preflight', model: FIXED_AI_MODEL, ...measurement, accepted: upperBound <= AI_INPUT_TOKEN_LIMIT }));
  if (upperBound > AI_INPUT_TOKEN_LIMIT) {
    const largest = Object.entries(measurement.components).sort((a, b) => b[1] - a[1])[0];
    throw new Error(`Input exceeds the safe 4,000-token budget (${upperBound} conservative units; largest component: ${largest[0]} ${largest[1]}). Reduce prompt or design context explicitly; requirements were not truncated. No provider request was sent.`);
  }
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
