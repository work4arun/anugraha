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

  const docs = await prisma.document.findMany({
    where: { studentId: params.id },
  });

  const sigs = await prisma.signature.findMany({
    where: { studentId: params.id },
  });

  return (
    <AdminStudentDetailClient
      profile={profile}
      documents={docs.map((d) => ({
        id: d.id,
        type: d.documentType,
        label: d.label,
        fileUrl: d.fileUrl,
        reviewStatus: d.reviewStatus,
        reviewNote: d.reviewNote,
      }))}
    />
  );
}
