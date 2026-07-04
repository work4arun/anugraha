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
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { canManageBatch } from "@/lib/authz";

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
      prisma.batchFormAssignment.findMany({
        where: { batchId },
        include: { formTemplate: { select: { name: true } } },
      }),
    ]);

    if (!batch) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    if (!canManageBatch(session, batch)) {
      return NextResponse.json(
        { success: false, error: "You can only edit batches you created" },
        { status: 403 }
      );
    }
    if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });

    // Each batch keeps its own copy of a template, so compare by name (the
    // batch's existing steps point at private clones, not the library id).
    if (existing.some((a) => a.formTemplate.name === template.name)) {
      return NextResponse.json(
        { success: false, error: "A step with this name is already in the batch" },
        { status: 409 }
      );
    }

    const nextOrder = existing.reduce((max, a) => Math.max(max, a.order), 0) + 1;

    // Ensure a unique slug within the batch.
    const usedSlugs = new Set(existing.map((a) => a.stepSlug));
    const base = slugify(template.name) || `step-${nextOrder}`;
    let stepSlug = base;
    let n = 2;
    while (usedSlugs.has(stepSlug)) stepSlug = `${base}-${n++}`;

    // Clone the library template into a batch-private copy so editing this
    // batch's step never modifies the shared template (or other batches).
    const clone = await prisma.formTemplate.create({
      data: {
        name: template.name,
        description: template.description,
        type: template.type,
        schema: template.schema as Prisma.InputJsonValue,
        signatoryRoles: template.signatoryRoles as Prisma.InputJsonValue,
        createdBy: session.user.id,
        isLibrary: false,
      },
    });

    const assignment = await prisma.batchFormAssignment.create({
      data: {
        batchId,
        formTemplateId: clone.id,
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

  const assignment = await prisma.batchFormAssignment.findUnique({
    where: { id: assignmentId },
    include: { batch: { select: { createdById: true } } },
  });
  if (!assignment || assignment.batchId !== params.batchId) {
    return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
  }
  if (!canManageBatch(session, assignment.batch)) {
    return NextResponse.json(
      { success: false, error: "You can only edit batches you created" },
      { status: 403 }
    );
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
