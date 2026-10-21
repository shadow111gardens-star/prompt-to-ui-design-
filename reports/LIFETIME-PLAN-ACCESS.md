# Account plan entitlement

The existing Firebase session response now exposes a plan derived only from the cryptographically verified Firebase ID token's custom `plan` claim. Allowed values: `plus`, `pro`, `lifetime`; missing/invalid values resolve to `local`.

AI Preferences is visible only for `lifetime`. Its existing `/api/workspace-key` administration endpoint is also protected by the server proxy; direct hash navigation or browser-storage changes do not grant access. Account and Billing use the same verified plan label.

This build has no payment checkout/webhook. A trusted server/admin integration must set `{ plan: "lifetime" }` on the Firebase account after validating the purchase. Preserve any unrelated custom claims when updating claims. Never grant a plan from a client-supplied purchase flag, localStorage, or frontend selection. Refresh the user's Firebase ID token / sign out and back in after updating the entitlement. No existing accounts were upgraded by this change.

The existing workspace integration key remains an installation-level key. Per-user AI provider keys are now implemented; see PERSONAL-PROVIDER-KEYS.md. The separate OPENUI_LOCAL_BYOK_TESTING flag permits authenticated localhost testing only in development, and is never an entitlement in production.

Validation: TypeScript check; 87 tests covering non-Lifetime tab hiding, absent API calls and server authorization with signed plan claims; production build.
