# Reference-inspired blog article

Added `/blog/design-better-mobile-app-screens`, linked as the first card on `/blog`. The existing three guides remain available. Article pages share the revised responsive template.

- Breadcrumbs, large title with orange accent, real reading-time calculation, publication date for the new guide, cover illustration and TL;DR.
- Numbered article sections, a design-system comparison table, native HTML/CSS mobile examples, a refinement sequence and seven connected-screen concepts. The visual examples are labelled as illustrations, not a working fitness product or real measured activity.
- Right-hand related-article sidebar, working local article search, section navigation and a contact CTA. No unconnected newsletter subscription, fabricated likes or comment counts were added.
- Share uses native sharing where available and clipboard-copy fallback otherwise; OS sharing/clipboard behavior was not executed during browser QA.
- Existing OpenUI fonts, theme tokens, header without middle navigation, footer and removed Careers destination are preserved. No new dependencies, APIs, email delivery, database changes or deployment.

The supplied full-page reference was treated as a design reference, not displayed as the resulting page. The existing user-supplied laptop illustration is reused for the cover. Mobile diagrams are actual page components that reflow on smaller screens.

## Changed files

- `lib/blog-content.ts`: new complete mobile-design guide and optional title accent, date and takeaway metadata.
- `components/site/blog-article.tsx`: revised reusable article layout.
- `components/site/article-sidebar.tsx`: related article search and Share control.
- `components/site/mobile-design-examples.tsx`: native illustrative phone layouts, design-system visual and connected-screen sequence.
- `components/site/blog-page.tsx`: listing retained; details delegated to the revised article template.
- `tests/company-pages.test.cjs`: validates the four original guides and assets.
- `scripts/product-pages-browser-check.cjs`: new route and related search/reset check; corrected native Backspace event used by the test.
- This report, `reports/BLOG-ARTICLE-LAYOUT-CHECK.json` and refreshed production build evidence.

## Verification

- Full automated suite: **215 passed, 0 failed, 0 skipped**.
- TypeScript: passed.
- Isolated production build: passed; Prisma client generation, Next.js compilation/type checks and 46 static pages. Synthetic configuration only.
- Real Chrome: **36 passed** for Blog, four articles and Contact at 390/768/1440 widths in light/dark themes. Fonts and visible images loaded, no horizontal overflow or JavaScript exceptions. Related search and clearing the search were exercised with actual input events. Contact form was not submitted. Careers remains 404.
- Reviewed actual new-guide full-page desktop, desktop dark and mobile screenshots. Screenshot directory is recorded in `BLOG-ARTICLE-LAYOUT-CHECK.json`; files remain outside the source tree.

No push or deployment was performed. Open the new guide from the first card on the local Blog page; deploy separately to update the public site.
