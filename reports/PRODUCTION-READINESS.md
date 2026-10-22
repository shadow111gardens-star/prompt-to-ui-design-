# Production readiness audit — 22 October 2026

Subsequent source update: project ownership enforcement and a pending additive
migration are documented in `PROJECT-OWNERSHIP.md`. No ownership migration or
production owner assignment has been applied. The findings below describe the
original audit; production release still requires the approved rollout and storage work.

**Build passes; release remains blocked by persistent storage and project authorization.**
No deployment, production database connection, schema/data change, backup deletion,
or application behavior change was performed during this audit.

## Prisma and working tree

Read `NEON-PHASE2.md` and inspected the existing uncommitted Phase 1/2 changes.
The installed lockfile versions of `prisma`, `@prisma/client`,
`@prisma/adapter-neon`, and `@prisma/engines` are all **7.8.0**.

- `prisma/schema.prisma`: PostgreSQL datasource, unchanged four models and strings.
- `lib/db.ts`: PrismaNeon uses pooled DATABASE_URL; no SQLite fallback. The
  development singleton excludes cached clients from the old datasource.
- `prisma.config.ts`: direct DIRECT_URL for CLI, separate PostgreSQL migration
  history, explicit local dotenv loading, exported environment precedence.
- `postinstall` and `build` run `prisma generate`; the build has no migration or
  import step. Existing PostgreSQL schema was already applied in Phase 2.
- `prisma-client-js` remains the configured generator, so importing the generated
  client from `@prisma/client` is correct for this project.
- No SQLite-specific application database access remains in the runtime source
  search. The retained SQLite adapter, native dependency, old migration history,
  tests, backup utilities, and import scripts are recovery/development artifacts.
  They were not deleted or invoked during this audit.
- Scripts named `setup`, `db:migrate`, and `db:reset` are local operational tools;
  do not configure them as Vercel install/build commands. Do not automatically run
  the one-time Phase 2 importer during deployment.
- Use `npm ci` with the committed lockfile; this audit reused installed dependencies
  and did not perform a clean Vercel installation.

## Blocking persistent-storage findings

| Feature | Current source/storage | Consequence on Vercel |
| --- | --- | --- |
| Moodboard/inspiration uploads | `lib/db/images.ts`, `data/uploads/` | Runtime writes under application directory fail; existing local bytes are absent from a Git deployment. Neon has paths, not image bytes. |
| Upload delivery and moodboard references | `app/api/uploads/[...path]/route.ts`, `lib/moodboard-references.ts`, generation routes | Reads require the original local files; references and previews will fail after deployment. |
| Generated/uploaded Pixabay assets | `lib/images/asset-store.ts`, `.openui/image-assets/` | Saved binary data, metadata, and Pixabay mappings are not durable or shared. |
| Pixabay search cache | `lib/images/pixabay.ts`, `.openui/pixabay-cache/` | Required 24-hour cache currently writes local disk; function-local memory or `/tmp` is not a persistent, cross-instance replacement. |
| Personal provider settings | `lib/ai/personal-provider-store.ts`, `.openui/provider-keys/` | Encrypted per-UID files are not deployed or durable. Settings can appear empty; saving/testing/model selection cannot reliably persist. |
| Workspace integration key | `lib/workspace-key.ts`, `.openui/workspace-key.json` | Global key record is local. Administration intentionally requires localhost and therefore refuses the hosted domain. Do not enable a global hosted key without an access-policy review. |

Vercel Functions have a read-only application filesystem with writable `/tmp`
scratch space. Moving durable data to `/tmp` does not solve persistence or sharing.
See [Vercel filesystem documentation](https://vercel.com/docs/functions/runtimes).

The app permits 10 MB image requests, while ordinary Vercel Function request and
response payloads are limited to 4.5 MB. Plan signed direct-to-object-storage
uploads and suitable asset delivery; simply raising the application's validation
limit is insufficient. See [Vercel limits](https://vercel.com/docs/functions/limitations)
and [direct client uploads](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
Large serialized canvas/autosave payloads also need testing against that platform
limit; no actual oversized production request was sent in this audit.

Required approved implementation before release:

1. Choose durable object storage (for example private Vercel Blob, S3/R2, or Firebase
   Storage) and the upload/download authorization policy. No provider or paid
   dependency was selected or installed on your behalf.
2. Adapt image upload, serving, delete, generation-reference, persistence, and
   export paths together. Copy existing images and asset metadata using a separately
   approved migration that preserves current IDs/URLs or supplies compatibility
   handlers. Keep original disk files and backups.
3. Store provider settings as encrypted, user-scoped durable records, preserving
   AES-256-GCM IV/tag/AAD semantics. Preserve the existing OPENUI_PROVIDER_KEYS_SECRET
   when importing existing ciphertext; changing it makes that ciphertext unreadable.
   Process-local write queues do not serialize updates across Vercel instances:
   use database transactions/revisions for concurrent updates.
4. Move the Pixabay cache into shared durable storage with its 24-hour expiry.
5. Use private cache policy/signed delivery for private uploads. The current legacy
   upload handler advertises a public immutable cache policy and permits inline SVG;
   review sanitization and delivery policy as part of the storage/access change.

## Blocking project-authorization finding

Firebase authentication protects `/dashboard/*` and `/api/*` through `proxy.ts`.
However, the Project model has no owner UID or membership relation.
`getAllProjects()` has no identity filter; `getProject(id)`, autosave, rename,
delete, style guide, upload, and settings paths use project IDs without an owner
check. `lib/images/api-auth.ts` validates project existence, not membership.

The synthetic probe executed the actual proxy, project GET route, and project
query helpers with an in-memory Prisma stub. Two distinct authenticated identities
both received the same private project. Anonymous access was rejected. Evidence:
`production-readiness-authorization.json`. This used no production records and no
network access.

Choose a policy before release: private per-user projects with ownership/membership,
or an explicitly restricted single-owner workspace. Public Firebase signup plus
the current shared project namespace does not isolate users. A per-user design
needs an approved schema/backfill assigning the five imported projects to the
correct UID, plus checks in every server page/API and child-asset operation. Do
not infer ownership from email strings, project IDs, or client-provided fields.
Add two-user denial tests for list/read/update/delete/autosave/assets and generation.
Restrict or disable `/api/debug-settings`, which currently returns all project settings
to any authenticated account. Scope any future integration keys to the approved
workspace policy as well.

No authorization/schema edits were made: assigning imported ownership or choosing
a sharing model would require your approval and could affect existing access.

## Firebase verification and remaining browser checks

Source inspection and automated tests confirm signature/issuer/audience/expiry
validation, rejection of unverified password users, Google-provider handling,
same-origin session protection, HttpOnly/Secure production cookies, token-refresh
sync, logout cookie clearing, password reset, and verification SDK workflow.
Signed custom claims determine paid entitlements. The local BYOK bypass is guarded
by development mode and localhost.

This is a short-lived Firebase ID-token cookie implementation, not an Admin SDK
long-lived session-cookie implementation. The custom verifier does not query
Firebase account-disabled/revocation status; valid existing tokens can remain
accepted until expiry. Decide whether immediate revocation enforcement is required
before public release. See [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions).

Local configuration presence and expected Firebase project/domain were checked
without printing values. Vercel Production variables and Firebase Console settings
could not be inspected through an authenticated connector; their correctness is
not claimed. Confirm:

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` at build time.
  Keep the existing storage bucket, sender ID, and measurement settings consistent.
- Email/Password and Google providers enabled; verification/reset email templates
  and action domains correct; passwordless email-link login is not needed.
- Production hostname authorized in Firebase Authentication and Google OAuth domain
  settings where applicable. See [Firebase Google authentication](https://firebase.google.com/docs/auth/web/google-signin).
- `OPENUI_PROVIDER_KEYS_SECRET` configured server-side with the existing matching
  32-byte base64 value; `PIXABAY_API_KEY` and selected server AI-provider credentials
  configured only where those features are used. None should use NEXT_PUBLIC names.
- Leave `OPENUI_LOCAL_BYOK_TESTING` and `OPENUI_LIFETIME_UI_PREVIEW` unset/false in
  production. Both are true locally. Lifetime UI preview is cosmetic; it does not
  grant the signed API entitlement.

Real Google/email login, email delivery, reset, refreshed authenticated sessions,
and authorized project access still need browser testing on an approved staging
domain after the blockers are resolved.

## Checks actually performed

- Full automated suite: **183 passed, 0 failed/skipped**, with synthetic PostgreSQL
  environment values; no real database connection.
- `npx tsc --noEmit`: passed.
- **`npm run build`: passed**, Prisma Client 7.8.0 + Next.js 16.2.9 Turbopack,
  including TypeScript and all 46 static pages.
- Build ran in an isolated sibling directory with an allowlist of copied source
  and synthetic credentials. No `.env` files, data directory, `.openui`, or secrets
  were copied. Installed dependencies were reused through a junction. Only the
  isolated Turbopack filesystem root was widened to resolve that junction; the
  original app configuration and build scripts were not changed.
- Compiled production HTTP checks: public/auth pages 200; anonymous dashboard
  redirects 307 to sign-in; anonymous projects/uploads/integration 401; forged
  session token 401; cross-origin session request 403. Ten checks passed.
  Initial harness runs needed relative-redirect resolution and a matching localhost
  Origin because Next normalizes loopback request URLs; these were harness fixes,
  not application edits.
- Synthetic two-user access probe: confirmed the project-isolation blocker.
- `git diff --check`: passed. `.env.local` remains untracked/ignored.
- Original SQLite/backup checksums, old SQLite migration checksums, and original
  uploads/`.openui` size/mtime records are unchanged. No production DB was queried.

Local build success is not a Vercel deployment or a durable-storage/authorization
pass. The isolated synthetic build must never be deployed as the production artifact.

## Exact next steps

1. Keep production release on hold. Approve a project-access policy and durable
   storage design; implement and test those before exposing the app publicly.
2. Separately approve the ownership backfill and file/ciphertext migration. Preserve
   backups and verify IDs, counts, hashes, access checks, and concurrent settings updates.
3. Configure the Vercel project root to the Git directory containing `package.json`
   and `prisma.config.ts` (this repository's root). Use Next.js preset, Node 22.x
   matching the tested 22.20.0 runtime, `npm ci`, `npm run build`, default `.next`
   output. Do not override install with `--ignore-scripts` or omit Prisma dev tools
   during build. Do not configure setup/reset/import as install/build commands.
4. Confirm Production environment names above in Vercel. Keep DATABASE_URL pooled
   and DIRECT_URL direct. Use a separate database branch/bucket for Preview/staging;
   do not point generic Preview deployments at production. Public Firebase values
   are compiled into the client, so environment changes require a future rebuild.
5. Use a controlled reviewed migration step for future schema changes, separate
   from ordinary builds. The initial Neon schema/import is already complete; do
   not rerun it. Keep the migration directory and lockfile in the eventual commit.
6. After the fixes, rerun tests/types/build, exercise a staging domain with two real
   Firebase users, test all auth flows and upload sizes, verify image reopen/export
   across separate instances/redeploys, and verify encrypted settings persist.
   Then request explicit deployment approval. No deploy was attempted here.

## Files added by this audit

- `scripts/safe-production-build.cjs`
- `scripts/safe-production-smoke.cjs`
- `scripts/production-readiness-probe.cjs`
- `reports/PRODUCTION-READINESS.md`
- `reports/production-readiness-config.json`
- `reports/production-readiness-build.json`
- `reports/production-readiness-build.log`
- `reports/production-readiness-tests.txt`
- `reports/production-readiness-authorization.json`
- `reports/production-readiness-smoke.json`
- `reports/production-readiness-preservation.json`

All existing Phase 1/2 working-tree edits remain intact. No commit or deployment
was made. The isolated build directory is retained locally for reproducibility;
its path is in `production-readiness-build.json`.
