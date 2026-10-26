# Company pages update

## Delivered

- Removed Careers from the Company footer and the page registry. The static route no longer generates; a real HTTP check against the isolated production build returned 404 for `/careers`.
- Replaced short blog outlines with three original full guides on UI briefs, consistent connected screens and export preparation. Each has more than 400 words, a relevant local cover image, a calculated reading time, section navigation and related-article links. Example prompts and an export comparison table are included. No invented publication history, endorsements or external author identities.
- Added dedicated blog listing and article layouts using existing fonts and light/dark theme tokens. Existing licensed local images are reused; their original credits remain in `public/product/CREDITS.md` and article cover captions. The canvas image is labelled as an illustration.
- Added a Contact page displaying Abhay Solanki and `solankiabhay722@gmail.com`, with name, reply email, topic and message fields.
- Per the user's explicit choice, submitting a valid form opens the user's email application with an encoded draft. The user must review and send it there. The page does not send email directly or claim a message was delivered. An email app must be configured on the user's device; direct email contact is also displayed.
- Contact validation rejects invalid/oversized input and header injection in the name. Recipient is fixed. No contact API endpoint, email service, dependency, environment variable, database write or deployment was added.

## Files

- `lib/site-pages.ts`: Careers removal, blog-content re-export; remaining page data preserved.
- `lib/blog-content.ts`: full guide content, covers and calculated reading time.
- `lib/contact-email.ts`: contact identity, schema and encoded draft creation.
- `components/site/blog-page.tsx`: listing and full articles.
- `components/site/contact-page.tsx`, `components/site/contact-form.tsx`: contact UI and email-app draft flow.
- `app/(site)/[slug]/page.tsx`, `app/(site)/blog/[article]/page.tsx`: use the new layouts.
- `tests/site-pages.test.cjs`: updated footer count and content-module loading.
- `tests/company-pages.test.cjs`: route removal, full article assets/content, contact validation and encoding.
- `scripts/product-pages-browser-check.cjs`: optional `--company` mode, contact native validation, footer links and Careers 404 checks. Does not submit the form or launch the user's mail application.
- This report, `reports/COMPANY-PAGES-BROWSER-CHECK.json`, and refreshed isolated build logs/metadata.

## Verification

- Focused company/site tests: **5 passed**.
- Full suite outside the restricted sandbox, with two workers: **215 passed, 0 failed, 0 skipped**. Sandboxed attempts timed out; those attempts are not counted as successful runs.
- `npx tsc --noEmit`: passed.
- Isolated production build: passed, Prisma 7.8.0 generation, Next.js compilation/build type checks and 45 static pages. Synthetic configuration only; no real environment files/data copied.
- Real Chrome checks against the isolated production server: **30 passed** — blog index, three article pages and Contact at 390/768/1440 widths in both themes. Fonts loaded, images displayed, no horizontal overflow, correct footer links and no JS exceptions. Form native validity checked with synthetic values without submission. `/careers` returned 404. Reviewed actual listing, article and Contact screenshots.
- Evidence: `reports/COMPANY-PAGES-BROWSER-CHECK.json`; temporary screenshot directory is recorded there.

To test the real email-app handoff, open `/contact`, complete the form and choose **Open email draft**. Confirm the recipient, subject, name, reply email and message in your configured mail app, then choose Send there if you want to send the message. Automated checks verified the draft URL, not OS email-app delivery or receipt.

No push or deployment was performed. The live Vercel site will reflect these changes after deployment.
