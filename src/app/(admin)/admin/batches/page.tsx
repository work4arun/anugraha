import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageBatch } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AdminBatchesClient } from "@/components/admin/AdminBatchesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch Management" };

export default async function AdminBatchesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const batches = await prisma.batch.findMany({
    include: {
      institution: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { students: true, formAssignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const institutions = await prisma.institution.findMany({
    select: { id: true, code: true, name: true },
  });

  return (
    <AdminBatchesClient
      batches={batches.map((b) => ({
        id: b.id,
        name: b.name,
        course: b.course,
        academicYear: b.academicYear,
        isActive: b.isActive,
        isTemplate: b.isTemplate,
        institutionCode: b.institution.code,
        studentCount: b._count.students,
        formCount: b._count.formAssignments,
        ownerName: b.createdBy?.name ?? null,
        canManage: canManageBatch(session, b),
      }))}
      institutions={institutions}
    />
  );
}
