# Firebase Authentication integration

Date: 2026-10-20

Implemented Google popup login, email/password signup and login, password-reset email, persistent browser authentication, verified server cookies, protected dashboard/internal APIs, and logout. No OTP, email-link login or verification-code flow was added. Prisma schema, SQLite project records and the Turbopack workspace-root fix are preserved.

## Configuration

The supplied values have already been added to the ignored `.env.local`. The supplied API key was used unchanged and is deliberately not repeated here. `.env.example` contains empty placeholders only for the new Firebase variables.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<the exact supplied Firebase Web API key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=openui-original.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=openui-original
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=openui-original.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=641514179673
NEXT_PUBLIC_FIREBASE_APP_ID=1:641514179673:web:8736801bbee0f1323f3548
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-WJ67HZDV4Z
```

Firebase Web SDK identifiers are public client configuration. No service-account private key is required or added by this implementation. Provider secrets such as Gemini credentials remain server-side. Measurement ID is retained, but Firebase Analytics is not initialized. Restart development after changing environment values; public client configuration must be present before a production build.

`firebase@12.10.0` is pinned because the latest Firebase release attempted during setup required Node >=24.12 while this machine runs Node 22.20. The selected official SDK's app/auth packages support Node >=20. No unrelated dependency upgrades were applied.

## Routes and behavior

- `/sign-up`: create account with email/password or Google.
- `/sign-in`: email/password or Google; Forgot password switches to a reset-email form.
- Successful auth creates the server cookie before a full navigation to the existing `/dashboard/workspace`, or a validated dashboard return path. A full navigation avoids reusing an anonymous prefetched router response.
- Firebase local persistence restores the user on reload and provides cross-tab auth notifications.
- `onIdTokenChanged` synchronizes refreshed tokens. Same-user refresh does not hide/unmount the active canvas.
- POST `/api/auth/session`, body `{ "idToken": "..." }`, verifies signature and mandatory claims before setting an HttpOnly, SameSite=Lax cookie. Secure is enabled in production; lifetime follows token expiry.
- DELETE `/api/auth/session` clears that cookie. Both writes require same-origin requests.
- `proxy.ts` verifies the cookie before dashboard or internal API access. Anonymous pages redirect to Sign in; anonymous internal API access returns 401. Cross-origin authenticated API writes are rejected.
- `/api/integration/projects` retains its existing independent Bearer-key protection. It is not made public by Firebase integration.
- Sign out is available in the dashboard sidebar/mobile drawer. It signs out Firebase, clears the server cookie and opens Sign in with a fresh document.
- Public project creation actions direct anonymous users to Sign in instead of making an unauthorized project-creation request.
- Passwords are sent only through Firebase Auth SDK methods, never to the session endpoint, SQLite, local profile form, or application logs.

The server verifies RS256 signatures against Google's fixed Firebase signing-certificate endpoint and checks issuer, audience/project, expiration, issued-at, authentication time and subject. Signing certificates are cached according to their HTTP lifetime. No client-decoded token is trusted without signature verification. This does not perform an Admin SDK revocation/disabled-user lookup on every request; already-issued tokens can remain valid until expiration. Local logout clears this browser's cookie/session rather than remotely revoking every issued token.

**Workspace boundary:** The existing Prisma database remains shared among authenticated users. This change adds authentication, not per-user project ownership or organization roles. Signup therefore grants access to the existing shared workspace to an authenticated account in this Firebase project. Multi-tenant isolation would require a separately approved data-model/access-control change.

## Firebase Console settings to verify

1. Project **openui-original** → Authentication → Sign-in method: enable **Email/Password** and **Google**. Do not enable email-link/OTP for this implementation.
2. Configure the Google provider's support email and any required OAuth consent-screen/test-user settings.
3. Authorized domains: `localhost` was confirmed in the project configuration, along with the supplied Firebase hosting domains. Add the actual deployed application domain. Add another development hostname only if you use it.
4. Keep the configured Auth domain and the Google OAuth handler consistent: `https://openui-original.firebaseapp.com/__/auth/handler`. Check custom OAuth settings if supplied in the Console.
5. Review the password policy. The signup UI requires at least eight characters; Firebase may require a stricter policy.
6. Review Authentication → Templates → Password reset. The reset email uses Firebase's reset flow and continues to the application's `/sign-in` route. Use HTTPS in production and ensure that domain is authorized.
7. Confirm that the Web App's API-key restrictions permit Firebase Authentication/Identity Toolkit and the intended origins.

## Verification completed

- Supplied identifiers matched `.env.local` exactly; API key was present; `.env*` ignore rule retained.
- Firebase's project-config endpoint returned 200 and the expected project number `641514179673`; authorized domains include `localhost`, `openui-original.firebaseapp.com`, `openui-original.web.app`.
- TypeScript checking passed.
- 80 tests passed: existing regression suite plus signature/claim/forgery checks, cookie/CSRF handling, server guard, Firebase initialization reuse, auth error mapping, safe redirects, signup/login/reset/Google handlers, persisted-user restoration, token refresh and logout synchronization.
- Production build passed after fixing a pre-existing debug route that constructed Prisma without its required adapter; it now reuses the existing configured Prisma singleton.
- Production server HTTP checks: public home/auth pages 200; anonymous dashboard/settings 307 to Sign in; anonymous project/model APIs 401; forged token 401; cross-origin session write 403; logout cookie-clear response 200 with HttpOnly and Secure attributes. Results: `reports/firebase-production-verification.json`.
- Browser automation is unavailable. A synthetic live Firebase provider-login probe was rejected by automatic approval review with “blocked by policy” and did not execute. Real account creation, Google consent/popup completion, reset email delivery and the full authenticated browser journey are **not live-verified**. No account or email was created/sent for these checks.

## Manual acceptance steps

1. Open `/sign-up`; submit an invalid email/short password and check validation. With a test email you control, create an account. Confirm Firebase Console → Authentication → Users shows it and the app opens `/dashboard/workspace`.
2. Reload the dashboard and a direct canvas URL. Verify login restoration, existing projects and editing/autosave/export workflows.
3. Sign out from the sidebar. Direct dashboard access should redirect to Sign in; `/api/projects` without a session should return 401.
4. Sign in using that email/password. Try an incorrect password and verify the readable error/loading recovery, then use the correct password.
5. Sign out; choose Continue with Google. Allow the popup, complete consent and confirm dashboard access. Cancel once and verify the cancellation message. Check a second tab for login/logout state changes.
6. On Sign in choose Forgot password, enter the controlled test email and send the reset link. Open the email, complete Firebase's reset page, then sign in with the new password. No OTP entry screen should appear.
7. Test phone/tablet layout, keyboard access, password reveal and both existing themes. The extension-related input hydration fix remains in place.

## Files changed

- `package.json`, `package-lock.json`
- `.env.example`; local uncommitted `.env.local`
- `lib/firebase/client.ts`, `lib/firebase/errors.ts`, `lib/firebase/verify-token.ts`
- `components/auth/provider.tsx`, `components/auth/protected.tsx`, `components/auth/logout-button.tsx`
- `app/api/auth/session/route.ts`, `proxy.ts`
- `app/layout.tsx`, `app/(protected)/layout.tsx`
- `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`
- `components/site/auth-screen.tsx`, `components/projects/dashboard-shell.tsx`
- `hooks/use-project.ts`
- `app/api/debug-settings/route.ts`
- `lib/legal-pages.ts` (Firebase account/session disclosures)
- `tests/firebase-auth.test.cjs`, `tests/auth-hydration.test.cjs`

Implementation references: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Google authentication](https://firebase.google.com/docs/auth/web/google-signin), [password reset](https://firebase.google.com/docs/auth/web/manage-users), [persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
