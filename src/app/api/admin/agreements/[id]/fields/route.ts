/**
 * PUT /api/admin/agreements/[id]/fields
 *
 * Replaces the full set of placed fields for an agreement.
 * Body: { fields: Array<{ signerRole, fieldType?, label?, required?, page, x, y, width, height }> }
 * fieldType: SIGNATURE (default) | CHECKBOX | DATE | TEXT — DocuSign-style.
 * Coordinates are normalized (0..1), origin top-left of the page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/authz";

interface FieldInput {
  signerRole: string;
  fieldType?: string;
  label?: string;
  required?: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp01 = (n: number) => Math.min(Math.max(Number(n) || 0, 0), 1);

const FIELD_TYPES = ["SIGNATURE", "CHECKBOX", "DATE", "TEXT"] as const;
type FieldType = (typeof FIELD_TYPES)[number];

function asFieldType(v: unknown): FieldType {
  return FIELD_TYPES.includes(v as FieldType) ? (v as FieldType) : "SIGNATURE";
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const agreement = await prisma.agreementTemplate.findUnique({
    where: { id: params.id },
    include: { batch: true },
  });
  if (!agreement) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!canManageBatch(session, agreement.batch)) {
    return NextResponse.json(
      { success: false, error: "You can only edit batches you created" },
      { status: 403 }
    );
  }

  const { fields } = (await req.json().catch(() => ({}))) as { fields?: FieldInput[] };
  if (!Array.isArray(fields)) {
    return NextResponse.json({ success: false, error: "fields array required" }, { status: 400 });
  }

  const cleaned = fields
    .filter((f) => f && typeof f.signerRole === "string" && Number.isFinite(f.page))
    .map((f, i) => ({
      agreementTemplateId: agreement.id,
      signerRole: f.signerRole,
      fieldType: asFieldType(f.fieldType),
      label: typeof f.label === "string" ? f.label.slice(0, 120) : null,
      required: f.required !== false,
      page: Math.max(1, Math.min(Math.round(f.page), agreement.pageCount)),
      x: clamp01(f.x),
      y: clamp01(f.y),
      width: clamp01(f.width),
      height: clamp01(f.height),
      order: i,
    }));

  // Replace the whole set atomically.
  await prisma.$transaction([
    prisma.agreementSignatureField.deleteMany({ where: { agreementTemplateId: agreement.id } }),
    ...(cleaned.length
      ? [prisma.agreementSignatureField.createMany({ data: cleaned })]
      : []),
  ]);

  return NextResponse.json({ success: true, data: { count: cleaned.length } });
}
