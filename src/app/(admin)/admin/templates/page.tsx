import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AdminTemplatesClient } from "@/components/admin/AdminTemplatesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Form Templates" };

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const superAdmin = isSuperAdmin(session);

  const [templates, admins] = await Promise.all([
    prisma.formTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { batchAssignments: true } } },
    }),
    prisma.admin.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const adminName = new Map(admins.map((a) => [a.id, a.name]));

  return (
    <AdminTemplatesClient
      isSuperAdmin={superAdmin}
      admins={admins}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        version: t.version,
        assignedCount: t._count.batchAssignments,
        ownerId: t.createdBy,
        ownerName: t.createdBy ? adminName.get(t.createdBy) ?? null : null,
      }))}
    />
  );
}
