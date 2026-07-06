/**
 * POST /api/admin/students/[id]/reset-all-agreements
 * Lets an admin reopen ALL of a student's signed/partially-signed agreements
 * in one action, mirroring reset-all (which does the same for forms), so the
 * admin doesn't have to reset each agreement one at a time.
 *
 * Behaviour (mirrors the single-agreement reset in ./reset-agreement,
 * applied to every non-PENDING agreement for this student):
 *  - Every PARTIAL/COMPLETED signed agreement is reverted to PENDING
 *    (signedPdfUrl and signedAt cleared). Agreements don't keep a separate
 *    copy of typed field values outside the stamped PDF, so the student
 *    re-enters and re-signs from scratch.
 *  - The student's overall progress/status is recalculated.
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
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        signedAgreements: { where: { status: { not: "PENDING" } } },
      },
    });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    if (student.signedAgreements.length === 0) {
      return NextResponse.json(
        { success: false, error: "This student has no signed agreements to reset" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      // Reopen every signed/partial agreement for re-signing.
      prisma.signedAgreement.updateMany({
        where: { studentId: params.id, status: { not: "PENDING" } },
        data: { status: "PENDING", signedPdfUrl: null, signedAt: null },
      }),
      // The previously generated "final" PDF (if any) included the
      // now-cleared signed copies — clear it until regenerated.
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
        action: "STUDENT_ALL_AGREEMENTS_RESET",
        entityType: "Student",
        entityId: params.id,
        ipAddress: getIpAddress(req),
        metadata: { agreementTemplateIds: student.signedAgreements.map((a) => a.agreementTemplateId) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student reset all agreements]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
