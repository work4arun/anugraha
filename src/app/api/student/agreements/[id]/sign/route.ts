/**
 * POST /api/student/agreements/[id]/sign
 *
 * Stamps the student's (and parent's) FRESHLY drawn signatures onto the
 * agreement PDF at the admin-placed fields, saves the completed PDF, and
 * records it.
 *
 * The student must sign again here, specifically for this agreement, in the
 * same request as reviewing it — we deliberately do NOT fall back to reusing
 * an old signature captured on a regular induction form (that reuse used to
 * make "signing" feel like it happened automatically, since it required no
 * new action from the student). Roles are taken from the agreement's placed
 * fields; the client must supply one fresh PNG data URI per role.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stampAgreement, type SignerImage } from "@/lib/agreement";
import { generateStudentPdf } from "@/lib/pdf";
import { recalculateStudentProgress } from "@/lib/progress";

// Generous but bounded — a signature canvas PNG at typical device pixel
// ratios is a few hundred KB; this just guards against abuse.
const MAX_SIGNATURE_BYTES = 3 * 1024 * 1024;

function isDataPng(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/png;base64,");
}

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
    // Body: { values: { [fieldId]: string | boolean }, signatures: { [role]: dataUri } }
    // `values` covers CHECKBOX/TEXT/DROPDOWN fields (DATE auto-fills with the
    // signing date). `signatures` must contain a fresh "data:image/png;base64,…"
    // PNG for every signatory role this agreement requires — drawn on the
    // signing page itself, not reused from elsewhere.
    const body = (await req.json().catch(() => ({}))) as {
      values?: Record<string, unknown>;
      signatures?: Record<string, unknown>;
    };
    const rawValues = body.values && typeof body.values === "object" ? body.values : {};
    const rawSignatures =
      body.signatures && typeof body.signatures === "object" ? body.signatures : {};

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

    // Every role this agreement needs a SIGNATURE field for must have a
    // fresh PNG in the request — no silent reuse of a previously captured
    // signature.
    const missingSignatures: string[] = [];
    const signers: SignerImage[] = [];
    for (const role of roles) {
      const img = rawSignatures[role];
      if (!isDataPng(img)) {
        missingSignatures.push(role);
        continue;
      }
      const approxBytes = (img.length * 3) / 4;
      if (approxBytes > MAX_SIGNATURE_BYTES) {
        return NextResponse.json(
          { success: false, error: "Signature image is too large" },
          { status: 400 }
        );
      }
      signers.push({ role, image: img });
    }
    if (missingSignatures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_SIGNATURE",
          error: `Please sign: ${missingSignatures.join(", ")}`,
          missing: missingSignatures,
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
