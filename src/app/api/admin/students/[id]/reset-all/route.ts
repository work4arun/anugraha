/**
 * POST /api/admin/students/[id]/reset-all
 * Lets an admin reopen ALL of a student's submitted forms in one action, so
 * the student can go back and modify anything instead of the admin having to
 * reset each form one at a time.
 *
 * Behaviour (mirrors the single-form reset in ./reset-form, applied to every
 * submitted form for this student):
 *  - Every SUBMITTED form response is reverted to DRAFT (submittedAt cleared).
 *    Typed answers are KEPT so the student only edits what's wrong.
 *  - All signatures and per-row acknowledgments for this student are cleared,
 *    so corrected forms are re-signed / re-acknowledged (integrity).
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
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        formResponses: { where: { status: "SUBMITTED" } },
      },
    });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    if (student.formResponses.length === 0) {
      return NextResponse.json(
        { success: false, error: "This student has no submitted forms to reset" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      // Reopen every submitted form for editing, keep the answers.
      prisma.studentFormResponse.updateMany({
        where: { studentId: params.id, status: "SUBMITTED" },
        data: { status: "DRAFT", submittedAt: null },
      }),
      // Clear all signatures so corrected forms are re-signed.
      prisma.signature.deleteMany({ where: { studentId: params.id } }),
      // Clear all per-row acknowledgments (deliverables tables).
      prisma.deliverableRowAcknowledgment.deleteMany({ where: { studentId: params.id } }),
    ]);

    await recalculateProgress(params.id);

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        studentId: params.id,
        actorType: "admin",
        action: "STUDENT_ALL_FORMS_RESET",
        entityType: "Student",
        entityId: params.id,
        ipAddress: getIpAddress(req),
        metadata: { formTemplateIds: student.formResponses.map((r) => r.formTemplateId) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student reset all forms]", error);
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
