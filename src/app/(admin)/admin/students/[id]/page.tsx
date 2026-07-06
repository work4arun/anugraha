import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentProfile } from "@/lib/student";
import { AdminStudentDetailClient } from "@/components/admin/AdminStudentDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Student Detail" };

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const profile = await getStudentProfile(params.id);
  if (!profile) notFound();

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    select: { pdfUrl: true, pdfGeneratedAt: true },
  });

  const docs = await prisma.document.findMany({
    where: { studentId: params.id },
  });

  const agreementTemplates = await prisma.agreementTemplate.findMany({
    where: { batchId: profile.batch.id, isActive: true },
    include: { signedAgreements: { where: { studentId: params.id } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AdminStudentDetailClient
      profile={profile}
      pdfUrl={student?.pdfUrl ?? null}
      pdfGeneratedAt={student?.pdfGeneratedAt?.toISOString() ?? null}
      documents={docs.map((d) => ({
        id: d.id,
        type: d.documentType,
        label: d.label,
        fileUrl: d.fileUrl,
        reviewStatus: d.reviewStatus,
        reviewNote: d.reviewNote,
      }))}
      agreements={agreementTemplates.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.signedAgreements[0]?.status ?? "PENDING",
        signedAt: a.signedAgreements[0]?.signedAt?.toISOString() ?? null,
      }))}
    />
  );
}
