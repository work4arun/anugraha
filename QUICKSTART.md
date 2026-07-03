# Rathinam MyDayOne — Quickstart

## Prerequisites
- Node.js 20+
- Docker Desktop (for local PostgreSQL + MinIO)
- npm or pnpm

---

## 1. Clone & install

```bash
cd rathinam-mydayone
npm install
```

---

## 2. Start infrastructure

```bash
# Starts PostgreSQL (port 5432) + MinIO (port 9000/9001)
docker compose up -d
```

MinIO Console: http://localhost:9001 (user: minioadmin / password: minioadmin)
pgAdmin (optional): `docker compose --profile tools up -d`

---

## 3. Configure environment

```bash
cp .env.example .env
# Edit .env if needed — defaults work with docker compose out of the box
```

---

## 4. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to local database
npm run db:push

# Seed with institutions, batch, templates, and test student
npm run db:seed
```

---

## 5. Start the app

```bash
npm run dev
# → http://localhost:3000
```

---

## 6. Test logins

| Role     | URL                    | Username / Email        | Password   |
|----------|------------------------|-------------------------|------------|
| Student  | http://localhost:3000/login       | `TEST001`               | `Test@1234` |
| Admin    | http://localhost:3000/admin/login | `admin@rathinam.in`     | `Admin@1234` |

---

## 7. Student flow to test

1. Login as `TEST001` → Dashboard with checklist
2. Start "Student Registration Form" → fill fields + **draw signature once** (this is the master signature)
3. "Code of Conduct" → read clauses + acknowledge → **Send OTP → verify** to apply your saved signature
4. "Placement Undertaking" → read + acknowledge → **OTP sign** (parent signature auto-reused)
5. "Deliverables Table" → tap each of 12 rows to acknowledge → **OTP sign**
6. "Document Upload" → upload test images for each doc type
7. Review screen → "Confirm & Generate PDF"
8. Complete screen → Download PDF

### Signatures & OTP

- The signature is **captured once** (drawn) on the Registration form — no photo uploads.
- Every later form reuses that signature; the student authenticates by entering a
  **6-digit OTP** sent to their registered mobile.
- **Local dev:** with no `SMS_PROVIDER` set, the OTP is printed to the server console
  and shown in the UI so you can test without an SMS gateway. Configure `SMS_PROVIDER`
  (MSG91 / Fast2SMS / Twilio) in `.env` for production — see `.env.example`.

> **Schema changed** — the OTP feature adds a `SignatureOtp` table. After pulling,
> re-run `npm run db:generate && npm run db:push` before `npm run dev`.

---

## 8. Brand customisation

**When you share the Rathinam logo and brand colors:**

1. `tailwind.config.ts` — update `brand.DEFAULT` and `accent.DEFAULT` hex values
2. `src/app/globals.css` — update `--color-brand` and `--color-accent` CSS variables
3. Replace the `<GraduationCap>` placeholder in login and header with your actual SVG logo
4. Update institution colors in the DB:
   ```sql
   UPDATE institutions SET primary_color = '#YOUR_HEX', accent_color = '#YOUR_HEX2'
   WHERE code IN ('RTC', 'RGU');
   ```

---

## 9. Deploy to production

### Environment
- Set `STORAGE_PROVIDER=s3` and fill in S3/Cloudflare R2 credentials
- Set `DATABASE_URL` to your hosted PostgreSQL (Neon, Supabase, Railway, etc.)
- Set `NEXTAUTH_SECRET` to a secure random string: `openssl rand -base64 32`
- Set `NEXTAUTH_URL` to your production domain
- Puppeteer: on Vercel, use `puppeteer-core` + `@sparticuz/chromium`; on a Node server, Puppeteer works out of the box

### Vercel deployment notes
- Add `PUPPETEER_EXECUTABLE_PATH` pointing to the chromium binary
- The `serverExternalPackages` config in `next.config.ts` is already set for Puppeteer

---

## Project structure

```
src/
├── app/
│   ├── (auth)/login/           Student login
│   ├── (student)/              All student-facing pages
│   │   ├── dashboard/          Checklist + progress
│   │   ├── induction/[stepSlug] Dynamic form renderer
│   │   ├── review/             Pre-submission review
│   │   └── complete/           Download PDF
│   ├── (admin)/admin/          Admin panel
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── batches/[id]/       Roster + bulk import
│   │   ├── students/[id]/      Student detail + doc review
│   │   └── templates/          Form template list
│   └── api/                    REST API routes
├── components/
│   ├── ui/                     Button, Input, Card, Badge, etc.
│   ├── signature/              SignatureCanvas (touch-first)
│   ├── upload/                 DocumentUpload (camera-first)
│   ├── forms/                  4 form type renderers
│   ├── student/                Dashboard, InductionStep, Review clients
│   └── admin/                  Admin page clients
├── lib/
│   ├── auth.ts                 NextAuth config (student + admin credentials)
│   ├── motion.ts               Framer Motion variant library
│   ├── pdf.ts                  Puppeteer PDF generation
│   ├── prisma.ts               Prisma singleton
│   ├── storage.ts              S3-abstracted file storage
│   ├── student.ts              Server-side student data helpers
│   └── utils.ts                Utility functions
├── middleware.ts                Route protection
└── types/index.ts              Shared TypeScript types
prisma/
├── schema.prisma               Full DB schema
└── seed.ts                     Seed with all templates from Document A & B
```

---

## What's in the seed (ready to use Day 1)

- **RTC** + **RGU** institutions
- **Batch**: RTC B.E./B.Tech 2024-25
- **5 form templates** (in order):
  1. Student Registration Form (all fields from Document A)
  2. General Student Code of Conduct (16 clauses)
  3. General Placement Undertaking (14 clauses)
  4. R-Smart Intellect Deliverables — B.E./B.Tech (12 rows with per-row ack)
  5. Document Upload (photo, 10th mark sheet, 12th mark sheet, Aadhaar)
- **Test student**: TEST001 / Test@1234
- **Super admin**: admin@rathinam.in / Admin@1234

---

## What's next (Phase 2)

- [ ] No-code template editor (add/edit/reorder clauses and deliverable rows)
- [ ] Batch creation UI (currently via DB seed)
- [ ] SMS/email credential dispatch after bulk import
- [ ] RAALE / CPA / Growth Card integration
- [ ] Admin-initiated password reset for individual students
- [ ] Puppeteer → lighter PDF solution for Vercel (react-pdf or WeasyPrint)
