# Export layout final audit

Completed 21 October 2026. Final full suite, standalone TypeScript check and optimized production build all passed.

## Exact production files changed by the export-layout work

1. `lib/screen-render-readiness.ts` (new): iframe-aware font collection, complete font-subset validation, exact computed font-size rules for export, stylesheet/font/image/layout readiness and capture-size validation.
2. `lib/screen-image-export.ts`: shared production PNG/JPG/SVG capture uses those helpers, preserves selected frame dimensions, excludes editor overlays and retains individual/all-screen ZIP downloads.
3. `lib/screen-html-export.ts` (new): serializes live iframe HTML, CSSOM rules, tokens, embedded fonts and saved images. Final review preserves generated scripts/noscript inside the design while excluding surrounding editor shell scripts and overlays.
4. `lib/frame-snapshot.ts`: existing frame PNG download delegates to the shared production capture; shape-aware HTML download delegates to live document serialization. Other canvas snapshot and download helpers remain.
5. `lib/zip-export.ts`: HTML ZIP uses each independently rendered live document instead of nesting raw generated documents inside a separate simplified page.
6. `components/canvas/shapes/generatedui/index.tsx`: Download HTML supplies the real shape ID so it uses the rendered document.

The font-size correction is called by `captureScreenImage` in production, in its `fontEmbedCSS` option, not only by the comparison harness. A regression assertion inspects the actual options passed to the production capture library. PNG, JPG, SVG, legacy frame PNG, HTML and ZIP entry points remain present. No AI prompts, saved screen content, database schema, dependencies or authentication flows were changed for this task.

## Tests and local tooling retained

- `tests/export-layout.test.cjs`
- `tests/export-html.test.cjs` (also checks preservation of generated scripts)
- `tests/export-pixel-check.test.cjs`
- Export regression fixtures/assertions in `tests/generation.test.cjs`
- `tests/prepare-export-layout-check.cjs`
- `tests/export-layout-browser-check.js`
- `tests/export-layout-pixels.js`

## Final validation

- `npm test`: **131 passed; 0 failed; 0 skipped**. Final rerun includes the production-option assertion and generated-script preservation test.
- `npx tsc --noEmit`: **exit 0**.
- `npm run build`: **exit 0**, optimized Next.js build and all 46 static pages generated.
- `git diff --check`: passed (Git only reports its normal LF-to-CRLF conversion notice for `.gitignore`).

Logs: `reports/export-layout/final-audit-tests.txt`, `final-audit-typescript.txt`, `final-audit-build.txt`, `final-git-audit.json`.

The previously downloaded Version 4 files were inspected: Dashboard 121 measured elements and Library 110; both have zero geometry mismatches, zero text-layout mismatches and zero introduced overflow. PNG/SVG pixel comparison completed with zero difference for both; no pixel comparisons skipped. JPEG remains lossy. See `EXPORT-LAYOUT-VERIFIED-RESULTS.md` for actual measurements and evidence boundaries. Final review only narrowed HTML shell cleanup to retain generated scripts; raster/font capture code used by the verified Version 4 run was unchanged.

## Git and secret review

- No files staged, no commit created.
- Existing unrelated working-tree changes preserved, neither staged nor reverted.
- No configured secret values found when scanning Git candidate files against local key/secret/token values; values were not printed.
- `.env.local`, `.openui/`, database files and uploads remain ignored.
- Added `/reports/export-layout/` to `.gitignore`: actual downloaded/exported images, ZIPs, source snapshots, bundled browser fixtures and diagnostic logs remain locally available but are excluded from accidental adds. No generated export artifact or private environment file is tracked.
- Reusable comparison tools and regression tests remain in `tests/`, outside that ignore rule.
- `package.json`, package lock and Prisma schema have no export-task changes.

## Test in the actual running OpenUI app

1. In the repository directory, stop any existing dev server with Ctrl+C after the production build. Run `npm run start` to test the built application, then open `http://localhost:3000`. Alternatively restart `npm run dev` for development use; avoid serving a stale dev session over freshly built assets.
2. Sign in normally and open the existing **Project 4** canvas containing **Study Dashboard** and **Library**. Wait for both previews and fonts/images to finish rendering.
3. Click the top-right **Export** button. Under **Current screen**, choose Study Dashboard; download PNG, JPG and SVG. Repeat for Library.
4. At the verified frame sizes, expect Home PNG/JPG 750 × 1808 and SVG 375 × 904; Library PNG/JPG 750 × 1748 and SVG 375 × 874. Export follows the current saved frame if you intentionally resize it. Check the single-line Pomodoro title/value, target label, section headings, cards, filter chips and navigation against Canvas at the same viewport.
5. Under **All screens**, download PNG, JPG and SVG ZIPs. Each should contain both independent screens with the appropriate extension and dimensions.
6. On a screen's own **Export** dropdown, test **Download PNG**, **Download HTML**, and its HTML ZIP option. Compare PNG with the navbar export; open HTML at the same viewport and check design styling. Open SVG in a browser with `foreignObject` support.
7. To rerun detailed diagnostics, use `node tests/prepare-export-layout-check.cjs` and open the generated local `reports/export-layout/browser-check/index.html`. This is optional; it does not replace the real application export controls.

Validation is specific to the tested study screens and browser. It is not a universal pixel-perfect guarantee for every CSS effect, SVG editor or lossy format.
