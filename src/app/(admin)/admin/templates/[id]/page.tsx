import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeJson } from "@/lib/utils";
import { AdminTemplateEditorClient } from "@/components/admin/AdminTemplateEditorClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Template" };

export default async function AdminTemplateEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: { _count: { select: { batchAssignments: true } } },
  });
  if (!template) notFound();

  return (
    <AdminTemplateEditorClient
      template={{
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        version: template.version,
        assignedCount: template._count.batchAssignments,
        schema: normalizeJson<Record<string, unknown>>(template.schema, {}),
        signatoryRoles: normalizeJson<Array<{ role: string; label: string }>>(
          template.signatoryRoles,
          []
        ),
      }}
    />
  );
}
