import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

// POST /api/student/form-response/row-ack
// Record a per-row acknowledgment for DELIVERABLES_TABLE forms
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;
  const { formTemplateId, rowId } = await req.json();

  if (!formTemplateId || !rowId) {
    return NextResponse.json(
      { success: false, error: "formTemplateId and rowId are required" },
      { status: 400 }
    );
  }

  try {
    const ack = await prisma.deliverableRowAcknowledgment.upsert({
      where: {
        studentId_formTemplateId_rowId: { studentId, formTemplateId, rowId },
      },
      update: {
        acknowledgedAt: new Date(),
        ipAddress: getIpAddress(req),
      },
      create: {
        studentId,
        formTemplateId,
        rowId,
        acknowledgedAt: new Date(),
        ipAddress: getIpAddress(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({ success: true, data: ack });
  } catch (error) {
    console.error("[row-ack POST]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
