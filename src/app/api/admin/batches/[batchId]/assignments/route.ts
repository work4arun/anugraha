/**
 * /api/admin/batches/[batchId]/assignments
 *   POST   — assign an existing template to this batch as the next step
 *            body: { formTemplateId, required? }
 *   DELETE  — remove an assignment (query: ?assignmentId=...)
 *
 * Step order and a unique URL slug are derived automatically. This lets each
 * batch / department have its own ordered set of forms.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { batchId } = params;
    const body = (await req.json()) as { formTemplateId?: string; required?: boolean };
    const formTemplateId = body.formTemplateId;
    if (!formTemplateId) {
      return NextResponse.json({ success: false, error: "formTemplateId required" }, { status: 400 });
    }

    const [batch, template, existing] = await Promise.all([
      prisma.batch.findUnique({ where: { id: batchId } }),
      prisma.formTemplate.findUnique({ where: { id: formTemplateId } }),
      prisma.batchFormAssignment.findMany({ where: { batchId } }),
    ]);

    if (!batch) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });

    if (existing.some((a) => a.formTemplateId === formTemplateId)) {
      return NextResponse.json(
        { success: false, error: "This template is already assigned to the batch" },
        { status: 409 }
      );
    }

    const nextOrder = existing.reduce((max, a) => Math.max(max, a.order), 0) + 1;

    // Ensure a unique slug within the batch.
    const usedSlugs = new Set(existing.map((a) => a.stepSlug));
    let base = slugify(template.name) || `step-${nextOrder}`;
    let stepSlug = base;
    let n = 2;
    while (usedSlugs.has(stepSlug)) stepSlug = `${base}-${n++}`;

    const assignment = await prisma.batchFormAssignment.create({
      data: {
        batchId,
        formTemplateId,
        order: nextOrder,
        stepSlug,
        required: body.required ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "BATCH_ASSIGNED",
        entityType: "Batch",
        entityId: batchId,
        metadata: { formTemplateId, order: nextOrder, stepSlug },
      },
    });

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("[assignments POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ success: false, error: "assignmentId required" }, { status: 400 });
  }

  const assignment = await prisma.batchFormAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.batchId !== params.batchId) {
    return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
  }

  await prisma.batchFormAssignment.delete({ where: { id: assignmentId } });

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      actorType: "admin",
      action: "BATCH_ASSIGNMENT_REMOVED",
      entityType: "Batch",
      entityId: params.batchId,
      metadata: { assignmentId },
    },
  });

  return NextResponse.json({ success: true });
}
