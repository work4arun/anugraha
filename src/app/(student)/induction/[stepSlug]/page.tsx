import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeJson } from "@/lib/utils";
import { InductionStepClient } from "@/components/student/InductionStepClient";
import type { Metadata } from "next";

const DEFAULT_SIGNATORY_ROLES = [
  { role: "student", label: "Signature of the Student" },
  { role: "parent", label: "Signature of the Parent / Guardian" },
];

interface Props {
  params: { stepSlug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Induction — ${params.stepSlug.replace(/-/g, " ")}` };
}

export default async function InductionStepPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    redirect("/login");
  }

  const { stepSlug } = params;
  const studentId = session.user.id;
  const batchId = session.user.batchId!;

  // Load assignment for this step
  const assignment = await prisma.batchFormAssignment.findUnique({
    where: {
      batchId_stepSlug: { batchId, stepSlug },
    },
    include: {
      formTemplate: true,
      batch: { include: { institution: true } },
    },
  });

  if (!assignment) notFound();

  // Load all batch steps (for StepBar)
  const allSteps = await prisma.batchFormAssignment.findMany({
    where: { batchId },
    orderBy: { order: "asc" },
    include: { formTemplate: { select: { name: true, type: true } } },
  });

  // Load existing response (if any)
  const existingResponse = await prisma.studentFormResponse.findUnique({
    where: {
      studentId_formTemplateId: {
        studentId,
        formTemplateId: assignment.formTemplateId,
      },
    },
  });

  // Load existing signatures for this template
  const existingSignatures = await prisma.signature.findMany({
    where: { studentId, formTemplateId: assignment.formTemplateId },
  });

  // Load prior signatures from other forms (for reuse offer)
  const priorSignatures = await prisma.signature.findMany({
    where: {
      studentId,
      formTemplateId: { not: assignment.formTemplateId },
    },
    orderBy: { signedAt: "desc" },
    distinct: ["signatoryRole"],
  });

  // Load deliverable row acknowledgments (for DELIVERABLES_TABLE)
  const rowAcks = await prisma.deliverableRowAcknowledgment.findMany({
    where: { studentId, formTemplateId: assignment.formTemplateId },
  });

  // Load uploaded documents
  const documents = await prisma.document.findMany({
    where: { studentId },
  });

  const stepData = {
    assignment: {
      id: assignment.id,
      order: assignment.order,
      stepSlug: assignment.stepSlug,
      required: assignment.required,
      formTemplate: {
        id: assignment.formTemplate.id,
        name: assignment.formTemplate.name,
        type: assignment.formTemplate.type,
        schema: assignment.formTemplate.schema,
        signatoryRoles: normalizeJson(
          assignment.formTemplate.signatoryRoles,
          DEFAULT_SIGNATORY_ROLES
        ),
        version: assignment.formTemplate.version,
      },
    },
    allSteps: allSteps.map((s) => ({
      stepSlug: s.stepSlug,
      name: s.formTemplate.name,
      order: s.order,
    })),
    existingData: existingResponse?.data ?? null,
    existingStatus: existingResponse?.status ?? "DRAFT",
    existingSignatures: existingSignatures.map((s) => ({
      role: s.signatoryRole,
      imageUrl: s.imageUrl,
    })),
    priorSignatures: priorSignatures.map((s) => ({
      role: s.signatoryRole,
      imageUrl: s.imageUrl,
    })),
    acknowledgedRowIds: rowAcks.map((r) => r.rowId),
    documents: documents.map((d) => ({
      id: d.id,
      type: d.documentType,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      uploadStatus: d.uploadStatus,
    })),
    institution: {
      code: assignment.batch.institution.code,
      fullName: assignment.batch.institution.fullName,
      primaryColor: assignment.batch.institution.primaryColor ?? "#4E9A2F",
    },
    studentId,
    batchId,
    studentName: session.user.name ?? "",
    batchCourse: assignment.batch.course,
    logoUrl: assignment.batch.logoUrl ?? "",
  };

  return <InductionStepClient stepData={stepData} />;
}
