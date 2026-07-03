/**
 * POST /api/student/signature/otp/verify
 * Verifies the OTP and, on success, applies the student's saved signature
 * (captured on the Registration form) — and the parent's, auto-reused — to
 * the given form. No re-drawing or uploading required.
 * Body: { formTemplateId, code }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { getIpAddress } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const { formTemplateId, code, roles } = (await req.json()) as {
      formTemplateId?: string;
      code?: string;
      roles?: string[];
    };
    if (!formTemplateId || !code) {
      return NextResponse.json({ success: false, error: "formTemplateId and code required" }, { status: 400 });
    }

    const otp = await prisma.signatureOtp.findFirst({
      where: { studentId, formTemplateId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        { success: false, code: "NO_OTP", error: "No active OTP. Please request a new one." },
        { status: 400 }
      );
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      await prisma.signatureOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return NextResponse.json(
        { success: false, code: "EXPIRED", error: "This OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }
    if (otp.attempts >= otp.maxAttempts) {
      await prisma.signatureOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return NextResponse.json(
        { success: false, code: "LOCKED", error: "Too many attempts. Please request a new OTP." },
        { status: 429 }
      );
    }

    const matches = hashOtp(code.trim()) === otp.codeHash;
    if (!matches) {
      const updated = await prisma.signatureOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      const attemptsLeft = Math.max(0, otp.maxAttempts - updated.attempts);
      if (attemptsLeft === 0) {
        await prisma.signatureOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      }
      return NextResponse.json(
        {
          success: false,
          code: "MISMATCH",
          error: attemptsLeft > 0 ? `Incorrect OTP. ${attemptsLeft} attempt(s) left.` : "Incorrect OTP. Please request a new one.",
          attemptsLeft,
        },
        { status: 400 }
      );
    }

    // ── OTP correct: apply the master signature(s) to this form ──────────────
    await prisma.signatureOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const allMasters = await prisma.signature.findMany({
      where: { studentId, formTemplateId: { not: formTemplateId } },
      orderBy: { signedAt: "asc" },
      distinct: ["signatoryRole"],
    });

    // Apply only the saved signatures relevant to this form's signatory roles.
    const masters =
      roles && roles.length
        ? allMasters.filter((m) => roles.includes(m.signatoryRole))
        : allMasters;

    if (masters.length === 0) {
      return NextResponse.json(
        { success: false, code: "NO_MASTER", error: "No saved signature to apply. Please sign the Registration form first." },
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
        action: "SIGNATURE_APPLIED_VIA_OTP",
        entityType: "Signature",
        entityId: formTemplateId,
        metadata: { roles: Object.keys(applied), method: "MOBILE_OTP" },
        ipAddress: ip,
      },
    });

    return NextResponse.json({ success: true, data: { signatures: applied } });
  } catch (error) {
    console.error("[signature otp verify]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
