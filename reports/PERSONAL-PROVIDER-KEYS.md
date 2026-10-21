# Personal AI provider keys

Implemented controls: enter/reveal a new key, encrypted Save, Remove, Test Connection, real model discovery, model selection and Use for generation. OpenAI, Anthropic, Google Gemini and xAI use their official APIs. No dependencies or Prisma changes were needed.

## Storage and authorization

- `/api/ai-provider-keys`: GET public metadata; PUT `{ provider, apiKey?, model?, active? }`; POST `{ provider }` tests a saved key and loads models; DELETE `{ provider }` removes it.
- All operations verify the Firebase session. Production requires the signed `plan: "lifetime"` claim. Writes require same Origin.
- Keys are encrypted per Firebase UID in `.openui/provider-keys/` using AES-256-GCM, random nonces and UID-associated authentication data. File names are SHA-256 hashes of the UID. Files and encryption configuration are ignored by Git.
- GET never returns a saved key. Reveal applies to newly entered text only. A saved key is represented by its last four characters.
- `OPENUI_PROVIDER_KEYS_SECRET`: a 32-byte base64 server secret. A random value was generated in the existing ignored `.env.local`; `.env.example` contains only an empty placeholder. Keep the same secret to decrypt existing files; do not replace it without re-entering keys.
- `OPENUI_LOCAL_BYOK_TESTING=true` is enabled in this local `.env.local` as authorized. It works only in `next dev`, only on localhost/loopback, and only for authenticated users. Production never accepts this override. It is separate from the UI preview flag.

## Generation

Generation endpoints run inside request-local AsyncLocalStorage. The active personal provider/model/key override server defaults without mutating process environment or sharing another user's key. Existing generate, redesign, workflow, theme, retheme, style, conversion and project-chat paths retain their behavior. SDK retry/fallback calls remain within the same personal-provider context. The existing canvas model picker lists the user's discovered models and updates their selection.

Saving a new key resets its verified state and model list. Test Connection lists compatible models at the official provider endpoint, selects an available model and activates the first configured provider. Use for generation changes the active provider. A connection test checks key/model-list access; provider generation quotas and billing can still reject a subsequent generation request. Removing the active key clears the personal override and restores existing project/server selection.

## Files

New: `app/api/ai-provider-keys/route.ts`, `lib/ai/personal-provider-{types,store,auth,context,discovery}.ts`, `lib/ai/with-personal-provider.ts`, `tests/personal-provider-keys.test.cjs`.

Updated: provider cards and settings, provider registry, all generation route handlers, `/api/models` and `/api/models/select`, environment example/local configuration, and legal copy covering provider-key storage.

## Manual test

1. Run `npm run dev`, sign in, open Settings > AI Preferences and refresh if the old preview is cached.
2. Enter a real provider API key. Reveal/Hide affects the typed key. Save Key clears the typed secret and displays its suffix.
3. Click Test Connection. Provider-authorized models should populate the dropdown and a verification status should appear. An invalid key must show an error.
4. Select a model, then Use for generation. Open a project and generate/chat; requests use this user's selected provider/key.
5. Reopen Settings: configured status and model should persist. Remove the key; it should disappear and be unavailable for future personal-provider requests. Revoke the credential at the provider if needed.
6. Try a second account: it must not see the first user's keys. In production, a non-Lifetime account must receive HTTP 403 from the key endpoint.

Validation: TypeScript, production build and 95 automated tests passed. New tests exercise encryption/tampering, user isolation, endpoint CSRF/entitlement, official URL/header discovery, model activation/removal, UI handlers and concurrent streamed request isolation. Tests use synthetic keys and mocked provider calls. No real provider key, paid generation or real external connection test was performed automatically.

For deployment use a persistent, protected server volume for `.openui/provider-keys/` and retain the encryption secret. This local filesystem store is designed for the existing single-server installation; a multi-instance/serverless deployment needs shared credential storage and locking.

Official APIs: [OpenAI models](https://developers.openai.com/api/reference/resources/models/methods/list), [Anthropic models](https://platform.claude.com/docs/en/api/models/list), [Gemini models](https://ai.google.dev/api/models), [xAI models](https://docs.x.ai/developers/rest-api-reference/inference/models).
