/**
 * /api/admin/students/[id]
 *   DELETE — permanently remove a student and everything tied to them
 *            (form responses, signatures, uploaded documents, deliverable
 *            acknowledgments, signed agreements).
 *
 * Restricted to the admin who created the student's batch, or any SUPER_ADMIN
 * — the same rule used for batch management (canManageBatch).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";
import { getIpAddress } from "@/lib/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: { batch: { select: { id: true, createdById: true } } },
  });
  if (!student) {
    return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
  }
  if (!canManageBatch(session, student.batch)) {
    return NextResponse.json(
      { success: false, error: "You can only delete students in batches you created" },
      { status: 403 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.signature.deleteMany({ where: { studentId: params.id } }),
      prisma.document.deleteMany({ where: { studentId: params.id } }),
      prisma.deliverableRowAcknowledgment.deleteMany({ where: { studentId: params.id } }),
      prisma.signedAgreement.deleteMany({ where: { studentId: params.id } }),
      prisma.studentFormResponse.deleteMany({ where: { studentId: params.id } }),
      // Keep audit history, but detach it from the student row we're removing.
      prisma.auditLog.updateMany({
        where: { studentId: params.id },
        data: { studentId: null },
      }),
      prisma.student.delete({ where: { id: params.id } }),
    ]);

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "STUDENT_DELETED",
        entityType: "Student",
        entityId: params.id,
        ipAddress: getIpAddress(req),
        metadata: { name: student.name, regNo: student.regNo, batchId: student.batchId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student DELETE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
