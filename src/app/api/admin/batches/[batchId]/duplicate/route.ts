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
import { Prisma } from "@prisma/client";
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
      include: {
        formAssignments: {
          orderBy: { order: "asc" },
          include: { formTemplate: true },
        },
        agreements: { include: { fields: true } },
      },
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

    // Never create a second batch with an existing name: duplicate names make
    // name-based student imports ambiguous (rows silently route to whichever
    // same-named batch wins the lookup). Auto-suffix "(2)", "(3)", … instead.
    const baseName = overrideName ?? `Copy of ${source.name}`;
    const taken = new Set(
      (
        await prisma.batch.findMany({
          where: { name: { startsWith: baseName } },
          select: { name: true },
        })
      ).map((b) => b.name)
    );
    let newName = baseName;
    for (let n = 2; taken.has(newName); n++) newName = `${baseName} (${n})`;

    // Deep-copy each form template so the new batch is fully independent: its
    // steps must be editable without ever modifying the original templates
    // (which the source batch and others may still use). Copying only the
    // assignments would leave both batches pointing at the same shared
    // template, so an edit "here" would change the original "there".
    const steps: Array<{ formTemplateId: string; order: number; stepSlug: string; required: boolean }> = [];
    for (const a of source.formAssignments) {
      const t = a.formTemplate;
      const clone = await prisma.formTemplate.create({
        data: {
          name: t.name,
          description: t.description,
          type: t.type,
          schema: t.schema as Prisma.InputJsonValue,
          signatoryRoles: t.signatoryRoles as Prisma.InputJsonValue,
          createdBy: session.user.id,
          isLibrary: false,
        },
      });
      steps.push({
        formTemplateId: clone.id,
        order: a.order,
        stepSlug: a.stepSlug,
        required: a.required,
      });
    }

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
        formAssignments: { create: steps },
      },
    });

    // Deep-copy agreements (rows + placed fields) so the new batch's
    // agreements can be edited or deleted without touching the original's.
    // The original PDF file itself is immutable in storage, so both copies
    // referencing the same originalPdfUrl is safe (deleting an agreement
    // removes only its DB row, never the stored file).
    for (const ag of source.agreements) {
      await prisma.agreementTemplate.create({
        data: {
          batchId: created.id,
          name: ag.name,
          originalPdfUrl: ag.originalPdfUrl,
          pageCount: ag.pageCount,
          isActive: ag.isActive,
          createdById: session.user.id,
          fields: {
            create: ag.fields.map((f) => ({
              signerRole: f.signerRole,
              fieldType: f.fieldType,
              label: f.label,
              required: f.required,
              options:
                f.options === null ? undefined : (f.options as Prisma.InputJsonValue),
              defaultValue: f.defaultValue,
              page: f.page,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              order: f.order,
            })),
          },
        },
      });
    }

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
