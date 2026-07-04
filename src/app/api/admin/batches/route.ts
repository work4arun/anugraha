/**
 * POST /api/admin/batches — create a new batch (cohort).
 * Body: { institutionId, name, course, department?, academicYear, isActive?, templateIds?[] }
 * Optionally assigns the chosen form templates as ordered induction steps.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/authz";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      institutionId?: string;
      name?: string;
      course?: string;
      department?: string;
      academicYear?: string;
      isActive?: boolean;
      isTemplate?: boolean;
      templateIds?: string[];
    };

    const institutionId = body.institutionId?.trim();
    const name = body.name?.trim();
    const course = body.course?.trim();
    const academicYear = body.academicYear?.trim();

    if (!institutionId || !name || !course || !academicYear) {
      return NextResponse.json(
        { success: false, error: "Institution, name, course and academic year are required" },
        { status: 400 }
      );
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) {
      return NextResponse.json({ success: false, error: "Institution not found" }, { status: 404 });
    }

    // Resolve chosen templates (in the admin's selected order) up front so the
    // batch and its step assignments are written in a single atomic create —
    // no partial batch if a step fails, and pooler-friendly (no transaction).
    const templateIds = Array.isArray(body.templateIds) ? body.templateIds : [];
    const steps: Array<{ formTemplateId: string; order: number; stepSlug: string; required: boolean }> = [];
    if (templateIds.length) {
      const templates = await prisma.formTemplate.findMany({
        where: { id: { in: templateIds } },
      });
      const ordered = templateIds
        .map((id) => templates.find((t) => t.id === id))
        .filter((t): t is (typeof templates)[number] => Boolean(t));

      const usedSlugs = new Set<string>();
      let order = 1;
      for (const t of ordered) {
        const base = slugify(t.name) || `step-${order}`;
        let stepSlug = base;
        let n = 2;
        while (usedSlugs.has(stepSlug)) stepSlug = `${base}-${n++}`;
        usedSlugs.add(stepSlug);
        // Give the batch its own private copy of the template so later edits to
        // this batch's steps never modify the shared library template.
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
        steps.push({ formTemplateId: clone.id, order, stepSlug, required: true });
        order++;
      }
    }

    const batch = await prisma.batch.create({
      data: {
        institutionId,
        name,
        course,
        department: body.department?.trim() || null,
        academicYear,
        isActive: body.isActive ?? true,
        // Only super admins may create shared sample templates.
        isTemplate: isSuperAdmin(session) ? body.isTemplate ?? false : false,
        // Record ownership: only this admin (or a SUPER_ADMIN) can edit it later.
        createdById: session.user.id,
        ...(steps.length ? { formAssignments: { create: steps } } : {}),
      },
    });

    // Best-effort audit — never fail a successful create on a logging hiccup.
    try {
      await prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          actorType: "admin",
          action: "BATCH_CREATED",
          entityType: "Batch",
          entityId: batch.id,
          metadata: { name, course, academicYear, steps: steps.length },
        },
      });
    } catch (auditErr) {
      console.warn("[batches POST] audit log failed:", auditErr);
    }

    return NextResponse.json({ success: true, data: { id: batch.id } });
  } catch (error) {
    console.error("[batches POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
