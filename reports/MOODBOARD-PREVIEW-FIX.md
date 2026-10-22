# Moodboard preview fix

## Root cause

Moodboard cards used optimized `next/image` for `/api/uploads/...` URLs. These API routes require the Firebase session cookie through `proxy.ts`. The installed Next.js 16.2.9 `fetchInternalImage()` creates its internal request without forwarding request headers, including cookies. Its upload request therefore receives 401 JSON rather than image bytes. Blob previews initially bypass optimization, but refreshed persisted URLs trigger this failure. The card previously displayed a green check based solely on upload completion, independent of image loading.

A regression test executes the installed Next optimizer and the actual project proxy with a stubbed token verifier: even when the optimizer's original request has a session cookie, its internal request has no cookie and receives **401**. A direct request with that cookie passes the proxy. Authentication has not been weakened or bypassed.

The existing on-disk Moodboard upload was inspected read-only: **62,045 bytes, valid JPEG, 736 × 552**, stored with a `.jfif` extension. Thus the existing file is not an empty/corrupt upload. The serving route previously returned application/octet-stream for JFIF; it now returns image/jpeg.

Other confirmed defects: the upload hook ignored the response URL and retained a temporary blob until router refresh; batched additions and upload completion used stale image arrays, potentially losing cards or duplicating requests; filenames containing reserved URL characters were not encoded.

## Files changed for this task

- `components/style/moodboard/images.board.tsx`: keep Next Image's fill/object-cover and the existing card dimensions, transforms, rotation and styling, but use `unoptimized` to load protected uploads directly with browser cookies. Track load/error per source. Green success requires upload completion AND a successful image load. Upload/preview failures show an explicit alert and take precedence over success.
- `hooks/use-styles.ts`: validate and use both storageId and URL from upload responses; switch successful previews to their durable URL immediately; retain blob resources until safe cleanup; use current form state for batched additions and upload updates; prevent duplicate in-flight uploads; retain stable client card IDs during server refresh; preserve readable upload failures.
- `lib/db/images.ts`: encode each stored path segment when constructing upload URLs, for both existing shared Moodboard/inspiration image helpers.
- `app/api/uploads/[...path]/route.ts`: serve JPEG files with `.jfif` extensions using image/jpeg.
- `tests/moodboard.test.cjs`: six regression tests.
- This report and `reports/moodboard-tests.txt`, `reports/moodboard-build.txt`.

No new endpoint, dependency, schema, authentication exception, or manual database/file mutation was introduced. Other pre-existing working-tree changes were left intact.

## Verification

- Six new tests pass: multi-file upload without lost/duplicate cards, failed/malformed upload responses, saved images on remount and the five-image batch limit, load/error-driven card status with direct URLs, actual optimizer/proxy auth failure reproduction, encoded stored URLs and JFIF serving.
- Full `npm test`: **148 passed, zero failed/skipped**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including all 46 static pages.
- `git diff --check`: passed.
- Existing uploaded JPEG decoding/dimensions were checked through the installed image parser without modifying user data.

Hook/card tests use isolated hooks and event handlers; storage queries and filesystem access are mocked in regression tests. The optimizer test uses the installed Next implementation and real proxy logic with a mocked token verifier. No browser is connected, so actual browser Network inspection, visual rendering, and real navigation back to the page remain unverified.

## Browser check

1. Start the app, sign in, and open Style Guide → Moodboard. The existing image should load without reuploading. In Chrome Network, its request should go directly to `/api/uploads/...`, return 200 with image/jpeg (for the existing JFIF), and no longer use `/_next/image?...` for the card.
2. Select several supported images at once. Each should keep its own card and preview. Green checks should appear only after upload and image loading complete; the rotation/card layout should remain unchanged.
3. Navigate to Canvas and return, then reload the page. Persisted image URLs should remain visible.
4. For failure testing, block `/api/upload` in DevTools before adding a new image. The card should show an upload error and no green success check. Blocking `/api/uploads/*` should likewise show a preview error and no success check. Remove the block and reload afterward.

Existing files that have actually been deleted or invalid image bytes cannot be repaired by a preview change; those will now report a clear failure. This fix does not replace images with placeholders or hide broken-image icons using CSS.
