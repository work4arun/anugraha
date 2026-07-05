/**
 * /api/admin/agreements/[id]
 *   GET    — fetch an agreement template + its signature fields (for the editor)
 *   PATCH  — edit an agreement: rename, toggle isActive, and/or replace the PDF.
 *            Body: { name?, isActive?, dataUrl? } (dataUrl = base64 PDF, same
 *            format as the upload route). Replacing the PDF keeps placed fields,
 *            but drops any on pages past the new PDF's page count.
 *   DELETE — remove an agreement template (and its fields / signed records)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { canManageBatch } from "@/lib/authz";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

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

export async function PATCH(
  req: NextRequest,
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

  try {
    const body = (await req.json()) as {
      name?: string;
      isActive?: boolean;
      dataUrl?: string;
    };

    const data: {
      name?: string;
      isActive?: boolean;
      originalPdfUrl?: string;
      pageCount?: number;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 120);
      if (!name) {
        return NextResponse.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    let droppedFields = 0;
    if (body.dataUrl) {
      const match = body.dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Please upload a PDF file" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(match[1], "base64");
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json(
          { success: false, error: "PDF is too large — keep it under 20 MB" },
          { status: 400 }
        );
      }

      let pageCount = 1;
      try {
        const doc = await PDFDocument.load(new Uint8Array(buffer));
        pageCount = doc.getPageCount();
      } catch {
        return NextResponse.json(
          { success: false, error: "That file could not be read as a PDF" },
          { status: 400 }
        );
      }

      const filename = `${((data.name ?? agreement.name) || "agreement")
        .replace(/[^a-z0-9]+/gi, "_")
        .slice(0, 40)
        .toLowerCase() || "agreement"}.pdf`;
      const { url } = await uploadFile(
        buffer,
        filename,
        "application/pdf",
        agreement.batchId,
        "agreements"
      );
      data.originalPdfUrl = url;
      data.pageCount = pageCount;

      // Placed fields on pages that no longer exist can't be stamped — drop them.
      const dropped = await prisma.agreementSignatureField.deleteMany({
        where: { agreementTemplateId: agreement.id, page: { gt: pageCount } },
      });
      droppedFields = dropped.count;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "Nothing to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.agreementTemplate.update({
      where: { id: agreement.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        adminId: session.user.id,
        action: "AGREEMENT_UPDATED",
        entityType: "AgreementTemplate",
        entityId: updated.id,
        metadata: {
          changed: Object.keys(data),
          droppedFields,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        originalPdfUrl: updated.originalPdfUrl,
        pageCount: updated.pageCount,
        isActive: updated.isActive,
        droppedFields,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/agreements/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not update agreement" },
      { status: 500 }
    );
  }
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
