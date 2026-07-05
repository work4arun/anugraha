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

interface CsvRow {
  [key: string]: string | undefined;
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

  for (const row of students) {
    const regNo = pick(row, "reg_no", "Reg No", "regNo", "Reg. No.", "register_no").toUpperCase();
    const name = pick(row, "name", "Name", "student_name", "Student Name");
    const email = pick(row, "email", "Email") || null;
    const mobile = pick(row, "mobile", "Mobile", "phone", "Phone") || null;
    const username = (pick(row, "username", "Username") || regNo).toUpperCase();
    const providedPassword = pick(row, "password", "Password");

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

    const password = providedPassword || generatePassword(10);
    const hash = await bcrypt.hash(password, 10);

    try {
      const existing = await prisma.student.findUnique({ where: { regNo } });

      // Batch independence: a student belongs to exactly ONE batch. Never
      // silently move a student between batches during import — that is how
      // "duplicated" batches ended up sharing (stealing) the original batch's
      // rows. If the reg no already lives in a different batch, report a
      // conflict so the admin resolves it deliberately.
      if (existing && existing.batchId !== resolvedBatchId) {
        skipped++;
        errors.push(
          `${regNo}: already enrolled in another batch — not moved. ` +
            `Remove them there first (or use a different reg no) if this is intentional.`
        );
        continue;
      }

      await prisma.student.upsert({
        where: { regNo },
        update: {
          name,
          email: email ?? undefined,
          mobile: mobile ?? undefined,
          username,
          // Only overwrite the password when the admin explicitly provided one.
          ...(providedPassword
            ? { passwordHash: hash, mustResetPassword: false }
            : {}),
        },
        create: {
          regNo,
          name,
          email,
          mobile,
          username,
          passwordHash: hash,
          mustResetPassword: providedPassword ? false : true,
          batchId: resolvedBatchId,
        },
      });

      if (existing) updated++;
      else created++;
      results.push({
        regNo,
        name,
        username,
        password: providedPassword ? "(set by you)" : password,
        action: existing ? "updated" : "created",
      });
    } catch (e) {
      skipped++;
      errors.push(`${regNo}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

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
