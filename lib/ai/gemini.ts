import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import { markProviderGenerationRequest } from '@/lib/ai/usage-logging';
import { FIXED_AI_MODEL, AI_INPUT_TOKEN_LIMIT, AI_MAX_OUTPUT_TOKENS } from '@/lib/ai/fixed-model';

export class GeminiConfigurationError extends Error {}
export function geminiConfiguration() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || FIXED_AI_MODEL;
  if (!key) throw new GeminiConfigurationError('Gemini is not configured. Set GEMINI_API_KEY on the server.');
  if (model !== FIXED_AI_MODEL) throw new GeminiConfigurationError(`Set GEMINI_MODEL to exactly ${FIXED_AI_MODEL} on the server, or leave it unset.`);
  return { key, model };
}
export function geminiConfigurationError(): string | null {
  try { geminiConfiguration(); return null; }
  catch (error) { return error instanceof GeminiConfigurationError ? error.message : 'Gemini configuration is unavailable.'; }
}

type InputComponents = { systemPrompt: number; jsonSchema: number; conversationHistory: number; designContext: number; userPrompt: number; tools: number; framing: number };
const bytes = (value: string) => Buffer.byteLength(value, 'utf8');
/** Count normalized message CONTENT, not SDK/HTTP JSON escaping and field names.
 * UTF-8 bytes remain a conservative proxy, not Gemini's exact tokenizer.
 * Framing allowance: 32 per message + 32 for assistant priming,
 * plus 16 per additional content part. Not an exact chat-template count. */
export function measureGeminiInput(prompt: unknown, extra?: unknown) {
  const messages = Array.isArray(prompt) ? prompt : [];
  const components: InputComponents = { systemPrompt: 0, jsonSchema: 0, conversationHistory: 0, designContext: 0, userPrompt: 0, tools: 0, framing: 32 + messages.length * 32 };
  const finalUser = messages.findLastIndex(message => message?.role === 'user');
  for (const [index, message] of messages.entries()) {
    const content = (message as { content?: unknown }).content;
    if (Array.isArray(content)) components.framing += Math.max(0, content.length - 1) * 16;
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
        if (value.startsWith('PROJECT REFERENCE DATA:\n') && value.includes('\n\nCURRENT USER REQUEST:\n')) {
          const marker = '\n\nCURRENT USER REQUEST:\n', boundary = value.indexOf(marker);
          components.designContext += bytes(value.slice(0, boundary));
          components.userPrompt += bytes(value.slice(boundary));
        } else if (value.startsWith('Requested change: ')) {
          const boundary = value.search(/\n\n(?=SELECTED SCREEN STYLE FALLBACK|Screen width:)/);
          if (boundary < 0) components.userPrompt += bytes(value);
          else { components.userPrompt += bytes(value.slice(0, boundary)); components.designContext += bytes(value.slice(boundary)); }
        } else if (value.startsWith('DESIGN SYSTEM:') || value.startsWith('DEVICE RULES:')) components.designContext += bytes(value);
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
  return { method: 'utf8_content_bytes' as const, components, upperBound, limit: AI_INPUT_TOKEN_LIMIT };
}
/** Diagnostic byte sizes only: never use these as Gemini token counts. */
export function logGeminiInputComponents(prompt: unknown, extra?: unknown) {
  const measurement = measureGeminiInput(prompt, extra);
  console.info(JSON.stringify({ event: 'ai_input_components', model: FIXED_AI_MODEL,
    unit: 'utf8_bytes_with_framing_allowance', components: measurement.components, bytesWithFraming: measurement.upperBound }));
}
export class GeminiPreflightError extends Error {
  constructor(message: string) { super(message); this.name = 'GeminiPreflightError'; }
}
/** Count the exact native request produced by the installed Google adapter,
 * including system instructions, history, inline media, tools and JSON schema.
 * https://ai.google.dev/api/tokens#method:-models.counttokens */
export async function validateGeminiRequest(body: Record<string, unknown>, key: string, signal?: AbortSignal | null) {
  markProviderGenerationRequest(false);
  let response: Response;
  try {
    response = await globalThis.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FIXED_AI_MODEL}:countTokens`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ generateContentRequest: { ...body, model: 'models/' + FIXED_AI_MODEL } }),
      redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch {
    throw new GeminiPreflightError('Gemini token counting failed. Retry manually. No generation request was sent.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new GeminiPreflightError('Gemini token counting failed (HTTP ' + response.status + '). Check server key, model access or quota. No generation request was sent.');
  }
  let result: unknown;
  try { result = await response.json(); } catch {
    throw new GeminiPreflightError('Gemini returned invalid token counts. No generation request was sent.');
  }
  const tokens = result && typeof result === 'object' && 'totalTokens' in result ? result.totalTokens : undefined;
  if (typeof tokens !== 'number' || !Number.isSafeInteger(tokens) || tokens < 0) {
    throw new GeminiPreflightError('Gemini returned invalid token counts. No generation request was sent.');
  }
  console.info(JSON.stringify({ event: 'ai_input_preflight', model: FIXED_AI_MODEL, method: 'gemini_count_tokens',
    inputTokens: tokens, limit: AI_INPUT_TOKEN_LIMIT, accepted: tokens <= AI_INPUT_TOKEN_LIMIT,
    tokenCountRequestSent: true, generationRequestSent: false }));
  if (tokens > AI_INPUT_TOKEN_LIMIT) {
    throw new GeminiPreflightError(`Input exceeds the 4,000-token budget (${tokens} Gemini-counted tokens including system instructions, schema and project context). Reduce the selected context or requirements explicitly. Nothing was truncated. No generation request was sent.`);
  }
  return tokens;
}
export const geminiLimitsMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    logGeminiInputComponents(params.prompt, { tools: params.tools, responseFormat: params.responseFormat });
    return { ...params, maxOutputTokens: Math.min(params.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS, AI_MAX_OUTPUT_TOKENS) };
  },
};
export function createGeminiModel() {
  const { key, model } = geminiConfiguration();
  const client = createGoogleGenerativeAI({ apiKey: key,
    fetch: async (url, options) => {
      const target = new URL(String(url));
      if (target.origin !== 'https://generativelanguage.googleapis.com' ||
          ![`/v1beta/models/${model}:generateContent`, `/v1beta/models/${model}:streamGenerateContent`].includes(target.pathname)) {
        throw new Error('Unsupported Gemini endpoint.');
      }
      if (typeof options?.body !== 'string') throw new GeminiPreflightError('Invalid Gemini request. No generation request was sent.');
      const body: unknown = JSON.parse(options.body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GeminiPreflightError('Invalid Gemini request. No generation request was sent.');
      await validateGeminiRequest(body as Record<string, unknown>, key, options.signal);
      markProviderGenerationRequest(true);
      let response: Response;
      try { response = await globalThis.fetch(url, { ...options, redirect: 'error' }); }
      catch { throw new Error('Gemini connection failed. Retry manually.'); }
      if (response.ok) return response;
      // Never forward provider error bodies: they can contain private request data.
      await response.body?.cancel();
      const message = response.status === 401 || response.status === 403 ? 'Gemini rejected the server API key or model access.'
        : response.status === 429 ? 'Gemini rate limit or quota reached. Retry manually later.'
        : response.status === 404 ? 'The configured Gemini model is unavailable for this API key.'
        : 'Gemini generation failed. Retry manually.';
      return Response.json({ error: { code: response.status, message, status: 'REQUEST_FAILED' } }, { status: response.status });
    },
  });
  return wrapLanguageModel({ model: client(model), middleware: geminiLimitsMiddleware });
}
