/**
 * /api/admin/admins/[adminId]  —  update a single admin (SUPER_ADMIN only)
 *   PATCH  — body may contain: { isActive?, role?, password? }
 *
 * Guards:
 *  - Only a SUPER_ADMIN may call this.
 *  - A super admin cannot deactivate or demote their own account (avoids lockout).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { adminId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.admin.findUnique({ where: { id: params.adminId } });
  if (!target) {
    return NextResponse.json({ success: false, error: "Admin not found" }, { status: 404 });
  }

  const isSelf = target.id === session.user.id;

  try {
    const body = (await req.json()) as {
      isActive?: boolean;
      role?: string;
      password?: string;
    };

    const data: Record<string, unknown> = {};

    if (typeof body.isActive === "boolean") {
      if (isSelf && body.isActive === false) {
        return NextResponse.json(
          { success: false, error: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }
      data.isActive = body.isActive;
    }

    if (body.role !== undefined) {
      const role = body.role as Role;
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
      }
      if (isSelf && role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { success: false, error: "You cannot change your own role" },
          { status: 400 }
        );
      }
      data.role = role;
    }

    if (body.password !== undefined) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    await prisma.admin.update({ where: { id: params.adminId }, data });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "ADMIN_UPDATED",
        entityType: "Admin",
        entityId: params.adminId,
        metadata: { changed: Object.keys(data) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
