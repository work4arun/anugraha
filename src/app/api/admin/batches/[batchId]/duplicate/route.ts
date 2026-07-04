/**
 * POST /api/admin/batches/[batchId]/duplicate
 *
 * Clones a batch (typically a "sample" template) into a brand-new batch owned
 * by the admin who triggers it. Copies settings, logo and all induction step
 * assignments — but NOT students, and never the template flag.
 *
 * Any authenticated admin may duplicate a template or any batch they can view;
 * the resulting batch is a normal, editable batch owned by them.
 *
 * Body (optional): { name?: string }  — override the new batch name.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await prisma.batch.findUnique({
      where: { id: params.batchId },
      include: { formAssignments: { orderBy: { order: "asc" } } },
    });
    if (!source) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    }

    let overrideName: string | undefined;
    try {
      const body = (await req.json()) as { name?: string };
      overrideName = body?.name?.trim() || undefined;
    } catch {
      // No body provided — fine, we'll derive a name.
    }

    const newName = overrideName ?? `Copy of ${source.name}`;

    // Create the new batch and copy its step assignments in a single nested
    // write. Prisma wraps this in one atomic statement — no interactive
    // transaction, which is more robust over a pooled (pgbouncer) connection.
    const created = await prisma.batch.create({
      data: {
        institutionId: source.institutionId,
        name: newName,
        course: source.course,
        department: source.department,
        academicYear: source.academicYear,
        logoUrl: source.logoUrl,
        isActive: source.isActive,
        inductionDeadline: source.inductionDeadline,
        // The copy is always a normal batch owned by whoever duplicated it.
        isTemplate: false,
        createdById: session.user.id,
        formAssignments: {
          create: source.formAssignments.map((a) => ({
            formTemplateId: a.formTemplateId,
            order: a.order,
            stepSlug: a.stepSlug,
            required: a.required,
          })),
        },
      },
    });

    // Best-effort audit — never fail a successful duplicate on a logging hiccup.
    try {
      await prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          actorType: "admin",
          action: "BATCH_DUPLICATED",
          entityType: "Batch",
          entityId: created.id,
          metadata: {
            sourceBatchId: source.id,
            sourceWasTemplate: source.isTemplate,
            steps: source.formAssignments.length,
          },
        },
      });
    } catch (auditErr) {
      console.warn("[batch duplicate] audit log failed:", auditErr);
    }

    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error) {
    console.error("[batch duplicate]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
