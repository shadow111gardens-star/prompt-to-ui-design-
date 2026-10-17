# Prompt-to-UI test report

Tested on 16 October 2026. Provider: Google. Model: google/gemini-3.1-flash-lite.

## Actual provider token usage

| Attempt | Input | Output | Total | Time |
|---|---:|---:|---:|---:|
| Initial generation | 1,440 | 1,719 | 3,159 | 5.237 seconds |
| Corrected prompt | 1,504 | 2,243 | 3,747 | 11.542 seconds |
| All testing | 2,944 | 3,962 | 6,906 | 16.779 seconds generation time |

Two generation endpoint submissions, with SDK retries disabled. Both returned HTTP 200 and finish reason stop. Usage is reported by the provider, not estimated from characters. These figures exclude this assistant conversation and any model-list requests. No model pricing or money estimate was requested or verified.

## Exact final test prompt

Design a polished responsive SaaS analytics dashboard named Pulse. Include a sidebar (Overview, Analytics, Customers, Settings), a header with date range and Export button, four KPI cards (Revenue, Active users, Conversion, Churn), a seven-day revenue chart, and a recent-orders table with five rows and status badges. Use realistic sample data, clear hierarchy, accessible contrast and labels. On mobile collapse the sidebar and stack cards. Follow the project design tokens. Use an inline SVG or CSS bar chart with exactly seven labeled daily values, not a placeholder. Give major components unique descriptive IDs. Make the header wrap on narrow screens. Use only the provided token colors including status badges. Return only the generated UI HTML.

## Results and limits

Both responses contained the brand, four metrics, a table and responsive classes. The first response failed the chart requirement by returning a placeholder. The second returned seven CSS bars, five order rows, component IDs and a wrapping header. Its chart-height layout, mobile navigation, date-range label and status colors still needed local corrections. The initial automated realChart check only recognized SVG or accessible charts, so it reported false for the CSS bars; manual source review found the seven bars and the sizing defect.

The raw model result is not perfect. Local corrections are saved separately in generation-polished.html and the self-contained preview.html. They add a sized and labeled chart, collapse control for mobile navigation, an accessible select name, token-colored statuses, focus outlines and layout adjustments. No additional AI call was made for these fixes. The page is a static UI prototype: Export and navigation links do not implement application workflows. Browser rendering verification could not complete because the browser timed out reaching the local preview server; no screenshot or verified mobile-rendering claim is made.

## Reductions implemented

- System instruction length: 7,445 to 2,160 characters, a 71.0% character reduction. Both measured calls used the shorter prompt; there is no measured before/after token or quality comparison against the original prompt.
- Only explicitly selected reference images are attached. Empty selection sends no reference images; this avoids unintended vision input.
- Generation disables the SDK's default two automatic retries: at most one provider attempt per submitted generation. A transient failure must be retried explicitly.
- Request cancellation is forwarded to the provider. The provider may still bill work already performed.
- Provider token usage and finish reason are emitted as stream metadata without a separate AI call.
- The existing UI defaults to one variant. Keep it at one for fewer calls; each additional variant is another generation.

Shorter prompts lower input overhead. Fewer API calls lower repeated generation cost. Output detail still consumes tokens, and cutting output aggressively can reduce quality. There is no guarantee of perfect output or a fixed saving percentage. Repeating a generation still calls the provider; no result cache was added.

## Verification

TypeScript passed after the route and prompt changes. Regression tests cover fragmented Unicode, preservation of valid generated code, parallel-stream isolation, compatible provider endpoints, Ollama URL normalization and usage metadata isolation. Full-project lint still has pre-existing errors. The production build previously failed downloading Google Fonts. Live tests did not change the saved project or database schema.

## Files

- attempt-1.json / attempt-1.html: initial provider result.
- generation-result.json / attempt-2.html: second provider result and quality notes.
- generation-polished.html: locally corrected HTML fragment.
- preview.html: locally corrected standalone preview with compiled Tailwind CSS and no CDN dependency.
