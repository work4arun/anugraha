/**
 * Server-side data fetching helpers for the student portal
 */

import { prisma } from "./prisma";
import type { InductionStep, StudentProfile, StepStatus } from "@/types";

export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        include: {
          institution: true,
          formAssignments: {
            orderBy: { order: "asc" },
            include: {
              formTemplate: {
                select: { id: true, name: true, type: true },
              },
            },
          },
        },
      },
      formResponses: {
        select: { formTemplateId: true, status: true },
      },
    },
  });

  if (!student) return null;

  // Build per-step status
  const responseMap = new Map(
    student.formResponses.map((r) => [r.formTemplateId, r.status])
  );

  const steps: InductionStep[] = student.batch.formAssignments.map((a) => {
    const responseStatus = responseMap.get(a.formTemplateId);
    let status: StepStatus = "not_started";
    if (responseStatus === "SUBMITTED" || responseStatus === "APPROVED") {
      status = "completed";
    } else if (responseStatus === "DRAFT") {
      status = "in_progress";
    }

    return {
      id: a.id,
      order: a.order,
      stepSlug: a.stepSlug,
      name: a.formTemplate.name,
      type: a.formTemplate.type as InductionStep["type"],
      required: a.required,
      status,
      formTemplateId: a.formTemplateId,
    };
  });

  // Calc completion
  const requiredSteps = steps.filter((s) => s.required);
  const doneSteps = requiredSteps.filter((s) => s.status === "completed");
  const completionPct = requiredSteps.length
    ? Math.round((doneSteps.length / requiredSteps.length) * 100)
    : 100;

  return {
    id: student.id,
    regNo: student.regNo,
    name: student.name,
    email: student.email ?? undefined,
    mobile: student.mobile ?? undefined,
    photoUrl: student.photoUrl ?? undefined,
    status: student.status,
    completionPct,
    mustResetPassword: student.mustResetPassword,
    batch: {
      id: student.batch.id,
      name: student.batch.name,
      course: student.batch.course,
      academicYear: student.batch.academicYear,
      logoUrl: student.batch.logoUrl ?? undefined,
      institution: {
        code: student.batch.institution.code,
        name: student.batch.institution.name,
        fullName: student.batch.institution.fullName,
        primaryColor: student.batch.institution.primaryColor ?? undefined,
        accentColor: student.batch.institution.accentColor ?? undefined,
      },
    },
    steps,
  };
}

export async function getNextIncompleteStep(
  studentId: string
): Promise<string | null> {
  const profile = await getStudentProfile(studentId);
  if (!profile) return null;

  const next = profile.steps.find((s) => s.status !== "completed" && s.required);
  return next?.stepSlug ?? null;
}
