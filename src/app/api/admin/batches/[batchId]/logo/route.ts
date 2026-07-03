/**
 * /api/admin/batches/[batchId]/logo
 *   POST   — upload a college logo for this batch. Body: { dataUrl }
 *            (a base64 data URL: PNG, JPG, WEBP or SVG)
 *   DELETE  — remove the batch logo
 *
 * Recommended upload: square PNG with a transparent background, 512 × 512 px
 * (min 256 × 256), under 1 MB. A wide wordmark works too — keep it under
 * ~800 × 240 px so it stays crisp in headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const MAX_BYTES = 1024 * 1024; // 1 MB

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
    const { dataUrl } = (await req.json()) as { dataUrl?: string };
    if (!dataUrl) {
      return NextResponse.json({ success: false, error: "dataUrl required" }, { status: 400 });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid image data" }, { status: 400 });
    }
    const mime = match[1];
    const ext = MIME_EXT[mime];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: "Use a PNG, JPG, WEBP or SVG image" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Logo is too large — please keep it under 1 MB" },
        { status: 400 }
      );
    }

    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    }

    const { url } = await uploadFile(buffer, `logo.${ext}`, mime, batchId, "logos");

    await prisma.batch.update({ where: { id: batchId }, data: { logoUrl: url } });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "BATCH_LOGO_UPDATED",
        entityType: "Batch",
        entityId: batchId,
        metadata: { url },
      },
    });

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error("[batch logo POST]", error);
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

  await prisma.batch.update({
    where: { id: params.batchId },
    data: { logoUrl: null },
  });

  return NextResponse.json({ success: true });
}
