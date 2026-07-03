import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, hashBuffer } from "@/lib/storage";
import { getIpAddress } from "@/lib/utils";

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

  try {
    // Convert base64 PNG to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
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
