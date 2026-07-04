/**
 * POST /api/admin/change-password
 * Lets the currently signed-in admin (any role) change their own password.
 * Body: { currentPassword: string, newPassword: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Current and new password are required" },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
    if (!admin) {
      return NextResponse.json({ success: false, error: "Admin not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash } });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        actorType: "admin",
        action: "ADMIN_PASSWORD_CHANGED",
        entityType: "Admin",
        entityId: admin.id,
        ipAddress: getIpAddress(req),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin change-password]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
