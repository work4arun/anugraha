/**
 * POST /api/student/signature/apply
 * Applies the student's saved signature(s) — captured on the Registration form —
 * to the given form. No OTP: the student is already authenticated by their
 * session, so a single confirming click applies the signature.
 * Body: { formTemplateId, roles? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const { formTemplateId, roles } = (await req.json()) as {
      formTemplateId?: string;
      roles?: string[];
    };
    if (!formTemplateId) {
      return NextResponse.json({ success: false, error: "formTemplateId required" }, { status: 400 });
    }

    // Load the most recent saved signature per role from any OTHER form.
    const allMasters = await prisma.signature.findMany({
      where: { studentId, formTemplateId: { not: formTemplateId } },
      orderBy: { signedAt: "desc" },
      distinct: ["signatoryRole"],
    });

    const masters =
      roles && roles.length
        ? allMasters.filter((m) => roles.includes(m.signatoryRole))
        : allMasters;

    if (masters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_MASTER",
          error: "No saved signature to apply. Please sign the Registration form first.",
        },
        { status: 409 }
      );
    }

    const ip = getIpAddress(req);
    const ua = req.headers.get("user-agent") ?? undefined;
    const applied: Record<string, string> = {};

    for (const m of masters) {
      await prisma.signature.upsert({
        where: {
          studentId_formTemplateId_signatoryRole: {
            studentId,
            formTemplateId,
            signatoryRole: m.signatoryRole,
          },
        },
        update: { imageUrl: m.imageUrl, imageHash: m.imageHash, ipAddress: ip, userAgent: ua, signedAt: new Date() },
        create: {
          studentId,
          formTemplateId,
          signatoryRole: m.signatoryRole,
          imageUrl: m.imageUrl,
          imageHash: m.imageHash,
          ipAddress: ip,
          userAgent: ua,
        },
      });
      applied[m.signatoryRole] = m.imageUrl;
    }

    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "SIGNATURE_APPLIED",
        entityType: "Signature",
        entityId: formTemplateId,
        metadata: { roles: Object.keys(applied), method: "DIRECT" },
        ipAddress: ip,
      },
    });

    return NextResponse.json({ success: true, data: { signatures: applied } });
  } catch (error) {
    console.error("[signature apply]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
