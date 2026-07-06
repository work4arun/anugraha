import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, hashBuffer } from "@/lib/storage";
import { getIpAddress } from "@/lib/utils";

// A signature canvas PNG is a few hundred KB at most; bound the payload so a
// malicious client can't post arbitrarily large bodies.
const MAX_SIGNATURE_BYTES = 1.5 * 1024 * 1024;
const PNG_PREFIX = "data:image/png;base64,";
// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// POST /api/student/signature — save a base64 PNG signature
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  const { formTemplateId, role, dataUrl } = await req.json() as {
    formTemplateId: string;
    role: string;
    dataUrl: string;
  };

  if (!formTemplateId || !role || !dataUrl) {
    return NextResponse.json(
      { success: false, error: "formTemplateId, role, and dataUrl are required" },
      { status: 400 }
    );
  }

  // Strict content checks: must be a PNG data URI, within the size cap, and
  // the decoded bytes must actually start with the PNG magic number.
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PNG_PREFIX)) {
    return NextResponse.json(
      { success: false, error: "dataUrl must be a data:image/png;base64 URI" },
      { status: 400 }
    );
  }
  if (dataUrl.length > MAX_SIGNATURE_BYTES * (4 / 3) + PNG_PREFIX.length) {
    return NextResponse.json(
      { success: false, error: "Signature image is too large" },
      { status: 400 }
    );
  }
  if (typeof role !== "string" || role.length > 50) {
    return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
  }

  try {
    // Convert base64 PNG to buffer
    const base64Data = dataUrl.slice(PNG_PREFIX.length);
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      return NextResponse.json(
        { success: false, error: "dataUrl is not a valid PNG image" },
        { status: 400 }
      );
    }
    const hash = hashBuffer(buffer);

    // Upload to storage
    const { url } = await uploadFile(
      buffer,
      `sig_${role}.png`,
      "image/png",
      studentId,
      "signatures"
    );

    // Upsert signature record
    const sig = await prisma.signature.upsert({
      where: {
        studentId_formTemplateId_signatoryRole: {
          studentId,
          formTemplateId,
          signatoryRole: role,
        },
      },
      update: {
        imageUrl: url,
        imageHash: hash,
        ipAddress: getIpAddress(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
        signedAt: new Date(),
      },
      create: {
        studentId,
        formTemplateId,
        signatoryRole: role,
        imageUrl: url,
        imageHash: hash,
        ipAddress: getIpAddress(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
        signedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "SIGNATURE_SAVED",
        entityType: "Signature",
        entityId: sig.id,
        metadata: { formTemplateId, role },
        ipAddress: getIpAddress(req),
      },
    });

    return NextResponse.json({ success: true, data: { url, id: sig.id } });
  } catch (error) {
    console.error("[signature POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save signature" },
      { status: 500 }
    );
  }
}
