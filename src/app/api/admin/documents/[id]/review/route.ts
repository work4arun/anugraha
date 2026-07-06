/**
 * POST /api/admin/documents/[id]/review
 * Approve or flag a student-uploaded document.
 * Body: { status: "APPROVED" | "FLAGGED", note?: string }
 *
 * Scoped: only admins who can manage the student's batch (creator or
 * SUPER_ADMIN) may review — same rule as batch management.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";

const VALID_STATUSES = ["APPROVED", "FLAGGED"] as const;
type ReviewStatus = (typeof VALID_STATUSES)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { status, note } = (await req.json()) as {
    status?: string;
    note?: string;
  };

  // Validate against the enum — an arbitrary string would otherwise reach
  // Prisma and blow up as a 500.
  if (!status || !VALID_STATUSES.includes(status as ReviewStatus)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      student: { include: { batch: { select: { id: true, createdById: true } } } },
    },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  if (!canManageBatch(session, existing.student.batch)) {
    return NextResponse.json(
      { success: false, error: "You can only review documents of students in batches you created" },
      { status: 403 }
    );
  }

  const doc = await prisma.document.update({
    where: { id: params.id },
    data: {
      reviewStatus: status as ReviewStatus,
      reviewNote: note ?? null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      studentId: existing.studentId,
      actorType: "admin",
      action: `DOCUMENT_${status}`,
      entityType: "Document",
      entityId: params.id,
      metadata: { note },
    },
  });

  return NextResponse.json({ success: true, data: doc });
}
