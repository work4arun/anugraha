import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentAgreementsDetailed } from "@/lib/agreement";
import { AgreementSigningClient } from "@/components/student/AgreementSigningClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign Your Agreement" };

/**
 * Forced final induction step. Only reachable once every required form step
 * is submitted — if forms are still incomplete, or there's nothing left to
 * sign, this redirects rather than showing a dead end.
 */
export default async function AgreementsStepPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    redirect("/login");
  }

  const studentId = session.user.id;
  const batchId = session.user.batchId;
  if (!batchId) redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: { include: { formAssignments: { where: { required: true } } } },
      formResponses: { select: { formTemplateId: true, status: true } },
    },
  });
  if (!student) redirect("/login");

  const requiredIds = new Set(student.batch.formAssignments.map((a) => a.formTemplateId));
  const submittedIds = new Set(
    student.formResponses
      .filter((r) => r.status === "SUBMITTED" && requiredIds.has(r.formTemplateId))
      .map((r) => r.formTemplateId)
  );
  const formStepsDone = requiredIds.size === 0 || submittedIds.size === requiredIds.size;

  // Agreements are the LAST step — don't let a student reach this page
  // before finishing the required forms.
  if (!formStepsDone) redirect("/dashboard");

  const agreements = await getStudentAgreementsDetailed(studentId, batchId);
  const pending = agreements.filter((a) => a.status !== "COMPLETED");

  // Nothing left to sign — this step is already done.
  if (pending.length === 0) redirect("/review");

  return (
    <AgreementSigningClient
      agreements={pending}
      studentName={session.user.name ?? ""}
      logoUrl={student.batch.logoUrl ?? ""}
    />
  );
}
