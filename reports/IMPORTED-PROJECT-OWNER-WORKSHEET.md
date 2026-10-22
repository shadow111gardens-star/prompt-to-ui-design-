# Imported project owner review worksheet

Prepared 22 October 2026 from the verified SQLite backup only. **No owner is assigned by this document.** No production connection, migration, key rotation, push, or deployment was performed.

## Read-only source verification

- Backup: `C:/Users/Abhay Solanki/Downloads/openui-main-sqlite-backups/phase1-2026-10-22-1792650848214/openui.db`.
- SHA-256 matches both the Phase 1 verification manifest and the assignment plan: `a85646e6caba52076357304885b51183ad6e9a2115e610d05b1d92b6e1815bcc`.
- SQLite integrity: ok; foreign-key violations: 0; backup WAL/SHM/journal sidecars: none.
- Exactly five project IDs match the assignment plan. Backup checksum and assignment-plan checksum are unchanged after reading.
- This backup predates the ownerUid column. The null values below are from the current offline assignment plan; current Neon ownership was not queried.
- Only project IDs, sanitized display names, project numbers, dates, public flags, and image counts were selected. No canvas/HTML content, descriptions, thumbnails, provider settings, tokens, credentials, or image bytes were exported. Names are plain identifying labels, not proof of ownership.

## Project inventory

Times are UTC; image counts are Moodboard / Inspiration. The public flag is historical metadata and does not grant access under the new owner policy.

| Project ID | Name | Project number | Created UTC | Last modified UTC | Image counts M / I | Historical isPublic | Plan ownerUid (unchanged) |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| cmvh5b97y00025guyv7jefm3t | Project 1 | 1 | 2026-10-20T20:38:30.768Z | 2026-10-20T20:43:39.024Z | 0 / 0 | false | null |
| cmvh5hwfh00045guyq5ik93eq | Project 2 | 2 | 2026-10-20T20:43:40.782Z | 2026-10-21T07:42:58.093Z | 0 / 0 | false | null |
| cmvht27jd0000m0uylzzqxrem | Project 3 | 3 | 2026-10-21T07:43:19.465Z | 2026-10-21T07:57:55.346Z | 0 / 0 | false | null |
| cmvhtlb0o0003m0uyylqeghtg | Project 4 | 4 | 2026-10-21T07:58:10.440Z | 2026-10-22T05:03:20.746Z | 2 / 0 | false | null |
| cmvj315os0002y4uylrjws5dc | Project 5 | 5 | 2026-10-22T05:10:12.748Z | 2026-10-22T05:10:15.634Z | 0 / 0 | false | null |

## Owner confirmation worksheet - leave blank until verified

For each row, confirm the actual project owner from your own records, known project content, or a separately authorized read-only backup review. Do not infer ownership from project order, name, creation date, or whoever is logged in now. One account may own multiple projects only after explicit confirmation for each row. Leave uncertain rows blank.

| Project ID | Name | Confirmed actual owner (your reference) | Verified Firebase UID | Confirmed by / date | Evidence or unresolved notes |
| --- | --- | --- | --- | --- | --- |
| cmvh5b97y00025guyv7jefm3t | Project 1 |  |  |  |  |
| cmvh5hwfh00045guyq5ik93eq | Project 2 |  |  |  |  |
| cmvht27jd0000m0uylzzqxrem | Project 3 |  |  |  |  |
| cmvhtlb0o0003m0uyylqeghtg | Project 4 |  |  |  |  |
| cmvj315os0002y4uylrjws5dc | Project 5 |  |  |  |  |

These blank fields are human review notes, not executable assignments. Completing this worksheet does not update `project-owner-assignment-plan.json` or the database. Keep your completed worksheet private; account references and UIDs are personal identifiers.

## Verify a Firebase UID

1. Open Firebase Console and explicitly select Firebase project `openui-original`. This is different from the Neon project named `openui-production`.
2. Open Authentication > Users. Find the intended account by its login identifier and inspect the sign-in provider. Copy the **Firebase User UID** from that account's entry; do not use a Google provider-specific UID, email address, API key, or token.
3. For your own account, sign in normally to OpenUI and open Chrome DevTools > Network. Inspect only the response JSON of the successful POST `/api/auth/session`: its `uid` comes from server-verified Firebase authentication. Match it exactly to the Firebase Console UID. Do not copy the request token, cookies, headers, or a full network/HAR export. No manual authenticated request is required.
4. A successful existing-session response can corroborate the UID, but it does not prove ownership of all imported projects. Confirm each project's owner separately. If the current app cannot establish a session, use the Console record and leave the app cross-check pending; do not apply a migration merely to perform this review.
5. If multiple accounts/providers appear, stop and determine which exact Firebase user record is intended. Do not delete/recreate or link accounts as part of this worksheet.

Reference: [Firebase: manage users and distinguish Firebase UID from provider profile IDs](https://firebase.google.com/docs/auth/web/manage-users).

## Approval boundary

After all intended assignments are confirmed, review the explicit project-ID-to-UID mapping privately. Any unknown owner remains unassigned. A later operation must separately verify target identity/current ownership, obtain approval, apply the additive schema if needed, and assign only confirmed rows with conflict checks. This report authorizes none of those operations. Existing backups, image assets, encrypted settings, keys, and all owner values remain unchanged.
