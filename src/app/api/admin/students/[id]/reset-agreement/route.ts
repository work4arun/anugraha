/**
 * POST /api/admin/students/[id]/reset-agreement
 * Lets an admin reopen a student's signed agreement so they can correct
 * mistakes and re-sign.
 *
 * Body: { agreementTemplateId: string }
 *
 * Behaviour:
 *  - The signed agreement record is reverted to PENDING (signedPdfUrl and
 *    signedAt cleared). Unlike form responses, agreements don't keep a
 *    separate copy of typed field values outside the stamped PDF, so the
 *    student re-enters and re-signs the agreement from scratch.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";
import { recalculateStudentProgress } from "@/lib/progress";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agreementTemplateId } = (await req.json()) as { agreementTemplateId?: string };
    if (!agreementTemplateId) {
      return NextResponse.json(
        { success: false, error: "agreementTemplateId required" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({ where: { id: params.id } });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const record = await prisma.signedAgreement.findUnique({
      where: { studentId_agreementTemplateId: { studentId: params.id, agreementTemplateId } },
    });
    if (!record) {
      return NextResponse.json(
        { success: false, error: "This student has not signed this agreement" },
        { status: 404 }
      );
    }

    await prisma.signedAgreement.update({
      where: { studentId_agreementTemplateId: { studentId: params.id, agreementTemplateId } },
      data: { status: "PENDING", signedPdfUrl: null, signedAt: null },
    });

    // This agreement is pending again — the student can no longer be
    // considered COMPLETED, even if their status said so a moment ago. The
    // previously generated "final" PDF (if any) included the now-cleared
    // signed copy, so it's stale — clear it until regenerated.
    await recalculateStudentProgress(params.id);
    if (student.pdfUrl) {
      await prisma.student.update({
        where: { id: params.id },
        data: { pdfUrl: null, pdfGeneratedAt: null },
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        studentId: params.id,
        actorType: "admin",
        action: "AGREEMENT_RESET",
        entityType: "SignedAgreement",
        entityId: record.id,
        ipAddress: getIpAddress(req),
        metadata: { agreementTemplateId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agreement reset]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
