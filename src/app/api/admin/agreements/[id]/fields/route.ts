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
  options?: unknown;
  defaultValue?: unknown;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp01 = (n: number) => Math.min(Math.max(Number(n) || 0, 0), 1);

const FIELD_TYPES = ["SIGNATURE", "CHECKBOX", "DATE", "TEXT", "DROPDOWN"] as const;
type FieldType = (typeof FIELD_TYPES)[number];

function asFieldType(v: unknown): FieldType {
  return FIELD_TYPES.includes(v as FieldType) ? (v as FieldType) : "SIGNATURE";
}

const MAX_OPTIONS = 50;
const MAX_OPTION_LEN = 120;

/** Sanitize a DROPDOWN options list: strings only, trimmed, deduped, capped. */
function cleanOptions(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of v) {
    if (typeof o !== "string") continue;
    const s = o.trim().slice(0, MAX_OPTION_LEN);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
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
    .map((f, i) => {
      const fieldType = asFieldType(f.fieldType);
      const options = fieldType === "DROPDOWN" ? cleanOptions(f.options) : [];
      const defaultValue =
        fieldType === "DROPDOWN" &&
        typeof f.defaultValue === "string" &&
        options.includes(f.defaultValue.trim())
          ? f.defaultValue.trim()
          : null;
      return {
        agreementTemplateId: agreement.id,
        signerRole: f.signerRole,
        fieldType,
        label: typeof f.label === "string" ? f.label.slice(0, 120) : null,
        required: f.required !== false,
        options: fieldType === "DROPDOWN" ? options : undefined,
        defaultValue,
        page: Math.max(1, Math.min(Math.round(f.page), agreement.pageCount)),
        x: clamp01(f.x),
        y: clamp01(f.y),
        width: clamp01(f.width),
        height: clamp01(f.height),
        order: i,
      };
    });

  // Replace the whole set atomically.
  await prisma.$transaction([
    prisma.agreementSignatureField.deleteMany({ where: { agreementTemplateId: agreement.id } }),
    ...(cleaned.length
      ? [prisma.agreementSignatureField.createMany({ data: cleaned })]
      : []),
  ]);

  return NextResponse.json({ success: true, data: { count: cleaned.length } });
}
