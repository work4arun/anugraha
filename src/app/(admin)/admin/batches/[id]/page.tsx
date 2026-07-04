import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageBatch } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AdminBatchDetailClient } from "@/components/admin/AdminBatchDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch Detail" };

export default async function AdminBatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      institution: true,
      formAssignments: {
        orderBy: { order: "asc" },
        include: { formTemplate: { select: { id: true, name: true, type: true } } },
      },
      students: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          regNo: true,
          name: true,
          email: true,
          mobile: true,
          status: true,
          completionPct: true,
          lastLoginAt: true,
          pdfUrl: true,
        },
      },
    },
  });

  if (!batch) notFound();

  return (
    <AdminBatchDetailClient
      canManage={canManageBatch(session, batch)}
      batch={{
        id: batch.id,
        name: batch.name,
        course: batch.course,
        academicYear: batch.academicYear,
        isActive: batch.isActive,
        isTemplate: batch.isTemplate,
        logoUrl: batch.logoUrl,
        institution: {
          code: batch.institution.code,
          fullName: batch.institution.fullName,
        },
        formAssignments: batch.formAssignments.map((a) => ({
          id: a.id,
          order: a.order,
          stepSlug: a.stepSlug,
          required: a.required,
          formTemplate: {
            id: a.formTemplate.id,
            name: a.formTemplate.name,
            type: a.formTemplate.type,
          },
        })),
        students: batch.students.map((s) => ({
          id: s.id,
          regNo: s.regNo,
          name: s.name,
          email: s.email,
          mobile: s.mobile,
          status: s.status,
          completionPct: s.completionPct,
          lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
          pdfUrl: s.pdfUrl,
        })),
      }}
    />
  );
}
