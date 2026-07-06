/**
 * POST /api/student/agreements/[id]/sign
 *
 * Stamps the student's (and parent's) captured signatures onto the agreement
 * PDF at the admin-placed fields, saves the completed PDF, and records it.
 *
 * The student must already have signatures on file (captured with the existing
 * signature flow). Roles are taken from the agreement's placed fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stampAgreement, collectStudentSignatures } from "@/lib/agreement";
import { generateStudentPdf } from "@/lib/pdf";
import { recalculateStudentProgress } from "@/lib/progress";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const studentId = session.user.id;

  try {
    // Optional body: { values: { [fieldId]: string | boolean } } for
    // CHECKBOX/TEXT fields (DATE fields auto-fill with the signing date).
    const body = (await req.json().catch(() => ({}))) as {
      values?: Record<string, unknown>;
    };
    const rawValues = body.values && typeof body.values === "object" ? body.values : {};

    const agreement = await prisma.agreementTemplate.findUnique({
      where: { id: params.id },
      include: { fields: true },
    });
    if (!agreement) {
      return NextResponse.json({ success: false, error: "Agreement not found" }, { status: 404 });
    }
    // The agreement must belong to the student's own batch.
    if (agreement.batchId !== session.user.batchId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const signatureFields = agreement.fields.filter((f) => f.fieldType === "SIGNATURE");
    const roles = Array.from(new Set(signatureFields.map((f) => f.signerRole)));
    if (agreement.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: "This agreement has no fields yet" },
        { status: 409 }
      );
    }

    // Sanitize values: only accept entries for this agreement's own
    // CHECKBOX/TEXT fields, with the right type for each.
    const values: Record<string, string | boolean> = {};
    const missing: string[] = [];
    for (const f of agreement.fields) {
      if (f.fieldType === "CHECKBOX") {
        const v = rawValues[f.id] === true;
        values[f.id] = v;
        if (f.required && !v) missing.push(f.label || "checkbox");
      } else if (f.fieldType === "TEXT") {
        const v = typeof rawValues[f.id] === "string" ? (rawValues[f.id] as string).trim().slice(0, 200) : "";
        values[f.id] = v;
        if (f.required && !v) missing.push(f.label || "text field");
      } else if (f.fieldType === "DROPDOWN") {
        const opts = Array.isArray(f.options) ? (f.options as string[]) : [];
        const raw = typeof rawValues[f.id] === "string" ? (rawValues[f.id] as string).trim() : "";
        // Only a configured option counts; anything else is treated as empty.
        const v = opts.includes(raw) ? raw : "";
        values[f.id] = v;
        if (f.required && !v) missing.push(f.label || "dropdown");
      }
    }
    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_FIELDS",
          error: `Please complete: ${missing.join(", ")}`,
          missing,
        },
        { status: 400 }
      );
    }

    const signers = roles.length ? await collectStudentSignatures(studentId, roles) : [];
    if (roles.length > 0 && signers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_SIGNATURE",
          error: "Please add your signature first, then sign the agreement.",
        },
        { status: 409 }
      );
    }

    const { url, stamped } = await stampAgreement(studentId, agreement.id, signers, values);
    const signedRoles = new Set(signers.map((s) => s.role));
    const allSigned = roles.every((r) => signedRoles.has(r));

    const record = await prisma.signedAgreement.upsert({
      where: {
        studentId_agreementTemplateId: {
          studentId,
          agreementTemplateId: agreement.id,
        },
      },
      update: {
        signedPdfUrl: url,
        status: allSigned ? "COMPLETED" : "PARTIAL",
        signedAt: new Date(),
      },
      create: {
        studentId,
        agreementTemplateId: agreement.id,
        signedPdfUrl: url,
        status: allSigned ? "COMPLETED" : "PARTIAL",
        signedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "AGREEMENT_SIGNED",
        entityType: "SignedAgreement",
        entityId: record.id,
        metadata: { agreementTemplateId: agreement.id, stamped, status: record.status },
      },
    });

    // Agreements are the last step of induction — recompute status now that
    // this one changed (flips to COMPLETED once every step + agreement is
    // signed; see src/lib/progress.ts).
    await recalculateStudentProgress(studentId);

    // If the student's consolidated PDF was already generated, it's now stale
    // (it won't contain this newly signed agreement). Regenerate it in the
    // background — don't block the sign response on a Puppeteer render.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { pdfUrl: true },
    });
    if (student?.pdfUrl) {
      generateStudentPdf(studentId).catch((err) =>
        console.error("[agreement sign] final PDF regeneration failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      data: { url, status: record.status, stamped },
    });
  } catch (error) {
    console.error("[agreement sign]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
