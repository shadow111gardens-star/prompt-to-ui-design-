# Study screen export investigation

Status: code changes and automated checks complete; visual acceptance of newly rendered exports remains pending a browser run. This report does not claim pixel-equivalent output has been verified.

## Real evidence inspected

Read the existing SQLite database in read-only mode. Both screens belong to the same saved canvas, Project 4 (`cmvhtlb0o0003m0uyylqeghtg`):

| Screen | Saved viewport at initial inspection | Existing exported PNG |
| --- | --- | --- |
| Study Dashboard (Home) | 375 × 904 CSS pixels | 750 × 1808 pixels |
| Library | 375 × 874 CSS pixels | 750 × 1748 pixels |

Opened and visually inspected the actual `01-Study Dashboard.png` in Downloads and both PNGs extracted from `openui-all-screens-png (1).zip`. Home has overlapping focus-card text and wrapped section labels; Library has wrapped headings and overlapping following sections. Copies of the actual source HTML, initial shape metadata and existing exported PNGs are under `reports/export-layout/source` and `before`. The original project content was not rewritten. The real Home title currently reads “Pomodoro Foc”; this was preserved, not substituted with fabricated content.

The supplied broken PNGs already have the expected 2× outer dimensions. Changing image dimensions alone therefore would not explain or resolve the observed text-layout mismatch.

## Rendering paths and root cause

Canvas: `components/canvas/shapes/generatedui/index.tsx` parses `normalizePreviewSizing(identifyHtmlElements(uiSpecData))`, puts generated head content into the iframe head, and maps cleaned body classes/styles onto `#mockup-root`. The surrounding iframe provides compiled Tailwind styles, project font imports, CSS variables and token updates. Canvas translation/zoom applies outside the iframe and should not enter exported pixels. The fullscreen device preview uses its own selected device viewport; exports target the saved Canvas frame, not editor zoom or an arbitrary fullscreen device selection.

Navbar image exports: `ImageExportControls` → `downloadScreenImages` → `captureScreenImage` → `html-to-image`. This library is a computed-style DOM clone → SVG `foreignObject` → browser rasterization pipeline, not a native screenshot. The installed library's `getUsedFonts` recursively visits children only when `child instanceof HTMLElement` in the parent window. Iframe children fail that cross-realm check, so a root using DM Sans does not cause a descendant-only Host Grotesk heading font to be embedded. The same computed box sizes then get rendered with a fallback heading font, which can wrap inside the copied widths and overflow copied heights. The regression test reproduces the omission using the installed library: before, the CSS contains DM Sans but not Host Grotesk; explicit collection embeds both. This confirms the font-discovery bug. The final visual contribution on the user's two screens still requires the browser comparison below.

Additional divergence found:

- The older frame PNG button used `skipFonts: true`, had no font/layout readiness wait, and ran a separate capture implementation.
- Image export used `scrollWidth/scrollHeight` as dimensions. Overflow could enlarge a capture or alter the cloned root instead of preserving its frame.
- HTML download rebuilt the document separately; HTML ZIP inserted a full generated HTML document inside another body and applied different font/wrapper defaults. This also omitted live tokens, compiled utility CSS and preview sizing normalization.
- Captures waited on font readiness before guaranteeing newly inserted content had requested fonts, did not await image decoding consistently, and did not settle layout after imported font rules were discovered.

## Changes

- `lib/screen-render-readiness.ts` (new): collect fonts from every iframe element and pseudo-element through its own document/window, then explicitly supply embedded CSS through the library's supported `fontEmbedCSS` option. Fail visibly if registered used fonts cannot be embedded. Wait for stylesheets, force layout, await fonts and image decoding, restore lazy-loading attributes, and wait for stable animation frames. Validate pixel limits without silent auto-scaling.
- `lib/screen-image-export.ts`: retain PNG/JPG/SVG and per-screen ZIP behavior, use each saved frame's dimensions at 2× raster resolution, reject viewport-resize races, exclude editor overlays, include URL query parameters in resource caching, and embed all used fonts before capture.
- `lib/frame-snapshot.ts`: route the old PNG button through the same capture implementation; remove the `skipFonts` path. HTML downloads with a shape ID use the live renderer document.
- `lib/screen-html-export.ts` (new): serialize the actual rendered iframe HTML, compiled CSSOM rules, custom styles, fonts, wrapper and injected tokens. Remove editor overlays and shell scripts rather than rebuilding/nesting generated documents. Embed saved image bytes and used font bytes.
- `lib/zip-export.ts`: package the independent live HTML documents instead of a second simplified renderer.
- `components/canvas/shapes/generatedui/index.tsx`: pass the shape ID to HTML export.
- Tests: `tests/export-layout.test.cjs`, `tests/export-html.test.cjs`, and updated capture fixtures in `tests/generation.test.cjs`.
- Reproduction tooling: `tests/prepare-export-layout-check.cjs` and `tests/export-layout-browser-check.js`.

No AI prompt changes, database/schema changes, new dependencies, content replacements or study-screen redesigns were made.

## Validation

- Full suite: **127 tests passed, zero failed**. Includes real installed-library cross-realm font regression, independent Home/Library frame dimensions, fonts/images/layout readiness, overlay filtering, PNG/JPG/SVG entry points, image archive packaging, live HTML/CSS/token serialization, and independent HTML ZIP contents.
- `npx tsc --noEmit`: passed.
- `npm run build`: production build log in `reports/export-layout/build.txt`.
- Existing exported PNGs were actually opened and inspected. New browser-rendered image files have **not** been captured or visually inspected by the agent: browser inventory is empty, and opening the in-app browser reports “Browser is not available: iab”. Unit tests use controlled DOM/transport fixtures; they are not a pixel comparison.

## Reproducible real-screen acceptance check

1. Run `node tests/prepare-export-layout-check.cjs` from the repository (already run). It reads the database without writes and prefers the immutable Home/Library snapshot captured with the original evidence. It does not run generation or replace project data.
2. Open `reports/export-layout/browser-check/index.html` in Chrome. Click **Run comparison and create exports**. Allow the same Google fonts/Tailwind resources used by Canvas to load.
3. The page renders both actual saved designs using the Canvas wrapper/style rules, displays old and new PNG exports plus new JPG/SVG, checks exact exported pixel dimensions, and compares element geometry against the SVG's reloaded DOM. Inspect labels, card sizes, alignment, borders, clipping and navigation, and check `geometryMismatches` for each screen. A nonzero result must be investigated, not treated as success.
4. Click **Download generated export files + results** for a ZIP with actual PNG/JPG/SVG/HTML exports, old reference captures, geometry JSON and an all-screen PNG ZIP. The JSON records measured results. No browser success is asserted until this is run.
5. Repeat in the authenticated app using both the navbar export controls and the legacy frame PNG button. A selected fullscreen preview device is separate from the saved frame; use the same dimensions when comparing layouts.

## Remaining limitations

- Browser visual verification remains outstanding; do not consider this accepted solely because unit/build checks pass.
- SVG continues to use HTML/CSS `foreignObject`, as before. Browsers render it; editors that do not support `foreignObject` may not reproduce it. It is not a native editable-vector reconstruction.
- `html-to-image` still clones computed styles and may have browser-specific limitations for complex effects. No pixel-perfect guarantee is made without comparing the actual exported files.
- HTML retains non-font external stylesheets if used by the original design. Fonts and saved OpenUI images are embedded, but HTML exports are not a general offline bundler for all arbitrary remote scripts/resources.
- The hidden legacy platform/code scaffold exporters remain separate code-conversion workflows, not visual screenshot exports.

Library behavior and supported options checked against the [official html-to-image documentation](https://github.com/bubkoo/html-to-image) and the installed source, particularly `embed-webfonts.js`, `clone-node.js` and `apply-style.js`.
