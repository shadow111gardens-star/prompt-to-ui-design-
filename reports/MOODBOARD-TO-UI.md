# Moodboard-to-UI generation

## Implementation

Style Guide → Moodboard now has **Generate UI from Moodboard**, separate from the existing Style Guide generation button. Its themed dialog accepts an optional description and desktop/tablet/mobile viewport. It waits for completed uploads and sends persisted storage IDs, never blob URLs.

The existing `/api/generate` multipart/SSE route accepts `generationMode=moodboard` and `moodboardImageIds` (one to five IDs). It loads those rows from the requested project's Moodboard relation, validates file paths/formats/size, reads actual bytes from persisted storage, and attaches AI SDK image parts with explicit media types. Missing images fail instead of falling back to text-only generation. Keys remain inside the existing server provider and personal-key architecture.

The prompt requests a new design based on visual hierarchy, layout, palette, typography, spacing, borders, imagery and component style. It explicitly prohibits reproducing a reference screenshot as the output. Moodboard screenshots are excluded from the generated-image asset inventory in this mode; the existing Pixabay image contract/hydration remains active for actual image slots. Normal generation is unchanged.

The client consumes the existing SSE stream, rejects empty/screenshot-only output, adds stable element IDs, and dispatches the existing `addGeneratedUI` action. This creates a normal `generatedui` screen, with existing history, renderer, Properties inspector and export paths. No new canvas schema is introduced. It positions/selects the new screen, saves through the existing autosave endpoint, then opens the current project's canvas. Failure to save retains the screen and offers **Retry saving design**, without another AI request. Provider/stream failures do not add a partial screen. Project-switch/cancellation guards prevent adding a response to a different project.

## Exact files changed for this feature

- `components/style/moodboard/index.tsx`: action placement beside the existing Style Guide action.
- `components/style/moodboard/generate-ui.tsx`: optional prompt/device dialog, progress/errors/cancel, save retry and canvas navigation.
- `app/api/generate/route.ts`: Moodboard request mode, persisted image loading, strict image-capable model selection, reference-specific instructions; preserves existing mode.
- `lib/ai/moodboard-model.ts`: effective selection including personal-provider overrides, capability checks and explicit unsupported-model errors; no silent substitution.
- `lib/moodboard-references.ts`: project-scoped saved IDs, path containment, MIME/size checks, server-side image bytes.
- `lib/moodboard-to-ui.ts`: SSE consumption, output validation, standard canvas insertion/history, save/reopen-compatible persistence.
- `lib/images/generation-pipeline.ts`: keep Moodboard references out of the image-asset inventory only for this new mode.
- `tests/moodboard-generation.test.cjs`: 15 regression tests.
- This report and `reports/moodboard-generation-{tests,focused,build}.txt` command logs.

No dependency, paid provider, new environment variable, API endpoint, database schema or separate rendering/export implementation was added. Existing unrelated working-tree changes were left intact; no commit was made.

## Provider support and current configuration

Environment inspection found Google, OpenAI and Ollama configuration (values were not logged). Read-only project settings contain Google Gemini 2.5 Flash, 3.1 Flash Lite and 3.5 Flash Lite selections. These names pass this feature's Gemini vision-family gate. A user's active personal provider/model takes precedence, as in existing generation.

| Existing provider | This feature's admission rule |
| --- | --- |
| Google | Recognized Gemini 1.5/2.x/3.x families; excludes audio/image-generation/embedding variants. |
| OpenAI | Recognized GPT-4o, GPT-4.1 and GPT-5 families; excludes audio/realtime/image-generation variants. |
| Ollama | The configured server's `/api/show` must explicitly advertise both `vision` and `completion` for the selected installed model. The actual local metadata service was unreachable during verification, so local live vision support is **unverified**. |
| OpenRouter | Selected model's catalog metadata must declare image input and text output. Discovery failure is an explicit error. |
| Anthropic | Recognized Claude 3 and Claude 4 naming families; unknown families are rejected conservatively. |
| xAI | Recognized Grok 4 or Grok 2 Vision families, with JPEG/PNG input. Text-only Grok 3 is rejected. |
| NVIDIA | Explicit Llama 3.2 11B/90B Vision Instruct IDs. Other IDs are rejected conservatively. |

These rules establish supported routing rather than guarantee account access or a successful live inference. Real installed SDK adapters for all seven providers were tested to serialize the image bytes into their native requests, with a synthetic transport that stops before network access. No paid inference request was made. Retired models, invalid credentials, provider quotas, size/dimension limits or backend restrictions still produce errors. Unknown models may support images but are intentionally not guessed or substituted.

Official sources consulted: [Google image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [OpenAI images and vision](https://developers.openai.com/api/docs/guides/images-vision), [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision), [Ollama vision documentation](https://github.com/ollama/ollama/blob/main/docs/capabilities/vision.mdx), [OpenRouter multimodal API documentation](https://openrouter.ai/blog/tutorials/image-generation-models/), [xAI image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding), [NVIDIA Llama 3.2 Vision](https://docs.api.nvidia.com/nim/reference/meta-llama-3_2-11b-vision-instruct).

## Verification

- Focused suite: **15/15 passed**.
- Full `npm test`: **163 passed, zero failed/skipped**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including production compilation, TypeScript and all 46 static pages.
- `git diff --check`: passed.

Regression coverage: actual persisted bytes/explicit MIME forwarding, invalid/missing/foreign IDs and unsafe paths, unsupported formats, all seven provider serializers, active personal overrides, capability-discovery failures, normal-mode preservation, reference-vs-asset separation, invalid output, HTTP/SSE provider failures, cancellation, project switching, actual Redux insertion/undo/redo, existing autosave/getProject reopen with a mocked database, portable HTML, and save retry without regeneration. The tests do not write to the real project database or perform paid generation.

## Browser testing still required

No browser is connected, so real AI visual interpretation, browser controls, inspector interaction, navigation and actual PNG/JPG/SVG output from this feature are not visually verified. Existing export tests still pass; new screen output uses the same exporter.

1. Run the app and sign in. Open the existing project → Style Guide → Moodboard. Upload one or more PNG/JPEG references and wait for upload completion.
2. Click **Generate UI from Moodboard**. Enter “Create a modern SaaS analytics dashboard inspired by these references.” Select a viewport and generate. This uses the existing configured model and can consume its normal inference quota.
3. Verify the progress states, then confirm the app opens Canvas with a **new** selected screen and leaves all old screens unchanged. The result should consist of editable elements, not a reference screenshot collage.
4. Select a heading/card/input and edit it in Properties, including COLOR. Check undo/redo, save, reload/reopen and export HTML/PNG/JPG/SVG/ZIP through existing actions. Compare the chosen device dimensions and visual styling.
5. Try a text-only/unknown model: expect an explicit error with no added screen or silent fallback. Test cancellation and a provider failure similarly.
6. To test persistence failure, block `/api/autosave` in Chrome before generating. A completed screen should stay in state with a save error and **Retry saving design**. Unblock and retry; it should save without another generation request.

Current intentional limits: up to five references; at most 10 MB per file and 20 MB combined; PNG/JPEG, plus WebP except with Grok. Convert GIF/SVG references before this workflow. There is no automatic paid-provider or model fallback, and no image-generation API requirement.
