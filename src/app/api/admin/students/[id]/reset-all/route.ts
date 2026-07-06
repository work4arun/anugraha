/**
 * POST /api/admin/students/[id]/reset-all
 * Lets an admin reopen ALL of a student's induction in one action — every
 * submitted form AND every signed/partial agreement — instead of having to
 * use the forms reset and the agreements reset separately. (Agreements are
 * the final step of induction; leaving them out here is how a student could
 * previously end up "reset" on paper but still fully signed underneath.)
 *
 * Behaviour (mirrors the single-form reset in ./reset-form and the
 * agreements-only reset in ./reset-all-agreements, applied together):
 *  - Every SUBMITTED form response is reverted to DRAFT (submittedAt cleared).
 *    Typed answers are KEPT so the student only edits what's wrong.
 *  - All signatures and per-row acknowledgments for this student are cleared,
 *    so corrected forms are re-signed / re-acknowledged (integrity).
 *  - Every PARTIAL/COMPLETED signed agreement is reverted to PENDING
 *    (signedPdfUrl and signedAt cleared), so the student re-signs from
 *    scratch.
 *  - The student's overall progress/status is recalculated.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";
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
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        formResponses: { where: { status: "SUBMITTED" } },
        signedAgreements: { where: { status: { not: "PENDING" } } },
        batch: { select: { id: true, createdById: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    if (!canManageBatch(session, student.batch)) {
      return NextResponse.json(
        { success: false, error: "You can only manage students in batches you created" },
        { status: 403 }
      );
    }

    if (student.formResponses.length === 0 && student.signedAgreements.length === 0) {
      return NextResponse.json(
        { success: false, error: "This student has no submitted forms or signed agreements to reset" },
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
      // Reopen every signed/partial agreement for re-signing.
      prisma.signedAgreement.updateMany({
        where: { studentId: params.id, status: { not: "PENDING" } },
        data: { status: "PENDING", signedPdfUrl: null, signedAt: null },
      }),
      // The previously generated "final" PDF (if any) now reflects stale
      // data — clear it so it isn't handed out as final until regenerated.
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
        action: "STUDENT_ALL_RESET",
        entityType: "Student",
        entityId: params.id,
        ipAddress: getIpAddress(req),
        metadata: {
          formTemplateIds: student.formResponses.map((r) => r.formTemplateId),
          agreementTemplateIds: student.signedAgreements.map((a) => a.agreementTemplateId),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student reset all]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
