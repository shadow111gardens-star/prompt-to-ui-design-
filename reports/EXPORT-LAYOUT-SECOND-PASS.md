# Export layout: actual browser artifact analysis

## Inspected evidence

Opened the downloaded `study-export-comparison.zip`. Extracted all files to `reports/export-layout/user-run-1`, visually inspected the actual Home and Library PNG/JPG files, and parsed both SVGs and the geometry JSON. The files confirm the remaining wrapping. Existing raster dimensions are correct: Home 750 × 1808, Library 750 × 1748; SVG viewports are 375 × 904 and 375 × 874 respectively.

### Exact Dashboard differences

| Element | Source | Export | Finding |
| --- | --- | --- | --- |
| `oui-e-16`, Daily Goal badge | x40, y126.4, 88.35 × 22.4 | x40, y128, 91 × 20 | The one reported geometry mismatch: y +1.6, width +2.65, height −2.4 CSS px |
| `oui-e-17`, “Pomodoro Foc” heading | One text line, box 144.925 × 26.4 | Two text lines, same outer box | Extra line overflows the copied height; the first harness ignored text-line changes |
| `oui-e-20`, “2h 15m” | One text line, box 104.3 × 28 | Two text lines, same outer box | Extra line extends into the target label below |

These source DOM measurements show that the Pomodoro text wrapping is introduced during export. The source's single-line title ends before the statistics row; the exported second title line extends into it. This is not addressed by redesigning the card or changing the original text.

Library's first-run `geometryMismatches: 0` was invalid evidence: `Library-geometry.json` contains `before: []` and `after: []`. The original comparison omitted Canvas's `identifyHtmlElements` step, so the Library HTML had no measurement IDs. Its visually broken headings were not tested.

## Confirmed remaining root cause

Both actual exported SVGs have **48 `@font-face` rules, 24 without `src`; all 24 missing rules are the Latin subsets**. Merely finding the font family name and some base64 bytes did not verify coverage.

In the installed `html-to-image` package, `embed-resources.js` implements `preferredFontFormat` using a module-level global `URL_WITH_FORMAT_REGEX`. Its `lastIndex` is retained after a successful match. Processing the next single-source face can start past that face's matching URL, return no match, and replace the entire `src` declaration with an empty string. Google's alternating Latin-extended/Latin faces exposed the problem. This explains why embedding the descendant font names alone improved some text while leaving ordinary Latin glyphs falling back inside frozen boxes.

The regression test runs the installed package's real `embedResources` with four valid font rules: preferred filtering retains only two sources; preserving all formats retains all four. No package patch or dependency upgrade was introduced.

## Targeted changes

- `lib/screen-image-export.ts`, `lib/screen-html-export.ts`: remove only the failing `preferredFontFormat: 'woff2'` optimization. Full font embedding remains enabled for all formats/subsets.
- `lib/screen-render-readiness.ts`: reject any exported font-face rule without a nonempty embedded source, in addition to the existing family/resource checks.
- `tests/export-layout.test.cjs`: regression for alternating source loss and rejection of incomplete font CSS.
- `tests/export-layout-browser-check.js`: assign IDs to both screens as Canvas does; reject empty comparisons; measure direct text line counts, text bounds and introduced overflow, not only element boxes; compare standalone HTML too; measure PNG-versus-SVG and JPG-versus-PNG raster differences; create all three image archive formats.
- `tests/prepare-export-layout-check.cjs`: include the real element-identification utility in the browser reproduction.

No source screen HTML, dimensions, layout, content, prompts, database or screenshots were substituted or edited.

## Checks

- `npm test`: **128 passed, zero failed** (`reports/export-layout/tests-v2.txt`).
- `npx tsc --noEmit`: passed.
- Production build: `reports/export-layout/build-v2.txt`.
- New browser comparison version: `2-latin-subsets`, same `browser-check/index.html`; downloaded filename `study-export-comparison-v2.zip`.

The first-run exports were actually inspected. New second-pass image output is not yet accepted: the agent's browser inventory remains empty, so the refreshed browser acceptance run must be inspected when its ZIP is available. Zero box mismatches alone will not be treated as a visual pass, and JPEG compression differences are reported rather than described as pixel equality.
