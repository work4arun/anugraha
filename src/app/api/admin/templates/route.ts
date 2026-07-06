/**
 * /api/admin/templates
 *   GET  — list all form templates
 *   POST — create a new (custom) form template
 *
 * Body for POST:
 *   { name, description?, type, schema?, signatoryRoles? }
 * If `schema`/`signatoryRoles` are omitted, sensible empty defaults for the
 * given type are used so the admin can build it up in the editor.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";

type TemplateType =
  | "REGISTRATION"
  | "ACKNOWLEDGMENT"
  | "DELIVERABLES_TABLE"
  | "DOCUMENT_UPLOAD";

function defaultSchema(type: TemplateType) {
  switch (type) {
    case "REGISTRATION":
      return {
        fields: [],
        declaration:
          "I hereby declare that the information furnished above is true and correct to the best of my knowledge.",
      };
    case "ACKNOWLEDGMENT":
      return {
        clauses: [],
        acknowledgmentText:
          "I have read, understood, and agree to abide by the above.",
        place: { id: "place", label: "Place", required: true },
        date: { id: "date", label: "Date", required: true, defaultToday: true },
      };
    case "DELIVERABLES_TABLE":
      return {
        programmeHeader: { label: "Programme", value: "" },
        rows: [],
        declaration:
          "I acknowledge that I have read, understood, and individually accepted each of the deliverables listed above.",
        place: { id: "place", label: "Place", required: true },
        date: { id: "date", label: "Date", required: true, defaultToday: true },
      };
    case "DOCUMENT_UPLOAD":
      return { documents: [] };
  }
}

const DEFAULT_SIGNATORY_ROLES = [
  { role: "student", label: "Signature of the Student" },
  { role: "parent", label: "Signature of the Parent / Guardian" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Only show reusable library templates — batch-private copies (isLibrary=false)
  // are edited from within their batch, not from the shared library list.
  const templates = await prisma.formTemplate.findMany({
    where: { isLibrary: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { batchAssignments: true } } },
  });

  return NextResponse.json({ success: true, data: templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // Building the shared template library is a super-admin task. Regular admins
  // compose batches from existing templates and customise them per batch.
  if (!isSuperAdmin(session)) {
    return NextResponse.json(
      { success: false, error: "Only a super admin can create shared templates" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      type?: TemplateType;
      schema?: unknown;
      signatoryRoles?: unknown;
    };

    const name = (body.name ?? "").trim();
    const type = body.type;
    const validTypes: TemplateType[] = [
      "REGISTRATION",
      "ACKNOWLEDGMENT",
      "DELIVERABLES_TABLE",
      "DOCUMENT_UPLOAD",
    ];

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: "Valid type is required" }, { status: 400 });
    }

    const template = await prisma.formTemplate.create({
      data: {
        name,
        description: body.description?.trim() || null,
        type,
        // Store REAL JSON (objects/arrays) — never JSON.stringify() into a Json column.
        schema: (body.schema ?? defaultSchema(type)) as Prisma.InputJsonValue,
        signatoryRoles: (body.signatoryRoles ??
          (type === "DOCUMENT_UPLOAD" ? [] : DEFAULT_SIGNATORY_ROLES)) as Prisma.InputJsonValue,
        createdBy: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        actorType: "admin",
        action: "TEMPLATE_CREATED",
        entityType: "FormTemplate",
        entityId: template.id,
        metadata: { name, type },
      },
    });

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("[templates POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
