# Bug scan — pre-launch review (1000s of students)

> **Update (2026-07-06 fix pass):** All remaining code-level issues are FIXED:
> - **7 (bulk import):** now parses/validates rows up front, fetches existing
>   students in ONE query, bcrypt-hashes in parallel (8-way), and upserts in
>   parallel batches (10-way) with per-row error capture. Duplicate reg nos in
>   one file keep the last row; `maxDuration = 300` exported.
> - **9 (rate limiting):** new `src/lib/rateLimit.ts` (in-memory fixed-window).
>   Both login providers now throttle: 5 attempts/account + 30/IP per 15 min
>   (counter cleared on successful login). ⚠️ In-memory — swap for Redis if the
>   app is ever run on more than one instance.
> - **10 (admin scoping):** `students/[id]/password`, `reset-form`,
>   `reset-agreement`, `reset-all`, `reset-all-agreements`, and
>   `documents/[id]/review` now all enforce `canManageBatch` (403 otherwise).
>   The review route also validates `status` against APPROVED/FLAGGED (was an
>   unvalidated cast → Prisma 500) and stamps `studentId` into the audit log.
> - **11 (deactivated admins):** the `jwt` callback re-checks `isActive` in the
>   DB every ≤5 min for admin tokens; revoked tokens yield a session no API
>   guard accepts, and middleware bounces `token.revoked` to login.
> - **12, 13 (OTP race / hashOtp fallback):** OBSOLETE — the OTP/SMS flow was
>   removed entirely; signature apply is session-based (`signature/apply`).
>   Issue 1 (SMS delivery) is obsolete for the same reason.
> - **14 (signature POST):** `/api/student/signature` now enforces a strict
>   `data:image/png;base64,` prefix, a 1.5 MB cap, PNG magic-byte verification
>   of the decoded buffer, and a role-length cap. (The agreement sign route
>   already had prefix+size checks.)
> - **generatePassword:** now uses Web Crypto `getRandomValues` with rejection
>   sampling (was `Math.random()`).
>
> Still open (infrastructure, not code): **15** — `getIpAddress` trusts
> `x-forwarded-for`; make sure the reverse proxy overwrites it. **16** —
> `STORAGE_PROVIDER=local` is single-instance only; move to S3/R2 + backups
> before scaling. Also do the load test + DB `connection_limit` items in the
> checklist below.
>
> `tsc --noEmit` → 0 errors after this pass.

> **Update (2026-07-05 re-scan):** Issues 1–6 are now FIXED in code (issue 6
> body template escaping completed — every interpolation in `buildPdfHtml` now
> goes through `escapeHtml`). Run `npx prisma db push && npx prisma generate`
> locally and restart to apply the Document unique constraint.
> **Still open: 7 (bulk import is still sequential), 9 (no rate limiting),
> 10 (admin scoping on student-level routes), 11 (deactivated admin JWT valid
> up to 8 h), 12 (OTP attempt race), 13 (hashOtp dev fallback), 14 (signature
> POST unbounded), 15 (x-forwarded-for), 16 (local storage on multi-instance).**
> Issue 8 (uploads path check + sync I/O) is fixed.
>
> New observations from the re-scan:
> - `generatePassword` (src/lib/utils.ts) uses `Math.random()` — predictable;
>   use `crypto.randomInt` for student passwords.
> - REGISTRATION sections in the final PDF print only "Form data captured
>   digitally" — the student's actual registration answers are not included.
>   Confirm this is intended.
> - Final PDF now auto-includes every active batch agreement (signed copy, or
>   stamped on-the-fly from saved signatures). Note auto-stamp leaves
>   checkbox/text answers blank if the student skipped the sign flow.

Typecheck passes (`tsc --noEmit` → 0 errors). The issues below are logic, security, and scale bugs found by reading every API route, lib, and the auth/middleware layer.

## Critical — fix before launch

### 1. OTP "sent" even when the SMS was never delivered
`src/app/api/student/signature/otp/request/route.ts` ignores `sms.delivered` and always returns `success: true`. Your `.env` has **no `SMS_PROVIDER` configured**, so in production `sendSms` returns `{delivered: false, error: "No SMS provider configured"}` — every student will see "OTP sent" and wait for a code that never arrives.
**Fix:** after `sendSms`, if `!sms.delivered && !isDevSms()`, return a 502 with a clear error. And set up MSG91/Fast2SMS/Twilio env vars before launch.

### 2. Chromium leak + unbounded concurrency in PDF generation
`src/lib/pdf.ts`: `browser.close()` is not in a `finally` — any error after launch (setContent timeout, upload failure) leaks a full Chromium process (~300–500 MB). Separately, every `/api/pdf` request launches its own Chromium. If even 20–30 students click "Generate PDF" at once, the server OOMs.
**Fix:** wrap in `try/finally { await browser.close() }`, and add a simple concurrency limiter (e.g. a semaphore of 2–3, or a queue) around `generateStudentPdf`.

### 3. Document upload accepts any file type → stored XSS via SVG
`src/app/api/student/document/route.ts` validates only size (10 MB). A student can upload an `.svg` (or any file), and `/api/uploads/[...path]` serves `.svg` **inline as `image/svg+xml` from your origin** — SVG can contain `<script>`, so an admin previewing it executes attacker JS with an admin session (full account takeover of the review flow).
**Fix:** whitelist mime + extension (`pdf,jpg,jpeg,png,webp` only) at upload; in the uploads route serve SVG (or everything) with `Content-Disposition: attachment` or add a `Content-Security-Policy: sandbox` header.

### 4. Form responses: no validation of `status`, template, or submitted-lock
`src/app/api/student/form-response/route.ts`:
- `status` comes straight from the client and is cast to the enum — any other string throws a Prisma error (500). Validate against `["DRAFT","SUBMITTED"]`.
- `formTemplateId` is never checked against the student's batch assignments — a student can create responses for any template ID.
- A `SUBMITTED` response can be overwritten or flipped back to `DRAFT` at any time — students can change answers after review. If that's not intended, reject updates when the stored status is `SUBMITTED` (or gate via admin reset only, which already exists at `reset-form`).

### 5. Duplicate document rows (race, no unique constraint)
`Document` has **no `@@unique([studentId, documentType])`** and the upload route does `findFirst` → create. A double-click uploads twice concurrently → both `findFirst`s see nothing → two rows for the same document type; admin review then shows/approves a stale one.
**Fix:** add the unique constraint + migrate, and switch to `upsert`.

## High

### 6. No HTML escaping in the PDF template
`buildPdfHtml` in `src/lib/pdf.ts` interpolates student names and form data directly into HTML (no `escapeHtml` anywhere). Any student typing `<` `>` `&` — or deliberately injecting markup — corrupts or forges content in the official, signed PDF.
**Fix:** run every interpolated string through an escape helper.

### 7. Bulk import will time out on large CSVs
`src/app/api/admin/students/bulk/route.ts` does a **sequential** `bcrypt.hash` (cost 10, ~80–100 ms) + 2 queries per row. A 1,000-row CSV ≈ 2–4 minutes in one HTTP request — it will die at proxy/`maxDuration` limits and leave a partial import with no resume.
**Fix:** chunk the import client-side (e.g. 100 rows/request — the import UI can loop), or hash with `Promise.all` in batches of ~10 and use `createMany`/transactions.

### 8. `/api/uploads` — path-prefix check bug + sync I/O
- `resolvedFilePath.startsWith(resolvedUploadDir)` passes for a sibling dir (`/srv/uploads-secret` matches `/srv/uploads`). Use `path.relative` and reject if it starts with `..`, or compare with `resolvedUploadDir + path.sep`.
- `fs.readFileSync` blocks the event loop for every file served. With thousands of students loading photos/PDFs, this serializes the whole server. Use `fs.promises.readFile` (or stream).

### 9. No rate limiting anywhere
- Login (both providers): unlimited password guesses; usernames are predictable reg numbers. Add per-IP + per-account throttling or lockout.
- OTP request: 30 s cooldown only, per form — no daily cap per student → SMS cost abuse.

## Medium

10. **Admin scoping gaps:** any admin/STAFF can reset any student's password (`students/[id]/password`), wipe their progress (`reset-all`, `reset-form`), and review documents in batches they don't own. Batch ownership (`canManageBatch`) exists but isn't applied to student-level admin routes.
11. **Deactivated admins keep access up to 8 h:** `isActive` is only checked at login; JWT stays valid. Check `isActive` in the `jwt`/`session` callback or shorten admin session lifetime.
12. **OTP verify attempt race:** the attempts check and increment aren't atomic — parallel requests can exceed `maxAttempts`. Use `updateMany({ where: { id, attempts: { lt: max } }, data: { attempts: { increment: 1 } } })` and check the affected count.
13. **`hashOtp` falls back to `"dev-otp-secret"`** when `OTP_SECRET`/`NEXTAUTH_SECRET` are missing — fail loudly in production instead.
14. **Signature POST body unbounded:** the base64 `dataUrl` isn't size-checked or verified to be a PNG. Cap length (~1 MB) and check the `data:image/png` prefix strictly.
15. **`getIpAddress` trusts `x-forwarded-for`** — audit-log IPs are spoofable unless your proxy overwrites the header (verify your reverse-proxy config does).
16. **`STORAGE_PROVIDER=local`:** fine on a single Docker VM, but breaks on serverless/multi-instance deploys and has no backup story. For thousands of students' documents, S3/R2 + backups is strongly recommended.

## Quick pre-launch checklist

- [x] ~~Configure a real SMS provider + fix issue 1~~ (obsolete — OTP flow removed)
- [x] `try/finally` + concurrency cap on Puppeteer (issue 2)
- [x] File-type whitelist + SVG serving fix (issue 3)
- [x] Validate `status`/template + lock submitted forms (issue 4)
- [x] Unique constraint on Document + upsert (issue 5)
- [x] Escape HTML in PDF template (issue 6)
- [x] Parallelized bulk import (issue 7)
- [x] Rate-limit login (issue 9 — OTP gone; in-memory limiter, single instance)
- [ ] Load test: 200–500 concurrent students on dashboard + form save
- [ ] Postgres connection pool sized for your instance (set `connection_limit` in `DATABASE_URL`)
- [ ] Database + uploads backup cron
