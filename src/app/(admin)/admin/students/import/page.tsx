import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminStudentImportClient } from "@/components/admin/AdminStudentImportClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Import Students" };

export default async function AdminStudentImportPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");

  const batches = await prisma.batch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, institution: { select: { code: true } } },
  });

  return (
    <AdminStudentImportClient
      batches={batches.map((b) => ({ id: b.id, name: b.name, code: b.institution.code }))}
    />
  );
}
