/**
 * /api/admin/templates/[id]
 *   GET    — fetch one template
 *   PATCH  — update name/description/schema/signatoryRoles (bumps version)
 *
 * This is the write path behind the no-code editor: editing deliverable rows
 * (step 4), clauses, registration fields, or document requirements.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const template = await prisma.formTemplate.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: template });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.formTemplate.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string | null;
      schema?: unknown;
      signatoryRoles?: unknown;
      // When the edit originates from a batch's step editor, the batch id is
      // sent so we can keep the edit private to that batch (copy-on-write).
      batchId?: string;
    };

    // Build the set of edited fields once — applied either to the existing row
    // (private template) or to a fresh clone (shared template, copy-on-write).
    const edits: Prisma.FormTemplateUncheckedCreateInput = {
      name: existing.name,
      description: existing.description,
      type: existing.type,
      schema: existing.schema as Prisma.InputJsonValue,
      signatoryRoles: existing.signatoryRoles as Prisma.InputJsonValue,
    };
    if (typeof body.name === "string" && body.name.trim()) edits.name = body.name.trim();
    if (body.description !== undefined) edits.description = body.description || null;
    if (body.schema !== undefined) edits.schema = body.schema as Prisma.InputJsonValue;
    if (body.signatoryRoles !== undefined)
      edits.signatoryRoles = body.signatoryRoles as Prisma.InputJsonValue;

    // Copy-on-write guard: a template is "shared" when it's a library master
    // (isLibrary) or when more than one batch step points at it. Editing such a
    // row in place would leak the change into every batch using it. If the edit
    // came from a specific batch, fork a private copy for that batch instead and
    // re-point only that batch's assignment(s) — other batches stay untouched.
    const assignmentCount = await prisma.batchFormAssignment.count({
      where: { formTemplateId: params.id },
    });
    const isShared = existing.isLibrary || assignmentCount > 1;

    // A library master may only be edited in place by a super admin. Regular
    // admins must edit within a batch context (which forks a private copy).
    if (existing.isLibrary && !body.batchId && !isSuperAdmin(session)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This is a shared template. Open it from your batch to customise a private copy.",
        },
        { status: 403 }
      );
    }

    if (isShared && body.batchId) {
      const clone = await prisma.formTemplate.create({
        data: {
          name: edits.name,
          description: edits.description,
          type: edits.type,
          schema: edits.schema as Prisma.InputJsonValue,
          signatoryRoles: edits.signatoryRoles as Prisma.InputJsonValue,
          createdBy: session.user.id,
          isLibrary: false,
        },
      });

      await prisma.batchFormAssignment.updateMany({
        where: { batchId: body.batchId, formTemplateId: params.id },
        data: { formTemplateId: clone.id },
      });

      await prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          actorType: "admin",
          action: "TEMPLATE_FORKED_FOR_BATCH",
          entityType: "FormTemplate",
          entityId: clone.id,
          metadata: { sourceId: params.id, batchId: body.batchId },
        },
      });

      // Return the clone's id so the editor keeps working on the private copy
      // (and doesn't fork again on the next save).
      return NextResponse.json({ success: true, data: clone });
    }

    const template = await prisma.formTemplate.update({
      where: { id: params.id },
      data: {
        version: existing.version + 1,
        name: edits.name,
        description: edits.description,
        schema: edits.schema as Prisma.InputJsonValue,
        signatoryRoles: edits.signatoryRoles as Prisma.InputJsonValue,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "TEMPLATE_UPDATED",
        entityType: "FormTemplate",
        entityId: template.id,
        metadata: { version: template.version },
      },
    });

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("[templates PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
