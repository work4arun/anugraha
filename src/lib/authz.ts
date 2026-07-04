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
