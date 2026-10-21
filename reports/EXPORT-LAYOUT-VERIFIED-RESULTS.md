# Verified study export results

Inspected actual downloaded `study-export-comparison-v3.zip` and `study-export-comparison-v4.zip`, their result/geometry JSON, SVG markup, image archives, and the actual PNG/JPG files. The PNG/JPG files from both screens were visually opened, not judged only from thumbnails.

## Version 3: exact results

| Check | Study Dashboard | Study Library |
| --- | ---: | ---: |
| Elements measured | 121 | 110 |
| SVG box mismatches | 0 | 2 |
| SVG text-metric mismatches | 4 | 7 |
| Introduced text overflow | 0 | 0 |
| Standalone HTML box/text mismatches | 0 / 0 | 0 / 0 |
| PNG versus SVG pixels | Skipped: audit false positive `%23g` | Compared: mean absolute channel difference 0 |
| JPG versus PNG pixels | Compared: mean difference 0.64017 / 255 | Compared: mean difference 0.50933 / 255 |

The Dashboard's earlier wrapping/overlap was already gone in these actual files: source and SVG both had one line for “Pomodoro Foc” and one line for “2h 15m”. Source metrics remained stable across PNG, JPG and SVG captures. Library measurements were populated (110 nodes), unlike the first harness's empty arrays.

The remaining version-3 production error was exact and reproducible: the installed `html-to-image` clone code deliberately applies `floor(fontSize) - 0.1px`. Actual JSON shows source `13px` becoming exported `12.9px`, `14px` becoming `13.9px`, and so on. This shortened text runs and shifted Library's Quizzes button (`oui-e-24`) by approximately −1.19 px and Saved button (`oui-e-25`) by −1.59 px as inline flex item widths accumulated. The text mismatches did not represent new line wrapping.

The Dashboard pixel skip was a test-audit defect, not an external image/font: `%23g` is an encoded local SVG gradient fragment. The regex scanner saw it inside a data-embedded SVG and mistakenly classified it as a file URL. The actual exported SVGs contain embedded rendering resources. The earlier security exception was associated with reading pixels after drawing a Blob-URL SVG containing `foreignObject`; the harness now uses the data-URL strategy used by the production library and catches any browser readback restriction as a separately reported skip. Browser security was not disabled.

## Final targeted changes

- `lib/screen-render-readiness.ts`: `screenFontSizeCSS` records exact computed font sizes using existing Canvas element IDs. Export-only rules counter the library's font-size reduction. It does not change the live source, layout or content.
- `lib/screen-image-export.ts`: include those exact-size rules with embedded font CSS for the shared PNG/JPG/SVG capture path.
- Earlier confirmed font corrections remain in `lib/screen-image-export.ts` and `lib/screen-html-export.ts`: include descendant fonts and preserve all subsets rather than use the faulty preferred-format filter. Each embedded face must have a nonempty source.
- `tests/export-layout-pixels.js`: data-URL image loading, resource audit including encoded fragments, and explicit compared/skipped results.
- `tests/export-layout-browser-check.js`: both populated screens, text-line/overflow metrics, per-format source stability, labeled old/new previews, source font status, HTML comparison, and downloadable partial diagnostic results when a stage fails.
- `tests/prepare-export-layout-check.cjs`, `tests/export-layout.test.cjs`, `tests/export-pixel-check.test.cjs`: package/run the reproduction and cover the confirmed regressions.

No project database, generated study HTML, prompts or screenshots were substituted or modified.

## Version 4: actual inspected results

| Check | Study Dashboard | Study Library |
| --- | ---: | ---: |
| Elements measured | 121 | 110 |
| SVG box mismatches | **0** | **0** |
| SVG text-layout mismatches | **0** | **0** |
| Introduced text overflow | **0** | **0** |
| HTML box/text mismatches | **0 / 0** | **0 / 0** |
| PNG versus SVG pixel difference | **Compared: 0** | **Compared: 0** |
| JPG versus PNG pixel difference | Compared: **0.640082 / 255** | Compared: **0.510985 / 255** |
| Pixel checks skipped | **None** | **None** |
| Errors | **None** | **None** |

The PNG and rasterized SVG outputs are identical in the tested browser at 2× resolution. JPEG is lossy and is not claimed to be identical; its measured differences are consistent with compression.

Pomodoro heading: source and export **22px**, one line. Timer value: source and export **28px**, one line. Their source/export line boxes no longer overflow or overlap. The image files visually confirm this.

Dimensions remain Home 375 × 904 / Library 375 × 874 CSS px. PNG/JPG dimensions are 750 × 1808 and 750 × 1748 respectively. SVG dimensions are the original CSS viewport sizes.

Before every production capture, the pipeline waits for font readiness, image decoding and stable layout frames; it repeats readiness after discovering imported font rules. The actual source font records show the used Latin DM Sans and Host Grotesk faces loaded. Unused Latin-extended subsets and unused weights may remain `unloaded`, which is normal glyph/weight-based lazy loading rather than a failed font wait. Source geometry/text metrics remain unchanged across all three capture formats.

### ZIP verification

Inspected all three final image ZIPs: each contains both screens with the correct extension. PNG and JPG entries are byte-identical to the inspected standalone files. SVG entries have equivalent rendered DOM, font-face definitions and exact-size rules; bytes differ because repeated font-rule collection creates duplicate equivalent CSS. Every archived font face has a source. These equivalence checks are recorded in `VERSION-4-ARCHIVE-AUDIT.json`; archived SVGs were not separately rasterized again by the agent.

## Automated validation

- **131 tests passed**, zero failed (`tests-v4.txt`).
- `npx tsc --noEmit`: passed.
- `npm run build`: passed (`build-v4.txt`).

Readable machine results: `VERSION-3-SUMMARY.json`, `VERSION-4-SUMMARY.json`. Full browser evidence is retained under `user-run-3` and `user-run-4`.

No remaining mismatch was detected for these two screens under the executed checks. This is not a universal pixel-perfect claim: native Canvas pixels were not independently screen-captured, DOM comparisons use a 1px tolerance, JPEG is lossy, and SVG still requires browser support for `foreignObject`. The tested claims are source/export DOM/text agreement and PNG/SVG pixel agreement at the recorded dimensions.
