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
    };

    const data: Prisma.FormTemplateUpdateInput = { version: existing.version + 1 };
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description || null;
    if (body.schema !== undefined) data.schema = body.schema as Prisma.InputJsonValue;
    if (body.signatoryRoles !== undefined)
      data.signatoryRoles = body.signatoryRoles as Prisma.InputJsonValue;

    const template = await prisma.formTemplate.update({
      where: { id: params.id },
      data,
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
