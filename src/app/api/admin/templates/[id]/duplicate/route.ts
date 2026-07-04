/**
 * POST /api/admin/templates/[id]/duplicate  (SUPER_ADMIN only)
 * Duplicates a template and assigns ownership to another admin, so a
 * super admin can hand a form off to a specific admin as their own copy.
 *
 * Body: { targetAdminId: string, name?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const source = await prisma.formTemplate.findUnique({ where: { id: params.id } });
    if (!source) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      targetAdminId?: string;
      name?: string;
    };

    const targetAdminId = body.targetAdminId?.trim();
    if (!targetAdminId) {
      return NextResponse.json(
        { success: false, error: "Please choose an admin to duplicate this form to" },
        { status: 400 }
      );
    }

    const targetAdmin = await prisma.admin.findUnique({ where: { id: targetAdminId } });
    if (!targetAdmin) {
      return NextResponse.json({ success: false, error: "Target admin not found" }, { status: 404 });
    }

    // Copy ONLY the form definition — never student data. We deliberately
    // create a fresh template from scalar fields, so none of the source's
    // studentResponses, signatures, rowAcknowledgments or batchAssignments
    // are carried over. The target admin receives an empty form to fill.
    const copy = await prisma.formTemplate.create({
      data: {
        name: body.name?.trim() || `${source.name} (Copy)`,
        description: source.description,
        type: source.type,
        schema: source.schema as Prisma.InputJsonValue,
        signatoryRoles: source.signatoryRoles as Prisma.InputJsonValue,
        createdBy: targetAdmin.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "TEMPLATE_DUPLICATED_TO_ADMIN",
        entityType: "FormTemplate",
        entityId: copy.id,
        metadata: {
          sourceId: source.id,
          targetAdminId: targetAdmin.id,
          targetAdminName: targetAdmin.name,
        },
      },
    });

    return NextResponse.json({ success: true, data: copy });
  } catch (error) {
    console.error("[templates duplicate POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
