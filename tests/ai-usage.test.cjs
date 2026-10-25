const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { streamText, generateText } = require('ai');
const { APICallError } = require('@ai-sdk/provider');
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
  };
}
const load = loader(), usage = load('lib/ai/usage-logging.ts'), pricing = load('lib/ai/usage-pricing.ts');
const tokens = (input = 100, output = 40) => ({ inputTokens: { total: input, noCache: input - 20, cacheRead: 20, cacheWrite: 0 }, outputTokens: { total: output, text: output - 10, reasoning: 10 } });
function model(id = 'gemini-2.5-flash', options = {}) {
  return { specificationVersion: 'v3', provider: 'mock-adapter', modelId: id, supportedUrls: {},
    doGenerate: options.doGenerate || (async () => ({ content: [{ type: 'text', text: 'generated HTML' }], finishReason: { unified: 'stop' }, usage: tokens(), warnings: [], response: { modelId: id } })),
    doStream: options.doStream || (async () => ({ stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: 'response-metadata', modelId: id });
      controller.enqueue({ type: 'text-start', id: 'text' });
      controller.enqueue({ type: 'text-delta', id: 'text', delta: 'generated HTML' });
      controller.enqueue({ type: 'text-end', id: 'text' });
      controller.enqueue({ type: 'finish', finishReason: { unified: 'stop' }, usage: tokens() });
      controller.close();
    } }) })),
  };
}
async function capture(work) {
  const previous = console.info, logs = []; console.info = value => logs.push(JSON.parse(value));
  try { await work(logs); } finally { console.info = previous; }
  return logs;
}
const request = () => new Request('http://localhost/api/generate/redesign');

test('real SDK streaming + planning collect each adapter request once, without adding cached/reasoning subsets twice', async () => {
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      usage.setGenerationDesignTarget('web');
      const candidate = usage.withUsageLogging(model(), 'google');
      await generateText({ model: candidate, prompt: 'PRIVATE planning prompt', maxRetries: 0 });
      const result = streamText({ model: candidate, prompt: 'PRIVATE design prompt', maxRetries: 0 });
      return result.toTextStreamResponse();
    });
    assert.ok(response.headers.get('X-OpenUI-Generation-Id'));
    assert.equal(await response.text(), 'generated HTML');
  });
  const calls = logs.filter(log => log.event === 'ai_usage_call'), summaries = logs.filter(log => log.event === 'ai_usage_summary');
  assert.equal(calls.length, 2); assert.equal(summaries.length, 1);
  const summary = summaries[0];
  assert.equal(summary.aiCalls, 2); assert.equal(summary.inputTokens, 200); assert.equal(summary.outputTokens, 80);
  assert.equal(summary.totalTokens, 280); assert.equal(summary.cachedInputTokens, 40); assert.equal(summary.reasoningTokens, 20);
  assert.equal(summary.designTarget, 'web'); assert.equal(summary.usageComplete, true);
  assert.ok(calls.every(call => call.generationId === summary.generationId));
  assert.equal(new Set(calls.map(call => call.callId)).size, 2);
  assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});

test('SDK automatic retries and explicit model fallback retain failed calls and mark unknown charges incomplete', async () => {
  let attempts = 0;
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      const failing = usage.withUsageLogging(model('first-model', { doGenerate: async () => {
        attempts++; throw new APICallError({ message: 'PRIVATE provider secret', url: 'https://provider.test', requestBodyValues: {}, statusCode: 503, isRetryable: true });
      } }), 'openrouter');
      await assert.rejects(generateText({ model: failing, prompt: 'PRIVATE', maxRetries: 1 }));
      const fallback = usage.withUsageLogging(model(), 'google');
      await generateText({ model: fallback, prompt: 'fallback', maxRetries: 0 });
      return Response.json({ ok: true });
    }); await response.text();
  });
  const summary = logs.find(log => log.event === 'ai_usage_summary');
  assert.equal(attempts, 2); assert.equal(summary.aiCalls, 3);
  assert.equal(summary.provider, 'mixed'); assert.equal(summary.inputTokens, null); assert.equal(summary.totalTokens, null);
  assert.equal(summary.knownInputTokens, 100); assert.equal(summary.knownTotalTokens, 140); assert.equal(summary.usageComplete, false);
  assert.equal(summary.cost.status, 'unavailable'); assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});

test('missing usage and interrupted/cancelled streams never produce invented zero tokens or duplicate summaries', async () => {
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      const candidate = usage.withUsageLogging(model('unknown', { doStream: async () => ({ stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'stream-start', warnings: [] }); }, cancel() {} }) }) }), 'nvidia');
      const result = await candidate.doStream({ prompt: [] });
      return new Response(result.stream.pipeThrough(new TransformStream({ transform(_part, controller) { controller.enqueue(new Uint8Array([1])); } })));
    });
    const reader = response.body.getReader(); await reader.read(); await reader.cancel();
  });
  const summaries = logs.filter(log => log.event === 'ai_usage_summary');
  assert.equal(summaries.length, 1); assert.equal(summaries[0].usageComplete, false);
  assert.equal(summaries[0].inputTokens, null); assert.equal(summaries[0].status, 'cancelled');
  assert.equal(logs.filter(log => log.event === 'ai_usage_call').length, 1);
});

test('unknown usage normalizes as null; totals and reasoning stay independent; rates require exact model and provider', () => {
  assert.deepEqual(usage.normalizeProviderUsage(null), { inputTokens: null, outputTokens: null, totalTokens: null, cachedInputTokens: null, cacheWriteTokens: null, reasoningTokens: null });
  assert.equal(usage.normalizeProviderUsage({ inputTokens: { total: 5 }, outputTokens: { total: 3, reasoning: 2 }, raw: { totalTokenCount: 9 } }).totalTokens, 9);
  const counts = usage.normalizeProviderUsage(tokens(100, 40)), now = Date.parse('2026-10-25T12:00:00Z');
  const cost = pricing.calculateTokenCost('google', 'gemini-2.5-flash', counts, false, now);
  assert.equal(cost.status, 'calculated'); assert.equal(cost.actualBilledUsd, null);
  assert.ok(Math.abs(cost.inputUsd - (80 * .30 + 20 * .03) / 1e6) < 1e-12);
  assert.equal(cost.outputUsd, 40 * 2.50 / 1e6);
  assert.equal(pricing.calculateTokenCost('google', 'gemini-3.5-flash-lite', counts, false, now).outputUsd, cost.outputUsd);
  const adapterDefaults = { inputTokens: { total: 0, cacheRead: 0 }, outputTokens: { total: 0, reasoning: 0 }, raw: {} };
  const absent = usage.normalizeProviderUsage(adapterDefaults, 'google');
  assert.equal(absent.inputTokens, null); assert.equal(absent.outputTokens, null); assert.equal(absent.totalTokens, null);
  assert.equal(absent.cachedInputTokens, null); assert.equal(absent.reasoningTokens, null);
  for (const [provider, id, extra] of [['openrouter', 'gemini-2.5-flash', false], ['google', 'gemini-3.5-flash', false], ['google', 'gemini-2.5-flash', true]]) assert.equal(pricing.calculateTokenCost(provider, id, counts, extra, now).status, 'unavailable');
  assert.equal(pricing.calculateTokenCost('google', 'gemini-2.5-flash', counts, false, Date.parse('2027-01-01')).status, 'unavailable');
});

test('parallel website/application generations have distinct IDs and never share token counters', async () => {
  const logs = await capture(async () => {
    await Promise.all(['web', 'app'].map(async (target, i) => {
      const response = await usage.withGenerationUsage(request(), async () => {
        usage.setGenerationDesignTarget(target);
        const candidate = usage.withUsageLogging(model('parallel-model', { doGenerate: async () => { await new Promise(resolve => setImmediate(resolve)); return { content: [], usage: tokens(100 + i, 40), warnings: [], finishReason: { unified: 'stop' } }; } }), 'ollama');
        await generateText({ model: candidate, prompt: 'x', maxRetries: 0 }); return Response.json({ ok: true });
      }); await response.text();
    }));
  });
  const summaries = logs.filter(log => log.event === 'ai_usage_summary');
  assert.equal(summaries.length, 2); assert.equal(new Set(summaries.map(log => log.generationId)).size, 2);
  assert.equal(summaries.find(log => log.designTarget === 'web').inputTokens, 100);
  assert.equal(summaries.find(log => log.designTarget === 'app').inputTokens, 101);
});

test('provider/model identity uses provider-returned model rather than requested alias; logs are emitted once on duplicate finish', async () => {
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      const candidate = usage.withUsageLogging(model('alias', { doStream: async () => ({ stream: new ReadableStream({ start(c) {
        c.enqueue({ type: 'response-metadata', modelId: 'actual-model-version' });
        c.enqueue({ type: 'finish', usage: tokens(), finishReason: { unified: 'stop' } });
        c.enqueue({ type: 'finish', usage: tokens(), finishReason: { unified: 'stop' } }); c.close();
      } }) }) }), 'openai');
      const twice = usage.withUsageLogging(candidate, 'openai'); assert.equal(twice, candidate);
      const run = await twice.doStream({ prompt: [] }); const reader = run.stream.getReader(); while (!(await reader.read()).done) {}
      return Response.json({ ok: true });
    }); await response.text();
  });
  const calls = logs.filter(log => log.event === 'ai_usage_call'); assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'actual-model-version'); assert.equal(calls[0].requestedModel, 'alias');
  assert.equal(logs.find(log => log.event === 'ai_usage_summary').totalTokens, 140);
});

test('actual redesign route logs one fixed TokenHarbor attempt and app target regardless of stale personal/project settings', async () => {
  let attempts = 0;
  const modules = loader({
    '@/lib/ai/tokenharbor': { tokenHarborConfiguration: () => ({ model: 'deepseek-v4.1-flash:free', key: 'synthetic' }), createTokenHarborModel: () => model('deepseek-v4.1-flash:free', { doStream: async () => { attempts++; return model('deepseek-v4.1-flash:free').doStream(); } }) },
    '@/lib/server/project-access': { withVerifiedIdentity: (_identity, work) => work(), requireOwnedProject: async id => ({ id }), ownedProjectWhere: async id => ({ id }), projectAccessResponse: () => undefined },
    '@/lib/db': { prisma: { project: { findUnique: async () => ({ settings: { provider: 'google', model: 'google/old-selection' }, inspirationImages: [], styleGuide: null, sketchesData: '{"designTarget":"app"}' }) } } },
    '@/lib/ai/personal-provider-auth': { personalProviderIdentity: async () => ({ sub: 'PRIVATE-uid', plan: 'lifetime' }), canUsePersonalProviders: () => true },
    '@/lib/ai/personal-provider-store': { personalProviderStore: { read: async () => ({ active: 'openai', providers: { openai: { key: 'PRIVATE-key', model: 'actual-personal-model', models: [] } } }) } },
    '@/lib/images/generation-pipeline': { withGeneratedImages: (_request, _uid, work) => work() },
    '@ai-sdk/openai': { createOpenAI: () => id => model(id, { doStream: async () => {
      attempts++;
      if (attempts === 1) throw new APICallError({ message: 'temporarily unavailable', url: 'https://provider.test', requestBodyValues: {}, statusCode: 503 });
      return model(id).doStream();
    } }) },
  });
  const logs = await capture(async () => {
    const route = modules('app/api/generate/redesign/route.ts');
    const req = new Request('http://localhost/api/generate/redesign', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'PRIVATE-project', generatedUIId: 'screen', streamId: 'stream', userMessage: 'PRIVATE-prompt' }) });
    const response = await route.POST(req); const text = await response.text();
    assert.equal(response.status, 200); assert.ok(text.includes('generated HTML'));
  });
  const summary = logs.find(log => log.event === 'ai_usage_summary');
  assert.ok(summary); assert.equal(summary.route, '/api/generate/redesign'); assert.equal(summary.designTarget, 'app');
  assert.equal(attempts, 1); assert.equal(summary.aiCalls, 1); assert.equal(summary.provider, 'tokenharbor');
  assert.equal(summary.model, 'deepseek-v4.1-flash:free'); assert.equal(summary.usageComplete, true);
  assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});

test('all supported provider labels, partial usage, error chunks and response read failures are reported without dropping metadata', async () => {
  for (const provider of ['google', 'openai', 'anthropic', 'openrouter', 'nvidia', 'ollama', 'xai']) {
    const logs = await capture(async () => {
      const response = await usage.withGenerationUsage(request(), async () => {
        const candidate = usage.withUsageLogging(model('version', { doGenerate: async () => ({ content: [], usage: { inputTokens: { total: 8 }, outputTokens: { total: undefined } }, finishReason: { unified: 'stop' }, warnings: [] }) }), provider);
        await candidate.doGenerate({ prompt: [] }); return Response.json({ ok: true });
      }); await response.text();
    });
    const call = logs.find(log => log.event === 'ai_usage_call'); assert.equal(call.provider, provider);
    assert.equal(call.inputTokens, 8); assert.equal(call.outputTokens, null); assert.equal(call.totalTokens, null); assert.equal(call.usageComplete, false);
  }
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      const candidate = usage.withUsageLogging(model('stream-error', { doStream: async () => ({ stream: new ReadableStream({ start(c) { c.enqueue({ type: 'error', error: { statusCode: 429, message: 'PRIVATE' } }); c.close(); } }) }) }), 'google');
      const result = await candidate.doStream({ prompt: [] }); const reader = result.stream.getReader();
      const first = await reader.read(); assert.equal(first.value.error.statusCode, 429); await reader.read();
      return new Response(new ReadableStream({ start(c) { c.error(new Error('PRIVATE')); } }));
    }); await assert.rejects(response.text());
  });
  assert.equal(logs.filter(log => log.event === 'ai_usage_summary').length, 1);
  assert.equal(logs.find(log => log.event === 'ai_usage_call').statusCode, 429);
  assert.equal(logs.find(log => log.event === 'ai_usage_summary').status, 'failed');
  assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});

test('OpenRouter provider-reported charge is retained without substituting a guessed gateway price', async () => {
  const logs = await capture(async () => {
    const response = await usage.withGenerationUsage(request(), async () => {
      const candidate = usage.withUsageLogging(model('vendor/actual-version', { doGenerate: async () => ({ content: [], warnings: [], finishReason: { unified: 'stop' }, usage: tokens(), providerMetadata: { openrouter: { usage: { cost: .0123, privateField: 'PRIVATE' } } } }) }), 'openrouter');
      await generateText({ model: candidate, prompt: 'x', maxRetries: 0 }); return Response.json({ ok: true });
    }); await response.text();
  });
  const call = logs.find(log => log.event === 'ai_usage_call'), summary = logs.find(log => log.event === 'ai_usage_summary');
  assert.equal(call.cost.status, 'provider_reported'); assert.equal(call.cost.totalUsd, .0123);
  assert.equal(call.cost.inputUsd, null); assert.equal(summary.cost.actualBilledUsd, .0123);
  assert.equal(summary.cost.status, 'provider_reported'); assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});
