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
import { getAgreementProgress } from "./agreement";

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

  const formStepsDone = requiredTemplateIds.size === 0 || submittedIds.size === requiredTemplateIds.size;

  // Agreements are the final induction step — they must count toward
  // completionPct itself, not just the derived status. Otherwise a student
  // with all forms submitted but an agreement still unsigned shows 100%
  // while `status` (correctly) says IN_PROGRESS, which is exactly the
  // "agreement not signed but progress shows 100%" bug this guards against.
  const { total: agreementTotal, completed: agreementCompleted, pending: pendingAgreements } =
    formStepsDone
      ? await getAgreementProgress(studentId, student.batchId)
      : { total: 0, completed: 0, pending: [] as Array<{ id: string; name: string }> };

  const totalSteps = requiredTemplateIds.size + agreementTotal;
  const doneSteps = submittedIds.size + agreementCompleted;

  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 100;

  const agreementsPending = pendingAgreements.length > 0;
  const stepsDone = formStepsDone && !agreementsPending;

  const newStatus =
    stepsDone
      ? "COMPLETED"
      : submittedIds.size > 0 || agreementCompleted > 0
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
