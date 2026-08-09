/**
 * GET /api/admin/students/export-pdfs  —  SUPER_ADMIN only
 *
 * Bundles every student's consolidated induction PDF, across ALL batches, into
 * a single .zip download organized into one folder per batch:
 *
 *   Anugraha2026_AllStudents_<timestamp>.zip
 *     ├─ <Institution> — <Batch A>/<RegNo>_<Name>_Anugraha2026.pdf
 *     ├─ <Institution> — <Batch B>/...
 *     └─ _skipped.txt        (only if some students could not be included)
 *
 * Students whose PDF has not been generated yet are generated on-the-fly. Any
 * that can't be produced (e.g. agreements still unsigned) are skipped and listed
 * in `_skipped.txt` inside the archive, so one bad record never fails the whole
 * export.
 *
 * Needs the Node.js runtime (Puppeteer/Chromium) and a generous time budget —
 * generating many PDFs sequentially can take a while on a large cohort.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";
import { generateStudentPdf, AgreementsPendingError } from "@/lib/pdf";
import { readFileBuffer } from "@/lib/storage";
import { createZip, safeZipSegment, type ZipEntry } from "@/lib/zip";
import { pdfFilename } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Every student in every active batch, with the batch + institution context
  // needed to build a readable folder name and PDF filename.
  const students = await prisma.student.findMany({
    where: { batch: { isActive: true } },
    select: {
      id: true,
      name: true,
      regNo: true,
      pdfUrl: true,
      batch: {
        select: {
          name: true,
          institution: { select: { code: true } },
        },
      },
    },
    orderBy: [{ batch: { name: "asc" } }, { regNo: "asc" }],
  });

  if (students.length === 0) {
    return NextResponse.json(
      { success: false, error: "No students found to export." },
      { status: 404 }
    );
  }

  const entries: ZipEntry[] = [];
  const skipped: string[] = [];
  const usedNames = new Set<string>();
  let generated = 0;

  for (const student of students) {
    const folder = safeZipSegment(
      `${student.batch.institution.code} - ${student.batch.name}`,
      "Batch"
    );
    const label = `${student.regNo} (${student.name})`;

    try {
      // Use the existing generated PDF when present; otherwise render it now.
      let pdfUrl = student.pdfUrl;
      if (!pdfUrl) {
        const result = await generateStudentPdf(student.id);
        pdfUrl = result.url;
        generated++;
      }

      const buffer = await readFileBuffer(pdfUrl);

      // Guarantee a unique path even if two students share reg no / name.
      let name = `${folder}/${safeZipSegment(pdfFilename(student.regNo, student.name))}`;
      if (usedNames.has(name)) {
        const base = name.replace(/\.pdf$/i, "");
        let n = 2;
        while (usedNames.has(`${base}_${n}.pdf`)) n++;
        name = `${base}_${n}.pdf`;
      }
      usedNames.add(name);

      entries.push({ name, data: buffer });
    } catch (err) {
      const reason =
        err instanceof AgreementsPendingError
          ? "agreements awaiting signature"
          : err instanceof Error
            ? err.message
            : String(err);
      skipped.push(`${folder}: ${label} — ${reason}`);
      console.error(`[export-pdfs] skipped ${label}:`, err);
    }
  }

  if (entries.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No PDFs could be produced for any student.",
        skipped,
      },
      { status: 422 }
    );
  }

  // Include a manifest of anything that couldn't be added, so the admin knows.
  if (skipped.length > 0) {
    const note =
      `Anugraha 2026 — students NOT included in this export (${skipped.length}):\n\n` +
      skipped.map((s) => `• ${s}`).join("\n") +
      `\n\nThese usually need their induction / agreements completed before a PDF can be generated.\n`;
    entries.push({ name: "_skipped.txt", data: Buffer.from(note, "utf8") });
  }

  const zip = createZip(entries);
  // NextResponse's BodyInit types don't accept a Node Buffer directly; wrap it
  // in a plain ArrayBuffer-backed Uint8Array (same pattern as the uploads route).
  const body = new Uint8Array(zip);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `Anugraha2026_AllStudents_${stamp}.zip`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
      "X-Export-Total": String(students.length),
      "X-Export-Included": String(entries.length - (skipped.length > 0 ? 1 : 0)),
      "X-Export-Generated": String(generated),
      "X-Export-Skipped": String(skipped.length),
      "Cache-Control": "no-store",
    },
  });
}
