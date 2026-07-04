/**
 * POST /api/admin/students/[id]/reset-form
 * Lets an admin reopen a student's submitted form so they can correct wrong
 * data and resubmit.
 *
 * Body: { formTemplateId: string }
 *
 * Behaviour:
 *  - The form response is reverted to DRAFT (submittedAt cleared). The student's
 *    typed answers are KEPT so they only edit what's wrong.
 *  - Signatures and per-row acknowledgments for this form are cleared, so the
 *    student re-signs / re-acknowledges the corrected version (integrity).
 *  - The student's overall progress/status is recalculated.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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
    const { formTemplateId } = (await req.json()) as { formTemplateId?: string };
    if (!formTemplateId) {
      return NextResponse.json(
        { success: false, error: "formTemplateId required" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({ where: { id: params.id } });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const response = await prisma.studentFormResponse.findUnique({
      where: { studentId_formTemplateId: { studentId: params.id, formTemplateId } },
    });
    if (!response) {
      return NextResponse.json(
        { success: false, error: "This student has not submitted this form" },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      // Reopen the form for editing, keep the answers.
      prisma.studentFormResponse.update({
        where: { studentId_formTemplateId: { studentId: params.id, formTemplateId } },
        data: { status: "DRAFT", submittedAt: null },
      }),
      // Clear signatures so the corrected form is re-signed.
      prisma.signature.deleteMany({
        where: { studentId: params.id, formTemplateId },
      }),
      // Clear per-row acknowledgments (deliverables tables).
      prisma.deliverableRowAcknowledgment.deleteMany({
        where: { studentId: params.id, formTemplateId },
      }),
    ]);

    await recalculateProgress(params.id);

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        studentId: params.id,
        actorType: "admin",
        action: "STUDENT_FORM_RESET",
        entityType: "StudentFormResponse",
        entityId: response.id,
        ipAddress: getIpAddress(req),
        metadata: { formTemplateId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student form reset]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/** Recompute completion % and overall status from required, submitted forms. */
async function recalculateProgress(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: { include: { formAssignments: { where: { required: true } } } },
      formResponses: { select: { formTemplateId: true, status: true } },
    },
  });
  if (!student) return;

  const requiredTemplateIds = new Set(
    student.batch.formAssignments.map((a) => a.formTemplateId)
  );
  const submittedIds = new Set(
    student.formResponses
      .filter((r) => r.status === "SUBMITTED" && requiredTemplateIds.has(r.formTemplateId))
      .map((r) => r.formTemplateId)
  );

  const pct =
    requiredTemplateIds.size > 0
      ? Math.round((submittedIds.size / requiredTemplateIds.size) * 100)
      : 100;

  const newStatus =
    pct === 100 ? "COMPLETED" : submittedIds.size > 0 ? "IN_PROGRESS" : "NOT_STARTED";

  await prisma.student.update({
    where: { id: studentId },
    data: { completionPct: pct, status: newStatus },
  });
}
