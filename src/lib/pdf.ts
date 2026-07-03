/**
 * PDF generation using Puppeteer.
 * Renders the student's completed induction data into a print-ready A4 PDF.
 * Called server-side only — never import this in client components.
 */

import puppeteer from "puppeteer";
import { prisma } from "./prisma";
import { uploadFile, hashBuffer } from "./storage";
import { pdfFilename, formatDate } from "./utils";

interface PdfGenerationResult {
  url: string;
  filename: string;
}

export async function generateStudentPdf(
  studentId: string
): Promise<PdfGenerationResult> {
  // ── Fetch all data ────────────────────────────────────────────────────────
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        include: {
          institution: true,
          formAssignments: {
            orderBy: { order: "asc" },
            include: { formTemplate: true },
          },
        },
      },
      formResponses: true,
      signatures: true,
      documents: true,
      rowAcknowledgments: true,
    },
  });

  if (!student) throw new Error("Student not found");

  const html = buildPdfHtml(student);

  // ── Launch Puppeteer ──────────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size:9px;width:100%;text-align:center;color:#666;font-family:sans-serif;">
        Rathinam Anugraha 2026 — ${student.name} (${student.regNo}) — CONFIDENTIAL
      </div>`,
    footerTemplate: `
      <div style="font-size:9px;width:100%;text-align:center;color:#666;font-family:sans-serif;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`,
  });

  await browser.close();

  // ── Upload PDF ────────────────────────────────────────────────────────────
  const filename = pdfFilename(student.regNo, student.name);
  const buffer = Buffer.from(pdfBuffer);

  const { url } = await uploadFile(buffer, filename, "application/pdf", studentId, "pdfs");

  // Update student record
  await prisma.student.update({
    where: { id: studentId },
    data: {
      pdfUrl: url,
      pdfGeneratedAt: new Date(),
      status: "COMPLETED",
    },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      studentId,
      actorType: "system",
      action: "PDF_GENERATED",
      entityType: "Student",
      entityId: studentId,
      metadata: { filename, url },
    },
  });

  return { url, filename };
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildPdfHtml(student: {
  name: string;
  regNo: string;
  email?: string | null;
  mobile?: string | null;
  photoUrl?: string | null;
  batch: {
    name: string;
    course: string;
    academicYear: string;
    institution: { fullName: string; code: string };
    formAssignments: Array<{
      order: number;
      formTemplateId: string;
      formTemplate: { name: string; type: string; schema: unknown };
    }>;
  };
  formResponses: Array<{ formTemplateId: string; data: unknown; submittedAt?: Date | null }>;
  signatures: Array<{ formTemplateId: string; signatoryRole: string; imageUrl: string; signedAt: Date }>;
  rowAcknowledgments: Array<{ formTemplateId: string; rowId: string; acknowledgedAt: Date }>;
  documents: Array<{ label: string; fileUrl: string; uploadStatus: string }>;
}): string {
  const generatedAt = formatDate(new Date());

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rathinam Anugraha 2026 — ${student.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111;
      background: white;
    }
    .page-break { page-break-before: always; }
    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 0 30px;
      border-bottom: 3px solid #4E7C1E;
    }
    .cover h1 { font-size: 22px; color: #4E7C1E; margin-bottom: 4px; }
    .cover h2 { font-size: 14px; color: #555; font-weight: normal; margin-bottom: 20px; }
    .cover table { border-collapse: collapse; width: 400px; }
    .cover table td { padding: 6px 12px; border: 1px solid #E5E7EB; }
    .cover table td:first-child { font-weight: 600; background: #ECFBF3; width: 140px; }
    .section { margin-top: 24px; }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #4E7C1E;
      background: #ECFBF3;
      padding: 8px 12px;
      border-left: 4px solid #4E7C1E;
      margin-bottom: 12px;
    }
    .clause-list { padding-left: 0; list-style: none; }
    .clause-list li {
      display: flex; gap: 8px; padding: 6px 0;
      border-bottom: 1px solid #F3F4F6;
      font-size: 10px; line-height: 1.5;
    }
    .clause-list li .num {
      color: #4E7C1E; font-weight: 700; min-width: 20px;
    }
    table.deliverables {
      width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px;
    }
    table.deliverables th {
      background: #4E7C1E; color: white; padding: 6px 8px; text-align: left;
    }
    table.deliverables td {
      padding: 6px 8px; border: 1px solid #E5E7EB; vertical-align: top;
    }
    table.deliverables tr:nth-child(even) td { background: #F9FAFB; }
    .ack-cell { text-align: center; }
    .ack-yes { color: #16A34A; font-weight: 700; }
    .sig-block {
      display: flex; gap: 30px; flex-wrap: wrap; margin-top: 16px;
    }
    .sig-item {
      display: flex; flex-direction: column; gap: 4px; min-width: 160px;
    }
    .sig-item label { font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .sig-item img { max-height: 60px; max-width: 180px; border-bottom: 1.5px solid #111; padding-bottom: 4px; }
    .sig-item .signed-at { font-size: 8px; color: #9CA3AF; }
    .declaration {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      padding: 10px 12px;
      font-size: 10px;
      line-height: 1.6;
      margin-top: 12px;
      border-radius: 4px;
    }
    .footer-stamp {
      margin-top: 20px;
      font-size: 9px;
      color: #9CA3AF;
      text-align: center;
    }
    .doc-list { list-style: none; }
    .doc-list li {
      padding: 6px 0;
      border-bottom: 1px solid #F3F4F6;
      font-size: 10px;
    }
    .doc-list li .check { color: #16A34A; margin-right: 6px; }
  </style>
</head>
<body>

  <!-- ─── COVER PAGE ──────────────────────────────────────────────────────── -->
  <div class="cover">
    <h1>Rathinam Anugraha 2026</h1>
    <h2>Anugraha 2026 — Student Induction Record</h2>
    <h2 style="font-size:12px;margin-top:-14px;">${student.batch.institution.fullName}</h2>
    <table>
      <tr><td>Student Name</td><td>${student.name}</td></tr>
      <tr><td>Reg. No.</td><td>${student.regNo}</td></tr>
      <tr><td>Course</td><td>${student.batch.course}</td></tr>
      <tr><td>Batch</td><td>${student.batch.name}</td></tr>
      <tr><td>Academic Year</td><td>${student.batch.academicYear}</td></tr>
      ${student.email ? `<tr><td>Email</td><td>${student.email}</td></tr>` : ""}
      ${student.mobile ? `<tr><td>Mobile</td><td>${student.mobile}</td></tr>` : ""}
      <tr><td>Generated On</td><td>${generatedAt}</td></tr>
    </table>
  </div>

  ${student.batch.formAssignments
    .map((a, idx) => {
      // Only the signatures that belong to THIS template/section.
      const sigs = student.signatures.filter(
        (s) => s.formTemplateId === a.formTemplateId
      );
      const schema = a.formTemplate.schema as Record<string, unknown>;
      const type = a.formTemplate.type;

      let content = "";

      if (type === "REGISTRATION") {
        content = `<p style="font-size:10px;color:#6B7280;font-style:italic">Form data captured digitally</p>`;
      }

      if (type === "ACKNOWLEDGMENT") {
        const clauses = (schema.clauses ?? []) as string[];
        content = `
          <ol class="clause-list">
            ${clauses.map((c, i) => `<li><span class="num">${i + 1}.</span><span>${c}</span></li>`).join("")}
          </ol>
          <div class="declaration">${schema.acknowledgmentText ?? ""}</div>
        `;
      }

      if (type === "DELIVERABLES_TABLE") {
        const rows = (schema.rows ?? []) as Array<{
          id: string; sno: number; deliverable: string; keyPoints: string;
        }>;
        const ackedIds = new Set(
          student.rowAcknowledgments.map((r) => r.rowId)
        );
        content = `
          <table class="deliverables">
            <thead>
              <tr>
                <th style="width:30px">S.No</th>
                <th style="width:120px">Deliverable</th>
                <th>Key Points / Inclusions</th>
                <th style="width:60px;text-align:center">Acknowledged</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td>${r.sno}</td>
                  <td style="white-space:pre-line;font-weight:600">${r.deliverable}</td>
                  <td style="white-space:pre-line">${r.keyPoints}</td>
                  <td class="ack-cell">
                    ${ackedIds.has(r.id) ? '<span class="ack-yes">✓</span>' : "—"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="declaration">${schema.declaration ?? ""}</div>
        `;
      }

      const sigHtml = sigs.length
        ? `<div class="sig-block">
            ${sigs.map((s) => `
              <div class="sig-item">
                <img src="${s.imageUrl}" alt="Signature" />
                <label>${s.signatoryRole.replace(/_/g, " ")}</label>
                <span class="signed-at">Signed: ${formatDate(s.signedAt)}</span>
              </div>
            `).join("")}
          </div>`
        : "";

      return `
        <div class="${idx > 0 ? "page-break" : ""} section">
          <div class="section-title">
            ${a.order}. ${a.formTemplate.name}
          </div>
          ${content}
          ${sigHtml}
        </div>
      `;
    })
    .join("")}

  <!-- ─── DOCUMENTS PAGE ─────────────────────────────────────────────────── -->
  <div class="page-break section">
    <div class="section-title">Uploaded Documents</div>
    <ul class="doc-list">
      ${student.documents
        .map(
          (d) => `
          <li>
            <span class="check">✓</span>
            ${d.label}
            <span style="color:#9CA3AF;margin-left:8px">(${d.uploadStatus})</span>
          </li>`
        )
        .join("")}
    </ul>
  </div>

  <div class="footer-stamp">
    This document was generated digitally by the Rathinam Anugraha 2026 platform and is valid without a wet signature.
    Institution: ${student.batch.institution.fullName} · Generated: ${generatedAt}
  </div>

</body>
</html>
  `;
}
