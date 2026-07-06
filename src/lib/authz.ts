/**
 * Authorization helpers for admin roles.
 *
 * Role model (see AdminRole in schema.prisma):
 *   SUPER_ADMIN — can create/manage admin accounts and edit/delete ANY batch.
 *   ADMIN       — can create batches; may edit/delete only batches they created.
 *   STAFF       — same batch rules as ADMIN (create own, edit own only).
 *
 * "Ownership" of a batch is tracked via Batch.createdById.
 */

import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "STAFF";

/** True when the session belongs to a signed-in admin (any role). */
export function isAdmin(session: Session | null): session is Session {
  return !!session && session.user.userType === "admin";
}

/** True only for SUPER_ADMIN. */
export function isSuperAdmin(session: Session | null): boolean {
  return isAdmin(session) && session.user.role === "SUPER_ADMIN";
}

/**
 * Can this admin edit / delete the given batch?
 * SUPER_ADMIN may manage every batch; everyone else only their own.
 * A batch with no owner (legacy data) is manageable only by a SUPER_ADMIN.
 */
export function canManageBatch(
  session: Session | null,
  batch: { createdById: string | null }
): boolean {
  if (!isAdmin(session)) return false;
  if (session.user.role === "SUPER_ADMIN") return true;
  return batch.createdById != null && batch.createdById === session.user.id;
}

/**
 * Convenience server-side guard. Returns the admin session, or null if the
 * current request is not an authenticated admin.
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  return isAdmin(session) ? session : null;
}

/**
 * Load a student together with their batch ownership and check whether the
 * given admin session may manage them (same rule as batch management).
 *
 * Returns:
 *   { student }          — allowed
 *   { error: "NOT_FOUND" }  — no such student
 *   { error: "FORBIDDEN" }  — student exists but belongs to another admin's batch
 */
export async function getManagedStudent(
  session: Session | null,
  studentId: string
): Promise<
  | { student: NonNullable<Awaited<ReturnType<typeof findStudentWithBatch>>>; error?: undefined }
  | { student?: undefined; error: "NOT_FOUND" | "FORBIDDEN" }
> {
  const student = await findStudentWithBatch(studentId);
  if (!student) return { error: "NOT_FOUND" };
  if (!canManageBatch(session, student.batch)) return { error: "FORBIDDEN" };
  return { student };
}

async function findStudentWithBatch(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    include: { batch: { select: { id: true, createdById: true } } },
  });
}
