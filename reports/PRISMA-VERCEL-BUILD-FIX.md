# Prisma client generation / Vercel build fix

## Root cause and diagnosis

The configured generator is explicitly `prisma-client-js`, with default output. For this generator the existing `import { PrismaClient } from '@prisma/client'` is correct. The newer Prisma 7 default generator, `prisma-client`, requires a custom output/import, but that is not the generator configured in this project. Neither the schema nor `lib/db.ts` needs changing for this error.

The project had no postinstall generation step and its build script was only `next build`. The installed `@prisma/client@7.8.0` package also has no postinstall generation hook. A local client already existed from manual generation, explaining why local builds could pass while a clean/cached deployment failed.

The failure was reproduced without changing files: a TypeScript compiler host hid only `node_modules/.prisma/client/*` from module resolution. The existing `lib/db.ts` then produced exactly TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'. With generated declarations visible, the same import compiles. This confirms missing generated artifacts as the direct cause; the full remote install logs/settings were not available to distinguish a fresh missing artifact from an incomplete restored cache.

There is no repository .npmrc, pnpm/yarn lockfile, Vercel override file, or local ignore-scripts setting causing generation to be blocked. npm reports ignore-scripts=false. Vercel dashboard/install overrides cannot be inspected locally.

The lockfile and installed dependency tree already align prisma, @prisma/client, @prisma/adapter-better-sqlite3 and @prisma/engines at **7.8.0**, with corresponding 7.8.0 runtime/adapter utilities. They were retained. Other transitive package versions were not forcibly changed.

## Exact changes

- `package.json`: `postinstall` is now `prisma generate`; `build` is now `prisma generate && next build`. Generation happens during installation and again explicitly before Next.js compilation, including deployments with a restored dependency cache.
- `package-lock.json`: root hasInstallScript metadata set to true for the new install lifecycle hook. No dependency versions/resolutions changed.
- `tests/prisma-client.test.cjs`: generated export/version compatibility, an actual SQLite adapter query in an in-memory database, and the missing-artifact TypeScript regression.
- This report; verification logs in `reports/prisma-build-fix-tests.txt` and `reports/prisma-build-fix-build.txt`.

No generator/import, datasource, Prisma package version, schema, migration or application feature was changed. Generated node_modules files remain ignored. No database migration/reset/seed was run.

## Verification

- `npm run db:generate`: passed, generated client **7.8.0**.
- `npm run postinstall`: passed, confirming the install lifecycle command.
- Focused Prisma suite: **3/3 passed**.
- Full `npm test`: **171 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with exit code 0. The log shows Prisma generation before Next.js 16.2.9 compilation, TypeScript checks and all 46 static pages.
- `git diff --check`: passed.
- Existing `data/openui.db` SHA-256 was identical before and after the complete test/build verification. Integration tests used `file::memory:`, not the user's database.

PowerShell may format Prisma's informational stderr line ("Loaded Prisma config...") as a NativeCommandError in the redirected log. This was not a nonzero process exit; generation and the completed production build returned 0.

## Vercel settings / redeployment

1. Deploy the commit containing package.json and package-lock.json (plus the regression test/report if desired).
2. Use the Next.js framework preset and the repository root containing package.json, prisma.config.ts and prisma/schema.prisma.
3. **Install Command:** `npm ci --include=dev` (or the default install if it includes dev dependencies). The Prisma CLI is already a devDependency, so do not omit dev dependencies at build time. Do not use --ignore-scripts or an ignore-scripts=true environment/config override.
4. **Build Command:** `npm run build`. Remove an override of bare `next build`, which bypasses the new explicit generation step.
5. **Node.js:** use 22.x. Local verification used Node 22.20.0; Prisma 7.8.0 supports ^20.19, ^22.12 or >=24.0.
6. Redeploy once with **Use existing Build Cache** unchecked, to discard missing/stale generated artifacts. Confirm logs show "Generated Prisma Client (v7.8.0)" before Next compilation.

No new environment variable is required by this fix. Existing application/Firebase/provider variables still need their existing Vercel configuration. No Vercel deployment was performed here. This verifies the production build; Vercel runtime SQLite file availability/persistence is a separate unchanged constraint, and is not claimed as solved by client generation.

Official references: [Prisma generator configuration](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators), [Prisma Vercel generation lifecycle guidance](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel).
