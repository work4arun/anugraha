/**
 * POST /api/student/reset-password
 * Lets an authenticated student set a new password on first login
 * (clears the mustResetPassword flag).
 * Body: { password: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

// At least 8 chars, one letter and one number.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const { password } = (await req.json()) as { password?: string };

    if (!password || !PASSWORD_RE.test(password)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password must be at least 8 characters and include a letter and a number.",
        },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 12);

    await prisma.student.update({
      where: { id: studentId },
      data: { passwordHash: hash, mustResetPassword: false },
    });

    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "PASSWORD_RESET",
        entityType: "Student",
        entityId: studentId,
        ipAddress: getIpAddress(req),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reset-password POST]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
