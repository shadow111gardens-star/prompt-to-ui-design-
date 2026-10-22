# ProjectSettings / model discovery audit

2026-10-22. Read-only inspection. Only this report created; no data import/export, writes, schema changes, migration, environment mutation, push or deployment. No real provider requests made. No key/connection/session values printed.

## Findings

ProjectSettings is a per-project provider/model preference, NOT an API-key store or model catalog. The model dropdown's catalog is fetched independently. Exporting/importing four legacy preferences is unnecessary to populate models, configure Gemini, or support newly created projects. Leave those records alone as requested.

The exact live Vercel cause of the reported empty dropdown cannot be determined without its authenticated `/api/models` HTTP response and provider-discovery logs. Confirmed code defects collapse several distinct failures into the same empty message; do not assert a missing production key just because settings rows are absent.

## Model and storage lifecycle

`prisma/schema.prisma` defines ProjectSettings with id (cuid), projectId (unique), nullable provider, nullable model. Its required parent Project relation cascades deletion. Project.settings is optional. No API key, Gemini configuration blob, quota or model-list rows exist in this model.

- `lib/db/settings.ts`: getProjectSettings checks parent ownership then findUnique by projectId and parent owner predicate. updateProjectSettings checks ownership and upserts provider/model. Create happens lazily on first model selection; subsequent selections update the same row.
- `app/api/models/select/route.ts`: GET loads saved provider/model, or an active personal-provider selection, or getFallbackSelection. It does not create a missing preference. POST resolves provider prefix if needed, optionally changes active personal model, then upserts the project preference. Its final provider default is openrouter if provider omitted. That default alone does not configure an OpenRouter credential.
- `app/api/projects/route.ts` → `lib/db/projects.ts:createProject`: creates Project only, using verified Firebase UID; does not create ProjectSettings. An owned project with no settings is valid. getProject includes settings for reads. deleteProject deletes parent; database FK cascades to settings. No dedicated ProjectSettings DELETE API or other application upsert writer was found.
- `app/api/debug-settings/route.ts`: authenticated owner-filtered settings listing. Does not configure models.
- `lib/server/project-access.ts`, `lib/ai/with-personal-provider.ts`: verified identity and project ownership guard model-selection operations. Never use raw database IDs as authorization.
- `scripts/sqlite-neon-import-core.cjs`, `scripts/neon-phase2.cjs`: historical one-time import/verification tooling also handles ProjectSettings. Not normal runtime and NOT used in this audit. Do not invoke to fix model discovery.
- Original SQLite and initial PostgreSQL migration files define the table/unique constraint/cascading FK. No seed creates one row per user/project automatically.

## UI, generation and credential sources

`components/canvas/model-selector.tsx` loads `/api/models` first, sets its catalog, then GETs `/api/models/select?projectId=...` for current selection. Selecting a model POSTs `{projectId,provider,model}`. Search filters catalog name/id locally. A saved preference can label a selection; it cannot create catalog entries.

`app/api/models/route.ts` is authenticated through withPersonalProvider. Standard flow calls `lib/ai/model-listing.ts:getEnabledProviders/fetchAllModels`. Enabled providers depend on server environment. Catalogs come from provider APIs, except the Anthropic list is hardcoded. Results are in-memory cached for five minutes keyed by provider names; this includes empty results. The endpoint never queries ProjectSettings.

Gemini server credentials: `GEMINI_API_KEY` OR `GOOGLE_GENERATIVE_AI_API_KEY` (these exact names; Firebase's web API key is not a substitute). Google discovery calls v1beta/models, paginates, requires generateContent, accepts gemini/gemma family IDs and excludes certain media/specialized IDs. The server adapter `lib/ai/provider-registry.ts:getLanguageModel` uses a current personal key first, otherwise those environment variables. Nothing reads a Gemini credential from Neon ProjectSettings.

`getFallbackSelection` first uses an active personal provider, then NEXT_PUBLIC_OPENUI_FALLBACK_MODEL only when corresponding server credentials exist, then a configured-provider priority and code-defined fallback IDs. GOOGLE_REDESIGN_FALLBACK_MODEL can override the Google fallback ID. These model-ID defaults are not proof of provider availability. The selector also retains an older client fallback label `openrouter/anthropic/claude-opus-4` if selection JSON lacks a model; it does not add models to the dropdown.

Personal-key flow (Lifetime entitlement or explicit development-only override):

- `lib/ai/personal-provider-auth.ts`, `lib/ai/with-personal-provider.ts`, `lib/ai/personal-provider-context.ts` select verified-user configuration.
- `lib/ai/personal-provider-store.ts`: encrypted per-UID files under `.openui/provider-keys`, using OPENUI_PROVIDER_KEYS_SECRET. These files store key, tested model list, chosen model and active provider, not Neon ProjectSettings.
- `app/api/ai-provider-keys/route.ts`, `lib/ai/personal-provider-discovery.ts`, `lib/ai/personal-provider-types.ts`: saving/testing discovers compatible models and activates a provider. `/api/models` uses saved tested models when personal.active exists. A filesystem/encryption failure can make `/api/models` fail before catalog discovery. Vercel ephemeral file persistence is a separate known limitation.
- Personal selection GET can override the project preference; generation adapter applies the active personal key/model through its context.

Generation reads settings via `lib/ai/route-utils.ts`, `lib/ai/project-chat-response.ts`, `lib/ai/moodboard-model.ts` and `app/api/generate/route.ts`, `convert/route.ts`, `redesign/route.ts`, `retheme/route.ts`, `style/route.ts`, `theme/route.ts`, `workflow/route.ts`, `workflow-redesign/route.ts`. Saved provider/model is used when present, otherwise fallback; vision flows add their own compatibility handling. No settings row is required to list available models.

## Fresh ID-only database comparison

At 2026-10-22T11:14:49.976Z both connections were independently pinned/verified; all SQL used read-only RepeatableRead transactions. Selected only Project.id and ProjectSettings.id/projectId, no provider/model/content/key/owner values. No rows copied between branches or exported.

- Production branch br-calm-morning-b4md3ubx, compute ep-tiny-thunder-b4xpxxw4, database neondb: **6 Projects, 0 ProjectSettings**.
- Staging branch br-square-mud-b4xx4iwp, compute ep-calm-mouse-b4nvpc6s, database neondb: **5 Projects, 4 ProjectSettings**.

| Staging settings ID | Parent project ID | Parent exists in production |
|---|---|---|
| cmvh5cfzv00035guy5x3vy208 | cmvh5b97y00025guyv7jefm3t | Yes |
| cmvh5zkd500055guyw1klulia | cmvh5hwfh00045guyq5ik93eq | Yes |
| cmvht2vb60001m0uy2jhcy17a | cmvht27jd0000m0uylzzqxrem | Yes |
| cmvj2mf2k0001y4uy3em3hlw9 | cmvhtlb0o0003m0uyylqeghtg | Yes |

Staging's fifth project cmvj315os0002y4uylrjws5dc has no settings row. Production additionally contains cmvjekn49000008jt81nxkzis. Existence of matching parent IDs does NOT authorize settings transfer or imply owner identity.

Why four: historical SQLite/Phase 2 inventories already contained four preferences for five legacy projects. Lazy settings creation is consistent with only four having saved selections. Staging retains those historical rows. Exact user actions and branch creation/copy mechanism cannot be proven from current rows; do not claim schema-only cloning created them. Earlier production reports recorded four preferences; today's zero is a change, but this read-only audit cannot identify who/what/when removed them. No automatic repair is appropriate.

Local-only credential presence checked without printing values: .env.local GEMINI_API_KEY nonempty; GOOGLE_GENERATIVE_AI_API_KEY absent/empty. .env.staging.local defines neither. Normal Next loading may still supply non-database values from .env.local; staging file absence alone is not proof of runtime absence. These local facts say NOTHING about Vercel Production variables, which were not accessible in this audit.

## Empty model-list diagnosis and controlled evidence

Inspected and executed the actual model-listing module in an isolated VM with synthetic environment and mocked fetch, no network/database or changes to process.env:

| Scenario | Enabled providers | Catalog count | Warning |
|---|---|---:|---|
| No credentials | none | 0 | No |
| Google HTTP 403 | google | 0 | Yes |
| Google network failure | google | 0 | Yes |
| Compatible Google generateContent response | google | 1 | No |
| Google response containing only excluded image model | google | 0 | No |

This confirms the failure-masking logic: fetchAllModels catches per-provider errors, logs a warning and returns an empty provider array; `/api/models` can report HTTP 200 with models=[] even on provider failure, cached for five minutes. The selector uses the same “No models found!” for a failed fetch (catalog stays empty), empty configured providers, provider-discovery failure, empty personal catalog, all filtered-out results or an unmatched search. Non-OK selection GET is silently ignored; that can leave selection blank, but missing settings cannot empty an independently successful catalog.

Additional logic gap: server registry supports XAI_API_KEY/xai, but getEnabledProviders/fetchAllModels has no environment-backed xai discovery branch; xAI-only server configuration yields no standard catalog. Personal xAI discovery is implemented. This does not establish that xAI is the user's current configuration.

## Smallest next action / fix recommendation

1. Do NOT export/import the four settings. New projects can use configured fallback; selecting an available model creates their own preference automatically.
2. In the affected signed-in Production canvas, clear search, open Chrome Network, reload and inspect `/api/models` status plus ONLY enabledProviders/model count/error text. For personal accounts inspect whether a provider was saved AND tested. Keep cookies/keys/raw private responses out of reports. Also check `/api/models/select?projectId=<own-new-project>` separately.
3. For standard Google mode, privately verify GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is configured in the actual Vercel Production runtime. If absent/rejected, correcting that configuration requires separate approval; no such change was made. With google enabled and empty models, inspect existing Google discovery warning/status (403/429/network/etc.). No unrelated database data movement fixes credentials.
4. Smallest code improvement, after confirming the request failure: preserve typed provider-discovery errors in `/api/models` response and distinguish missing configuration, load error, empty compatible catalog and search-no-match in ModelSelector; do not cache transient all-provider failures as success, and provide retry. Keep partial provider success. Add xAI environment discovery only if needed. No source change requested/performed in this audit.
5. If `/api/models` returns compatible models but UI stays empty with cleared search, capture that response shape and reproduce selector filtering/rendering before editing. No live production request/browser session was available here, so the precise live incident cause remains unconfirmed beyond the proven catalog/error-handling paths.

Changed files: only this audit. No full suite/build run for a documentation-only change; synthetic discovery probes above are executed evidence, not real Gemini API tests. Existing records remain unchanged by this task.
