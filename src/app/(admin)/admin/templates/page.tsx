import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminTemplatesClient } from "@/components/admin/AdminTemplatesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Form Templates" };

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const templates = await prisma.formTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { batchAssignments: true } } },
  });

  return (
    <AdminTemplatesClient
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        version: t.version,
        assignedCount: t._count.batchAssignments,
      }))}
    />
  );
}
