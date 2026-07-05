import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageBatch } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AgreementEditorClient } from "@/components/admin/AgreementEditorClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Place Signatures" };

export default async function AgreementEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const agreement = await prisma.agreementTemplate.findUnique({
    where: { id: params.id },
    include: { batch: true, fields: { orderBy: { order: "asc" } } },
  });
  if (!agreement) notFound();

  const canManage = canManageBatch(session, agreement.batch);

  return (
    <AgreementEditorClient
      canManage={canManage}
      agreement={{
        id: agreement.id,
        name: agreement.name,
        batchId: agreement.batchId,
        originalPdfUrl: agreement.originalPdfUrl,
        pageCount: agreement.pageCount,
        isActive: agreement.isActive,
        fields: agreement.fields.map((f) => ({
          id: f.id,
          signerRole: f.signerRole,
          fieldType: f.fieldType,
          label: f.label,
          required: f.required,
          options: Array.isArray(f.options) ? (f.options as string[]) : [],
          defaultValue: f.defaultValue,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
        })),
      }}
    />
  );
}
