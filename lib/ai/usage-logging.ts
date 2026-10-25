import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { calculateTokenCost, type TokenCounts } from '@/lib/ai/usage-pricing';

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function identifier(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9._:/@-]{1,200}$/.test(value) ? value : null;
}
export function normalizeProviderUsage(value: unknown, provider?: string): TokenCounts {
  const usage = object(value), input = object(usage.inputTokens), output = object(usage.outputTokens);
  let inputTokens = count(input.total) ?? count(usage.inputTokens);
  let outputTokens = count(output.total) ?? count(usage.outputTokens);
  const raw = object(usage.raw);
  // Google's adapter defaults absent raw counts to zero. Preserve absence
  // instead of labelling those defaults as observed provider usage.
  const googleRaw = provider === 'google' && usage.raw !== null && typeof usage.raw === 'object';
  if (googleRaw) {
    inputTokens = count(raw.promptTokenCount);
    const total = count(raw.totalTokenCount);
    if (total !== null && inputTokens !== null && total >= inputTokens) outputTokens = total - inputTokens;
    else if (count(raw.candidatesTokenCount) === null && count(raw.thoughtsTokenCount) === null) outputTokens = null;
  }
  return { inputTokens, outputTokens,
    totalTokens: count(raw.totalTokenCount) ?? count(raw.total_tokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
    cachedInputTokens: googleRaw ? count(raw.cachedContentTokenCount) : count(input.cacheRead) ?? count(usage.cachedInputTokens),
    cacheWriteTokens: count(input.cacheWrite), reasoningTokens: googleRaw ? count(raw.thoughtsTokenCount) : count(output.reasoning) ?? count(usage.reasoningTokens) };
}
type Call = {
  callId: string; provider: string; requestedModel: string | null; model: string | null;
  upstreamProvider: string | null;
  modelSource: 'adapter_model_id' | 'provider_response'; operation: 'stream' | 'generate';
  status: 'pending' | 'completed' | 'failed' | 'cancelled'; error: string | null;
  statusCode: number | null; usage: TokenCounts; usageAvailable: boolean; usageComplete: boolean;
  extraBilling: boolean; logged: boolean; reportedCostUsd: number | null;
};
type Generation = { generationId: string; route: string; calls: Call[]; finished: boolean; designTarget: 'web' | 'app' | null };
const usageContext = new AsyncLocalStorage<Generation>();
function log(value: unknown) {
  // No prompts, HTML, identifiers of users/projects, headers or raw provider errors.
  try { console.info(JSON.stringify(value)); } catch { /* Telemetry cannot break generation. */ }
}
function errorCode(error: unknown) { return count(object(error).statusCode); }
function costForCall(call: Call) {
  if (call.reportedCostUsd !== null) return { status: 'provider_reported', basis: 'provider_reported_charge',
    inputUsd: null, outputUsd: null, totalUsd: call.reportedCostUsd, actualBilledUsd: call.reportedCostUsd };
  return calculateTokenCost(call.provider, call.model ?? '', call.usage, call.extraBilling);
}
function recordCall(generation: Generation, call: Call) {
  if (call.logged) return;
  call.logged = true;
  log({ event: 'ai_usage_call', generationId: generation.generationId, route: generation.route,
    callId: call.callId, provider: call.provider, model: call.model, requestedModel: call.requestedModel,
    upstreamProvider: call.upstreamProvider,
    modelSource: call.modelSource, operation: call.operation, status: call.status,
    ...call.usage, usageAvailable: call.usageAvailable, usageComplete: call.usageComplete,
    error: call.error, statusCode: call.statusCode,
    cost: costForCall(call) });
}
export function setGenerationDesignTarget(target?: 'web' | 'app') {
  const generation = usageContext.getStore(); if (generation) generation.designTarget = target ?? null;
}
function finishGeneration(generation: Generation, status: string) {
  if (generation.finished) return;
  generation.finished = true;
  for (const call of generation.calls) {
    if (call.status === 'pending') { call.status = 'cancelled'; call.error = 'usage_not_received_before_generation_end'; }
    recordCall(generation, call);
  }
  const calls = generation.calls;
  function sum(key: keyof TokenCounts, complete: boolean) {
    const values = calls.map(call => call.usage[key]);
    if (!values.length || (complete && values.some(value => value === null))) return null;
    const known = values.filter((value): value is number => value !== null);
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
  }
  const providers = [...new Set(calls.map(call => call.provider))], models = [...new Set(calls.map(call => call.model))];
  const costs = calls.map(costForCall);
  function sumCost(key: 'inputUsd' | 'outputUsd' | 'totalUsd' | 'actualBilledUsd') {
    return costs.length && costs.every(cost => cost[key] !== null) ? costs.reduce((sum, cost) => sum + (cost[key] ?? 0), 0) : null;
  }
  const costComplete = costs.length > 0 && costs.every(cost => cost.totalUsd !== null);
  log({ event: 'ai_usage_summary', generationId: generation.generationId, route: generation.route,
    designTarget: generation.designTarget, provider: providers.length === 1 ? providers[0] : providers.length ? 'mixed' : null,
    model: models.length === 1 ? models[0] : models.length ? 'mixed' : null,
    models: calls.map(call => ({ provider: call.provider, model: call.model, callId: call.callId })), aiCalls: calls.length,
    inputTokens: sum('inputTokens', true), outputTokens: sum('outputTokens', true), totalTokens: sum('totalTokens', true),
    cachedInputTokens: sum('cachedInputTokens', true), cacheWriteTokens: sum('cacheWriteTokens', true), reasoningTokens: sum('reasoningTokens', true),
    knownInputTokens: sum('inputTokens', false), knownOutputTokens: sum('outputTokens', false), knownTotalTokens: sum('totalTokens', false),
    usageComplete: calls.length > 0 && calls.every(call => call.usageComplete),
    status: status === 'completed' && calls.at(-1)?.status === 'failed' ? 'failed'
      : calls.some(call => call.status === 'failed') && status === 'completed' ? 'completed_with_failed_attempts' : status,
    cost: { status: costComplete ? (costs.every(cost => cost.status === 'provider_reported') ? 'provider_reported' : 'calculated') : 'unavailable',
      basis: 'per_call_provider_charge_or_explicit_published_rate_basis',
      inputUsd: sumCost('inputUsd'), outputUsd: sumCost('outputUsd'), totalUsd: sumCost('totalUsd'), actualBilledUsd: sumCost('actualBilledUsd') } });
}

/** Request scope covers ALL adapter calls, including SDK retries and tool steps. */
export async function withGenerationUsage(request: Request, handler: () => Promise<Response>): Promise<Response> {
  const route = new URL(request.url).pathname;
  if (!/^\/api\/generate(?:\/|$)/.test(route) || usageContext.getStore()) return handler();
  const generation: Generation = { generationId: randomUUID(), route, calls: [], finished: false, designTarget: null };
  return usageContext.run(generation, async () => {
    const abort = () => finishGeneration(generation, 'aborted');
    request.signal.addEventListener('abort', abort, { once: true });
    const finish = (status: string) => { request.signal.removeEventListener('abort', abort); finishGeneration(generation, status); };
    try {
      const response = await handler();
      const headers = new Headers(response.headers); headers.set('X-OpenUI-Generation-Id', generation.generationId);
      if (!response.body) { finish(response.ok ? 'completed' : 'failed'); return new Response(null, { status: response.status, headers }); }
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) { finish(response.ok ? 'completed' : 'failed'); controller.close(); }
            else controller.enqueue(next.value);
          } catch (error) { finish('failed'); controller.error(error); }
        },
        async cancel(reason) { try { await reader.cancel(reason); } finally { finish('cancelled'); } },
      });
      return new Response(body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) { finish('failed'); throw error; }
  });
}

const wrapped = new WeakSet<object>();
export function withUsageLogging<T>(model: T, provider: string): T {
  if (!usageContext.getStore() || !model || typeof model !== 'object' || wrapped.has(model)) return model;
  const candidate = model as unknown as LanguageModelV3;
  // The registered production adapters are v3. Test/non-language-model objects
  // are left alone; never mutate provider behavior just to obtain telemetry.
  if (typeof candidate.doGenerate !== 'function' || typeof candidate.doStream !== 'function') return model;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate, model, params }) => {
      const generation = usageContext.getStore(); if (!generation || generation.finished) return doGenerate();
      const call = begin(generation, provider, model.modelId, 'generate', params);
      try {
        const result = await doGenerate();
        update(call, result.usage, result.response?.modelId, result.providerMetadata);
        if (result.content.some(part => part.type === 'file')) call.extraBilling = true;
        call.status = 'completed'; recordCall(generation, call); return result;
      } catch (error) { fail(generation, call, error); throw error; }
    },
    wrapStream: async ({ doStream, model, params }) => {
      const generation = usageContext.getStore(); if (!generation || generation.finished) return doStream();
      const call = begin(generation, provider, model.modelId, 'stream', params);
      try {
        const result = await doStream(), reader = result.stream.getReader();
        const stream: typeof result.stream = new ReadableStream({
          async pull(controller) {
            try {
              const next = await reader.read();
              if (next.done) {
                if (call.status === 'pending') { call.status = 'completed'; if (!call.usageAvailable) call.error = 'provider_usage_unavailable'; }
                recordCall(generation, call); controller.close(); return;
              }
              const part = next.value;
              if (!call.logged) {
                if (part.type === 'response-metadata' && part.modelId) { call.model = identifier(part.modelId); call.modelSource = 'provider_response'; }
                if (part.type === 'finish') update(call, part.usage, undefined, part.providerMetadata);
                if (part.type === 'file') call.extraBilling = true;
                if (part.type === 'error') { call.status = 'failed'; call.error = 'provider_stream_error'; call.statusCode = errorCode(part.error); }
              }
              controller.enqueue(part);
            } catch (error) { fail(generation, call, error); controller.error(error); }
          },
          async cancel(reason) {
            try { await reader.cancel(reason); } finally {
              if (!call.logged) { call.status = 'cancelled'; call.error = 'stream_cancelled'; recordCall(generation, call); }
            }
          },
        });
        return { ...result, stream };
      } catch (error) { fail(generation, call, error); throw error; }
    },
  };
  const result = wrapLanguageModel({ model: candidate, middleware }); wrapped.add(result);
  return result as T;
}
function begin(generation: Generation, provider: string, modelId: string, operation: Call['operation'], params: unknown): Call {
  const p = object(params);
  // Tool fees, audio/file rates, explicit cache storage and nonstandard tiers
  // need their own pricing; do not label their token calculation a total cost.
  const prompts = Array.isArray(p.prompt) ? p.prompt : [];
  const hasFiles = prompts.some(message => {
    const content = object(message).content;
    return Array.isArray(content) && content.some(part => object(part).type === 'file' && !String(object(part).mediaType ?? '').startsWith('image/'));
  });
  const call: Call = { callId: randomUUID(), provider, requestedModel: identifier(modelId), model: identifier(modelId),
    upstreamProvider: null,
    modelSource: 'adapter_model_id', operation, status: 'pending', error: null, statusCode: null,
    usage: normalizeProviderUsage(null), usageAvailable: false, usageComplete: false,
    extraBilling: hasFiles || (Array.isArray(p.tools) && p.tools.length > 0) || Object.keys(object(p.providerOptions)).length > 0, logged: false, reportedCostUsd: null };
  generation.calls.push(call); return call;
}
function update(call: Call, usage: unknown, responseModel?: string, metadata?: unknown) {
  if (call.logged) return;
  if (responseModel) { call.model = identifier(responseModel); call.modelSource = 'provider_response'; }
  call.usage = normalizeProviderUsage(usage, call.provider);
  call.usageAvailable = Object.values(call.usage).some(value => value !== null);
  call.usageComplete = call.usage.inputTokens !== null && call.usage.outputTokens !== null && call.usage.totalTokens !== null;
  // The gateway can report the actual charge even when its current rate card
  // is unknown. Do not log the rest of its metadata or apply direct rates.
  const cost = object(object(object(metadata).openrouter).usage).cost;
  if (call.provider === 'openrouter') {
    call.upstreamProvider = identifier(object(object(metadata).openrouter).provider);
    if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) call.reportedCostUsd = cost;
  }
  if (!call.usageComplete) call.error = 'provider_usage_unavailable_or_partial';
}
function fail(generation: Generation, call: Call, error: unknown) {
  if (call.logged) return;
  call.status = 'failed'; call.error = 'provider_call_failed'; call.statusCode = errorCode(error); recordCall(generation, call);
}
