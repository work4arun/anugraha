/**
 * POST /api/admin/students/bulk
 * Bulk-import students. Each row is matched to a batch so profiles stay in sync
 * with the batches you create.
 *
 * Body: { batchId?: string, students: CsvRow[] }
 *  - batchId (optional): default batch for rows that don't name one.
 *  - Each row may carry a `batch` column (batch name OR batch id) to route the
 *    student to a specific batch — handy for a single global upload.
 *
 * Recognised columns (header names are case-flexible):
 *   name | reg_no | username | password | email | mobile | batch
 *  - username defaults to reg_no when omitted.
 *  - password: if provided, it is used as-is (student won't be forced to reset);
 *    if omitted, a random password is generated and returned so you can share it.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generatePassword } from "@/lib/utils";
import { canManageBatch } from "@/lib/authz";

// Bulk imports hash a password per row (~80–100 ms each) — allow up to 5 min
// on platforms that honour it, and do the heavy work in parallel batches
// below so a 1,000-row CSV finishes in seconds, not minutes.
export const maxDuration = 300;

/** How many bcrypt hashes / DB upserts to run concurrently. */
const HASH_CONCURRENCY = 8;
const DB_CONCURRENCY = 10;

interface CsvRow {
  [key: string]: string | undefined;
}

/** Run `fn` over `items` with at most `limit` promises in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function pick(row: CsvRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { batchId: defaultBatchId, students } = (await req.json()) as {
    batchId?: string;
    students: CsvRow[];
  };

  if (!Array.isArray(students)) {
    return NextResponse.json({ success: false, error: "students array required" }, { status: 400 });
  }

  // Build batch lookups (by id and by name) — restricted to batches this admin
  // may manage, so nobody can import students into another admin's batch.
  const allBatches = await prisma.batch.findMany({
    select: { id: true, name: true, createdById: true },
  });
  const batches = allBatches.filter((b) => canManageBatch(session, b));
  const byId = new Map(batches.map((b) => [b.id, b.id]));
  const byName = new Map(batches.map((b) => [b.name.trim().toLowerCase(), b.id]));
  // Names shared by more than one batch are ambiguous — routing rows to
  // "whichever batch won the map" silently mixed student lists. Refuse those.
  const nameCounts = new Map<string, number>();
  for (const b of batches) {
    const k = b.name.trim().toLowerCase();
    nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
  }

  function resolveBatch(row: CsvRow): string | "AMBIGUOUS" | null {
    const v = pick(row, "batch", "Batch", "batch_id", "batchId", "Batch Name");
    if (v) {
      if (byId.has(v)) return v;
      const k = v.toLowerCase();
      if ((nameCounts.get(k) ?? 0) > 1) return "AMBIGUOUS";
      const id = byName.get(k);
      if (id) return id;
      return null; // named a batch we couldn't find
    }
    return defaultBatchId ?? null;
  }

  const results: Array<{ regNo: string; name: string; username: string; password: string; action: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const unmatchedBatches = new Set<string>();
  const errors: string[] = [];

  // ── Phase 1: parse + validate every row up front (cheap, synchronous) ──
  interface PreparedRow {
    regNo: string;
    name: string;
    email: string | null;
    mobile: string | null;
    username: string;
    providedPassword: string;
    password: string;
    batchId: string;
  }

  const preparedByRegNo = new Map<string, PreparedRow>();

  for (const row of students) {
    const regNo = pick(row, "reg_no", "Reg No", "regNo", "Reg. No.", "register_no").toUpperCase();
    const name = pick(row, "name", "Name", "student_name", "Student Name");

    if (!regNo || !name) {
      skipped++;
      continue;
    }

    const resolvedBatchId = resolveBatch(row);
    if (resolvedBatchId === "AMBIGUOUS") {
      skipped++;
      errors.push(
        `${regNo}: batch name "${pick(row, "batch", "Batch")}" matches more than one batch — use the batch id instead.`
      );
      continue;
    }
    if (!resolvedBatchId) {
      skipped++;
      const named = pick(row, "batch", "Batch");
      if (named) unmatchedBatches.add(named);
      continue;
    }

    // Duplicate reg nos inside one CSV: the last row wins (same final state
    // as the old sequential import), earlier ones are counted as skipped.
    if (preparedByRegNo.has(regNo)) {
      skipped++;
      errors.push(`${regNo}: appears more than once in the file — kept the last occurrence.`);
    }

    const providedPassword = pick(row, "password", "Password");
    preparedByRegNo.set(regNo, {
      regNo,
      name,
      email: pick(row, "email", "Email") || null,
      mobile: pick(row, "mobile", "Mobile", "phone", "Phone") || null,
      username: (pick(row, "username", "Username") || regNo).toUpperCase(),
      providedPassword,
      password: providedPassword || generatePassword(10),
      batchId: resolvedBatchId,
    });
  }

  const prepared = Array.from(preparedByRegNo.values());

  // ── Phase 2: one query for all existing students (instead of one per row) ──
  const existingRows = await prisma.student.findMany({
    where: { regNo: { in: prepared.map((p) => p.regNo) } },
    select: { regNo: true, batchId: true },
  });
  const existingByRegNo = new Map(existingRows.map((s) => [s.regNo, s]));

  // Batch independence: a student belongs to exactly ONE batch. Never
  // silently move a student between batches during import — that is how
  // "duplicated" batches ended up sharing (stealing) the original batch's
  // rows. If the reg no already lives in a different batch, report a
  // conflict so the admin resolves it deliberately.
  const importable = prepared.filter((p) => {
    const existing = existingByRegNo.get(p.regNo);
    if (existing && existing.batchId !== p.batchId) {
      skipped++;
      errors.push(
        `${p.regNo}: already enrolled in another batch — not moved. ` +
          `Remove them there first (or use a different reg no) if this is intentional.`
      );
      return false;
    }
    return true;
  });

  // ── Phase 3: hash passwords in parallel (the former per-row bottleneck) ──
  const hashes = await mapWithConcurrency(importable, HASH_CONCURRENCY, (p) =>
    bcrypt.hash(p.password, 10)
  );

  // ── Phase 4: upsert in parallel batches, collecting per-row failures ──
  await mapWithConcurrency(importable, DB_CONCURRENCY, async (p, i) => {
    const existing = existingByRegNo.get(p.regNo);
    try {
      await prisma.student.upsert({
        where: { regNo: p.regNo },
        update: {
          name: p.name,
          email: p.email ?? undefined,
          mobile: p.mobile ?? undefined,
          username: p.username,
          // Only overwrite the password when the admin explicitly provided one.
          ...(p.providedPassword
            ? { passwordHash: hashes[i], mustResetPassword: false }
            : {}),
        },
        create: {
          regNo: p.regNo,
          name: p.name,
          email: p.email,
          mobile: p.mobile,
          username: p.username,
          passwordHash: hashes[i],
          mustResetPassword: p.providedPassword ? false : true,
          batchId: p.batchId,
        },
      });

      if (existing) updated++;
      else created++;
      results.push({
        regNo: p.regNo,
        name: p.name,
        username: p.username,
        password: p.providedPassword ? "(set by you)" : p.password,
        action: existing ? "updated" : "created",
      });
    } catch (e) {
      skipped++;
      errors.push(`${p.regNo}: ${e instanceof Error ? e.message : "failed"}`);
    }
  });

  // Parallel processing shuffles completion order — keep the returned
  // credential list deterministic for the admin.
  results.sort((a, b) => a.regNo.localeCompare(b.regNo));

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      actorType: "admin",
      action: "STUDENTS_BULK_IMPORTED",
      entityType: defaultBatchId ? "Batch" : "System",
      entityId: defaultBatchId ?? "global-import",
      metadata: { created, updated, skipped, total: students.length },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      created,
      updated,
      skipped,
      total: students.length,
      unmatchedBatches: Array.from(unmatchedBatches),
      errors: errors.slice(0, 20),
      credentials: results,
    },
  });
}
