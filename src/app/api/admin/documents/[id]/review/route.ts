import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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

  const { status, note } = await req.json() as {
    status: "APPROVED" | "FLAGGED";
    note?: string;
  };

  const doc = await prisma.document.update({
    where: { id: params.id },
    data: {
      reviewStatus: status,
      reviewNote: note ?? null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      actorType: "admin",
      action: `DOCUMENT_${status}`,
      entityType: "Document",
      entityId: params.id,
      metadata: { note },
    },
  });

  return NextResponse.json({ success: true, data: doc });
}
