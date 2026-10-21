# Pixabay image integration

Implemented 21 October 2026 in the existing generation, canvas, project persistence and export flows. No dependency or Prisma schema changes.

## Configuration and deployment

- Server-only `.env.local`: `PIXABAY_API_KEY=your_actual_key`. This workspace already has a configured value; it was not changed or printed. `.env.example` contains a blank placeholder only.
- Keep `.env.local` and `.openui/` out of Git. Persist `.openui/image-assets` and `.openui/pixabay-cache` on a private writable volume across deployments. Ephemeral/serverless filesystem deployments need an equivalent durable object store before deployment; this implementation targets the existing single-server application.
- API routes reuse verified Firebase session authentication. Image bytes are scoped to the importing user's UID. Existing project authorization architecture was preserved.

## Operation

The existing language-model middleware requests semantic image slots (`data-image-query`, role and descriptive alt text). After generation, the existing SSE stream receives a final replacement containing saved image references. Distinct sections use distinct queries and results. Selection ranks topic tags, aspect ratio, dimensions and quality metadata. A broader query is tried when no suitable result exists. Eight searches/downloaded images per generation and a processing deadline bound provider calls. Product UI screenshots are not substituted with arbitrary photography; the model is instructed to render actual interface HTML/SVG.

`GET /api/images/search` validates query, orientation, type, category, dimensions and page; responses are cached on disk for 24 hours with concurrent-request deduplication. Public responses contain temporary previews and source links, never the API key or download URL. `POST /api/images/assets` accepts a cached result selection or raster upload and saves validated bytes. `GET /api/images/assets/[id]` serves authenticated, user-scoped assets. Redirect destinations are checked, downloads/uploads are capped at 10 MB, and raster signatures/dimensions are checked. Missing configuration, malformed upstream data, network failure and rate limiting produce safe errors and designed SVG fallbacks.

The existing element inspector now supports search, selection and upload for images and marked image backgrounds. Changes use the existing edit/undo/autosave flow. Saved HTML contains local asset IDs; asset files survive reopening without relying on Pixabay URLs. Existing HTML, ZIP, copied/converted-code exports embed asset bytes as data URIs. Raster export waits for eager image decoding, including below-the-fold images.

Pixabay search results link to Pixabay, authors and license information. Downloaded assets retain source page/author metadata. Images are incorporated in generated designs rather than exported as a standalone stock library. Official requirements checked: [API documentation](https://pixabay.com/api/docs/), [content license](https://pixabay.com/service/license-summary/), [terms](https://pixabay.com/service/terms/). Search response caching is 24 hours; permanent CDN hotlinking is avoided by storing selected bytes. Users remain responsible for context-specific trademark, likeness and other third-party rights.

## Files changed for this integration

- New server/image modules: `lib/images/{pixabay,asset-store,api-auth,image-contract,hydrate-html,generation-context,generation-pipeline,portable-assets,image-replacement}.ts`.
- New API routes: `app/api/images/search/route.ts`, `app/api/images/assets/route.ts`, `app/api/images/assets/[id]/route.ts`.
- New inspector control: `components/canvas/element-inspector/image-picker.tsx`; integration in inspector `panel.tsx` and `context.tsx`.
- Generation integration: `lib/ai/provider-registry.ts`, `lib/ai/with-personal-provider.ts`, `lib/stream-utils.ts`.
- Persistence/editing/export integration: `lib/element-editing.ts`, `lib/db/projects.ts`, `lib/frame-snapshot.ts`, `lib/zip-export.ts`, `lib/screen-image-export.ts`, `components/navbar/index.tsx`, `components/canvas/shapes/generatedui/index.tsx`, `components/canvas/shapes/generatedui/code-preview-dialog.tsx`.
- Configuration: `.env.example`.
- Tests/evidence: `tests/pixabay-images.test.cjs`, `tests/manual-pixabay-check.cjs`, `reports/pixabay-final-tests.txt`, `reports/pixabay-build.txt`, `reports/PIXABAY-FIRST-LIVE-RESULTS.json`, `reports/PIXABAY-LIVE-RESULTS.json`.

Other working-tree changes predate this task and were preserved.

## Verification and limits

- Full existing/new suite: **112 tests passed, zero failed**. Includes 11 image-specific tests: cache/encoding/key redaction, error responses, downloads/upload validation, UID isolation/redirect rejection, cooldown, five-category hydration, fallback/relevance/uniqueness, SSE replacement, actual autosave/reopen handlers with a mocked database, portable exports, authenticated API handlers, inspector patch persistence and model-contract integration.
- `npx tsc --noEmit`: passed. Production build result is recorded in `pixabay-build.txt`.
- Automated category fixtures: travel, food, ecommerce, real estate and fitness; preserve responsive CSS, image crop, alt and eager/lazy attributes. SaaS fake-screenshot avoidance and existing uploaded portfolio assets are also checked.
- Real API searches returned results for all five categories. One real food image (1280 x 932 JPEG, 324,890 bytes) was downloaded, stored and reopened. Other real downloads returned upstream HTTP 429. A later bounded check confirmed searches still succeeded but downloads remained rate limited. These failed downloads are **not** counted as successful end-to-end tests. Cooldown prevents repeated download attempts, with errors/fallbacks instead of invented URLs.
- No browser surface was available for authenticated visual interaction. Desktop/mobile visual layout, interactive picker clicks and actual browser PNG/JPG/SVG capture were not end-to-end verified. Automated checks cover preserved responsive markup, handler behavior and embedded export bytes.
- Relevance is metadata-based, not visual recognition. Product/people images do not prove product identity or endorsement. Existing arbitrary grey decorative divs without image semantics are not guessed into stock images. The new generation contract provides explicit image semantics for future output.
- Existing external non-placeholder assets remain unchanged. Only persisted OpenUI/upload image paths are embedded by the portable exporter. Existing remote fonts/styles/scripts still follow the application's current export behavior.

## Browser acceptance steps

1. Sign in and generate travel, food, shop, real-estate and fitness pages. Confirm distinct topic-appropriate images, or an explicit fallback/warning when Pixabay is rate limited.
2. Select an image in the canvas, open Properties, search for alternatives and choose a result. Check author/source links. Upload a PNG/JPEG/WebP/GIF and verify replacement and undo.
3. Save, return to the workspace and reopen. Images should persist; changing the API key must not affect already saved images.
4. Check desktop and mobile previews for crop/aspect ratio/rounded corners. Download HTML/ZIP, open the exported page away from the app and inspect image rendering. Exercise image exports in the browser.
5. Test a no-results query and invalid upload; confirm readable errors. Do not repeatedly retry live downloads during a provider cooldown.
