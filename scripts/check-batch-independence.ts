/**
 * Batch-independence check.
 *
 * Verifies that a duplicated batch is fully independent of its source:
 *   1. Creates a throwaway source batch with a student, a form template
 *      assignment, and an agreement with fields.
 *   2. Duplicates it the same way the API route does (shared logic re-run
 *      here against the DB).
 *   3. Asserts: no shared student rows, no shared form templates, no shared
 *      agreement rows/fields between the two batches.
 *   4. Mutates the duplicate (renames its template, adds a student, edits its
 *      agreement) and asserts the source is untouched — and vice versa.
 *   5. Cleans up everything it created.
 *
 * Run with:  npx tsx scripts/check-batch-independence.ts
 * (Needs DATABASE_URL — run it locally, not in a sandbox.)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log("Batch-independence check\n");

  const institution = await prisma.institution.findFirst();
  if (!institution) throw new Error("No institution in DB — seed first.");

  const tag = `__indep_check_${Date.now()}`;

  // ── 1. Source batch with student + form + agreement ────────────────────
  const template = await prisma.formTemplate.create({
    data: { name: `${tag}_form`, type: "REGISTRATION", schema: {}, signatoryRoles: [] },
  });
  const src = await prisma.batch.create({
    data: {
      institutionId: institution.id,
      name: `${tag}_src`,
      course: "TEST",
      academicYear: "2026-27",
      formAssignments: {
        create: [{ formTemplateId: template.id, order: 1, stepSlug: "reg", required: true }],
      },
      agreements: {
        create: [
          {
            name: `${tag}_agreement`,
            originalPdfUrl: "/api/uploads/none.pdf",
            pageCount: 1,
            fields: {
              create: [
                { signerRole: "student", fieldType: "SIGNATURE", page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.05, order: 0 },
                { signerRole: "student", fieldType: "DROPDOWN", label: "Pick", options: ["A", "B"], page: 1, x: 0.4, y: 0.1, width: 0.2, height: 0.04, order: 1 },
              ],
            },
          },
        ],
      },
      students: {
        create: [
          {
            regNo: `${tag}_S1`,
            name: "Src Student",
            username: `${tag}_S1`,
            passwordHash: "x",
          },
        ],
      },
    },
    include: { formAssignments: { include: { formTemplate: true } }, agreements: { include: { fields: true } } },
  });

  // ── 2. Duplicate exactly as the API route does ──────────────────────────
  const steps = [];
  for (const a of src.formAssignments) {
    const clone = await prisma.formTemplate.create({
      data: {
        name: a.formTemplate.name,
        type: a.formTemplate.type,
        schema: a.formTemplate.schema ?? {},
        signatoryRoles: a.formTemplate.signatoryRoles ?? [],
        isLibrary: false,
      },
    });
    steps.push({ formTemplateId: clone.id, order: a.order, stepSlug: a.stepSlug, required: a.required });
  }
  const dup = await prisma.batch.create({
    data: {
      institutionId: src.institutionId,
      name: `${tag}_dup`,
      course: src.course,
      academicYear: src.academicYear,
      isTemplate: false,
      formAssignments: { create: steps },
    },
  });
  for (const ag of src.agreements) {
    await prisma.agreementTemplate.create({
      data: {
        batchId: dup.id,
        name: ag.name,
        originalPdfUrl: ag.originalPdfUrl,
        pageCount: ag.pageCount,
        isActive: ag.isActive,
        fields: {
          create: ag.fields.map((f) => ({
            signerRole: f.signerRole,
            fieldType: f.fieldType,
            label: f.label,
            required: f.required,
            options: f.options === null ? undefined : (f.options as object),
            defaultValue: f.defaultValue,
            page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, order: f.order,
          })),
        },
      },
    });
  }

  try {
    // ── 3. No sharing ──────────────────────────────────────────────────────
    console.log("\nNo shared rows:");
    const dupStudents = await prisma.student.findMany({ where: { batchId: dup.id } });
    assert(dupStudents.length === 0, "duplicate starts with zero students");

    const srcAssign = await prisma.batchFormAssignment.findMany({ where: { batchId: src.id } });
    const dupAssign = await prisma.batchFormAssignment.findMany({ where: { batchId: dup.id } });
    assert(
      srcAssign.every((s) => dupAssign.every((d) => d.formTemplateId !== s.formTemplateId)),
      "form templates are deep copies (no shared template ids)"
    );

    const srcAgs = await prisma.agreementTemplate.findMany({ where: { batchId: src.id } });
    const dupAgs = await prisma.agreementTemplate.findMany({ where: { batchId: dup.id } });
    assert(dupAgs.length === srcAgs.length, "agreements copied");
    assert(
      dupAgs.every((d) => srcAgs.every((s) => s.id !== d.id)),
      "agreement rows are independent copies"
    );

    // ── 4. Mutation isolation ──────────────────────────────────────────────
    console.log("\nMutation isolation:");
    await prisma.student.create({
      data: { batchId: dup.id, regNo: `${tag}_S2`, name: "Dup Student", username: `${tag}_S2`, passwordHash: "x" },
    });
    const srcCount = await prisma.student.count({ where: { batchId: src.id } });
    assert(srcCount === 1, "adding a student to the duplicate does not change the source");

    await prisma.formTemplate.update({
      where: { id: dupAssign[0].formTemplateId },
      data: { name: `${tag}_renamed` },
    });
    const srcTemplate = await prisma.formTemplate.findUnique({ where: { id: srcAssign[0].formTemplateId } });
    assert(srcTemplate!.name === `${tag}_form`, "renaming the duplicate's form leaves the source's form untouched");

    await prisma.agreementTemplate.update({ where: { id: dupAgs[0].id }, data: { name: `${tag}_ag_renamed` } });
    const srcAg = await prisma.agreementTemplate.findUnique({ where: { id: srcAgs[0].id } });
    assert(srcAg!.name === `${tag}_agreement`, "renaming the duplicate's agreement leaves the source's untouched");

    await prisma.student.update({
      where: { regNo: `${tag}_S1` },
      data: { name: "Src Student Edited" },
    });
    const dupCount = await prisma.student.count({ where: { batchId: dup.id } });
    assert(dupCount === 1, "editing a source student does not change the duplicate's roster");

    console.log("\nAll independence checks passed ✅");
  } finally {
    // ── 5. Cleanup ─────────────────────────────────────────────────────────
    await prisma.student.deleteMany({ where: { regNo: { startsWith: tag } } });
    await prisma.agreementTemplate.deleteMany({ where: { name: { startsWith: tag } } });
    const assigns = await prisma.batchFormAssignment.findMany({
      where: { batchId: { in: [src.id, dup.id] } },
    });
    await prisma.batchFormAssignment.deleteMany({ where: { batchId: { in: [src.id, dup.id] } } });
    await prisma.formTemplate.deleteMany({
      where: { id: { in: assigns.map((a) => a.formTemplateId) } },
    });
    await prisma.batch.deleteMany({ where: { id: { in: [src.id, dup.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
