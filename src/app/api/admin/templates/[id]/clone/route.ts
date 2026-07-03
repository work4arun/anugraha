/**
 * POST /api/admin/templates/[id]/clone
 * Duplicates a template. Optionally re-points a specific batch assignment to the
 * new copy so that batch/department can diverge from the shared template
 * (e.g. a different deliverables list per department) without affecting others.
 *
 * Body: { assignmentId?: string, name?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await prisma.formTemplate.findUnique({ where: { id: params.id } });
    if (!source) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      assignmentId?: string;
      name?: string;
    };

    const clone = await prisma.formTemplate.create({
      data: {
        name: body.name?.trim() || `${source.name} (Copy)`,
        description: source.description,
        type: source.type,
        schema: source.schema as Prisma.InputJsonValue,
        signatoryRoles: source.signatoryRoles as Prisma.InputJsonValue,
        createdBy: session.user.id,
      },
    });

    // Optionally re-point a batch assignment to the clone.
    if (body.assignmentId) {
      const assignment = await prisma.batchFormAssignment.findUnique({
        where: { id: body.assignmentId },
      });
      if (assignment) {
        await prisma.batchFormAssignment.update({
          where: { id: assignment.id },
          data: { formTemplateId: clone.id },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "TEMPLATE_CLONED",
        entityType: "FormTemplate",
        entityId: clone.id,
        metadata: { sourceId: source.id, assignmentId: body.assignmentId ?? null },
      },
    });

    return NextResponse.json({ success: true, data: clone });
  } catch (error) {
    console.error("[templates clone POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
