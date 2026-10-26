# Second reference-inspired guide

Added `/blog/create-saas-design-system`: **How to Create a Design System for Your SaaS Product: A Complete Guide**. It is the second card on the Blog listing, after the mobile-design guide. Existing guides remain intact; five articles are now registered.

The guide includes an original vector cover, TL;DR, five numbered sections, conclusion and a functional sign-in CTA. Native HTML/CSS examples show a concept dashboard, color/type/spacing foundations, buttons/fields/cards, a component library and maintenance tips. Examples are labelled as educational concepts rather than live account data or implemented SaaS functionality. The full reference screenshot is not used as the rendered page.

Shared article layout, existing theme/fonts, related search, reading-time calculation and navigation are reused. Fake social counts and disconnected subscription controls were not added. No API, dependency, environment, database or deployment changes.

## Files

- `lib/blog-content.ts`: complete new guide, optional unnumbered conclusion.
- `components/site/design-system-examples.tsx`: native visual examples.
- `public/product/design-system-guide.svg`: original local cover illustration.
- `components/site/blog-article.tsx`: guide visuals and closing CTA.
- `tests/company-pages.test.cjs`: verifies five full guides/assets.
- `tests/site-pages.test.cjs`: validates the existing sign-in route used by the new CTA.
- `scripts/product-pages-browser-check.cjs`: new route and updated related-article count.
- This report, browser evidence JSON and refreshed production build evidence.

## Actual verification

- Full automated suite: **215 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- Isolated production build: passed, including Prisma client generation, Next.js compilation/type checks and 47 static pages. Synthetic configuration only.
- Real Chrome: **42 checks passed** — Blog, five article routes and Contact at 390/768/1440 widths in both themes. No horizontal overflow, broken visible images or JS exceptions; fonts loaded. Related search/reset and existing contact field validity checked without submission. Careers still returns 404.
- Reviewed actual full-page desktop, desktop dark and mobile screenshots for the new guide. Evidence directory is in `reports/DESIGN-SYSTEM-BLOG-CHECK.json`.

No push or deployment was performed. The new route will appear on the live site after deployment.
