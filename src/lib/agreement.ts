/**
 * Agreement signing — stamps captured signature images onto an uploaded PDF
 * at admin-placed signature fields, then saves the completed PDF to storage.
 *
 * Server-side only (uses pdf-lib + storage read/write).
 *
 * Coordinate model: each AgreementSignatureField stores normalized geometry
 * (x, y, width, height in 0..1) with the origin at the TOP-LEFT of the page —
 * this matches how the browser placement editor reports positions. pdf-lib's
 * origin is BOTTOM-LEFT, so we flip the y-axis when drawing.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./prisma";
import { uploadFile, readFileBuffer, resolveToDataUri } from "./storage";
import { resolveFieldAutofill, type AutofillStudent } from "./agreementAutofill";

export interface SignerImage {
  /** signerRole the image belongs to, e.g. "student" | "parent" */
  role: string;
  /** PNG signature — a data URI or a stored url/key readable by storage. */
  image: string;
}

/**
 * Values for non-signature fields, keyed by AgreementSignatureField.id:
 *   CHECKBOX → boolean (true = ticked)
 *   TEXT     → string typed by the student
 *   DROPDOWN → the selected option (validated against field.options upstream)
 *   DATE     → ignored; always stamped with the signing date
 */
export type FieldValues = Record<string, string | boolean>;

function dataUriToBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.includes(",") ? dataUri.slice(dataUri.indexOf(",") + 1) : dataUri;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

async function loadPngBytes(image: string): Promise<Uint8Array | null> {
  try {
    if (image.startsWith("data:")) return dataUriToBytes(image);
    // Otherwise it's a stored url/key — read the raw file.
    const buf = await readFileBuffer(image);
    return new Uint8Array(buf);
  } catch (err) {
    console.warn("[agreement] could not load signature image:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Render the stamped agreement PDF in memory (no upload, no DB writes).
 * Only fields whose signerRole has a provided image are stamped; missing
 * signers are simply left blank, so this can run for a partial signing too.
 */
export async function renderAgreementBytes(
  agreementTemplateId: string,
  signers: SignerImage[],
  values: FieldValues = {}
): Promise<{ bytes: Uint8Array; stamped: number; templateName: string }> {
  const template = await prisma.agreementTemplate.findUnique({
    where: { id: agreementTemplateId },
    include: { fields: true },
  });
  if (!template) throw new Error("Agreement template not found");

  // Load the original, unsigned PDF.
  const srcBytes = await readFileBuffer(template.originalPdfUrl);
  const pdf = await PDFDocument.load(srcBytes);
  const pages = pdf.getPages();

  // Preload each signer's PNG once.
  const pngByRole = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  for (const s of signers) {
    const bytes = await loadPngBytes(s.image);
    if (!bytes) continue;
    try {
      pngByRole.set(s.role, await pdf.embedPng(bytes));
    } catch (err) {
      console.warn(`[agreement] embedPng failed for role "${s.role}":`, err instanceof Error ? err.message : err);
    }
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.07, 0.09, 0.15);
  const signingDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let stamped = 0;
  for (const field of template.fields) {
    const pageIndex = Math.min(Math.max(field.page - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { width: pw, height: ph } = page.getSize();

    const boxW = field.width * pw;
    const boxH = field.height * ph;
    const boxX = field.x * pw;
    // Flip Y: normalized y is from the top; pdf-lib draws from the bottom.
    const boxY = ph - field.y * ph - boxH;

    if (field.fieldType === "SIGNATURE") {
      const png = pngByRole.get(field.signerRole);
      if (!png) continue; // this signer hasn't signed yet

      // Fit the signature inside the box, preserving aspect ratio, centered.
      const scale = Math.min(boxW / png.width, boxH / png.height);
      const drawW = png.width * scale;
      const drawH = png.height * scale;
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;

      page.drawImage(png, { x: drawX, y: drawY, width: drawW, height: drawH });
      stamped++;
      continue;
    }

    if (field.fieldType === "CHECKBOX") {
      if (values[field.id] !== true) continue; // not ticked
      // Draw a ✓ as two strokes, fitted inside the box.
      const s = Math.min(boxW, boxH);
      const cx = boxX + boxW / 2;
      const cy = boxY + boxH / 2;
      const t = Math.max(s * 0.12, 1);
      page.drawLine({
        start: { x: cx - s * 0.32, y: cy + s * 0.02 },
        end: { x: cx - s * 0.08, y: cy - s * 0.26 },
        thickness: t,
        color: ink,
      });
      page.drawLine({
        start: { x: cx - s * 0.08, y: cy - s * 0.26 },
        end: { x: cx + s * 0.36, y: cy + s * 0.3 },
        thickness: t,
        color: ink,
      });
      stamped++;
      continue;
    }

    // DATE (auto signing date), TEXT (student-typed), DROPDOWN (selected
    // option) — all stamp as text with the same box-fitting logic.
    let text =
      field.fieldType === "DATE"
        ? signingDate
        : String(values[field.id] ?? "").trim();
    if (!text) continue;

    // Helvetica can only encode WinAnsi — strip characters it can't draw
    // (e.g. Tamil script) rather than throwing and failing the whole PDF.
    try {
      font.widthOfTextAtSize(text, 10);
    } catch {
      text = text.replace(/[^\x20-\x7E]/g, "").trim();
      if (!text) continue;
    }

    // Fit the font size to the box: start from the height, shrink to fit width.
    let size = Math.min(boxH * 0.72, 14);
    const maxW = boxW * 0.96;
    while (size > 5 && font.widthOfTextAtSize(text, size) > maxW) size -= 0.5;

    page.drawText(text, {
      x: boxX + (boxW - font.widthOfTextAtSize(text, size)) / 2,
      y: boxY + (boxH - size) / 2 + size * 0.12,
      size,
      font,
      color: ink,
    });
    stamped++;
  }

  const outBytes = await pdf.save();
  return { bytes: outBytes, stamped, templateName: template.name };
}

/**
 * Generate (or regenerate) the signed PDF for a student + agreement template
 * and save it to storage. Returns the stored url of the produced PDF.
 */
export async function stampAgreement(
  studentId: string,
  agreementTemplateId: string,
  signers: SignerImage[],
  values: FieldValues = {}
): Promise<{ url: string; stamped: number }> {
  const { bytes, stamped, templateName } = await renderAgreementBytes(
    agreementTemplateId,
    signers,
    values
  );

  const safeName = templateName.replace(/[^a-z0-9]+/gi, "_").slice(0, 40).toLowerCase() || "agreement";
  const { url } = await uploadFile(
    Buffer.from(bytes),
    `${safeName}_signed.pdf`,
    "application/pdf",
    studentId,
    "agreements"
  );

  return { url, stamped };
}

/**
 * Agreement completion for a student's batch: how many active agreement
 * templates exist, how many the student has fully signed (SignedAgreement
 * with status COMPLETED), and which ones are still pending. This is the
 * single source of truth for both "is this student done with agreements"
 * (pending.length === 0) and "how many agreement steps count toward overall
 * progress" (total / completed) — callers must not compute total/completed
 * separately, or the two can drift out of sync.
 */
export async function getAgreementProgress(
  studentId: string,
  batchId: string
): Promise<{ total: number; completed: number; pending: Array<{ id: string; name: string }> }> {
  const templates = await prisma.agreementTemplate.findMany({
    where: { batchId, isActive: true },
    select: { id: true, name: true },
  });
  if (templates.length === 0) return { total: 0, completed: 0, pending: [] };

  const completedRows = await prisma.signedAgreement.findMany({
    where: {
      studentId,
      agreementTemplateId: { in: templates.map((t) => t.id) },
      status: "COMPLETED",
    },
    select: { agreementTemplateId: true },
  });
  const completedIds = new Set(completedRows.map((s) => s.agreementTemplateId));
  const pending = templates.filter((t) => !completedIds.has(t.id));

  return { total: templates.length, completed: completedIds.size, pending };
}

/**
 * Agreements for this batch that the student hasn't fully signed yet
 * (no SignedAgreement row, or one whose status isn't COMPLETED). Used to
 * gate final PDF generation — an agreement still "awaiting signature"
 * must not be treated as done.
 */
export async function getPendingAgreements(
  studentId: string,
  batchId: string
): Promise<Array<{ id: string; name: string }>> {
  return (await getAgreementProgress(studentId, batchId)).pending;
}

/**
 * Convenience: resolve a student's stored signature images (from the existing
 * Signature records) into SignerImage[] for the given roles. Reuses the same
 * canvas signatures captured during induction.
 */
export async function collectStudentSignatures(
  studentId: string,
  roles: string[]
): Promise<SignerImage[]> {
  const sigs = await prisma.signature.findMany({
    where: { studentId, signatoryRole: { in: roles } },
    orderBy: { signedAt: "desc" },
    distinct: ["signatoryRole"],
  });

  const out: SignerImage[] = [];
  for (const s of sigs) {
    const dataUri = await resolveToDataUri(s.imageUrl);
    if (dataUri) out.push({ role: s.signatoryRole, image: dataUri });
  }
  return out;
}

export interface StudentAgreementField {
  id: string;
  fieldType: "CHECKBOX" | "TEXT" | "DROPDOWN";
  label: string | null;
  required: boolean;
  options: string[];
  defaultValue: string | null;
  page: number;
  /**
   * When set, this TEXT field is auto-filled from the student's record (name,
   * register number, parent details, …). `autofillValue` is the resolved value
   * to show read-only; the student doesn't fill it in and it never counts as a
   * missing required field.
   */
  autofillKey: string | null;
  autofillValue: string | null;
}

export interface StudentAgreementItem {
  id: string;
  name: string;
  pageCount: number;
  originalPdfUrl: string;
  /** Signatory roles (e.g. "student", "parent") this agreement needs a fresh signature from. */
  roles: string[];
  inputFields: StudentAgreementField[];
  status: "PENDING" | "PARTIAL" | "COMPLETED";
  signedPdfUrl: string | null;
  signedAt: string | null;
}

/**
 * The batch's active agreements from the signed-in student's point of view —
 * shared by the dashboard status list (GET /api/student/agreements) and the
 * dedicated full-page signing step, so both always agree on what's pending,
 * what fields need filling, and which roles need a signature.
 */
export async function getStudentAgreementsDetailed(
  studentId: string,
  batchId: string
): Promise<StudentAgreementItem[]> {
  // Load once so TEXT fields bound to student data can be pre-resolved for the
  // signing UI (the stamped PDF resolves them again server-side at sign time).
  const autofillStudent = (await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      regNo: true,
      email: true,
      mobile: true,
      gender: true,
      accommodation: true,
      boardingPoint: true,
      fatherName: true,
      fatherMobile: true,
      fatherOccupation: true,
      motherName: true,
      motherMobile: true,
      motherOccupation: true,
    },
  })) as AutofillStudent | null;

  const agreements = await prisma.agreementTemplate.findMany({
    where: { batchId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      fields: {
        select: {
          id: true,
          signerRole: true,
          fieldType: true,
          label: true,
          required: true,
          options: true,
          defaultValue: true,
          page: true,
        },
        orderBy: { order: "asc" },
      },
      signedAgreements: { where: { studentId } },
    },
  });

  return agreements.map((a) => {
    const signed = a.signedAgreements[0];
    return {
      id: a.id,
      name: a.name,
      pageCount: a.pageCount,
      originalPdfUrl: a.originalPdfUrl,
      roles: Array.from(
        new Set(a.fields.filter((f) => f.fieldType === "SIGNATURE").map((f) => f.signerRole))
      ),
      // CHECKBOX/TEXT/DROPDOWN need input from the student at signing time
      // (send them back as `values` keyed by field id); DATE is auto-filled.
      inputFields: a.fields
        .filter(
          (f) =>
            f.fieldType === "CHECKBOX" ||
            f.fieldType === "TEXT" ||
            f.fieldType === "DROPDOWN"
        )
        .map((f) => {
          const auto = autofillStudent ? resolveFieldAutofill(f, autofillStudent) : null;
          return {
            id: f.id,
            fieldType: f.fieldType as "CHECKBOX" | "TEXT" | "DROPDOWN",
            label: f.label,
            required: f.required,
            options: Array.isArray(f.options) ? (f.options as string[]) : [],
            defaultValue: f.defaultValue,
            page: f.page,
            autofillKey: auto?.key ?? null,
            autofillValue: auto ? auto.value : null,
          };
        }),
      status: (signed?.status ?? "PENDING") as "PENDING" | "PARTIAL" | "COMPLETED",
      signedPdfUrl: signed?.signedPdfUrl ?? null,
      signedAt: signed?.signedAt ? signed.signedAt.toISOString() : null,
    };
  });
}
