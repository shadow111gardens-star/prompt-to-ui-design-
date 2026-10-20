# Firebase email verification

Email/password signup now sends Firebase's normal verification email and opens `/verify-email`. Password sign-in without verification opens that page as well. No OTP or passwordless provider is involved. Google sign-in continues through the existing flow.

## Files

- `lib/firebase/email-verification.ts`: SDK send/reload helpers, forced ID-token refresh, 60-second resend cooldown stored per user in localStorage (also enforced in memory if storage is unavailable).
- `components/auth/verify-email.tsx`, `app/verify-email/page.tsx`: responsive themed verification page, email, resend/check/sign-out controls and feedback.
- `components/site/auth-screen.tsx`: signup email sending and pending-account redirect.
- `components/auth/provider.tsx`: retains pending Firebase users without establishing an authorized server session; updates the session after verification.
- `components/auth/protected.tsx`: hides workspace content for pending accounts.
- `lib/firebase/verify-token.ts`: checks signed `firebase.sign_in_provider` and `email_verified` claims after signature validation. Password tokens require `email_verified === true`; Google requires no additional email.
- `app/api/auth/session/route.ts`: rejects pending password accounts with HTTP 403 / `EMAIL_VERIFICATION_REQUIRED` and removes stale session cookies.
- `proxy.ts`: applies the same verification to existing protected pages/internal APIs, including previously issued unverified cookies. The existing separately Bearer-key-authenticated integration endpoint is unchanged.
- `tests/firebase-auth.test.cjs`, `tests/auth-hydration.test.cjs`, `tests/email-verification-ui.test.cjs`: signed-token/server guards, provider transitions, signup sending, persisted cooldown, reload/refresh ordering, UI states and protected layouts.

No packages, Firebase configuration, environment variables, database schema or Prisma changes are required.

## Firebase Console

In project `openui-original`, keep Authentication > Sign-in method > Email/Password enabled. Keep Google enabled. Do not enable Email link (passwordless sign-in) for this flow. Review Authentication > Templates > Email address verification for sender name, subject and Firebase-hosted action URL. Keep your deployed domain and localhost in Authorized domains as appropriate. This implementation uses Firebase's default hosted verification action handler.

## Real browser test

1. Start OpenUI and visit `/sign-up`. Use a new email inbox you control and a password of at least 8 characters.
2. Submit. Confirm `/verify-email` displays your email. Check inbox/spam for Firebase's verification link.
3. Before clicking the link, open `/dashboard/workspace`: access must redirect to verification. An internal API request such as `/api/projects` must not return project data (403 if an old unverified cookie exists, otherwise 401).
4. Click “I've verified my email” before verification: a helpful pending message should appear.
5. Confirm resend is disabled for 60 seconds, including after refreshing. After it expires, click Resend and check the inbox again. Network/Firebase errors should be visible without bypassing the cooldown.
6. Open the verification link in the received email. Return to the original OpenUI tab and click “I've verified my email”. The app reloads Firebase user state, forces a fresh token, updates the existing HttpOnly server cookie and redirects to `/dashboard/workspace`.
7. Sign out, then sign in with that email/password: the dashboard should open normally. Try a separate unverified account: it should open verification instead.
8. Test Google sign-in: no additional verification email/page should be required. Test password reset and sign-out as before.
9. Repeat the page at narrow mobile and tablet widths; buttons and email should remain readable without horizontal overflow.

## Validation

- `npx tsc --noEmit`
- `node --test tests/*.test.cjs`: 84 passed.
- `npm run build`

Automated tests mock Firebase email delivery and use signed local test tokens for server checks. Real inbox delivery and Google popup interaction require the browser steps above; they were not claimed as completed.

Official SDK reference: https://firebase.google.com/docs/auth/web/manage-users#send_a_user_a_verification_email
