/**
 * /api/admin/batches/[batchId]
 *   PATCH  — edit batch fields (name, course, department, academicYear, isActive)
 *   DELETE — delete the batch (only when it has no students)
 *
 * Both are restricted to the admin who created the batch, or any SUPER_ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const batch = await prisma.batch.findUnique({ where: { id: params.batchId } });
  if (!batch) {
    return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
  }
  if (!canManageBatch(session, batch)) {
    return NextResponse.json(
      { success: false, error: "You can only edit batches you created" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      course?: string;
      department?: string | null;
      academicYear?: string;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.course === "string" && body.course.trim()) data.course = body.course.trim();
    if (body.department !== undefined) data.department = body.department?.trim() || null;
    if (typeof body.academicYear === "string" && body.academicYear.trim())
      data.academicYear = body.academicYear.trim();
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.batch.update({ where: { id: params.batchId }, data });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "BATCH_UPDATED",
        entityType: "Batch",
        entityId: params.batchId,
        metadata: { changed: Object.keys(data) },
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (error) {
    console.error("[batch PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const batch = await prisma.batch.findUnique({
    where: { id: params.batchId },
    include: { _count: { select: { students: true } } },
  });
  if (!batch) {
    return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
  }
  if (!canManageBatch(session, batch)) {
    return NextResponse.json(
      { success: false, error: "You can only delete batches you created" },
      { status: 403 }
    );
  }
  if (batch._count.students > 0) {
    return NextResponse.json(
      { success: false, error: "Remove all students before deleting this batch" },
      { status: 409 }
    );
  }

  // Clean up form-step assignments, then the batch itself.
  await prisma.batchFormAssignment.deleteMany({ where: { batchId: params.batchId } });
  await prisma.batch.delete({ where: { id: params.batchId } });

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      actorType: "admin",
      action: "BATCH_DELETED",
      entityType: "Batch",
      entityId: params.batchId,
      metadata: { name: batch.name },
    },
  });

  return NextResponse.json({ success: true });
}
