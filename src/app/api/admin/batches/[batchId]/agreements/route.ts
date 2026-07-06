/**
 * /api/admin/batches/[batchId]/agreements
 *   GET  — list agreement templates for this batch
 *   POST — upload a new agreement PDF. Body: { name, dataUrl }
 *          (dataUrl is a base64 "data:application/pdf;base64,..." string)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { canManageBatch } from "@/lib/authz";
import { recalculateBatchStudentsProgress } from "@/lib/progress";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function GET(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const agreements = await prisma.agreementTemplate.findMany({
    where: { batchId: params.batchId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { fields: true, signedAgreements: true } } },
  });

  return NextResponse.json({
    success: true,
    data: agreements.map((a) => ({
      id: a.id,
      name: a.name,
      originalPdfUrl: a.originalPdfUrl,
      pageCount: a.pageCount,
      isActive: a.isActive,
      fieldCount: a._count.fields,
      signedCount: a._count.signedAgreements,
      createdAt: a.createdAt,
    })),
  });
}

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
    const { name, dataUrl } = (await req.json()) as { name?: string; dataUrl?: string };

    if (!dataUrl) {
      return NextResponse.json({ success: false, error: "dataUrl required" }, { status: 400 });
    }

    const match = dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
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

    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    }
    if (!canManageBatch(session, batch)) {
      return NextResponse.json(
        { success: false, error: "You can only edit batches you created" },
        { status: 403 }
      );
    }

    // Validate it's a real PDF and read the page count for the editor.
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

    const { url } = await uploadFile(
      buffer,
      `${(name || "agreement").replace(/[^a-z0-9]+/gi, "_").slice(0, 40).toLowerCase() || "agreement"}.pdf`,
      "application/pdf",
      batchId,
      "agreements"
    );

    const agreement = await prisma.agreementTemplate.create({
      data: {
        batchId,
        name: name?.trim() || "Agreement",
        originalPdfUrl: url,
        pageCount,
        createdById: session.user.id,
      },
    });

    // A brand-new agreement is one more (unsigned) step for every existing
    // student in this batch. Recompute each student's status so anyone
    // previously "COMPLETED" drops back to reflect the new pending step, and
    // clear any stale "final" PDF that was generated before this agreement
    // existed (it would be missing this signature and shouldn't be handed
    // out as final anymore).
    const staleIds = (
      await prisma.student.findMany({
        where: { batchId, pdfUrl: { not: null } },
        select: { id: true },
      })
    ).map((s) => s.id);
    if (staleIds.length > 0) {
      await prisma.student.updateMany({
        where: { id: { in: staleIds } },
        data: { pdfUrl: null, pdfGeneratedAt: null },
      });
    }
    await recalculateBatchStudentsProgress(batchId);

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "AGREEMENT_UPLOADED",
        entityType: "AgreementTemplate",
        entityId: agreement.id,
        metadata: { batchId, pageCount, url },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: agreement.id, url, pageCount },
    });
  } catch (error) {
    console.error("[agreement POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
