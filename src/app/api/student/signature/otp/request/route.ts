/**
 * POST /api/student/signature/otp/request
 * Sends a one-time password to the student's registered mobile so they can
 * authenticate applying their saved signature to a form.
 * Body: { formTemplateId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms, isDevSms } from "@/lib/sms";
import {
  generateOtp,
  hashOtp,
  maskMobile,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
} from "@/lib/otp";
import { getIpAddress } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const { formTemplateId } = (await req.json()) as { formTemplateId?: string };
    if (!formTemplateId) {
      return NextResponse.json({ success: false, error: "formTemplateId required" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    if (!student.mobile || student.mobile.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_MOBILE",
          error:
            "No registered mobile number is on file. Please contact the Admissions Office.",
        },
        { status: 400 }
      );
    }

    // Require a signature captured earlier (the Registration form) to reuse.
    const masterCount = await prisma.signature.count({
      where: { studentId, formTemplateId: { not: formTemplateId } },
    });
    if (masterCount === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_MASTER",
          error: "Please add your signature on the Student Registration Form first.",
        },
        { status: 409 }
      );
    }

    // Cooldown: block rapid re-requests.
    const recent = await prisma.signatureOtp.findFirst({
      where: { studentId, formTemplateId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000
      );
      return NextResponse.json(
        { success: false, code: "COOLDOWN", error: `Please wait ${wait}s before requesting another OTP.` },
        { status: 429 }
      );
    }

    // Invalidate previous un-consumed OTPs for this form.
    await prisma.signatureOtp.updateMany({
      where: { studentId, formTemplateId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    await prisma.signatureOtp.create({
      data: {
        studentId,
        formTemplateId,
        codeHash: hashOtp(code),
        destination: maskMobile(student.mobile),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const message = `${code} is your Rathinam Anugraha 2026 signature OTP. Valid for 5 minutes. Do not share it with anyone.`;
    const sms = await sendSms(student.mobile, message);

    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "SIGNATURE_OTP_SENT",
        entityType: "Signature",
        entityId: formTemplateId,
        metadata: { provider: sms.provider, delivered: sms.delivered },
        ipAddress: getIpAddress(req),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        maskedMobile: maskMobile(student.mobile),
        // In local dev with no SMS gateway, surface the code so you can test.
        devCode: isDevSms() ? code : undefined,
      },
    });
  } catch (error) {
    console.error("[signature otp request]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
