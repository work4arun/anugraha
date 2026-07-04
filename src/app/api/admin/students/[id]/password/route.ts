/**
 * POST /api/admin/students/[id]/password
 * Lets an admin set a new login password for a student.
 * Body: { password: string }
 *
 * The student is not forced to reset it again (mustResetPassword=false), so the
 * admin can hand over the exact password they set.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { password } = (await req.json()) as { password?: string };
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({ where: { id: params.id } });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.student.update({
      where: { id: params.id },
      data: { passwordHash, mustResetPassword: false },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        studentId: params.id,
        actorType: "admin",
        action: "STUDENT_PASSWORD_RESET",
        entityType: "Student",
        entityId: params.id,
        ipAddress: getIpAddress(req),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student password reset]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
