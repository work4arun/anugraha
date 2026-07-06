/**
 * Shared student progress calculation.
 *
 * A student's `completionPct` / `status` must reflect BOTH:
 *   - required form steps (BatchFormAssignment → StudentFormResponse), and
 *   - agreements for their batch (AgreementTemplate → SignedAgreement),
 *     which act as the final step of induction.
 *
 * Call this after anything that changes either: a form response is
 * submitted/reset, or an agreement is signed/reset. Previously this logic
 * was duplicated in three places (student form-response submit, admin
 * reset-form, admin reset-all) and none of them considered agreements at
 * all, so a student (and the admin roster) could show "Completed" while an
 * agreement was still awaiting signature.
 */

import { prisma } from "./prisma";
import { getPendingAgreements } from "./agreement";

export async function recalculateStudentProgress(studentId: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: { include: { formAssignments: { where: { required: true } } } },
      formResponses: { select: { formTemplateId: true, status: true } },
    },
  });
  if (!student) return;

  const requiredTemplateIds = new Set(
    student.batch.formAssignments.map((a) => a.formTemplateId)
  );
  const submittedIds = new Set(
    student.formResponses
      .filter((r) => r.status === "SUBMITTED" && requiredTemplateIds.has(r.formTemplateId))
      .map((r) => r.formTemplateId)
  );

  const pct =
    requiredTemplateIds.size > 0
      ? Math.round((submittedIds.size / requiredTemplateIds.size) * 100)
      : 100;

  const stepsDone = pct === 100;
  // Only bother checking agreements once steps are actually done — avoids an
  // extra query for the common in-progress case.
  const agreementsPending = stepsDone
    ? (await getPendingAgreements(studentId, student.batchId)).length > 0
    : false;

  const newStatus =
    stepsDone
      ? agreementsPending
        ? "IN_PROGRESS"
        : "COMPLETED"
      : submittedIds.size > 0
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  await prisma.student.update({
    where: { id: studentId },
    data: { completionPct: pct, status: newStatus },
  });
}

/**
 * Recompute every student in a batch. Use this after something that changes
 * eligibility for the WHOLE batch at once — e.g. an agreement template being
 * added, deactivated, or deleted — rather than looping callers manually.
 *
 * Note: this only recomputes status/completionPct. A newly-added agreement
 * can make an already-generated "final" PDF stale (it won't contain the new,
 * unsigned agreement) — callers that create a new agreement should also
 * clear `pdfUrl`/`pdfGeneratedAt` for students who had one. Deactivating or
 * deleting an agreement only ever relaxes requirements, so no PDF already
 * generated becomes incorrect in that direction.
 */
export async function recalculateBatchStudentsProgress(batchId: string): Promise<void> {
  const students = await prisma.student.findMany({
    where: { batchId },
    select: { id: true },
  });

  // Chunk instead of firing one unbounded Promise.all — a large batch (a few
  // hundred students) would otherwise open hundreds of concurrent queries at
  // once against the DB pool from a single request.
  const CHUNK_SIZE = 20;
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map((s) => recalculateStudentProgress(s.id)));
  }
}
