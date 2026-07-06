import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewClient } from "@/components/student/ReviewClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Review Your Induction" };

export default async function ReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") redirect("/login");

  const studentId = session.user.id;

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
    },
  });

  if (!student) redirect("/login");

  const steps = student.batch.formAssignments.map((a) => {
    const response = student.formResponses.find(
      (r) => r.formTemplateId === a.formTemplateId
    );
    const sigs = student.signatures.filter(
      (s) => s.formTemplateId === a.formTemplateId
    );
    return {
      id: a.id,
      order: a.order,
      stepSlug: a.stepSlug,
      name: a.formTemplate.name,
      type: a.formTemplate.type,
      required: a.required,
      status: response?.status ?? "DRAFT",
      data: response?.data,
      signatures: sigs.map((s) => ({ role: s.signatoryRole, url: s.imageUrl })),
    };
  });

  const allRequired = steps.filter((s) => s.required);
  const allSubmitted = allRequired.every((s) => s.status === "SUBMITTED");

  // Agreements are the last step of induction — shown as a final checklist
  // entry here, and the final PDF can't be generated until every one is
  // signed (status COMPLETED).
  const agreementTemplates = await prisma.agreementTemplate.findMany({
    where: { batchId: student.batch.id, isActive: true },
    orderBy: { createdAt: "asc" },
    include: { signedAgreements: { where: { studentId } } },
  });
  const agreements = agreementTemplates.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.signedAgreements[0]?.status ?? "PENDING",
  }));
  const agreementsPending = agreements.filter((a) => a.status !== "COMPLETED");

  const reviewData = {
    student: {
      id: student.id,
      name: student.name,
      regNo: student.regNo,
      email: student.email,
      mobile: student.mobile,
      photoUrl: student.photoUrl,
      pdfUrl: student.pdfUrl,
    },
    batch: {
      name: student.batch.name,
      course: student.batch.course,
      academicYear: student.batch.academicYear,
      institution: {
        code: student.batch.institution.code,
        fullName: student.batch.institution.fullName,
        primaryColor: student.batch.institution.primaryColor ?? "#4E9A2F",
      },
    },
    steps,
    documents: student.documents.map((d) => ({
      id: d.id,
      type: d.documentType,
      label: d.label,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      uploadStatus: d.uploadStatus,
      reviewStatus: d.reviewStatus,
    })),
    allSubmitted,
    agreements,
    agreementsPending: agreementsPending.map((a) => ({ id: a.id, name: a.name })),
  };

  return <ReviewClient reviewData={reviewData} />;
}
