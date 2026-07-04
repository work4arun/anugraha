/**
 * /api/admin/agreements/[id]
 *   GET    — fetch an agreement template + its signature fields (for the editor)
 *   DELETE — remove an agreement template (and its fields / signed records)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const agreement = await prisma.agreementTemplate.findUnique({
    where: { id: params.id },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!agreement) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: agreement.id,
      name: agreement.name,
      originalPdfUrl: agreement.originalPdfUrl,
      pageCount: agreement.pageCount,
      isActive: agreement.isActive,
      fields: agreement.fields.map((f) => ({
        id: f.id,
        signerRole: f.signerRole,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        order: f.order,
      })),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const agreement = await prisma.agreementTemplate.findUnique({
    where: { id: params.id },
    include: { batch: true },
  });
  if (!agreement) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!canManageBatch(session, agreement.batch)) {
    return NextResponse.json(
      { success: false, error: "You can only edit batches you created" },
      { status: 403 }
    );
  }

  await prisma.agreementTemplate.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
