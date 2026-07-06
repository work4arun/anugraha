/**
 * Split shared form templates across batches (one-off data repair).
 *
 * Background
 * ──────────
 * A form template (`form_templates`) is meant to be either:
 *   • a reusable *library master* (isLibrary = true), shown in the Templates
 *     page and cloned when added to a batch, OR
 *   • a *batch-private copy* (isLibrary = false) that exactly one batch step
 *     points at, so editing that step never affects any other batch.
 *
 * Earlier seed data (and edits made before the copy-on-write fix) left some
 * batches' steps pointing directly at the SAME template row — so editing a form
 * in one batch changed it in another. This script repairs that existing data.
 *
 * What it does
 * ────────────
 * For every template row referenced by a batch step, it guarantees the row is
 * used by AT MOST ONE batch step. When a template is shared by more than one
 * step (across one or more batches) — or a batch step still points at a library
 * master — it creates an independent private copy for each extra step and
 * re-points that step to its own copy. Library masters themselves are left
 * intact so they still appear in the Templates page.
 *
 * It is idempotent: run it as many times as you like. After a clean run it
 * reports "nothing to split".
 *
 * Run with:  npx tsx scripts/split-shared-templates.ts
 *   • add  --dry-run  to preview changes without writing.
 *   • needs DATABASE_URL — run it locally/against your DB, not in a sandbox.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Split shared templates${DRY_RUN ? " (dry run)" : ""}\n`);

  // Every batch step, oldest first, with its template's library flag.
  const assignments = await prisma.batchFormAssignment.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      formTemplate: { select: { id: true, isLibrary: true } },
      batch: { select: { name: true, createdById: true } },
    },
  });

  // Group steps by the template they currently point at.
  const byTemplate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = byTemplate.get(a.formTemplateId) ?? [];
    list.push(a);
    byTemplate.set(a.formTemplateId, list);
  }

  let forked = 0;
  let sharedTemplates = 0;

  for (const [templateId, steps] of byTemplate) {
    const isLibrary = steps[0].formTemplate.isLibrary;

    // Which steps must get their own private copy?
    //   • Library master: EVERY step pointing at it should get a private copy
    //     (the master stays in the library, unused by batches).
    //   • Private template shared by >1 step: keep the first step on it, fork
    //     the rest.
    const stepsToFork = isLibrary ? steps : steps.slice(1);

    if (stepsToFork.length === 0) continue; // already private + unique
    sharedTemplates++;

    // Load the source once; every copy is made from it.
    const source = await prisma.formTemplate.findUnique({ where: { id: templateId } });
    if (!source) continue;

    for (const step of stepsToFork) {
      console.log(
        `  • batch "${step.batch.name}" · step "${step.stepSlug}" — ` +
          `${isLibrary ? "points at library master" : "shares a private template"} ` +
          `(template ${templateId.slice(-6)}) → forking`
      );
      if (DRY_RUN) {
        forked++;
        continue;
      }

      const clone = await prisma.formTemplate.create({
        data: {
          name: source.name,
          description: source.description,
          type: source.type,
          schema: source.schema as Prisma.InputJsonValue,
          signatoryRoles: source.signatoryRoles as Prisma.InputJsonValue,
          // Preserve batch ownership where known.
          createdBy: step.batch.createdById ?? source.createdBy,
          isLibrary: false,
        },
      });

      await prisma.batchFormAssignment.update({
        where: { id: step.id },
        data: { formTemplateId: clone.id },
      });
      forked++;
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would fork" : "Forked"} ${forked} step(s) off ` +
      `${sharedTemplates} shared template(s).`
  );
  if (forked === 0) console.log("Nothing to split — every batch step is already independent. ✅");
  else if (!DRY_RUN) console.log("Every batch step now points at its own private template. ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
