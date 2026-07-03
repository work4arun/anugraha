import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminBatchNewClient } from "@/components/admin/AdminBatchNewClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Batch" };

export default async function AdminBatchNewPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const [institutions, templates] = await Promise.all([
    prisma.institution.findMany({ select: { id: true, code: true, fullName: true } }),
    prisma.formTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  return (
    <AdminBatchNewClient
      institutions={institutions}
      templates={templates.map((t) => ({ id: t.id, name: t.name, type: t.type }))}
    />
  );
}
