# Canvas AI Mockup Generator check

Found: the configured global fallback was an OpenRouter model, while this installation has no OpenRouter key and does have a Gemini key. A project with no saved model settings therefore attempted an unconfigured provider. This was reproduced with the actual generation route under mocked SDK calls.

Changed:
- `lib/ai/provider-registry.ts`: skip unconfigured fallback providers; select an already configured provider using the existing fallback model mappings. Missing credentials give a readable error. Direct local Ollama use remains supported. Active personal provider keys still take priority.
- `/api/models/select`: return the effective server fallback for projects without saved settings, keeping the navbar model display consistent with generation.
- `generator-dialog.tsx`: wait for submit, show loading, block duplicate submissions, keep input and show errors on failure. A blank prompt requires an included drawing or selected reference, not merely the presence of an unchecked drawing.
- `hooks/use-canvas.ts`: guard duplicate requests and missing project IDs; propagate failures to the dialog while preserving the source frame and its sketches.

Validation: TypeScript and production build passed. 101 automated tests passed, including idea/content/style/device/variant payloads, async success/failure/retry, input validation, the missing-key fallback, actual SSE route output, and the actual frame-generation handler's success/failure state changes. The provider was mocked for these tests; no paid request or live model output was claimed. A live authenticated browser/provider check remains outstanding because no browser is connected to this session.
