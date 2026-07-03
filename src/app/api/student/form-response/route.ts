import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIpAddress } from "@/lib/utils";

// POST /api/student/form-response — upsert a student's form response
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const body = await req.json();
    const { formTemplateId, data, status = "DRAFT" } = body as {
      formTemplateId: string;
      data: Record<string, unknown>;
      status?: string;
    };

    if (!formTemplateId) {
      return NextResponse.json({ success: false, error: "formTemplateId required" }, { status: 400 });
    }

    const now = new Date();
    const response = await prisma.studentFormResponse.upsert({
      where: {
        studentId_formTemplateId: { studentId, formTemplateId },
      },
      update: {
        data,
        status: status as "DRAFT" | "SUBMITTED",
        lastSavedAt: now,
        submittedAt: status === "SUBMITTED" ? now : undefined,
        updatedAt: now,
      },
      create: {
        studentId,
        formTemplateId,
        data,
        status: status as "DRAFT" | "SUBMITTED",
        lastSavedAt: now,
        submittedAt: status === "SUBMITTED" ? now : undefined,
      },
    });

    // Update student status + completion %
    await updateStudentProgress(studentId);

    // Audit log
    if (status === "SUBMITTED") {
      await prisma.auditLog.create({
        data: {
          studentId,
          actorType: "student",
          action: "FORM_SUBMITTED",
          entityType: "StudentFormResponse",
          entityId: response.id,
          metadata: { formTemplateId, status },
          ipAddress: getIpAddress(req),
        },
      });
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[form-response POST]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/student/form-response?formTemplateId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const formTemplateId = searchParams.get("formTemplateId");
  if (!formTemplateId) {
    return NextResponse.json({ success: false, error: "formTemplateId required" }, { status: 400 });
  }

  const response = await prisma.studentFormResponse.findUnique({
    where: {
      studentId_formTemplateId: {
        studentId: session.user.id,
        formTemplateId,
      },
    },
  });

  return NextResponse.json({ success: true, data: response });
}

// ── Helper ──────────────────────────────────────────────────────────────────

async function updateStudentProgress(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        include: {
          formAssignments: { where: { required: true } },
        },
      },
      formResponses: { select: { formTemplateId: true, status: true } },
    },
  });

  if (!student) return;

  const requiredTemplateIds = new Set(
    student.batch.formAssignments.map((a) => a.formTemplateId)
  );
  const submittedIds = new Set(
    student.formResponses
      .filter((r) => r.status === "SUBMITTED" && requiredTemplateIds.has(r.formTemplateId))
      .map((r) => r.formTemplateId)
  );

  const pct =
    requiredTemplateIds.size > 0
      ? Math.round((submittedIds.size / requiredTemplateIds.size) * 100)
      : 100;

  const newStatus =
    pct === 100
      ? "COMPLETED"
      : submittedIds.size > 0
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  await prisma.student.update({
    where: { id: studentId },
    data: {
      completionPct: pct,
      status: newStatus,
    },
  });
}
