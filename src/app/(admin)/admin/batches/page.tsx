import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageBatch, isSuperAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AdminBatchesClient } from "@/components/admin/AdminBatchesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch Management" };

export default async function AdminBatchesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  // Visibility: a SUPER_ADMIN sees every batch. Everyone else only sees
  // shared sample templates (isTemplate) plus batches they personally
  // created — one admin's own batches are not visible to another admin.
  // They can still get a copy of someone else's work via a super admin
  // marking it as a template, or by duplicating a template themselves.
  const batches = await prisma.batch.findMany({
    where: isSuperAdmin(session)
      ? undefined
      : { OR: [{ isTemplate: true }, { createdById: session.user.id }] },
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
