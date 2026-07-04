import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AdminManagementClient } from "@/components/admin/AdminManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Management" };

export default async function AdminManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") redirect("/admin/login");
  // Only super admins may manage admin accounts.
  if (!isSuperAdmin(session)) redirect("/admin/dashboard");

  const [admins, institutions] = await Promise.all([
    prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        institution: { select: { code: true } },
      },
    }),
    prisma.institution.findMany({ select: { id: true, code: true, name: true } }),
  ]);

  return (
    <AdminManagementClient
      currentAdminId={session.user.id}
      admins={admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        isActive: a.isActive,
        lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
        institutionCode: a.institution?.code ?? null,
      }))}
      institutions={institutions}
    />
  );
}
