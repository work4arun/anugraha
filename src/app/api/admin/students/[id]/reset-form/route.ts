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
import { getManagedStudent } from "@/lib/authz";
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
    const { formTemplateId } = (await req.json()) as { formTemplateId?: string };
    if (!formTemplateId) {
      return NextResponse.json(
        { success: false, error: "formTemplateId required" },
        { status: 400 }
      );
    }

    const check = await getManagedStudent(session, params.id);
    if (!check.student) {
      if (check.error === "FORBIDDEN") {
        return NextResponse.json(
          { success: false, error: "You can only manage students in batches you created" },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    const student = check.student;

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
      // The previously generated "final" PDF (if any) now reflects stale
      // data for this form — clear it so it isn't handed out as final until
      // regenerated from the corrected submission.
      ...(student.pdfUrl
        ? [prisma.student.update({ where: { id: params.id }, data: { pdfUrl: null, pdfGeneratedAt: null } })]
        : []),
    ]);

    await recalculateStudentProgress(params.id);

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
