# Image instruction message-order fix

## Root cause and traced flow

`withPersonalProvider` authenticates the request and retains the personal-provider AsyncLocalStorage context. `withGeneratedImages` adds the image-generation context. Generation routes call the model registry through `resolveModelForProject`/fallback helpers and pass their existing `system` option plus user messages to AI SDK `streamText`. The SDK normalizes those into a leading system block and conversation messages. `getLanguageModel` wraps the selected provider using `withImageContract`.

The bug was in `lib/images/generation-context.ts`, `imageContractMiddleware().transformParams`: it constructed `[...params.prompt, { role: 'system', content: imageInstructions }]`. This put trusted image instructions after the last user/assistant message. The installed Google serializer throws the exact reported error for that sequence, before making a network request. Other providers have different system-instruction wire formats; leaving the message at the end was not portable.

The middleware now inserts the image system message immediately after any existing leading system messages and before all conversation turns. Existing system messages, provider options and conversation message objects are preserved. User, assistant and tool content is not promoted to instruction roles or reordered. No history truncation, error suppression or image-instruction removal was added.

Example:

Before: `system(base), user(first), assistant(reply), user(next), system(images)`

After: `system(base), system(images), user(first), assistant(reply), user(next)`

## Provider handling

The fix uses AI SDK's normalized system role and leaves native serialization to the existing installed adapters:

- Google: leading instructions become the separate `systemInstruction` field; user/model turns remain in `contents`.
- Anthropic: leading instructions become the top-level `system` field; conversational turns remain in `messages`.
- OpenAI Responses: the adapter selects `system`/`developer` according to model capabilities (the regression uses a reasoning model).
- xAI, NVIDIA and Ollama: existing OpenAI-compatible chat adapter retains leading instruction roles and chronological messages.
- OpenRouter: existing provider adapter retains the leading instruction block and conversation order.

No provider adapters, key selection logic, route payloads or stream parsing were changed. Image-slot instructions and uploaded-asset context remain present; final image hydration and SSE replacement/warning packets are unchanged.

Documentation checked alongside the installed source: [AI SDK message prompts](https://ai-sdk.dev/docs/foundations/prompts), [AI SDK model messages](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message), [Gemini system instructions](https://ai.google.dev/gemini-api/docs/text-generation/), [Anthropic adapter documentation](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).

## Files changed

- `lib/images/generation-context.ts`: correct the middleware insertion point; explain normalized/native format boundary.
- `tests/image-message-order.test.cjs`: new regression tests for empty/new/history prompts, zero/one/multiple leading system messages, metadata preservation, all seven actual provider serializers, all four personal-key provider overrides, and reproduction of the original Google error.
- `tests/pixabay-images.test.cjs`: replace the old test assertion that incorrectly expected image instructions after the user message.
- `reports/message-order-tests.txt`, `reports/message-order-build.txt`: validation logs.

## Validation

- Full suite: **121 passed, zero failed** (including nine new message-order tests).
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Provider tests use the actual registry, middleware and installed serializers with injected fake fetch. They inspect final JSON requests and stop before network I/O; no real API credentials, billable generation or live provider success is claimed.
- Existing image hydration, persistence/export, SSE replacement/error propagation and personal-provider tests also pass.
