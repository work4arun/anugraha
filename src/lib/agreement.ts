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
 * Generate (or regenerate) the signed PDF for a student + agreement template.
 * Only fields whose signerRole has a provided image are stamped; missing
 * signers are simply left blank, so this can run for a partial signing too.
 *
 * Returns the stored url of the produced PDF.
 */
export async function stampAgreement(
  studentId: string,
  agreementTemplateId: string,
  signers: SignerImage[],
  values: FieldValues = {}
): Promise<{ url: string; stamped: number }> {
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

    // DATE (auto signing date) and TEXT (student-typed value).
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
  const safeName = template.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 40).toLowerCase() || "agreement";
  const { url } = await uploadFile(
    Buffer.from(outBytes),
    `${safeName}_signed.pdf`,
    "application/pdf",
    studentId,
    "agreements"
  );

  return { url, stamped };
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
