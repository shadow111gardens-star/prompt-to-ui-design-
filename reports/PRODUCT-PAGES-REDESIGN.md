# Product pages redesign

Updated `/features`, `/pricing`, `/changelog` and `/roadmap` in the existing app. Footer destinations remain unchanged. Other site pages, authentication, billing implementation and generation behavior were not changed by this UI task.

## What changed

- Dedicated product-page layouts with shared product navigation, stronger heading hierarchy, generous spacing, existing Host Grotesk/DM Sans fonts and existing light/dark orange/brown theme tokens.
- Features: six practical workflow sections, editable-screen capabilities and the existing canvas illustration (labelled as an illustration).
- Pricing: available workspace capabilities, accurate billing availability and working native FAQ disclosure controls. Removed speculative subscription prices/allowances/rollover/support claims from this page; checkout is not connected. The homepage pricing component was outside this four-page scope and remains unchanged.
- Changelog: expanded notes describing implemented generation, color editing, export, ownership and asset work. No invented release dates, customer statistics or version history.
- Roadmap: available capabilities, improvement priorities and uncommitted ideas clearly separated, with feedback links. No fabricated deadlines or completion percentages.
- Real workspace/planning photography is stored locally, with descriptive alt text and photographer links. Attribution/license sources are in `public/product/CREDITS.md`. Photos do not represent OpenUI employees or customers.
- Product-page images use existing Next Image with `unoptimized` for direct delivery of the already-compressed local assets. Initial optimized-image desktop checks showed unresolved images; the final direct-asset implementation was checked again and every visible image loaded. Other application images/settings were not changed.

## Files changed in this task

- `app/(site)/[slug]/page.tsx`
- `components/site/product-page.tsx` (new)
- `lib/site-pages.ts` (only the four product entries)
- `public/product/creative-workspace.jpg`, `public/product/product-planning.jpg`, `public/product/CREDITS.md` (new)
- `scripts/product-pages-browser-check.cjs` (new, dependency-free local Chrome QA)
- `reports/PRODUCT-PAGES-BROWSER-CHECK.json` and this report (new)
- `reports/production-readiness-build.json` and `.log` (refreshed)

Pre-existing FRAME preflight changes in the working tree were preserved.

## Actual verification

- Full Node suite: **212 passed, 0 failed, 0 skipped**.
- Site/footer destination checks: **2 passed**.
- `npx tsc --noEmit`: passed.
- Final isolated `npm run build`: passed, including Prisma client generation, Next.js compilation/build type checks and 46 static pages. Synthetic configuration only; no real environment files or application data copied.
- Real headless Chrome against the final isolated production build: **24 passed** (four routes, 390/768/1440 CSS-pixel widths, light/dark). Each had one H1, correct active product navigation, all four product footer links, loaded fonts, no horizontal overflow and no broken visible images. No JavaScript exceptions recorded. Pricing FAQ opening/closing also passed.
- Reviewed actual desktop/mobile screenshots and all four full-page desktop captures. These are responsive viewport checks, not a physical-device/browser-matrix certification.
- Evidence JSON: `reports/PRODUCT-PAGES-BROWSER-CHECK.json`. Screenshots/results remain in the temporary folder recorded there, outside source control.

Reproduce browser QA against a local running instance with:

```powershell
node scripts/product-pages-browser-check.cjs http://127.0.0.1:3000
```

Chrome must be installed at the path configured in that script. It only accepts local targets. No deployment or push was performed.
